/**
 * mediumStore.ts — Medium ↔ BinaryMind sync store.
 *
 * All Medium network calls go through /api/medium-proxy:
 *   dev/preview  → Vite middleware plugin in vite.config.ts
 *   production   → api/medium-proxy.js (Vercel serverless)
 */

import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { supabase } from "@/lib/supabase";
import { mediumHtmlToTiptapHtml, blocksToMediumHtml } from "./mediumConverter";
import type { Blog } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ---------------------------------------------------------------------------
// Proxy helpers
// ---------------------------------------------------------------------------

const PROXY_URL = "/api/medium-proxy";

async function proxyCall<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Proxy error ${res.status}`);
  return json as T;
}

/** GET https://api.medium.com/v1{path} */
async function mediumRpcGet<T>(path: string, token: string): Promise<T> {
  return proxyCall<T>({ method: "GET", path, token });
}

/** POST https://api.medium.com/v1{path} */
async function mediumRpcPost<T>(path: string, token: string, body: unknown): Promise<T> {
  return proxyCall<T>({ method: "POST", path, token, body });
}

/** Fetch and parse the Medium RSS feed for a username. */
async function fetchRssFeed(username: string): Promise<MediumRssPost[]> {
  const data = await proxyCall<{ posts: MediumRssPost[] }>({ method: "RSS_FEED", username });
  return data.posts ?? [];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediumUserInfo {
  id: string;
  username: string;
  name: string;
  url: string;
  imageUrl: string;
}

export interface MediumRssPost {
  title: string;
  url: string;
  pubDate: string;
  categories: string[];
  thumbnail: string;
  description: string;
  /** Full article HTML from content:encoded — used directly for import, no extra fetch needed. */
  contentHtml: string;
}

export interface ImportedPostRecord {
  id: string;           // BinaryMind blog id
  userId: string;
  mediumPostId: string;
  mediumUrl: string | null;
  pushStatus: "none" | "pending" | "pushed";
  importedAt: string;
}

interface MediumState {
  connected: boolean;
  mediumUser: MediumUserInfo | null;
  integrationToken: string | null;
  importedPosts: ImportedPostRecord[];
  loading: boolean;
  /** Posts fetched from the Medium RSS feed for the picker. */
  rssPosts: MediumRssPost[];
  rssLoading: boolean;
  /** URLs of posts that should be pre-selected in the picker (not yet imported). */
  rssAutoSelected: Set<string>;
  /** The blog created by the most recent importByUrl call — used for the toast link. */
  lastImportedBlog: { id: string; title: string; slug: string } | null;

  load: (userId: string) => Promise<void>;
  connect: (userId: string, token: string) => Promise<void>;
  disconnect: (userId: string) => Promise<void>;
  /** Fetch the RSS feed and store in rssPosts. */
  fetchRssPosts: () => Promise<void>;
  /** Import a Medium post (by URL) as a BinaryMind draft. Returns the created blog. */
  importByUrl: (
    url: string,
    userId: string,
    authorName: string,
    authorAvatar: string | undefined,
    rssMeta?: MediumRssPost,
  ) => Promise<Blog | null>;
  /** Push a BinaryMind blog to Medium as a draft. */
  pushToMedium: (blog: Blog) => Promise<void>;
  markPushStatus: (blogId: string, status: "none" | "pending" | "pushed") => Promise<void>;
  /** Delete an imported post from BinaryMind blogs + tracking table. */
  removeImported: (blogId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMedium = create<MediumState>((set, get) => ({
  connected: false,
  mediumUser: null,
  integrationToken: null,
  importedPosts: [],
  loading: false,
  rssPosts: [],
  rssLoading: false,
  rssAutoSelected: new Set<string>(),
  lastImportedBlog: null,

  // ── Load ──────────────────────────────────────────────────────────────────
  load: async (userId) => {
    set({ loading: true });
    try {
      const { data: userRow } = await db
        .from("users")
        .select("medium_user_id, medium_username, medium_name, medium_avatar_url, medium_token")
        .eq("id", userId)
        .single();

      const { data: importRows } = await db
        .from("medium_imported_posts")
        .select("*")
        .eq("user_id", userId)
        .order("imported_at", { ascending: false });

      if (userRow?.medium_token) {
        set({
          connected: true,
          integrationToken: userRow.medium_token,
          mediumUser: userRow.medium_user_id ? {
            id: userRow.medium_user_id,
            username: userRow.medium_username ?? "",
            name: userRow.medium_name ?? "",
            url: `https://medium.com/@${userRow.medium_username ?? ""}`,
            imageUrl: userRow.medium_avatar_url ?? "",
          } : null,
        });
      } else {
        set({ connected: false, integrationToken: null, mediumUser: null });
      }

      set({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        importedPosts: (importRows ?? []).map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          mediumPostId: r.medium_post_id,
          mediumUrl: r.medium_url ?? null,
          pushStatus: r.push_status,
          importedAt: r.imported_at,
        })),
        loading: false,
      });
    } catch (err) {
      console.error("[mediumStore] load error:", err);
      set({ loading: false });
    }
  },

  // ── Connect ───────────────────────────────────────────────────────────────
  connect: async (userId, token) => {
    set({ loading: true });
    try {
      const meResp = await mediumRpcGet<{ data: MediumUserInfo }>("/me", token);
      const mediumUser = meResp.data;

      await db.from("users").update({
        medium_user_id: mediumUser.id,
        medium_username: mediumUser.username,
        medium_name: mediumUser.name,
        medium_avatar_url: mediumUser.imageUrl,
        medium_token: token,
        medium_connected_at: new Date().toISOString(),
      }).eq("id", userId);

      set({ connected: true, integrationToken: token, mediumUser, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  // ── Disconnect ────────────────────────────────────────────────────────────
  disconnect: async (userId) => {
    await db.from("users").update({
      medium_user_id: null,
      medium_username: null,
      medium_name: null,
      medium_avatar_url: null,
      medium_token: null,
      medium_connected_at: null,
    }).eq("id", userId);
    set({ connected: false, integrationToken: null, mediumUser: null, rssPosts: [] });
  },

  // ── Fetch RSS posts ───────────────────────────────────────────────────────
  fetchRssPosts: async () => {
    const { mediumUser } = get();
    if (!mediumUser?.username) return;
    set({ rssLoading: true });
    try {
      const posts = await fetchRssFeed(mediumUser.username);
      // Auto-select all posts that haven't been imported yet so the user
      // only needs to deselect anything they don't want.
      // We return the new set via a dedicated field so the panel can
      // initialise its local state. We store it in the store as well.
      const importedUrls = new Set(get().importedPosts.map((p) => p.mediumUrl).filter(Boolean));
      const autoSelected = new Set(posts.filter((p) => !importedUrls.has(p.url)).map((p) => p.url));
      set({ rssPosts: posts, rssLoading: false, rssAutoSelected: autoSelected });
    } catch (err) {
      console.error("[mediumStore] fetchRssPosts error:", err);
      set({ rssLoading: false });
    }
  },

  // ── Import by URL ─────────────────────────────────────────────────────────
  importByUrl: async (url, userId, authorName, authorAvatar, rssMeta) => {
    // Stable post id from the URL tail (handles slugs like "title-abc123")
    
    const mediumPostId = url.replace(/[?#].*$/, "").split("/").filter(Boolean).pop() ?? url;
    
    if (get().importedPosts.find((p) => p.mediumUrl === url || p.mediumPostId === mediumPostId)) {
      throw new Error("This Medium post has already been imported.");
    }

    const title = rssMeta?.title ?? "Imported from Medium";

    const coverImage: string | undefined = rssMeta?.thumbnail || undefined;

    const tags: string[] = rssMeta?.categories ?? [];
    let tiptapHtml: string;

    if (rssMeta?.contentHtml) {
      // RSS gives us the full article HTML — convert it directly to TipTap HTML.
      tiptapHtml = mediumHtmlToTiptapHtml(rssMeta.contentHtml);
    } else {
      // Fallback: should not normally be reached for RSS-sourced imports.
      tiptapHtml = `<h1>${title}</h1><p>Imported from <a href="${url}">${url}</a> — please update the content manually.</p>`;
    }

    // Prepend the title as an <h1> if the content doesn't already start with one
    if (!tiptapHtml.trimStart().startsWith("<h1>")) {
      tiptapHtml = `<h1>${title}</h1>\n${tiptapHtml}`;
    }

    // Store as a single html block — this feeds directly into NotionEditor's `initial` prop
    const blocks = [{ id: uuid(), type: "html" as const, content: tiptapHtml }];

    const { useBlogs } = await import("@/features/blogs/blogStore");
    const blog = await useBlogs.getState().create(userId, authorName, authorAvatar, {
      title,
      coverImage,
      tags,
      blocks,
      status: "draft",
      description: `Imported from Medium: ${url}`,
    });

    await db.from("medium_imported_posts").insert({
      id: blog.id,
      user_id: userId,
      medium_post_id: mediumPostId,
      medium_url: url,
      push_status: "none",
      imported_at: new Date().toISOString(),
    });

    set((s) => ({
      importedPosts: [
        { id: blog.id, userId, mediumPostId, mediumUrl: url, pushStatus: "none", importedAt: new Date().toISOString() },
        ...s.importedPosts,
      ],
      lastImportedBlog: { id: blog.id, title: blog.title, slug: blog.slug },
    }));
    return blog;
  },

  // ── Push to Medium ────────────────────────────────────────────────────────
  pushToMedium: async (blog) => {
    const { integrationToken, mediumUser } = get();
    if (!integrationToken || !mediumUser) throw new Error("Medium account not connected.");

    await mediumRpcPost(`/users/${mediumUser.id}/posts`, integrationToken, {
      title: blog.title,
      contentFormat: "html",
      content: blocksToMediumHtml(blog.blocks),
      tags: blog.tags.slice(0, 5),
      canonicalUrl: blog.seo?.canonical ?? undefined,
      publishStatus: "draft",
    });

    await get().markPushStatus(blog.id, "pushed");
  },

  // ── Mark push status ──────────────────────────────────────────────────────
  markPushStatus: async (blogId, status) => {
    await db.from("medium_imported_posts").update({ push_status: status }).eq("id", blogId);
    set((s) => ({
      importedPosts: s.importedPosts.map((p) => p.id === blogId ? { ...p, pushStatus: status } : p),
    }));
  },

  // ── Remove imported post ──────────────────────────────────────────────────
  removeImported: async (blogId) => {
    // Delete from tracking table first (FK → no cascade issue with blogs)
    await db.from("medium_imported_posts").delete().eq("id", blogId);
    // Delete the blog row itself
    await db.from("blogs").delete().eq("id", blogId);
    // Remove from both local store slices
    const { useBlogs } = await import("@/features/blogs/blogStore");
    useBlogs.setState((s) => ({ blogs: s.blogs.filter((b) => b.id !== blogId) }));
    set((s) => ({
      importedPosts: s.importedPosts.filter((p) => p.id !== blogId),
    }));
  },
}));

