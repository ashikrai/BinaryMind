export const APP_NAME = "Binary Mind";
export const STORAGE_KEYS = {
  auth: "mc.auth.v1",
  blogs: "mc.blogs.v1",
  bookmarks: "mc.bookmarks.v1",
  history: "mc.history.v1",
  theme: "mc.theme.v1",
  drafts: "mc.drafts.v1",
} as const;

/**
 * Google OAuth Client ID. Set VITE_GOOGLE_CLIENT_ID at build time
 * (or in a `.env.local`). Without it, the app falls back to a local
 * mock profile so the UI stays functional for local development / demo.
 */
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "") as string;
