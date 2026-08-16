# Binary Mind (Medium Clone)
Live-Demo: [Binary-mind](https://binary-mind-01.lovable.app)

<img width="1092" height="569" alt="image" src="https://github.com/user-attachments/assets/5cc770d3-d2f6-45af-8c81-08b8d3b21490" />
<!-- <img width="3304" height="1709" alt="BMind" src="https://github.com/user-attachments/assets/7c726b93-9bb8-4f13-9747-8541d4bd9da4" /> -->


A production-grade **`Medium-inspired`** writing and reading platform. The Stories are persisted in **`Supabase`** (PostgreSQL), authentication is handled via **`Google Identity Services`**, and the frontend is a fully code-split `React 19 SPA`.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Data Flow](#data-flow)
5. [Database Schema](#database-schema)
6. [Getting Started](#getting-started)
7. [Environment Variables](#environment-variables)
8. [Google OAuth Setup](#google-oauth-setup)
9. [Supabase Setup](#supabase-setup)
10. [Deploying](#deploying)
11. [Architecture Decisions](#architecture-decisions)
12. [Local Storage Usage](#local-storage-usage)
13. [Accessibility & Performance](#accessibility--performance)
14. [Roadmap](#roadmap)

---

## Features

### Reading
<img width="1087" height="566" alt="image" src="https://github.com/user-attachments/assets/5aa3ee67-3f3c-4c9e-a0bc-4de95d074868" />

- **Public feed** — all published stories visible without login, newest first
- **Story page** — full block-rendered article with author byline, publish date, and estimated reading time
- **Reading progress bar** — fixed top indicator that fills as you scroll
- **Like / Unlike** — one like per authenticated user, backed by a Postgres join table + atomic RPC
- **Bookmark** — saved per-user in Supabase; falls back to `localStorage` when signed out
- **Share** — native share API + direct links to Twitter/X, LinkedIn, Facebook, Reddit, WhatsApp, and Email
- **Copy link** — one-click clipboard copy
- **Prev / Next navigation** — adjacent published stories with cover image thumbnails
- **Related stories** — three cards at the bottom, each with cover image preview
- **View counter** — incremented server-side via a `security definer` RPC so it works for anonymous readers

### Writing & Editing
<img width="1087" height="566" alt="image" src="https://github.com/user-attachments/assets/1cd9f3c6-0c9b-486d-8b98-43224473d5c4" />

- **Block-based editor** — 16 block types: Title, Subtitle, H1–H3, Paragraph, Quote, Pull Quote, Divider, Bullet list, Numbered list, Checklist, Image, Code, YouTube embed, Tweet/X embed, GitHub Gist, Table, Callout
- **Markdown shortcuts** — type `` ` `` `` ` `` `` ` `` → code block, `* ` / `- ` → bullet, `1. ` → numbered, `> ` → quote
- **Undo / Redo** — in-editor history stack, separate from browser history
- **Drag-and-drop reorder** — grab the grip handle to reorder blocks
- **Autosave** — every block change triggers a debounced `UPDATE` to Supabase
- **Image crop tool** — built-in crop UI for image blocks
- **Inline styling** — per-block font size, weight, colour, and alignment via a style popover
- **Preview mode** — toggle between editor and rendered preview in the same route

### Publishing & Story Management
<img width="1088" height="566" alt="image" src="https://github.com/user-attachments/assets/d7f867f9-f9d2-4e21-95d5-4fabebc46de3" />

- **Liquid-glass publish dialog** — iOS-style frosted-glass modal to set cover image, tags, and collaborators before going live
- **Blog settings panel** — slide-over Sheet to update cover image, tags, and collaborators on already-published stories, accessible directly from My Stories without navigating away
- **Collaborators** — add co-authors by email with live user autocomplete (queries `users` table as you type)
- **Tags** — up to 7 tags per story, shown on cards and the reading page
- **Statuses** — `draft` → `published` → `archived`; each has its own list view
- **Duplicate** — clone any story into a new draft in one click
- **Delete** — permanent delete with confirmation dialog

### Add Medium Account
You need to generate your Medium Integration token. [Generate Integration Token ](https://medium.com/me/settings/security)
Once generated copy the token and add in the profile section.
<img width="983" height="358" alt="image" src="https://github.com/user-attachments/assets/4504d037-3379-432f-bb2a-cba35af7f012" />

#### Successfully Imported
<img width="858" height="511" alt="image" src="https://github.com/user-attachments/assets/518fbf57-11ea-4591-8b21-37bb2b3aaae5" />

All imported posts can be access here:
<img width="872" height="491" alt="image" src="https://github.com/user-attachments/assets/57d86572-3850-4cb8-9150-061249d9d3f2" />


### My Stories dashboard
<img width="1088" height="566" alt="image" src="https://github.com/user-attachments/assets/653438b6-44cd-4552-9c1b-a198e4bbc9ce" />

- **Published** tab — view, edit, configure settings, or view stats per story
- **Drafts** tab — resume editing or publish
- **Collaborations** tab — stories you've been added to as a co-author
- **Per-story stats** — views, likes, shares, reading time, word count in a dialog (author-only)

### Author Analytics (Dashboard)
<img width="1089" height="566" alt="image" src="https://github.com/user-attachments/assets/0c56a952-39f6-4069-84a9-6040c240f1fe" />

- Total / draft / published / archived story counts
- Aggregate views, likes, total words, and average story length
- 14-day publishing activity bar chart (Recharts)
- Most-viewed story and average reading time

### Search
<img width="1089" height="566" alt="image" src="https://github.com/user-attachments/assets/2bd6df50-65b9-40ca-a128-40a8d2c00f94" />

- Real-time client-side search across titles, descriptions, tags, categories, and block content
- URL-synchronised query parameter (`?q=…`) — shareable and browser-back-compatible

### User Profile
<img width="1090" height="566" alt="image" src="https://github.com/user-attachments/assets/33d555cb-1919-4566-b6ac-b68cfd8ced8a" />

- Edit display name, bio, Twitter, GitHub, and website
- Changes propagate to all blog `author_name` rows in Supabase automatically
- Avatar sourced from Google profile photo

### Auth
<img width="1088" height="564" alt="image" src="https://github.com/user-attachments/assets/9fedee23-6c8a-4308-a0b0-b2f93f7b01fb" />

- **Google Identity Services (GIS)** — sign in with your Google account; the JWT `sub` is used as the stable user ID
- **Demo mode** — when `VITE_GOOGLE_CLIENT_ID` is not set, a local mock profile is created so the app is fully functional for development
- **Session persistence** — auth session is kept in `localStorage` (obfuscated) and restored on page reload
- **Protected routes** — `<RequireAuth>` redirects unauthenticated users to `/login` with a `from` state so they land back after sign-in

### Theme
<img width="1092" height="569" alt="image" src="https://github.com/user-attachments/assets/5cc770d3-d2f6-45af-8c81-08b8d3b21490" />

- Light / Dark / System — toggle in the nav bar, persisted to `localStorage`

---

## Tech Stack

| Concern | Library | Version |
|---|---|---|
| Build | Vite | 6 |
| UI framework | React + TypeScript (strict) | 19 / 5.8 |
| Routing | react-router-dom (BrowserRouter) | 7 |
| UI primitives | shadcn/ui (Radix UI) | latest |
| Styling | Tailwind CSS | v4 |
| State management | Zustand | 5 |
| Backend / DB | Supabase (PostgreSQL) | 2 |
| Auth | Google Identity Services (GIS) | — |
| Data fetching | @tanstack/react-query | 5 |
| Forms | react-hook-form + zod | 7 / 3 |
| Charts | Recharts | 2 |
| Date formatting | date-fns | 4 |
| Icons | lucide-react | latest |
| Toasts | sonner | 2 |
| Unique IDs | uuid | 11 |

---

## Project Structure

```
src/
├── app/
│   └── App.tsx              # Router, providers, DataBootstrap
├── components/
│   ├── ui/                  # shadcn/ui primitives (Button, Dialog, Sheet, …)
│   ├── ErrorBoundary.tsx
│   └── PageLoader.tsx
├── constants/
│   └── index.ts             # APP_NAME, STORAGE_KEYS, GOOGLE_CLIENT_ID
├── features/                # Feature-first modules — no cross-feature imports
│   ├── auth/
│   │   ├── authStore.ts     # Zustand store: login, logout, updateProfile
│   │   ├── GoogleSignInButton.tsx
│   │   └── RequireAuth.tsx  # Route guard
│   ├── blogs/
│   │   ├── blogStore.ts     # Zustand store: CRUD, likes, collaborators, views
│   │   ├── BlogListPage.tsx # Reusable list for Archive etc.
│   │   ├── BlogSettingsPanel.tsx  # Sheet: cover / tags / collaborators
│   │   ├── BlogStatsDialog.tsx    # Stats modal (author-only)
│   │   └── PublishDialog.tsx      # Liquid-glass publish flow
│   ├── bookmarks/
│   │   └── bookmarkStore.ts # Supabase-backed, localStorage fallback
│   ├── editor/
│   │   ├── BlockEditor.tsx  # 16-block editor with undo/redo/drag
│   │   ├── BlockRenderer.tsx
│   │   ├── BlockStylePopover.tsx
│   │   ├── CropTool.tsx
│   │   ├── blockStyle.ts
│   │   └── inline.tsx       # InlineEditable component
│   └── theme/
│       ├── themeStore.ts
│       └── ThemeToggle.tsx
├── hooks/
│   ├── use-mobile.tsx
│   └── useStableCallback.ts
├── layouts/
│   ├── AppLayout.tsx        # Sticky nav + footer
│   └── AuthLayout.tsx
├── lib/
│   ├── database.types.ts    # Hand-rolled Supabase type map
│   ├── supabase.ts          # createClient singleton
│   └── utils.ts             # cn() helper
├── pages/                   # One file per route, all React.lazy code-split
│   ├── Home.tsx             # Feed + hero + sidebar
│   ├── ReadBlog.tsx         # Article reader
│   ├── Write.tsx            # Creates a blank draft, redirects to /edit/:id
│   ├── EditBlog.tsx         # Editor + settings + publish
│   ├── MyStories.tsx        # Published / Drafts / Collaborations tabs
│   ├── Dashboard.tsx        # Analytics overview
│   ├── Profile.tsx          # Edit name / bio / social links
│   ├── Search.tsx           # Full-text client-side search
│   ├── Bookmarks.tsx
│   ├── Drafts.tsx           # → /my-stories?tab=draft
│   ├── Published.tsx        # → /my-stories?tab=published
│   ├── Archive.tsx
│   ├── Settings.tsx
│   ├── Login.tsx
│   └── NotFound.tsx
├── storage/
│   ├── crypto.ts            # enc:v1:<base64> obfuscation layer
│   └── localStore.ts        # Typed localStorage wrapper
├── types/
│   └── index.ts             # Blog, Block, Collaborator, UserProfile, AuthSession
└── styles.css               # Tailwind v4 entry + CSS design tokens
```

---

## Data Flow

```
App boot
└── DataBootstrap
      ├── fetchBlogs()           → SELECT all published rows (public, no auth)
      ├── fetchLikedBlogs(uid)   → SELECT blog_likes WHERE user_id = uid
      └── fetchBookmarks(uid)    → SELECT bookmarks WHERE user_id = uid

Google Sign-in  (loginWithGoogleCredential)
└── Decode JWT payload  →  extract sub / email / name / picture
      ├── UPSERT users row       (INSERT on first login, UPDATE email+avatar on return)
      ├── SELECT full profile    (bio, social links, custom display name)
      ├── fetchBlogs(userId)     → +user's own drafts / archived
      ├── fetchLikedBlogs(uid)
      └── fetchBookmarks(uid)

Write
└── create()
      ├── Optimistic Zustand update  (editor opens instantly)
      └── INSERT blogs row

Edit  (every block change)
└── updateBlocks()
      ├── Recompute stats (word count, reading time) in-browser
      ├── Optimistic Zustand update
      └── UPDATE blogs SET blocks, word_count, reading_time

Publish
└── PublishDialog → save()
      ├── UPDATE blogs SET cover_image, tags
      ├── setCollaborators()
      │     ├── SELECT users WHERE email IN (...)
      │     ├── DELETE blog_collaborators WHERE blog_id = ?
      │     └── INSERT blog_collaborators rows
      └── UPDATE blogs SET status = 'published', published_at = now()

Reading
├── incrementView()   → RPC increment_blog_views  (security definer, anon-safe)
└── toggleLike()
      ├── Optimistic like count update
      └── RPC add_blog_like / remove_blog_like  (idempotent, returns authoritative count)
```

---

## Database Schema

Five tables, all using `text` primary keys (Google `sub` strings for users, client-generated UUID strings for everything else).

```
┌─────────────┐         ┌──────────────────────┐
│   users     │         │  blog_collaborators  │
│─────────────│    ┌───▶│──────────────────────│
│ id (PK)     │    │    │ blog_id (FK → blogs) │
│ email       │    │    │ user_id (FK → users) │
│ name        │    │    │ added_at             │
│ avatar      │    │    └──────────────────────┘
│ bio         │    │
│ social_*    │    │    ┌──────────────────────┐
│ joined_at   │    │    │    blog_likes        │
└──────┬──────┘    │    │──────────────────────│
       │           │    │ user_id (FK → users) │
       │           │    │ blog_id (FK → blogs) │
       ▼           │    │ created_at           │
┌─────────────┐    │    └──────────────────────┘
│    blogs    │────┘
│─────────────│         ┌──────────────────────┐
│ id (PK)     │────────▶│     bookmarks        │
│ author_id   │         │──────────────────────│
│ title/slug  │         │ user_id (FK → users) │
│ cover_image │         │ blog_id (FK → blogs) │
│ tags[]      │         │ created_at           │
│ blocks jsonb│         └──────────────────────┘
│ status      │
│ views/likes │
│ word_count  │
│ seo jsonb   │
└─────────────┘

RLS: all tables have Row Level Security enabled with open policies
     (using true). Security is enforced at the app layer via
     RequireAuth + Google sign-in. The anon key is intentionally
     public — embedding it in JS is the standard Supabase pattern.

RPCs (security definer — bypass RLS, safe for anon callers):
  • increment_blog_views(blog_id text)
  • add_blog_like(p_blog_id text, p_user_id text) → integer
  • remove_blog_like(p_blog_id text, p_user_id text) → integer
```

> The full schema is in [`supabase/schema.sql`](supabase/schema.sql). Run it once in the Supabase SQL Editor to create all tables, indexes, triggers, and functions.

---

## Getting Started

### Prerequisites

- Node.js 18+ (or Bun 1.x)
- A [Supabase](https://supabase.com) project (free tier works fine)
- A Google Cloud project for OAuth (optional — a demo mode works without it)

### Install & run

```bash
# clone
git clone <repo-url>
cd binarymind

# install (use bun or npm/pnpm/yarn — all work)
bun install

# copy the env template and fill in your values
cp .env.local.example .env.local

# start the dev server
bun run dev          # http://localhost:8080
```

### Other scripts

```bash
bun run build        # production build → dist/
bun run preview      # preview the production build locally
bun run lint         # ESLint
bun run format       # Prettier
```

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# ── Supabase ───────────────────────────────────────────────────────
# Find these in: Supabase Dashboard → Project Settings → API
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# ── Google OAuth ───────────────────────────────────────────────────
# Optional. Without this, the app uses a local demo profile.
# See "Google OAuth Setup" below.
VITE_GOOGLE_CLIENT_ID=<your-oauth-client-id>.apps.googleusercontent.com

# ── Vite base path ─────────────────────────────────────────────────
# Only needed when deploying to a subpath (e.g. GitHub Pages /repo/).
# Leave unset for root deployments.
# VITE_BASE=/repo/
```

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | **Yes** | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Public anon key (safe to expose in JS) |
| `VITE_GOOGLE_CLIENT_ID` | No | Enables real Google sign-in; omit for demo mode |
| `VITE_BASE` | No | Vite base path for subpath deployments |

---

## Google OAuth Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth 2.0 Client ID** → **Web application**.
3. Under **Authorized JavaScript origins** add:
   - `http://localhost:8080` (local dev)
   - Your production domain (e.g. `https://binarymind.example.com`)
4. Copy the **Client ID** and paste it as `VITE_GOOGLE_CLIENT_ID` in `.env.local`.
5. No redirect URI is needed — Google Identity Services uses a popup flow, not a redirect.

> **Demo mode** — if `VITE_GOOGLE_CLIENT_ID` is empty or missing, the login page shows a "Continue as Demo User" button that creates a local profile. All features work except real Google identity.

---

## Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** → **New query**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. Copy your **Project URL** and **anon key** from **Project Settings → API** into `.env.local`.

That's it — the schema creates all five tables, indexes, RLS policies, triggers, and stored functions in a single idempotent script.

### Why open RLS policies?

This app uses **Google Identity Services directly** (not Supabase Auth). Because there is no Supabase-issued JWT, standard `auth.uid()` RLS expressions evaluate to `null` for every request. Access control is enforced at the application layer:

- All write routes are behind `<RequireAuth>` which redirects unauthenticated users to `/login`.
- The Supabase `anon` key is intentionally public — this is the [standard Supabase pattern](https://supabase.com/docs/guides/api/api-keys) for the anon key.
- If you later add Supabase Auth (e.g. for server-side rendering or MFA), swap the open policies for JWT-based ones without changing any application code.

---

## Deploying

### Vercel / Netlify (recommended)

1. Connect your repo.
2. Set the environment variables in the hosting dashboard.
3. Set the build command to `bun run build` (or `npm run build`) and the output directory to `dist`.
4. For Netlify, add a `_redirects` file or `netlify.toml` rule so all paths return `index.html`:

   ```
   /* /index.html 200
   ```

### GitHub Pages

1. Set the base path for your repo subpath:

   ```bash
   VITE_BASE=/your-repo-name/ bun run build
   ```

2. Publish the `dist/` folder to the `gh-pages` branch.
3. `public/404.html` is included — it preserves deep links so `BrowserRouter` can resolve them on load. Adjust `segmentCount` inside that file if your base has more than one path segment.

---

## Architecture Decisions

### Feature-first module layout

Each feature (`auth`, `blogs`, `bookmarks`, `editor`, `theme`) owns its Zustand store, components, and hooks. Pages compose features — features never import from pages. `components/ui/` never imports from features. This keeps the dependency graph acyclic and makes individual features easy to test or replace.

### Zustand with optimistic updates

Every mutation follows the same pattern:

```
1. Update Zustand state immediately  →  UI responds in <1 frame
2. Fire async Supabase call
3. On error: roll back Zustand state + show toast
```

This means the editor, like button, and bookmarks all feel instant even on slow connections.

### All IDs are `text`

Supabase defaults to `uuid` columns. This app generates IDs client-side using `crypto.randomUUID()` (via the `uuid` package) and passes them as plain strings. Using `text` PK columns means zero casting between JS and Postgres — a `uuid::text` mismatch was the root cause of the original `increment_blog_views` bug fixed in the schema.

### Google auth without Supabase Auth

The app receives a Google ID token (JWT) in the browser, decodes the payload (`sub`, `email`, `name`, `picture`) without a backend round-trip, and upserts the user row directly in Supabase. This keeps the architecture simple and avoids the need for server-side session management. The trade-off is that RLS policies can't use `auth.uid()` — they are intentionally open, with security enforced by the `RequireAuth` component.

### Block-based content model

Blog content is stored as a `jsonb` array of `Block` objects:

```ts
interface Block {
  id: string;        // UUID
  type: BlockType;   // "paragraph" | "h1" | "image" | "code" | …
  content: string;
  meta?: Record<string, unknown>;  // url, language, checked, style, …
}
```

This is more flexible than Markdown (structured embeds, per-block styling, drag-and-drop reorder) and simpler than a full ProseMirror document tree.

---

## Local Storage Usage

`localStorage` is used for lightweight persistence that doesn't need a server round-trip:

| Key | Shape | When used |
|---|---|---|
| `mc.auth.v1` | `AuthSession` (user + JWT) | Restores session on page reload |
| `mc.bookmarks.v1` | `string[]` (blog IDs) | Fallback for unauthenticated bookmarks |
| `mc.history.v1` | `string[]` (last 50 read blog IDs) | Reading history |
| `mc.theme.v1` | `"light" \| "dark" \| "system"` | Theme preference |

All values are wrapped by [`storage/crypto.ts`](src/storage/crypto.ts) using `enc:v1:<base64(json)>` — this is **obfuscation, not encryption**. It prevents casual inspection in DevTools but provides no real security guarantee. The interface is intentionally symmetric so it can be upgraded to `AES-GCM` (WebCrypto) if a server-supplied key becomes available.

Blogs, collaborators, likes, and user profiles are **not** stored in localStorage — they live exclusively in Supabase.

---

## Accessibility & Performance

- Semantic HTML landmarks: `<header>`, `<main>`, `<footer>`, `<nav>`, `<article>`
- All icon-only buttons carry `aria-label`; decorative icons carry `aria-hidden="true"`
- Radix UI primitives provide full keyboard navigation, focus management, and ARIA roles out of the box
- All routes are code-split with `React.lazy` + `<Suspense>` — the initial bundle only loads the shell and the current route
- `loading="lazy"` on all non-critical images
- `min-h-dvh` for correct mobile viewport height (avoids the iOS Safari address-bar jump)
- Reading progress bar uses a passive scroll listener — no layout thrash
- Optimistic UI throughout — every mutation is reflected instantly without waiting for the network

---

## Roadmap

- [ ] Full-text search via Postgres `tsvector` (move filtering server-side for large datasets)
- [ ] Notifications (new likes, new collaborator invites)
- [ ] Comment threads per story
- [ ] Reader history page (already tracked in `mc.history.v1`)
- [ ] Story series / collections
- [ ] SEO meta tags and Open Graph images per story
- [ ] Monaco editor integration for the code block (syntax highlighting)
- [ ] MFA / 2FA (requires a real backend session)
- [ ] Supabase Auth migration path (swap open RLS for `auth.uid()` policies)
