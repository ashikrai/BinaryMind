/**
 * mediumConverter.ts
 *
 * Converts between Medium's HTML-based post content and the TipTap editor's
 * HTML format used by BinaryMind.
 *
 * Medium posts come back from the RSS feed as rendered HTML
 * (content:encoded).  We parse that HTML with DOMParser and emit a clean
 * HTML string that TipTap understands — keeping real HTML tags so inline
 * formatting (bold, italic, links, code) is preserved faithfully.
 *
 * When pushing to Medium we do the inverse: read the stored HTML block and
 * POST it directly to the Medium v1 API with contentFormat "html".
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

/** Strip all HTML tags from a string — used for plain-text extraction. */
function stripHtml(html: string): string {
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

/**
 * Keep only the inline HTML tags that TipTap understands, stripping everything
 * else.  Block-level tags (div, span wrappers, etc.) are removed; semantic
 * inline tags are kept.
 */
function sanitizeInline(html: string): string {
  // Normalise bold/italic shorthands
  let out = html
    .replace(/<b(\s[^>]*)?>([^<]*)<\/b>/gi, "<strong>$2</strong>")
    .replace(/<i(\s[^>]*)?>([^<]*)<\/i>/gi, "<em>$2</em>")
    .replace(/<br\s*\/?>/gi, " ");

  // Strip every tag except the ones TipTap inline marks support
  out = out.replace(/<\/?(?!strong|em|u|s|code|a|mark)[a-z][^>]*>/gi, "");

  // Decode common HTML entities
  out = out
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return out.trim();
}

// ---------------------------------------------------------------------------
// Medium HTML → TipTap-compatible HTML string
// ---------------------------------------------------------------------------

/**
 * Convert the HTML string from a Medium RSS `content:encoded` field into a
 * clean HTML string that the TipTap / NotionEditor understands.
 *
 * Supported Medium elements:
 *   h1 / h2 / h3 / h4    → <h1> / <h2> / <h3>
 *   p                     → <p> (with inline formatting preserved)
 *   blockquote            → <blockquote>
 *   pre > code            → <pre><code class="language-*">
 *   ul > li               → <ul><li>
 *   ol > li               → <ol><li>
 *   figure > img          → <img src="…"> (image link only, no upload)
 *   figure > iframe       → <p><a href="…"> for embeds
 *   hr                    → <hr>
 *
 * The result is stored as a single `{ type: "html", content }` block so it
 * feeds directly into the NotionEditor `initial` prop without any lossy
 * round-trip through the legacy Block[] intermediate format.
 */
export function mediumHtmlToTiptapHtml(html: string): string {
  if (!html?.trim()) return "";

  // In SSR / test environments without DOMParser fall back to a regex pass.
  if (typeof DOMParser === "undefined") return mediumHtmlToTiptapHtmlRegex(html);

  const doc = new DOMParser().parseFromString(html, "text/html");
  const parts: string[] = [];

  for (const child of Array.from(doc.body.children)) {
    const tag = child.tagName.toLowerCase();
    const classList = child.classList;
    const innerHtml = child.innerHTML;

    // ── Headings ────────────────────────────────────────────────────────────
    if (tag === "h1") {
      parts.push(`<h1>${sanitizeInline(innerHtml)}</h1>`);
      continue;
    }
    if (tag === "h2") {
      parts.push(`<h2>${sanitizeInline(innerHtml)}</h2>`);
      continue;
    }
    if (tag === "h3" || tag === "h4") {
      parts.push(`<h3>${sanitizeInline(innerHtml)}</h3>`);
      continue;
    }

    // ── Divider ─────────────────────────────────────────────────────────────
    if (tag === "hr") {
      parts.push("<hr />");
      continue;
    }

    // ── Code block ──────────────────────────────────────────────────────────
    if (tag === "pre") {
      const codeEl = child.querySelector("code");
      const lang = codeEl?.className.replace(/.*language-(\S+).*/, "$1") ?? "";
      const codeText = (codeEl ? codeEl.textContent : child.textContent) ?? "";
      const langAttr = lang ? ` class="language-${lang}"` : "";
      parts.push(`<pre><code${langAttr}>${escHtml(codeText)}</code></pre>`);
      continue;
    }

    // ── Blockquote ──────────────────────────────────────────────────────────
    if (tag === "blockquote") {
      // Flatten nested <p> tags inside blockquote for TipTap compatibility
      const inner = sanitizeInline(child.querySelector("p")?.innerHTML ?? innerHtml);
      parts.push(`<blockquote><p>${inner}</p></blockquote>`);
      continue;
    }

    // ── Lists ────────────────────────────────────────────────────────────────
    if (tag === "ul") {
      const items = Array.from(child.querySelectorAll("li"))
        .map((li) => `<li><p>${sanitizeInline(li.innerHTML)}</p></li>`)
        .join("");
      if (items) parts.push(`<ul>${items}</ul>`);
      continue;
    }
    if (tag === "ol") {
      const items = Array.from(child.querySelectorAll("li"))
        .map((li) => `<li><p>${sanitizeInline(li.innerHTML)}</p></li>`)
        .join("");
      if (items) parts.push(`<ol>${items}</ol>`);
      continue;
    }

    // ── Figure (image / embed) ───────────────────────────────────────────────
    if (tag === "figure") {
      const img = child.querySelector("img");
      const iframe = child.querySelector("iframe");

      if (iframe) {
        const src = iframe.getAttribute("src") ?? "";
        const embedHtml = embedToHtml(src);
        if (embedHtml) { parts.push(embedHtml); continue; }
      }

      if (img) {
        // Use data-src as fallback (Medium lazy-loads with data-src)
        const src = img.getAttribute("src") ?? img.getAttribute("data-src") ?? "";
        const alt = escAttr(img.getAttribute("alt") ?? "");
        if (src) parts.push(`<img src="${escAttr(src)}" alt="${alt}" />`);
        continue;
      }
      continue;
    }

    // ── Paragraph ────────────────────────────────────────────────────────────
    if (tag === "p") {
      const img = child.querySelector("img");
      const iframe = child.querySelector("iframe");

      if (iframe) {
        const src = iframe.getAttribute("src") ?? "";
        const embedHtml = embedToHtml(src);
        if (embedHtml) { parts.push(embedHtml); continue; }
      }

      // Lone image inside <p>
      if (img && child.children.length === 1) {
        const src = img.getAttribute("src") ?? img.getAttribute("data-src") ?? "";
        const alt = escAttr(img.getAttribute("alt") ?? "");
        if (src) parts.push(`<img src="${escAttr(src)}" alt="${alt}" />`);
        continue;
      }

      // Mixtape embed (external link preview) → plain link paragraph
      if (classList.contains("graf--mixtapeEmbed")) {
        const link = child.querySelector("a");
        const url = link?.getAttribute("href") ?? "";
        if (url) {
          parts.push(`<p><a href="${escAttr(url)}">${escHtml(url)}</a></p>`);
          continue;
        }
      }

      const text = sanitizeInline(innerHtml);
      if (text) parts.push(`<p>${text}</p>`);
      continue;
    }

    // ── Fallback: treat as paragraph ─────────────────────────────────────────
    const text = sanitizeInline(innerHtml);
    if (text) parts.push(`<p>${text}</p>`);
  }

  return parts.join("\n");
}

/** Escape a string for use inside an HTML attribute value. */
function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape a string for use as HTML text content. */
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Convert a known embed src URL (YouTube, Twitter/X, Gist) to a TipTap-
 * compatible HTML snippet.  Unknown URLs return null.
 */
function embedToHtml(src: string): string | null {
  if (!src) return null;
  if (/youtu\.?be/.test(src)) {
    return `<p><a href="${escAttr(src)}">${escHtml(src)}</a></p>`;
  }
  if (/twitter\.com|x\.com/.test(src)) {
    return `<p><a href="${escAttr(src)}">${escHtml(src)}</a></p>`;
  }
  if (/gist\.github\.com/.test(src)) {
    return `<p><a href="${escAttr(src)}">${escHtml(src)}</a></p>`;
  }
  return null;
}

/** Regex-based fallback for environments without DOMParser (e.g. SSR / tests). */
function mediumHtmlToTiptapHtmlRegex(html: string): string {
  // Best-effort: strip Medium wrapper divs and return the cleaned HTML directly.
  return html
    .replace(/<\/?(div|section|article|figure|figcaption)[^>]*>/gi, "")
    .replace(/<h4([^>]*)>/gi, "<h3$1>")
    .replace(/<\/h4>/gi, "</h3>")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Legacy Block[] helpers (kept for the blocksToMediumHtml push path)
// ---------------------------------------------------------------------------

/** Preserve basic inline markup as BinaryMind inline markers (legacy, push-only). */
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
// Medium HTML → BinaryMind Block[] (legacy — kept for backwards compatibility)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `mediumHtmlToTiptapHtml` instead.  This function produces
 * the old Block[] intermediate format which loses inline formatting when
 * serialised back to HTML via blocksToHtml in EditBlog.
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

    // --- Paragraph ---
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

      if (classList.contains("graf--mixtapeEmbed")) {
        const link = child.querySelector("a");
        const url = link?.getAttribute("href") ?? "";
        if (url) { blocks.push(makeBlock("bookmark", url)); continue; }
      }

      const inline = htmlToInline(innerHtml);
      if (inline) blocks.push(makeBlock("paragraph", inline));
      continue;
    }

    // --- Fallback ---
    const text = htmlToInline(innerHtml);
    if (text) blocks.push(makeBlock("paragraph", text));
  }

  return blocks;
}

/** Regex-based fallback for environments without DOMParser (e.g. tests). */
function parseMediumHtmlRegex(html: string): Block[] {
  const blocks: Block[] = [];
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

/** Recognise embed URLs (YouTube, Twitter/X, Gist) and return the matching Block. */
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
