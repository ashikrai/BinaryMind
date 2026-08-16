import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import type { Plugin, Connect } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

// ---------------------------------------------------------------------------
// Medium proxy middleware — handles /api/medium-proxy in dev and preview.
// Runs server-side in the Vite Node.js process so there are no CORS issues.
// In production the same logic lives in api/medium-proxy.js (Vercel/Netlify).
//
// Supported operation types (sent as JSON body):
//   { method: "GET",      path, token }          → Medium REST API GET
//   { method: "POST",     path, token, body }    → Medium REST API POST
//   { method: "FETCH_URL", url }                  → fetch raw HTML (import)
//   { method: "RSS_FEED",  username }             → fetch + parse RSS feed
// ---------------------------------------------------------------------------
const MEDIUM_API = "https://api.medium.com/v1";

/** Parse Medium RSS XML into a list of post items — pure string ops, no deps. */
function parseRss(xml: string): Array<{
  title: string;
  url: string;
  pubDate: string;
  categories: string[];
  thumbnail: string;
  description: string;
  contentHtml: string;   // full post HTML from content:encoded
}> {
  const items: ReturnType<typeof parseRss> = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const m of itemMatches) {
    const chunk = m[1];
    const title = chunk.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]
                ?? chunk.match(/<title>([\s\S]*?)<\/title>/)?.[1]
                ?? "";
    const link  = chunk.match(/<link>([\s\S]*?)<\/link>/)?.[1]
                ?? chunk.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]
                ?? "";
    const pubDate = chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
    const cats = [...chunk.matchAll(/<category><!\[CDATA\[([\s\S]*?)\]\]><\/category>/g)]
                   .map(c => c[1]);
    const thumbnail = chunk.match(/<media:thumbnail[^>]+url="([^"]+)"/)?.[1]
                    ?? chunk.match(/<media:content[^>]+url="([^"]+)"/)?.[1]
                    ?? "";
    // description — plain text excerpt (first <description> tag)
    const rawDesc = chunk.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ?? "";
    const description = rawDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    // content:encoded — full article HTML (present in Medium RSS)
    const contentHtml = chunk.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] ?? "";
    if (link) items.push({ title: title.trim(), url: link.trim(), pubDate, categories: cats, thumbnail, description, contentHtml });
  }
  return items;
}

function mediumProxyPlugin(): Plugin {
  function handler(
    req: IncomingMessage,
    res: ServerResponse,
    next: Connect.NextFunction,
  ) {
    if (req.url !== "/api/medium-proxy") return next();

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { ...cors, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", async () => {
      let payload: {
        method: string;
        path?: string;
        token?: string;
        body?: unknown;
        url?: string;
        username?: string;
      };

      try {
        payload = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        res.writeHead(400, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }

      const { method, path: apiPath, token, body, url, username } = payload;

      try {
        // ── RSS feed listing ─────────────────────────────────────────────────
        if (method === "RSS_FEED") {
          const feedUrl = `https://medium.com/feed/@${username}`;
          const r = await fetch(feedUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; BinaryMind/1.0)" },
            signal: AbortSignal.timeout(12000),
          });
          if (!r.ok) throw new Error(`RSS feed returned HTTP ${r.status}`);
          const xml = await r.text();
          const posts = parseRss(xml);
          res.writeHead(200, { ...cors, "Content-Type": "application/json" });
          res.end(JSON.stringify({ posts }));
          return;
        }

        // ── Fetch arbitrary URL (for single-URL import) ───────────────────────
        if (method === "FETCH_URL") {
          const r = await fetch(url!, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; BinaryMind/1.0)" },
            signal: AbortSignal.timeout(15000),
          });
          const html = await r.text();
          res.writeHead(200, { ...cors, "Content-Type": "application/json" });
          res.end(JSON.stringify({ html }));
          return;
        }

        // ── Medium REST API proxy ─────────────────────────────────────────────
        const targetUrl = `${MEDIUM_API}${apiPath}`;
        const init: RequestInit = {
          method: method === "POST" ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10000),
        };
        if (method === "POST" && body) init.body = JSON.stringify(body);

        const r = await fetch(targetUrl, init);
        const text = await r.text();
        res.writeHead(r.status, { ...cors, "Content-Type": "application/json" });
        res.end(text);
      } catch (err) {
        res.writeHead(500, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
  }

  return {
    name: "medium-proxy",
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}

export default defineConfig(() => ({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss(), tsconfigPaths(), mediumProxyPlugin()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
}));
