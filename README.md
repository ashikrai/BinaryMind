# Binary Mind (Medium Clone)
<img width="3304" height="1709" alt="BMind" src="https://github.com/user-attachments/assets/b17ce6bd-6f13-40be-8601-e2062249cc82" />


A production-grade **Medium.com-inspired** writing and reading experience built as
a fully static single-page application. The whole app runs in the browser and
persists to `localStorage` — no backend required — so it deploys to GitHub Pages
(or any static host) with zero configuration.

This is a **foundation slice** of the full brief: routing, theming, Google auth,
local persistence, a block-based editor, a Medium-style reading page, and a
dashboard shell are all in place. Individual features (all block types,
advanced analytics, MFA, etc.) are structured to extend incrementally.

## Tech stack

| Concern       | Library                             |
| ------------- | ----------------------------------- |
| Build         | Vite 6                              |
| UI framework  | React 19 + TypeScript (strict)      |
| Routing       | react-router-dom v7 (BrowserRouter) |
| UI primitives | shadcn/ui (Radix) + Tailwind CSS v4 |
| State         | Zustand (per-feature stores)        |
| Forms         | react-hook-form + zod               |
| Charts        | Recharts                            |
| Auth          | Google Identity Services (GIS)      |
| Icons         | lucide-react                        |
| Toasts        | sonner                              |

> Kibo UI is a set of *shadcn-compatible* blocks. This project uses shadcn
> primitives directly; drop in specific Kibo blocks as needed via their CLI.

## Getting started

```bash
bun install
bun run dev        # http://localhost:8080
bun run build      # dist/
bun run preview
```

## Google sign-in

The app uses Google Identity Services and works in two modes:

- **With a client ID** — set `VITE_GOOGLE_CLIENT_ID` in `.env.local` (create it
  at <https://console.cloud.google.com/> → *APIs & Services* → *Credentials*,
  add your deployed origin to *Authorized JavaScript origins*). The
  standard Google button renders and returns a real JWT.
- **Without a client ID** — the login screen shows a demo button that creates
  a local profile. Perfect for previewing the app or local development.

## Deploying to GitHub Pages

1. Set the project's base path when building (only needed if the site is served
   from a subpath like `https://user.github.io/repo/`):

   ```bash
   VITE_BASE=/repo/ bun run build
   ```

2. Publish `dist/` to the `gh-pages` branch (any workflow will do). The
   `public/404.html` fallback preserves deep links so `BrowserRouter` can
   resolve them on load — set `segmentCount` in that file if your base has
   more than one path segment.

## Architecture

```
src/
├── app/               # <App /> — router + providers
├── components/        # shadcn primitives + generic UI
├── constants/         # env-independent configuration
├── features/          # feature-first modules (no cross-imports)
│   ├── auth/          # auth store + Google button + <RequireAuth />
│   ├── blogs/         # blog store + list view
│   ├── bookmarks/     # bookmark store
│   ├── editor/        # BlockEditor + BlockRenderer
│   └── theme/         # theme store + toggle
├── layouts/           # AppLayout, AuthLayout
├── pages/             # one file per route, code-split via React.lazy
├── storage/           # localStorage wrapper + obfuscation layer
├── types/             # shared domain types
└── styles.css         # Tailwind v4 entry + design tokens
```

**Feature boundaries.** Each feature owns its store, components, and hooks.
Pages compose features — features never import from pages. UI primitives in
`components/ui/` never import from features.

**Business logic vs UI vs storage.**

- `storage/localStore.ts` is the only place that talks to `localStorage`.
- Each feature store (`authStore`, `blogStore`, `bookmarkStore`, `themeStore`)
  is the sole owner of its slice; components read via selectors.
- Presentation lives in `pages/` and `features/**/components`.

## Storage format

All values are wrapped by `storage/crypto.ts` before being written to
`localStorage`. The encoding is `enc:v1:<base64(json)>` — it is
**obfuscation, not encryption**: browser JS cannot keep a key secret from
the user. The interface is symmetric so it can be upgraded to WebCrypto
`AES-GCM` when a real backend supplies key material.

| Key               | Shape                              |
| ----------------- | ---------------------------------- |
| `mc.auth.v1`      | `AuthSession` (user + jwt)         |
| `mc.blogs.v1`     | `Blog[]`                           |
| `mc.bookmarks.v1` | `string[]` (blog IDs)              |
| `mc.history.v1`   | `string[]` (last 50 read blog IDs) |
| `mc.theme.v1`     | `"light" \| "dark" \| "system"`    |

Domain types live in `src/types/index.ts`.

## Future backend migration

Because features are structured around stores, moving to a backend means
replacing store internals — call sites stay identical.

1. **Auth** — swap `authStore.loginWithGoogleCredential` to POST the JWT to
   `/api/auth/google`; store the returned session in `localStore` as today.
2. **Blogs / bookmarks** — replace the in-store arrays with an
   `@tanstack/react-query` cache backed by REST/GraphQL. Keep the same
   selector signatures.
3. **Encryption** — swap `storage/crypto.ts` for WebCrypto AES-GCM using a
   key derived per-user server-side.
4. **Search** — for anything beyond a few hundred stories, move filtering to
   the backend (e.g. Postgres full-text) instead of iterating in memory.

## Accessibility & performance

- Semantic landmarks (`<header>`, `<main>`, `<footer>`, `<nav>`, `<article>`).
- All icon-only buttons carry `aria-label`.
- Keyboard-navigable via Radix primitives.
- Routes are code-split with `React.lazy`; large vendor libs (`recharts`,
  `react-router`) land in their own chunks.
- Images are `loading="lazy"`.
- `min-h-dvh` for correct mobile viewport height.

## Roadmap

- Additional editor blocks (tables, callouts, footnotes, tweet/gist embeds).
- Full-text search with lunr.
- Monaco integration for the code block.
- Reading progress persistence + resume.
- MFA (TOTP) once a backend exists.



## Architecture at a glance
```
App start
  └── DataBootstrap
        ├── fetchBlogs()         → SELECT published blogs  (public)
        └── fetchBookmarks()     → SELECT bookmarks        (if logged in)

Google Sign-in
  └── loginWithGoogleCredential()
        ├── UPSERT users row
        ├── SELECT full profile (bio/social)
        ├── fetchBlogs(userId)   → +user's drafts/archived
        └── fetchBookmarks(userId)

Write / Edit
  └── create() / updateBlocks() / setStatus()
        ├── Optimistic Zustand update (instant UI)
        └── INSERT / UPDATE blogs row

views & likes
  └── increment_blog_views() / increment_blog_likes()  → Postgres RPC (atomic)
```