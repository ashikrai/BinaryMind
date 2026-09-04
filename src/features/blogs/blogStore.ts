import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { supabase } from "@/lib/supabase";
import type { Blog, Block, BlogStatus, Collaborator } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function textOfBlocks(blocks: Block[]) {
  return blocks
    .map((b) => {
      // Strip HTML tags for HTML blocks (Tiptap output)
      if (b.type === "html") {
        return b.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
      }
      return b.content;
    })
    .join(" ");
}

function computeStats(blocks: Block[]) {
  const text = textOfBlocks(blocks);
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.round(wordCount / 200));
  return { wordCount, readingTime };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBlog(row: any, collaborators?: Collaborator[]): Blog {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name || "Unknown author",
    authorAvatar: row.author_avatar ?? undefined,
    title: row.title,
    slug: row.slug,
    description: row.description ?? "",
    coverImage: row.cover_image ?? undefined,
    tags: row.tags ?? [],
    categories: row.categories ?? [],
    blocks: row.blocks ?? [],
    status: row.status as BlogStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
    collaborators: collaborators ?? [],
    seo: row.seo ?? {},
    stats: {
      views: row.views ?? 0,
      likes: row.likes ?? 0,
      shares: row.shares ?? 0,
      readingTime: row.reading_time ?? 1,
      wordCount: row.word_count ?? 0,
    },
  };
}

// Short alias so every .from() call doesn't need a cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ---------------------------------------------------------------------------
// Store types
// ---------------------------------------------------------------------------

