-- =============================================================================
-- Binary Mind — Complete Schema  (single-file fresh install)
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Auth strategy:
--   This app uses Google Identity Services directly (NOT Supabase Auth).
--   The anon key is embedded in the JS bundle, so JWT-based RLS adds no real
--   security.  All RLS policies are intentionally open (using true) and access
--   control is enforced at the application layer via RequireAuth / Google sign-in.
--
-- ID strategy:
--   All primary keys and foreign keys that reference them are TEXT.
--   • users.id   = Google JWT "sub" claim (stable, globally unique string)
--   • blogs.id   = UUID generated client-side via crypto.randomUUID(), stored
--                  as text so no casting is needed in the JS layer.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";


-- ===========================================================================
-- TABLES
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- users
--   One row per Google-authenticated writer.
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id              text        primary key,
  email           text        not null unique,
  name            text        not null,
  avatar          text,
  bio             text,
  social_twitter  text,
  social_github   text,
  social_website  text,
  joined_at       timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users: select"      on public.users;
drop policy if exists "users: public read" on public.users;
drop policy if exists "users: insert own"  on public.users;
drop policy if exists "users: insert"      on public.users;
drop policy if exists "users: update own"  on public.users;
drop policy if exists "users: update"      on public.users;

create policy "users: select" on public.users for select using (true);
create policy "users: insert" on public.users for insert with check (true);
create policy "users: update" on public.users for update using (true);


-- ---------------------------------------------------------------------------
-- blogs
--   id is TEXT (client-generated UUID string — no casting required).
-- ---------------------------------------------------------------------------
create table if not exists public.blogs (
  id            text        primary key,
  author_id     text        not null references public.users(id) on delete cascade,
  author_name   text        not null default '',
  author_avatar text,
  title         text        not null default 'Untitled story',
  slug          text        not null,
  description   text        not null default '',
  cover_image   text,
  tags          text[]      not null default '{}',
  categories    text[]      not null default '{}',
  blocks        jsonb       not null default '[]',
  status        text        not null default 'draft'
                            check (status in ('draft', 'published', 'archived', 'deleted')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,
  seo           jsonb       not null default '{}',
  views         integer     not null default 0,
  likes         integer     not null default 0,
  shares        integer     not null default 0,
  reading_time  integer     not null default 1,
  word_count    integer     not null default 0
);

create unique index if not exists blogs_slug_idx         on public.blogs (slug);
create        index if not exists blogs_author_idx       on public.blogs (author_id);
create        index if not exists blogs_status_idx       on public.blogs (status);
create        index if not exists blogs_published_at_idx on public.blogs (published_at desc);

alter table public.blogs enable row level security;

drop policy if exists "blogs: public read published" on public.blogs;
drop policy if exists "blogs: author read own"       on public.blogs;
drop policy if exists "blogs: author insert"         on public.blogs;
drop policy if exists "blogs: author update"         on public.blogs;
drop policy if exists "blogs: author delete"         on public.blogs;
drop policy if exists "blogs: select"                on public.blogs;
drop policy if exists "blogs: insert"                on public.blogs;
drop policy if exists "blogs: update"                on public.blogs;
drop policy if exists "blogs: delete"                on public.blogs;

create policy "blogs: select" on public.blogs for select using (true);
create policy "blogs: insert" on public.blogs for insert with check (true);
create policy "blogs: update" on public.blogs for update using (true);
create policy "blogs: delete" on public.blogs for delete using (true);


-- ---------------------------------------------------------------------------
-- bookmarks
--   Composite PK (user_id, blog_id) prevents duplicates.
-- ---------------------------------------------------------------------------
create table if not exists public.bookmarks (
  user_id    text        not null references public.users(id) on delete cascade,
  blog_id    text        not null references public.blogs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blog_id)
);

alter table public.bookmarks enable row level security;

drop policy if exists "bookmarks: read own"   on public.bookmarks;
drop policy if exists "bookmarks: insert own" on public.bookmarks;
drop policy if exists "bookmarks: delete own" on public.bookmarks;
drop policy if exists "bookmarks: select"     on public.bookmarks;
drop policy if exists "bookmarks: insert"     on public.bookmarks;
drop policy if exists "bookmarks: delete"     on public.bookmarks;

