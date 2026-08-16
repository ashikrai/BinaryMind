/**
 * api/medium-proxy.js
 *
 * Serverless function for production (Vercel auto-detects api/ directory).
 * In development the identical logic runs as a Vite middleware in vite.config.ts.
 *
 * Supported operation types (JSON body):
 *   { method: "GET",       path, token }        → Medium REST API GET
 *   { method: "POST",      path, token, body }  → Medium REST API POST
 *   { method: "FETCH_URL", url }                → fetch raw HTML
 *   { method: "RSS_FEED",  username }           → parse Medium RSS feed
 */

const MEDIUM_API = "https://api.medium.com/v1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function parseRss(xml) {
  const items = [];
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
    const cats = [...chunk.matchAll(/<category><!\[CDATA\[([\s\S]*?)\]\]><\/category>/g)].map(c => c[1]);
    const thumbnail = chunk.match(/<media:thumbnail[^>]+url="([^"]+)"/)?.[1]
                    ?? chunk.match(/<media:content[^>]+url="([^"]+)"/)?.[1]
                    ?? "";
    const rawDesc = chunk.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ?? "";
    const description = rawDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    const contentHtml = chunk.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] ?? "";
    if (link) items.push({ title: title.trim(), url: link.trim(), pubDate, categories: cats, thumbnail, description, contentHtml });
  }
  return items;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { ...CORS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let payload;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    payload = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { ...CORS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const { method, path, token, body, url, username } = payload;

  try {
    if (method === "RSS_FEED") {
      const feedUrl = `https://medium.com/feed/@${username}`;
      const r = await fetch(feedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; BinaryMind/1.0)" },
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw new Error(`RSS feed returned HTTP ${r.status}`);
      const xml = await r.text();
      const posts = parseRss(xml);
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ posts }));
      return;
    }

    if (method === "FETCH_URL") {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; BinaryMind/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      const html = await r.text();
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ html }));
      return;
    }

    const targetUrl = `${MEDIUM_API}${path}`;
    const fetchOptions = {
      method: method === "POST" ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    };
    if (method === "POST" && body) fetchOptions.body = JSON.stringify(body);

    const r = await fetch(targetUrl, fetchOptions);
    const text = await r.text();
    res.writeHead(r.status, { ...CORS, "Content-Type": "application/json" });
    res.end(text);
  } catch (err) {
    res.writeHead(500, { ...CORS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(err) }));
  }
}
