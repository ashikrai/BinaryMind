/**
 * medium-proxy — Supabase Edge Function
 *
 * Acts as a server-side proxy for all Medium API v1 calls.
 * Runs in Deno on Supabase's edge, so there are no browser CORS restrictions.
 *
 * Request format (JSON body sent by the browser):
 *   {
 *     method:  "GET" | "POST",          // HTTP method for the Medium API call
 *     path:    "/me",                   // Medium API path, e.g. "/me" or "/users/:id/posts"
 *     token:   "<integration-token>",  // Medium self-issued integration token
 *     body?:   { ... }                 // Only for POST requests
 *   }
 *
 * The function forwards the request to https://api.medium.com/v1{path} with
 * the correct Authorization header and returns the Medium response as-is.
 *
 * For post imports we also support fetching arbitrary Medium post URLs:
 *   {
 *     method: "FETCH_URL",
 *     url:    "https://medium.com/@user/post-slug-abc123"
 *   }
 * Returns { html: "<raw page html>" }.
 *
 * Deploy:
 *   supabase functions deploy medium-proxy --no-verify-jwt
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const MEDIUM_API = "https://api.medium.com/v1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let payload: {
    method: string;
    path?: string;
    token?: string;
    body?: unknown;
    url?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { method, path, token, body, url } = payload;

  // -------------------------------------------------------------------------
  // FETCH_URL mode — fetch a public Medium post's HTML for import
  // -------------------------------------------------------------------------
  if (method === "FETCH_URL") {
    if (!url) {
      return new Response(JSON.stringify({ error: "url is required for FETCH_URL" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const res = await fetch(url, {
        headers: {
          // Mimic a browser UA so Medium doesn't serve a bot-detection page
          "User-Agent":
            "Mozilla/5.0 (compatible; BinaryMind-Importer/1.0; +https://binarymind.dev)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `Fetch failed: ${res.status} ${res.statusText}` }),
          { status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      const html = await res.text();
      return new Response(JSON.stringify({ html }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Medium API proxy mode — GET or POST to api.medium.com
  // -------------------------------------------------------------------------
  if (!token) {
    return new Response(JSON.stringify({ error: "token is required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!path) {
    return new Response(JSON.stringify({ error: "path is required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const targetUrl = `${MEDIUM_API}${path}`;

  const mediumHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  try {
    const mediumRes = await fetch(targetUrl, {
      method: method === "POST" ? "POST" : "GET",
      headers: mediumHeaders,
      ...(method === "POST" && body ? { body: JSON.stringify(body) } : {}),
    });

    const responseText = await mediumRes.text();

    return new Response(responseText, {
      status: mediumRes.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