create policy "bookmarks: select" on public.bookmarks for select using (true);
create policy "bookmarks: insert" on public.bookmarks for insert with check (true);
create policy "bookmarks: delete" on public.bookmarks for delete using (true);


-- ---------------------------------------------------------------------------
-- blog_likes
--   One row per (user, blog) pair — enforces one like per user.
--   The likes counter on blogs is kept in sync by the RPCs below.
-- ---------------------------------------------------------------------------
create table if not exists public.blog_likes (
  user_id    text        not null references public.users(id) on delete cascade,
  blog_id    text        not null references public.blogs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blog_id)
);

alter table public.blog_likes enable row level security;

drop policy if exists "blog_likes: select" on public.blog_likes;
drop policy if exists "blog_likes: insert" on public.blog_likes;
drop policy if exists "blog_likes: delete" on public.blog_likes;

create policy "blog_likes: select" on public.blog_likes for select using (true);
create policy "blog_likes: insert" on public.blog_likes for insert with check (true);
create policy "blog_likes: delete" on public.blog_likes for delete using (true);


-- ---------------------------------------------------------------------------
-- blog_collaborators
--   Tracks which users can co-author a blog in addition to the owner.
--   Composite PK prevents duplicate entries.
-- ---------------------------------------------------------------------------
create table if not exists public.blog_collaborators (
  blog_id  text        not null references public.blogs(id) on delete cascade,
  user_id  text        not null references public.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (blog_id, user_id)
);

alter table public.blog_collaborators enable row level security;

drop policy if exists "blog_collaborators: select" on public.blog_collaborators;
drop policy if exists "blog_collaborators: insert" on public.blog_collaborators;
drop policy if exists "blog_collaborators: delete" on public.blog_collaborators;

create policy "blog_collaborators: select" on public.blog_collaborators for select using (true);
create policy "blog_collaborators: insert" on public.blog_collaborators for insert with check (true);
create policy "blog_collaborators: delete" on public.blog_collaborators for delete using (true);


-- ===========================================================================
-- TRIGGERS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Auto-update updated_at on every blogs row change
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists blogs_set_updated_at on public.blogs;

create trigger blogs_set_updated_at
  before update on public.blogs
  for each row execute function public.set_updated_at();


-- ===========================================================================
-- FUNCTIONS  (all use text IDs — no uuid casting)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- increment_blog_views(blog_id text)
--   Fire-and-forget view counter increment called via supabase.rpc().
--   security definer bypasses RLS so it always succeeds for anonymous readers.
-- ---------------------------------------------------------------------------
create or replace function public.increment_blog_views(blog_id text)
returns void
language sql
security definer
as $$
  update public.blogs
  set views = views + 1
  where id = blog_id;
$$;


-- ---------------------------------------------------------------------------
-- add_blog_like(p_blog_id text, p_user_id text) → integer
--   Inserts the (user, blog) row (no-op on duplicate) and increments the
--   counter only when the row was actually inserted.
--   Returns the authoritative likes count after the operation.
-- ---------------------------------------------------------------------------
create or replace function public.add_blog_like(p_blog_id text, p_user_id text)
returns integer
language plpgsql
security definer
as $$
declare
  inserted boolean;
begin
  insert into public.blog_likes (user_id, blog_id)
  values (p_user_id, p_blog_id)
  on conflict do nothing;

  get diagnostics inserted = row_count;  -- 1 if inserted, 0 if duplicate

  if inserted then
    update public.blogs set likes = likes + 1 where id = p_blog_id;
  end if;

  return (select likes from public.blogs where id = p_blog_id);
end;
$$;


-- ---------------------------------------------------------------------------
-- FUNCTION: remove_blog_like(p_blog_id text, p_user_id text) → integer
--   Deletes the (user, blog) row and decrements the counter only when a row
--   was actually removed.
--   Returns the authoritative likes count after the operation.
-- ---------------------------------------------------------------------------
create or replace function public.remove_blog_like(p_blog_id text, p_user_id text)
returns integer
language plpgsql
security definer
as $$
declare
  removed boolean;
begin
  delete from public.blog_likes
  where user_id = p_user_id and blog_id = p_blog_id;

  get diagnostics removed = row_count;  -- 1 if deleted, 0 if it didn't exist

  if removed then
    update public.blogs set likes = greatest(0, likes - 1) where id = p_blog_id;
  end if;

  return (select likes from public.blogs where id = p_blog_id);
end;
$$;
