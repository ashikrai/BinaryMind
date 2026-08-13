import { useEffect, useRef, useState } from "react";
import type { Block } from "@/types";
import { cn } from "@/lib/utils";
import { InlineText } from "./inline";
import { getBlockStyle, styleToCss } from "./blockStyle";
import { Copy, Check } from "lucide-react";

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  return m ? m[1] : null;
}

function tweetId(url: string): string | null {
  const m = url.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/);
  return m ? m[1] : null;
}

function gistPath(url: string): string | null {
  const m = url.match(/gist\.github\.com\/([^/]+\/[a-f0-9]+)/i);
  return m ? m[1] : null;
}

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <article className="prose-mc mx-auto max-w-2xl">
      {blocks.map((b) => {
        const css = styleToCss(getBlockStyle(b));
        return (
          <div
            key={b.id}
            className={cn(
              css.hasBackground && "my-4 rounded-md p-6",
              css.fontOverride && "mc-font-override",
            )}
            style={css.container}
          >
            <div style={css.text}>
              <BlockNode block={b} />
            </div>
          </div>
        );

      })}
    </article>
  );
}

function BlockNode({ block }: { block: Block }) {
  switch (block.type) {
    case "title":
      return <h1 className="mb-2 font-serif text-4xl font-bold leading-tight md:text-5xl"><InlineText text={block.content} /></h1>;
    case "subtitle":
      return <p className="mb-8 font-serif text-xl text-muted-foreground"><InlineText text={block.content} /></p>;
    case "h1":
      return <h2 className="mt-8 font-serif text-3xl font-bold"><InlineText text={block.content} /></h2>;
    case "h2":
      return <h3 className="mt-6 font-serif text-2xl font-bold"><InlineText text={block.content} /></h3>;
    case "h3":
      return <h4 className="mt-4 font-serif text-xl font-semibold"><InlineText text={block.content} /></h4>;
    case "paragraph":
      return <p className="my-4 font-serif text-lg leading-relaxed"><InlineText text={block.content} /></p>;
    case "quote":
      return (
        <blockquote className="my-6 border-l-4 border-foreground/40 pl-4 font-serif text-xl italic">
          <InlineText text={block.content} />
        </blockquote>
      );
    case "divider":
      return <hr className="my-8 border-border" />;
    case "bullet":
      return (
        <ul className="my-4 list-disc pl-6 font-serif text-lg">
          {block.content.split("\n").filter(Boolean).map((line, i) => (
            <li key={i}><InlineText text={line} /></li>
          ))}
        </ul>
      );
    case "numbered":
      return (
        <ol className="my-4 list-decimal pl-6 font-serif text-lg">
          {block.content.split("\n").filter(Boolean).map((line, i) => (
            <li key={i}><InlineText text={line} /></li>
          ))}
        </ol>
      );
    case "checklist":
      return (
        <ul className="my-4 list-none pl-0 font-serif text-lg">
          {block.content.split("\n").filter(Boolean).map((line, i) => {
            const checked = line.startsWith("[x] ") || line.startsWith("[X] ");
            const text = checked ? line.slice(4) : line.startsWith("[ ] ") ? line.slice(4) : line;
            return (
              <li key={i} className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={checked} readOnly />
                <span className={cn(checked && "text-muted-foreground line-through")}>
                  <InlineText text={text} />
                </span>
              </li>
            );
          })}
        </ul>
      );
    case "image": {
      if (!block.content) return null;
      const alt = (block.meta?.alt as string) ?? "";
      const caption = (block.meta?.caption as string) ?? "";
      return (
        <figure className="my-8">
          <img src={block.content} alt={alt} className="w-full rounded-md" loading="lazy" />
          {caption && (
            <figcaption className="mt-2 text-center font-serif text-sm italic text-muted-foreground">
              {caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "code":
      return (
        <CodeBlock
          content={block.content}
          language={(block.meta?.language as string) ?? ""}
        />
      );
    case "youtube": {
      const id = youtubeId(block.content);
      if (!id) return null;
      return (
        <div className="my-6 aspect-video w-full overflow-hidden rounded-md">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${id}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    case "tweet": {
      const id = tweetId(block.content);
      if (!id) return null;
      return <TweetEmbed url={block.content} />;
    }
    case "gist": {
      const path = gistPath(block.content);
      if (!path) return null;
      return <GistEmbed path={path} />;
    }
    case "callout": {
      const variant = (block.meta?.variant as string) ?? "info";
      const styles: Record<string, string> = {
        info: "border-blue-500/60 bg-blue-500/10",
        success: "border-green-500/60 bg-green-500/10",
        warning: "border-yellow-500/60 bg-yellow-500/10",
        danger: "border-red-500/60 bg-red-500/10",
      };
      return (
        <div
          className={cn(
            "my-6 rounded-md border-l-4 p-4 font-serif text-base",
            styles[variant] ?? styles.info,
          )}
        >
          <InlineText text={block.content} />
        </div>
      );
    }
    case "table": {
      const rows = block.content.split("\n").map((r) => r.split("\t"));
      const hasHeader = Boolean(block.meta?.headers ?? true);
      if (!rows.length) return null;
      const [head, ...body] = hasHeader ? [rows[0], ...rows.slice(1)] : [null, ...rows];
      return (
        <div className="my-6 overflow-x-auto">
          <table className="w-full border-collapse font-serif text-base">
            {head && (
              <thead>
                <tr>
                  {head.map((c, i) => (
                    <th key={i} className="border-b-2 border-foreground/30 px-3 py-2 text-left font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((row, r) => (
                <tr key={r}>
                  {row.map((c, i) => (
                    <td key={i} className="border-b border-border px-3 py-2">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default:
      return <p className="my-4 font-serif text-lg">{block.content}</p>;
  }
}

// ---------------------------------------------------------------------------
// Code block — dark themed, language label, copy button
// ---------------------------------------------------------------------------
function CodeBlock({ content, language }: { content: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="my-6 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2">
        <span className="font-mono text-xs font-medium text-zinc-400">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code"}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          {copied
            ? <><Check className="h-3 w-3" />Copied</>
            : <><Copy className="h-3 w-3" />Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-zinc-100">
        <code>{content}</code>
      </pre>
    </div>
  );
}

/**
 * Lazy-load Twitter widgets.js the first time a tweet renders; re-parse when new
 * embeds mount so multiple tweets on a page all hydrate.
 */
function TweetEmbed({ url }: { url: string }) {
  const ref = useRef<HTMLQuoteElement>(null);
  useEffect(() => {
    const w = window as any;
    const load = () =>
      new Promise<void>((resolve) => {
        if (w.twttr?.widgets) return resolve();
        const existing = document.getElementById("twitter-wjs") as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener("load", () => resolve());
          return;
        }
        const s = document.createElement("script");
        s.id = "twitter-wjs";
        s.async = true;
        s.src = "https://platform.twitter.com/widgets.js";
        s.onload = () => resolve();
        document.body.appendChild(s);
      });
    load().then(() => {
      if (ref.current && w.twttr?.widgets) w.twttr.widgets.load(ref.current.parentElement);
    });
  }, [url]);
  return (
    <div className="my-6 flex justify-center">
      <blockquote ref={ref} className="twitter-tweet">
        <a href={url}>{url}</a>
      </blockquote>
    </div>
  );
}

/**
 * GitHub Gists ship as document.write() scripts, so we sandbox them in an iframe
 * via srcDoc — the same trick Medium uses to keep gists from mutating the host page.
 */
function GistEmbed({ path }: { path: string }) {
  const srcDoc = `<html><head><base target="_blank"><style>body{margin:0;font-family:system-ui}</style></head><body><script src="https://gist.github.com/${path}.js"></script></body></html>`;
  return (
    <iframe
      className="my-6 w-full rounded-md border"
      style={{ minHeight: 220 }}
      srcDoc={srcDoc}
      title={`GitHub Gist ${path}`}
      sandbox="allow-scripts"
      loading="lazy"
    />
  );
}
