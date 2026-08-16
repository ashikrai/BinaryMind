import { create } from "zustand";
import { localStore } from "@/storage/localStore";
import { STORAGE_KEYS, GOOGLE_CLIENT_ID } from "@/constants";
import { supabase } from "@/lib/supabase";
import type { AuthSession, UserProfile } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface AuthState {
  session: AuthSession | null;
  loading: boolean;
  loginWithGoogleCredential: (jwt: string) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  /**
   * Switch the active avatar / display-name between Google and Medium.
   * Persists the preference to the users row (avatar_source column) and
   * updates the in-memory session immediately so all UI reacts.
   */
  setAvatarSource: (source: "google" | "medium") => Promise<void>;
}

interface GoogleJwtPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

function decodeJwt(token: string): GoogleJwtPayload | null {
  try {
    const payload = token.split(".")[1];
    const json = decodeURIComponent(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function persistSession(session: AuthSession | null) {
  if (session) localStore.set(STORAGE_KEYS.auth, session);
  else localStore.remove(STORAGE_KEYS.auth);
}

const restored = localStore.get<AuthSession>(STORAGE_KEYS.auth);

export const useAuth = create<AuthState>((set, get) => ({
  session: restored,
  loading: false,

  loginWithGoogleCredential: async (jwt) => {
    const payload = decodeJwt(jwt);
    if (!payload) return;

    const user: UserProfile = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      avatar: payload.picture,
      joinedAt: new Date().toISOString(),
    };
    const session: AuthSession = { user, token: jwt, issuedAt: new Date().toISOString() };
    persistSession(session);
    set({ session });

    // First, try to insert the user row (first-time login).
    // On conflict (returning user), only update email + avatar — never overwrite
    // a custom name the user may have set in their profile.
    const { error: upsertErr } = await db.from("users").upsert(
      {
        id: user.id,
        email: user.email,
        name: user.name,       // used only on INSERT (first login)
        avatar: user.avatar ?? null,
        joined_at: user.joinedAt,
      },
      {
        onConflict: "id",
        ignoreDuplicates: false,
        // Only update these columns on conflict — never name/bio/social.
        // Supabase JS v2 exposes this via the "merge" option but the simplest
        // portable approach is a raw UPDATE restricted to the safe columns.
      }
    );
    if (upsertErr) console.error("[authStore] upsert user error:", upsertErr);

    // For returning users, patch only email + avatar (not name) so a custom
    // display name set in Profile settings is never clobbered.
    await db
      .from("users")
      .update({ email: user.email, avatar: user.avatar ?? null })
      .eq("id", user.id);

    // Fetch the full stored profile (may have bio/social/custom name from a
    // previous session).
    const { data: stored } = await db
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (stored) {
      const avatarSource: "google" | "medium" = stored.avatar_source ?? "google";
      // When the user prefers Medium avatar, swap in the Medium profile values.
      const displayAvatar = avatarSource === "medium" && stored.medium_avatar_url
        ? stored.medium_avatar_url
        : stored.avatar ?? user.avatar;
      const displayName = avatarSource === "medium" && stored.medium_name
        ? stored.medium_name
        : stored.name ?? user.name;

      const fullUser: UserProfile = {
        ...user,
        name: displayName,
        avatar: displayAvatar ?? undefined,
        bio: stored.bio ?? undefined,
        social: {
          twitter: stored.social_twitter ?? undefined,
          github: stored.social_github ?? undefined,
          website: stored.social_website ?? undefined,
        },
        avatarSource,
      };
      const fullSession: AuthSession = { ...session, user: fullUser };
      persistSession(fullSession);
      set({ session: fullSession });
    }

    // Trigger data hydration.
    const { useBlogs } = await import("@/features/blogs/blogStore");
    const { useBookmarks } = await import("@/features/bookmarks/bookmarkStore");
    useBlogs.getState().fetchBlogs(user.id);
    useBlogs.getState().fetchLikedBlogs(user.id);
    useBookmarks.getState().fetchBookmarks(user.id);
  },

  updateProfile: async (patch) => {
    const session = get().session;
    if (!session) return;

    const next: UserProfile = { ...session.user, ...patch };
    const nextSession: AuthSession = { ...session, user: next };
    persistSession(nextSession);
    set({ session: nextSession });

    // 1. Update the users row.
    const { error } = await db.from("users").update({
      name: next.name,
      bio: next.bio ?? null,
      social_twitter: next.social?.twitter ?? null,
      social_github: next.social?.github ?? null,
      social_website: next.social?.website ?? null,
    }).eq("id", next.id);

    if (error) {
      console.error("[authStore] updateProfile error:", error);
      return;
    }

    // 2. If the display name changed, propagate it to all the user's blogs
    //    so author_name stays in sync on the published feed.
    if (patch.name && patch.name !== session.user.name) {
      const { error: blogErr } = await db
        .from("blogs")
        .update({ author_name: patch.name })
        .eq("author_id", next.id);
      if (blogErr) console.error("[authStore] update blogs author_name error:", blogErr);

      // Also update local Zustand state so the UI reflects immediately.
      const { useBlogs } = await import("@/features/blogs/blogStore");
      const state = useBlogs.getState();
      const updated = state.blogs.map((b) =>
        b.authorId === next.id ? { ...b, authorName: patch.name as string } : b,
      );
      useBlogs.setState({ blogs: updated });
    }
  },

  logout: () => {
    persistSession(null);
    set({ session: null });
  },

  setAvatarSource: async (source) => {
    const session = get().session;
    if (!session) return;

    // Persist preference to DB
    await db.from("users").update({ avatar_source: source }).eq("id", session.user.id);

    // Re-read Medium columns to get the latest avatar/name for that source
    const { data: stored } = await db
      .from("users")
      .select("name, avatar, medium_name, medium_avatar_url")
      .eq("id", session.user.id)
      .single();

    const displayAvatar = source === "medium" && stored?.medium_avatar_url
      ? stored.medium_avatar_url
      : stored?.avatar ?? session.user.avatar;
    const displayName = source === "medium" && stored?.medium_name
      ? stored.medium_name
      : stored?.name ?? session.user.name;

    const next: UserProfile = {
      ...session.user,
      avatar: displayAvatar ?? undefined,
      name: displayName,
      avatarSource: source,
    };
    const nextSession: AuthSession = { ...session, user: next };
    persistSession(nextSession);
    set({ session: nextSession });
  },
}));

export function isGoogleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID);
}
