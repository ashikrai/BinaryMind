/**
 * mediumConverter.ts
 *
 * Converts between Medium's HTML-based post content and BinaryMind's
 * Block[] format — both ways.
 *
 * Medium posts come back from the Medium API as rendered HTML
 * (the `content.html` field).  We parse that HTML with DOMParser and
 * walk the element tree, emitting typed Block objects.
 *
 * When pushing to Medium we do the inverse: serialize Block[] → HTML string
 * and use the Medium REST API to create a post with contentFormat "html".
 */

import { v4 as uuid } from "uuid";
import type { Block, BlockType } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(tag: string, attrs: Record<string, string>, innerHTML: string): string {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");
  return `<${tag}${attrStr}>${innerHTML}</${tag}>`;
}

/** Strip all HTML tags from a string — used for block.content in text blocks. */
function stripHtml(html: string): string {
  // Preserve line breaks before stripping
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** Preserve basic inline markup as BinaryMind inline markers. */
function htmlToInline(html: string): string {
  return html
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em>(.*?)<\/em>/gi, "_$1_")
    .replace(/<i>(.*?)<\/i>/gi, "_$1_")
    .replace(/<code>(.*?)<\/code>/gi, "`$1`")
    .replace(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/** Convert BinaryMind inline markers back to HTML for Medium. */
function inlineToHtml(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, "<br>");
}

function makeBlock(type: BlockType, content: string, meta?: Record<string, unknown>): Block {
  return { id: uuid(), type, content, ...(meta ? { meta } : {}) };
}

// ---------------------------------------------------------------------------
// Medium HTML → BinaryMind Block[]
// ---------------------------------------------------------------------------

/**
 * Parse the HTML string that Medium returns in `post.content.html` and
 * convert it to a BinaryMind Block array.
 *
 * Medium's HTML uses a small, well-known tag set:
 *   h1/h2/h3/h4  → headings
 *   p             → paragraph (may contain a lone <img> = image block)
 *   blockquote    → quote or pullquote
 *   pre > code    → code block
 *   ul > li       → bullet list
 *   ol > li       → numbered list
 *   figure        → image (with optional figcaption)
 *   hr            → divider
 *   iframe        → embed (YouTube / Twitter / Gist)
 *   .graf--mixtapeEmbed → bookmark card (external link preview)
 */
export function mediumHtmlToBlocks(html: string): Block[] {
  // SSR / Node fallback — parse with the browser's DOMParser when available.
  if (typeof DOMParser === "undefined") return parseMediumHtmlRegex(html);

  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: Block[] = [];
  const children = Array.from(doc.body.children);

  for (const child of children) {
    const tag = child.tagName.toLowerCase();
    const classList = child.classList;
    const innerHtml = child.innerHTML;
    const textContent = child.textContent ?? "";

    // --- Headings ---
    if (tag === "h1") {
      blocks.push(makeBlock("h1", htmlToInline(innerHtml)));
      continue;
    }
    if (tag === "h2") {
      blocks.push(makeBlock("h2", htmlToInline(innerHtml)));
      continue;
    }
    if (tag === "h3" || tag === "h4") {
      blocks.push(makeBlock("h3", htmlToInline(innerHtml)));
      continue;
    }

    // --- Divider ---
    if (tag === "hr") {
      blocks.push(makeBlock("divider", ""));
      continue;
    }

    // --- Code block ---
    if (tag === "pre") {
      const codeEl = child.querySelector("code");
      const language = codeEl?.className.replace(/language-/, "") ?? "";
      const codeText = codeEl ? codeEl.textContent ?? "" : textContent;
      blocks.push(makeBlock("code", codeText, { language }));
      continue;
    }

    // --- Blockquote ---
    if (tag === "blockquote") {
      // Medium uses .graf--pullquote for large pull-quotes
      const type: BlockType = classList.contains("graf--pullquote") ? "pullquote" : "quote";
      blocks.push(makeBlock(type, htmlToInline(innerHtml)));
      continue;
    }

    // --- Lists ---
    if (tag === "ul") {
      const items = Array.from(child.querySelectorAll("li"))
        .map((li) => htmlToInline(li.innerHTML))
        .join("\n");
      blocks.push(makeBlock("bullet", items));
      continue;
    }
    if (tag === "ol") {
      const items = Array.from(child.querySelectorAll("li"))
        .map((li) => htmlToInline(li.innerHTML))
        .join("\n");
      blocks.push(makeBlock("numbered", items));
      continue;
    }

    // --- Figure (image / embed) ---
    if (tag === "figure") {
      const img = child.querySelector("img");
      const iframe = child.querySelector("iframe");
      const caption = child.querySelector("figcaption")?.textContent?.trim() ?? "";

      if (iframe) {
        const src = iframe.getAttribute("src") ?? "";
        const block = embedUrlToBlock(src);
        if (block) { blocks.push(block); continue; }
      }

      if (img) {
        const src = img.getAttribute("src") ?? img.getAttribute("data-src") ?? "";
        const alt = img.getAttribute("alt") ?? "";
        blocks.push(makeBlock("image", src, { alt, caption }));
        continue;
      }
      continue;
    }

    // --- Paragraph (may contain lone img / iframe / embed link) ---
    if (tag === "p") {
      const img = child.querySelector("img");
      const iframe = child.querySelector("iframe");

      if (iframe) {
        const src = iframe.getAttribute("src") ?? "";
        const block = embedUrlToBlock(src);
        if (block) { blocks.push(block); continue; }
      }

      if (img && child.children.length === 1) {
        const src = img.getAttribute("src") ?? img.getAttribute("data-src") ?? "";
        const alt = img.getAttribute("alt") ?? "";
        blocks.push(makeBlock("image", src, { alt, caption: "" }));
        continue;
      }

      // Mixtape embed (external link preview) → bookmark block
      if (classList.contains("graf--mixtapeEmbed")) {
        const link = child.querySelector("a");
        const url = link?.getAttribute("href") ?? "";
        if (url) { blocks.push(makeBlock("bookmark", url)); continue; }
      }

      const inline = htmlToInline(innerHtml);
      if (inline) blocks.push(makeBlock("paragraph", inline));
      continue;
    }

    // --- Fallback: treat as paragraph ---
    const text = htmlToInline(innerHtml);
    if (text) blocks.push(makeBlock("paragraph", text));
  }

  return blocks;
}

/** Regex-based fallback for environments without DOMParser (e.g. tests). */
function parseMediumHtmlRegex(html: string): Block[] {
  const blocks: Block[] = [];
  // Very basic: split on block-level tags and convert each to a paragraph.
  const paragraphs = html
    .replace(/<\/?(div|section|article)[^>]*>/gi, "")
    .split(/(?=<(?:h[1-4]|p|blockquote|pre|ul|ol|figure|hr)[^>]*>)/i);

  for (const chunk of paragraphs) {
    const tag = chunk.match(/^<(h[1-4]|p|blockquote|pre|ul|ol|hr)/i)?.[1]?.toLowerCase();
    const text = htmlToInline(chunk);
    if (!text && tag !== "hr") continue;
    if (tag === "h1") blocks.push(makeBlock("h1", text));
    else if (tag === "h2") blocks.push(makeBlock("h2", text));
    else if (tag === "h3" || tag === "h4") blocks.push(makeBlock("h3", text));
    else if (tag === "blockquote") blocks.push(makeBlock("quote", text));
    else if (tag === "hr") blocks.push(makeBlock("divider", ""));
    else blocks.push(makeBlock("paragraph", text));
  }
  return blocks;
}

/** Recognise embed URLs (YouTube, Twitter/X, Gist) and return the matching block. */
function embedUrlToBlock(src: string): Block | null {
  if (/youtu\.?be/.test(src)) return makeBlock("youtube", src);
  if (/twitter\.com|x\.com/.test(src)) return makeBlock("tweet", src);
  if (/gist\.github\.com/.test(src)) return makeBlock("gist", src);
  return null;
}

// ---------------------------------------------------------------------------
// BinaryMind Block[] → Medium HTML
// ---------------------------------------------------------------------------

/**
 * Serialise a BinaryMind Block[] to the HTML string that the Medium v1 API
 * expects when `contentFormat` is "html".
 *
 * We keep collaborator-specific Medium features (Series, Member-only, etc.)
 * out of scope since those are account-level settings in Medium, not content.
 */
export function blocksToMediumHtml(blocks: Block[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "title":
        // Medium derives the title from the first h1 in the HTML.
        parts.push(el("h1", {}, inlineToHtml(block.content)));
        break;
      case "subtitle":
        parts.push(el("h2", {}, inlineToHtml(block.content)));
        break;
      case "h1":
        parts.push(el("h2", {}, inlineToHtml(block.content)));
        break;
      case "h2":
        parts.push(el("h3", {}, inlineToHtml(block.content)));
        break;
      case "h3":
        parts.push(el("h4", {}, inlineToHtml(block.content)));
        break;
      case "paragraph":
        parts.push(el("p", {}, inlineToHtml(block.content)));
        break;
      case "quote":
        parts.push(el("blockquote", {}, inlineToHtml(block.content)));
        break;
      case "pullquote":
        parts.push(el("blockquote", { class: "graf--pullquote" }, inlineToHtml(block.content)));
        break;
      case "divider":
        parts.push("<hr />");
        break;
      case "bullet": {
        const items = block.content
          .split("\n")
          .filter(Boolean)
          .map((line) => el("li", {}, inlineToHtml(line)))
          .join("");
        parts.push(el("ul", {}, items));
        break;
      }
      case "numbered": {
        const items = block.content
          .split("\n")
          .filter(Boolean)
          .map((line) => el("li", {}, inlineToHtml(line)))
          .join("");
        parts.push(el("ol", {}, items));
        break;
      }
      case "checklist": {
        // Medium doesn't have native checklists; render as a bulleted list.
        const items = block.content
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const checked = line.startsWith("[x] ") || line.startsWith("[X] ");
            const text = checked ? "✓ " + line.slice(4) : line.startsWith("[ ] ") ? line.slice(4) : line;
            return el("li", {}, inlineToHtml(text));
          })
          .join("");
        parts.push(el("ul", {}, items));
        break;
      }
      case "code": {
        const lang = (block.meta?.language as string) ?? "";
        const codeEl = el("code", lang ? { class: `language-${lang}` } : {}, block.content);
        parts.push(el("pre", {}, codeEl));
        break;
      }
      case "image": {
        if (!block.content) break;
        const alt = (block.meta?.alt as string) ?? "";
        const caption = (block.meta?.caption as string) ?? "";
        const imgEl = el("img", { src: block.content, alt }, "");
        const content = caption ? imgEl + el("figcaption", {}, caption) : imgEl;
        parts.push(el("figure", {}, content));
        break;
      }
      case "youtube":
        parts.push(
          el(
            "figure",
            {},
            el("iframe", { src: block.content, frameborder: "0", allowfullscreen: "true" }, ""),
          ),
        );
        break;
      case "tweet":
      case "gist":
        // Render as a hyperlink — Medium will auto-expand it.
        parts.push(el("p", {}, el("a", { href: block.content }, block.content)));
        break;
      case "bookmark":
        parts.push(el("p", {}, el("a", { href: block.content }, block.content)));
        break;
      case "callout":
        parts.push(el("blockquote", {}, inlineToHtml(block.content)));
        break;
      case "html":
        parts.push(block.content);
        break;
      case "iframe":
        parts.push(
          el("figure", {}, el("iframe", { src: block.content }, "")),
        );
        break;
      case "table": {
        // Medium doesn't support tables natively — render as code block.
        parts.push(el("pre", {}, el("code", {}, block.content)));
        break;
      }
      default:
        if (block.content) parts.push(el("p", {}, inlineToHtml(block.content)));
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers exported for tests / store
// ---------------------------------------------------------------------------

export { stripHtml };
