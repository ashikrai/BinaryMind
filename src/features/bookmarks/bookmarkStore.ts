import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { localStore } from "@/storage/localStore";
import { STORAGE_KEYS } from "@/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface BookmarksState {
  ids: string[];
  userId: string | null;
  /** Load bookmarks for the given user from Supabase. */
  fetchBookmarks: (userId: string) => Promise<void>;
  toggle: (blogId: string) => Promise<void>;
  has: (id: string) => boolean;
}

// Keep a local fallback for unauthenticated users (theme/bookmarks stay local).
const localIds = localStore.get<string[]>(STORAGE_KEYS.bookmarks) ?? [];

export const useBookmarks = create<BookmarksState>((set, get) => ({
  ids: localIds,
  userId: null,

  fetchBookmarks: async (userId) => {
    const { data, error } = await db
      .from("bookmarks")
      .select("blog_id")
      .eq("user_id", userId);

    if (error) {
      console.error("[bookmarkStore] fetchBookmarks error:", error);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = (data ?? []).map((r: any) => r.blog_id as string);
    set({ ids, userId });
  },

  toggle: async (blogId) => {
    const { ids, userId } = get();
    const already = ids.includes(blogId);
    const next = already ? ids.filter((x) => x !== blogId) : [...ids, blogId];
    set({ ids: next });

    if (!userId) {
      // Unauthenticated — persist locally only.
      localStore.set(STORAGE_KEYS.bookmarks, next);
      return;
    }

    if (already) {
      await db
        .from("bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("blog_id", blogId);
    } else {
      await db.from("bookmarks").insert({ user_id: userId, blog_id: blogId });
    }
  },

  has: (id) => get().ids.includes(id),
}));