interface BlogsState {
  blogs: Blog[];
  loading: boolean;
  /** IDs of blogs liked by the currently logged-in user. */
  likedBlogIds: Set<string>;
  /** Fetches all published blogs plus the given user's own blogs of any status. */
  fetchBlogs: (userId?: string) => Promise<void>;
  /** Fetches the set of blog IDs liked by a given user. */
  fetchLikedBlogs: (userId: string) => Promise<void>;
  create: (
    authorId: string,
    authorName: string,
    authorAvatar: string | undefined,
    seed?: Partial<Blog>
  ) => Promise<Blog>;
  update: (id: string, patch: Partial<Blog>) => Promise<void>;
  updateBlocks: (id: string, blocks: Block[]) => Promise<void>;
  setStatus: (id: string, status: BlogStatus) => Promise<void>;
  duplicate: (id: string) => Promise<Blog | null>;
  remove: (id: string) => Promise<void>;
  incrementView: (id: string) => Promise<void>;
  /** Toggle like for an authenticated user. Returns the new like count. */
  toggleLike: (blogId: string, userId: string) => Promise<void>;
  /** Replace the collaborator list for a blog (owner only). */
  setCollaborators: (blogId: string, emails: string[]) => Promise<void>;
  bySlug: (slug: string) => Blog | undefined;
  byAuthor: (authorId: string) => Blog[];
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useBlogs = create<BlogsState>((set, get) => ({
  blogs: [],
  loading: false,
  likedBlogIds: new Set<string>(),

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------
  fetchBlogs: async (userId) => {
    set({ loading: true });
    try {
      // Always load all published blogs (public feed).
      const { data: published, error: pubErr } = await db
        .from("blogs")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (pubErr) throw pubErr;

      let own: unknown[] = [];
      let collaborated: unknown[] = [];
      if (userId) {
        // Load ALL of the current user's non-published blogs (drafts, archived).
        const { data, error } = await db
          .from("blogs")
          .select("*")
          .eq("author_id", userId)
          .neq("status", "published");
        if (error) throw error;
        own = data ?? [];

        // Load blogs where the user is a collaborator (any status).
        const { data: collabRows, error: collabErr } = await db
          .from("blog_collaborators")
          .select("blog_id")
          .eq("user_id", userId);
        if (!collabErr && collabRows?.length) {
          const ids = collabRows.map((r: any) => r.blog_id as string); // eslint-disable-line @typescript-eslint/no-explicit-any
          const { data: collabBlogs } = await db
            .from("blogs")
            .select("*")
            .in("id", ids);
          collaborated = collabBlogs ?? [];
        }
      }

      // Merge, deduplicate (user may have published posts already in the list).
      const allRows = [...(published ?? []), ...own, ...collaborated];
      const seen = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unique = allRows.filter((r: any) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      // Fetch collaborators for all blogs that have them.
      const allIds = unique.map((r: any) => (r as any).id as string); // eslint-disable-line @typescript-eslint/no-explicit-any
      let collabMap: Record<string, Collaborator[]> = {};
      if (allIds.length) {
        const { data: collabData } = await db
          .from("blog_collaborators")
          .select("blog_id, user_id, users(name, email, avatar)")
          .in("blog_id", allIds);
        if (collabData) {
          for (const row of collabData as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (!collabMap[row.blog_id]) collabMap[row.blog_id] = [];
            collabMap[row.blog_id].push({
              userId: row.user_id,
              name: row.users?.name ?? "",
              email: row.users?.email ?? "",
              avatar: row.users?.avatar ?? undefined,
            });
          }
        }
      }

      set({
        blogs: unique.map((r: any) => rowToBlog(r, collabMap[r.id] ?? [])), // eslint-disable-line @typescript-eslint/no-explicit-any
        loading: false,
      });
    } catch (err) {
      console.error("[blogStore] fetchBlogs error:", err);
      set({ loading: false });
    }
  },

  // -------------------------------------------------------------------------
  // Fetch liked blog IDs for the current user
  // -------------------------------------------------------------------------
  fetchLikedBlogs: async (userId: string) => {
    const { data, error } = await db
      .from("blog_likes")
      .select("blog_id")
      .eq("user_id", userId);
    if (error) {
      console.error("[blogStore] fetchLikedBlogs error:", error);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set({ likedBlogIds: new Set((data ?? []).map((r: any) => r.blog_id as string)) });
  },

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------
  create: async (authorId, authorName, authorAvatar, seed) => {
    const now = new Date().toISOString();
    const title = seed?.title ?? "Share your story!";
    const blog: Blog = {
      id: uuid(),
      authorId,
      authorName,
      authorAvatar,
      title,
      slug: `${slugify(title) || "untitled"}-${Math.random().toString(36).slice(2, 6)}`,
      description: "",
      tags: [],
      categories: [],
      blocks: seed?.blocks ?? [
        { id: uuid(), type: "title", content: title },
        { id: uuid(), type: "paragraph", content: "" },
      ],
      status: "draft",
      createdAt: now,
      updatedAt: now,
      seo: {},
      stats: { views: 0, likes: 0, shares: 0, readingTime: 1, wordCount: 0 },
      ...seed,
    };

    // Optimistic update first so the editor opens instantly.
    set({ blogs: [blog, ...get().blogs] });

    const { error } = await db.from("blogs").insert({
      id: blog.id,
      author_id: blog.authorId,
      author_name: blog.authorName,
      author_avatar: blog.authorAvatar ?? null,
      title: blog.title,
      slug: blog.slug,
      description: blog.description,
      cover_image: blog.coverImage ?? null,
      tags: blog.tags,
      categories: blog.categories,
      blocks: blog.blocks,
      status: blog.status,
      created_at: blog.createdAt,
      updated_at: blog.updatedAt,
      published_at: blog.publishedAt ?? null,
      seo: blog.seo,
      views: 0,
      likes: 0,
      shares: 0,
      reading_time: 1,
      word_count: 0,
    });

    if (error) {
      // Roll back on failure.
      set({ blogs: get().blogs.filter((b) => b.id !== blog.id) });
      console.error("[blogStore] create error:", error);
      throw error;
    }

    return blog;
  },

  // -------------------------------------------------------------------------
  // Update metadata
  // -------------------------------------------------------------------------
  update: async (id, patch) => {
    const now = new Date().toISOString();
    set({
      blogs: get().blogs.map((b) =>
        b.id === id ? { ...b, ...patch, updatedAt: now } : b
      ),
    });

    const { error } = await db
      .from("blogs")
      .update({
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.slug !== undefined && { slug: patch.slug }),
        ...(patch.coverImage !== undefined && { cover_image: patch.coverImage ?? null }),
        ...(patch.tags !== undefined && { tags: patch.tags }),
        ...(patch.categories !== undefined && { categories: patch.categories }),
        ...(patch.seo !== undefined && { seo: patch.seo }),
        updated_at: now,
      })
      .eq("id", id);

    if (error) console.error("[blogStore] update error:", error);
  },

  // -------------------------------------------------------------------------
  // Update blocks
  // -------------------------------------------------------------------------
  updateBlocks: async (id, blocks) => {
    const stats = computeStats(blocks);
    const now = new Date().toISOString();
    // Support both legacy block-based title and Tiptap HTML title (first <h1>)
    let newTitle = blocks.find((x) => x.type === "title")?.content;
    if (!newTitle) {
      const htmlBlock = blocks.find((x) => x.type === "html");
      if (htmlBlock) {
        const m = htmlBlock.content.match(/<h1[^>]*>(.*?)<\/h1>/i);
        if (m) newTitle = m[1].replace(/<[^>]*>/g, "").trim();
      }
    }

    // Recompute slug only when the title has changed AND the existing slug is
    // still the auto-generated "untitled-*" placeholder (never re-slug a blog
    // that has been published with a real slug).
    const existing = get().blogs.find((b) => b.id === id);
    let newSlug: string | undefined;
    if (
      newTitle &&
      existing &&
      newTitle !== existing.title &&
      /^untitled-/.test(existing.slug)
    ) {
      const base = slugify(newTitle).slice(0, 50) || "untitled";
      const suffix = Math.random().toString(36).slice(2, 6);
      newSlug = `${base}-${suffix}`;
    }

    set({
      blogs: get().blogs.map((b) =>
        b.id === id
          ? {
              ...b,
              blocks,
              updatedAt: now,
              stats: { ...b.stats, ...stats },
              title: newTitle || b.title,
              ...(newSlug ? { slug: newSlug } : {}),
            }
          : b
      ),
    });

    const { error } = await db
      .from("blogs")
      .update({
        blocks,
        updated_at: now,
        reading_time: stats.readingTime,
        word_count: stats.wordCount,
        ...(newTitle ? { title: newTitle } : {}),
        ...(newSlug ? { slug: newSlug } : {}),
      })
      .eq("id", id);

    if (error) console.error("[blogStore] updateBlocks error:", error);
  },

  // -------------------------------------------------------------------------
  // Set status (draft / published / archived / deleted)
  // -------------------------------------------------------------------------
  setStatus: async (id, status) => {
    const now = new Date().toISOString();
    set({
      blogs: get().blogs.map((b) =>
        b.id === id
          ? {
              ...b,
              status,
              publishedAt: status === "published" ? now : b.publishedAt,
              updatedAt: now,
            }
          : b
      ),
    });

    const { error } = await db
      .from("blogs")
      .update({
        status,
        ...(status === "published" && { published_at: now }),
        updated_at: now,
      })
      .eq("id", id);

    if (error) console.error("[blogStore] setStatus error:", error);
  },

  // -------------------------------------------------------------------------
  // Duplicate
  // -------------------------------------------------------------------------
  duplicate: async (id) => {
    const src = get().blogs.find((b) => b.id === id);
    if (!src) return null;
    return get().create(src.authorId, src.authorName, src.authorAvatar, {
      title: `${src.title} (copy)`,
      blocks: src.blocks.map((bl) => ({ ...bl, id: uuid() })),
      tags: src.tags,
      categories: src.categories,
      description: src.description,
      coverImage: src.coverImage,
    });
  },

  // -------------------------------------------------------------------------
  // Remove
  // -------------------------------------------------------------------------
  remove: async (id) => {
    set({ blogs: get().blogs.filter((b) => b.id !== id) });
    const { error } = await db.from("blogs").delete().eq("id", id);
    if (error) console.error("[blogStore] remove error:", error);
  },

  // -------------------------------------------------------------------------
  // Increment view (fire-and-forget via RPC)
  // -------------------------------------------------------------------------
  incrementView: async (id) => {
    set({
      blogs: get().blogs.map((b) =>
        b.id === id ? { ...b, stats: { ...b.stats, views: b.stats.views + 1 } } : b
      ),
    });
    await db.rpc("increment_blog_views", { blog_id: id });
  },

  // -------------------------------------------------------------------------
  // Toggle like — uses blog_likes join table so each user can only like once.
  // The RPC returns the authoritative like count after the operation.
  // -------------------------------------------------------------------------
  toggleLike: async (blogId, userId) => {
    const already = get().likedBlogIds.has(blogId);

    // Optimistic UI update.
    const delta = already ? -1 : 1;
    set({
      blogs: get().blogs.map((b) =>
        b.id === blogId
          ? { ...b, stats: { ...b.stats, likes: Math.max(0, b.stats.likes + delta) } }
          : b
      ),
      likedBlogIds: (() => {
        const next = new Set(get().likedBlogIds);
        already ? next.delete(blogId) : next.add(blogId);
        return next;
      })(),
    });

    // Persist to DB and reconcile with the authoritative count.
    const rpc = already ? "remove_blog_like" : "add_blog_like";
    const { data: newCount, error } = await db.rpc(rpc, {
      p_blog_id: blogId,
      p_user_id: userId,
    });

    if (error) {
      console.error("[blogStore] toggleLike error:", error);
      // Roll back optimistic update.
      set({
        blogs: get().blogs.map((b) =>
          b.id === blogId
            ? { ...b, stats: { ...b.stats, likes: Math.max(0, b.stats.likes - delta) } }
            : b
        ),
        likedBlogIds: (() => {
          const prev = new Set(get().likedBlogIds);
          already ? prev.add(blogId) : prev.delete(blogId);
          return prev;
        })(),
      });
      return;
    }

    // Sync authoritative count if the RPC returned it.
    if (typeof newCount === "number") {
      set({
        blogs: get().blogs.map((b) =>
          b.id === blogId ? { ...b, stats: { ...b.stats, likes: newCount } } : b
        ),
      });
    }
  },

  // -------------------------------------------------------------------------
  // Set collaborators (owner replaces the entire list by email)
  // -------------------------------------------------------------------------
  setCollaborators: async (blogId, emails) => {
    // 1. Resolve emails → user IDs.
    const uniqueEmails = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (!uniqueEmails.length) {
      // Clear all collaborators.
      await db.from("blog_collaborators").delete().eq("blog_id", blogId);
      set({
        blogs: get().blogs.map((b) =>
          b.id === blogId ? { ...b, collaborators: [] } : b
        ),
      });
      return;
    }

    const { data: users, error: usersErr } = await db
      .from("users")
      .select("id, name, email, avatar")
      .in("email", uniqueEmails);

    if (usersErr) {
      console.error("[blogStore] setCollaborators lookup error:", usersErr);
      return;
    }

    const found = (users ?? []) as { id: string; name: string; email: string; avatar: string | null }[];

    // 2. Replace all rows for this blog.
    await db.from("blog_collaborators").delete().eq("blog_id", blogId);
    if (found.length) {
      await db.from("blog_collaborators").insert(
        found.map((u) => ({ blog_id: blogId, user_id: u.id }))
      );
    }

    // 3. Update local state.
    const collaborators: Collaborator[] = found.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar ?? undefined,
    }));
    set({
      blogs: get().blogs.map((b) =>
        b.id === blogId ? { ...b, collaborators } : b
      ),
    });
  },

  // -------------------------------------------------------------------------
  // Synchronous selectors (unchanged API)
  // -------------------------------------------------------------------------
  bySlug: (slug) => get().blogs.find((b) => b.slug === slug),
  byAuthor: (authorId) => get().blogs.filter((b) => b.authorId === authorId),
}));
