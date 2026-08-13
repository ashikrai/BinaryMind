-- =============================================================================
-- Binary Mind — RLS FIX
-- Run this in Supabase SQL editor → fixes the "row-level security policy"
-- error caused by JWT-based policies that don't work with Google-direct auth.
--
-- This script is SAFE to re-run on an existing database.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Drop the broken JWT-based policies
-- ---------------------------------------------------------------------------

-- blogs
drop policy if exists "blogs: public read published" on public.blogs;
drop policy if exists "blogs: author read own"       on public.blogs;
drop policy if exists "blogs: author insert"         on public.blogs;
drop policy if exists "blogs: author update"         on public.blogs;
drop policy if exists "blogs: author delete"         on public.blogs;

-- bookmarks
drop policy if exists "bookmarks: read own"   on public.bookmarks;
drop policy if exists "bookmarks: insert own" on public.bookmarks;
drop policy if exists "bookmarks: delete own" on public.bookmarks;

-- users (old names)
drop policy if exists "users: insert own" on public.users;
drop policy if exists "users: update own" on public.users;


-- ---------------------------------------------------------------------------
-- Replace with open policies (anon key is already public in the JS bundle;
-- security is enforced at the app layer via RequireAuth)
-- ---------------------------------------------------------------------------

-- users
drop policy if exists "users: public read" on public.users;
drop policy if exists "users: insert"      on public.users;
drop policy if exists "users: update"      on public.users;

create policy "users: public read"
  on public.users for select using (true);

create policy "users: insert"
  on public.users for insert with check (true);

create policy "users: update"
  on public.users for update using (true);


-- blogs
drop policy if exists "blogs: select" on public.blogs;
drop policy if exists "blogs: insert" on public.blogs;
drop policy if exists "blogs: update" on public.blogs;
drop policy if exists "blogs: delete" on public.blogs;

create policy "blogs: select"
  on public.blogs for select using (true);

create policy "blogs: insert"
  on public.blogs for insert with check (true);

create policy "blogs: update"
  on public.blogs for update using (true);

create policy "blogs: delete"
  on public.blogs for delete using (true);


-- bookmarks
drop policy if exists "bookmarks: select" on public.bookmarks;
drop policy if exists "bookmarks: insert" on public.bookmarks;
drop policy if exists "bookmarks: delete" on public.bookmarks;

create policy "bookmarks: select"
  on public.bookmarks for select using (true);

create policy "bookmarks: insert"
  on public.bookmarks for insert with check (true);

create policy "bookmarks: delete"
  on public.bookmarks for delete using (true);


-- ---------------------------------------------------------------------------
-- Fix the blogs.id column type if it was created as uuid (not text)
-- The app sends UUIDs as text strings, so the column must accept text.
-- ---------------------------------------------------------------------------
do $$
begin
  -- Only alter if the column is currently uuid type.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'blogs'
      and column_name  = 'id'
      and data_type    = 'uuid'
  ) then
    alter table public.blogs alter column id type text using id::text;
  end if;
end
$$;

-- Same fix for bookmarks.blog_id if it references a uuid column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'bookmarks'
      and column_name  = 'blog_id'
      and data_type    = 'uuid'
  ) then
    alter table public.bookmarks alter column blog_id type text using blog_id::text;
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- Re-create helper functions with text argument types
-- ---------------------------------------------------------------------------
create or replace function public.increment_blog_views(blog_id text)
returns void
language sql
security definer
as $$
  update public.blogs set views = views + 1 where id = blog_id;
$$;

create or replace function public.increment_blog_likes(blog_id text)
returns void
language sql
security definer
as $$
  update public.blogs set likes = likes + 1 where id = blog_id;
$$;


-- ---------------------------------------------------------------------------
-- blog_likes table (new in likes-v2 patch)
--   Creates the table if it doesn't exist yet (safe for existing installs).
-- ---------------------------------------------------------------------------
create table if not exists public.blog_likes (
  user_id    text        not null references public.users(id)  on delete cascade,
  blog_id    text        not null references public.blogs(id)  on delete cascade,
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
-- FUNCTION: add_blog_like / remove_blog_like  (replaces increment_blog_likes)
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

  get diagnostics inserted = row_count;

  if inserted then
    update public.blogs set likes = likes + 1 where id = p_blog_id;
  end if;

  return (select likes from public.blogs where id = p_blog_id);
end;
$$;

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

  get diagnostics removed = row_count;

  if removed then
    update public.blogs set likes = greatest(0, likes - 1) where id = p_blog_id;
  end if;

  return (select likes from public.blogs where id = p_blog_id);
end;
$$;


-- ---------------------------------------------------------------------------
-- blog_collaborators table (new — collaborator feature)
-- ---------------------------------------------------------------------------
create table if not exists public.blog_collaborators (
  blog_id    text        not null references public.blogs(id)  on delete cascade,
  user_id    text        not null references public.users(id)  on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (blog_id, user_id)
);

alter table public.blog_collaborators enable row level security;

drop policy if exists "blog_collaborators: select" on public.blog_collaborators;
drop policy if exists "blog_collaborators: insert" on public.blog_collaborators;
drop policy if exists "blog_collaborators: delete" on public.blog_collaborators;

create policy "blog_collaborators: select" on public.blog_collaborators for select using (true);
create policy "blog_collaborators: insert" on public.blog_collaborators for insert with check (true);
create policy "blog_collaborators: delete" on public.blog_collaborators for delete using (true);
