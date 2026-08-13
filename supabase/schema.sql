-- =============================================================================
-- Binary Mind — Full Schema (fresh install)
-- Run this entire script in: Supabase Dashboard → SQL Editor → New query → Run
--
-- RLS strategy:
--   This app uses Google Identity Services directly (NOT Supabase Auth).
--   The anon key is embedded in the JS bundle, so JWT-based RLS gives no
--   extra security. Policies are open (using true) and security is enforced
--   at the application layer via RequireAuth / Google sign-in.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";


-- ---------------------------------------------------------------------------
-- TABLE: users
--   One row per Google-authenticated writer.
--   id  = Google JWT "sub" claim (stable, globally unique).
-- ---------------------------------------------------------------------------
create table public.users (
  id               text        primary key,
  email            text        not null unique,
  name             text        not null,
  avatar           text,
  bio              text,
  social_twitter   text,
  social_github    text,
  social_website   text,
  joined_at        timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users: select" on public.users for select using (true);
create policy "users: insert" on public.users for insert with check (true);
create policy "users: update" on public.users for update using (true);


-- ---------------------------------------------------------------------------
-- TABLE: blogs
--   id is a UUID string generated client-side (stored as text so the JS
--   uuid() output doesn't need casting).
-- ---------------------------------------------------------------------------
create table public.blogs (
  id             text        primary key,
  author_id      text        not null references public.users(id) on delete cascade,
  author_name    text        not null default '',
  author_avatar  text,
  title          text        not null default 'Untitled story',
  slug           text        not null,
  description    text        not null default '',
  cover_image    text,
  tags           text[]      not null default '{}',
  categories     text[]      not null default '{}',
  blocks         jsonb       not null default '[]',
  status         text        not null default 'draft'
                             check (status in ('draft', 'published', 'archived', 'deleted')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  published_at   timestamptz,
  seo            jsonb       not null default '{}',
  views          integer     not null default 0,
  likes          integer     not null default 0,
  shares         integer     not null default 0,
  reading_time   integer     not null default 1,
  word_count     integer     not null default 0
);

-- Indexes
create unique index blogs_slug_idx         on public.blogs (slug);
create        index blogs_author_idx       on public.blogs (author_id);
create        index blogs_status_idx       on public.blogs (status);
create        index blogs_published_at_idx on public.blogs (published_at desc);

-- RLS
alter table public.blogs enable row level security;

create policy "blogs: select" on public.blogs for select using (true);
create policy "blogs: insert" on public.blogs for insert with check (true);
create policy "blogs: update" on public.blogs for update using (true);
create policy "blogs: delete" on public.blogs for delete using (true);


-- ---------------------------------------------------------------------------
-- TABLE: bookmarks
--   Composite PK (user_id, blog_id) prevents duplicates.
-- ---------------------------------------------------------------------------
create table public.bookmarks (
  user_id    text        not null references public.users(id)  on delete cascade,
  blog_id    text        not null references public.blogs(id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blog_id)
);

-- RLS
alter table public.bookmarks enable row level security;

create policy "bookmarks: select" on public.bookmarks for select using (true);
create policy "bookmarks: insert" on public.bookmarks for insert with check (true);
create policy "bookmarks: delete" on public.bookmarks for delete using (true);


-- ---------------------------------------------------------------------------
-- TABLE: blog_collaborators
--   Tracks which users can co-author a blog (in addition to the owner).
--   Composite PK prevents duplicate entries.
-- ---------------------------------------------------------------------------
create table public.blog_collaborators (
  blog_id    text        not null references public.blogs(id)  on delete cascade,
  user_id    text        not null references public.users(id)  on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (blog_id, user_id)
);

alter table public.blog_collaborators enable row level security;

create policy "blog_collaborators: select" on public.blog_collaborators for select using (true);
create policy "blog_collaborators: insert" on public.blog_collaborators for insert with check (true);
create policy "blog_collaborators: delete" on public.blog_collaborators for delete using (true);




-- ---------------------------------------------------------------------------
-- FUNCTION: auto-update updated_at on every blogs row change
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

create trigger blogs_set_updated_at
  before update on public.blogs
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- FUNCTION: increment_blog_views(blog_id text)
--   Called via supabase.rpc('increment_blog_views', { blog_id })
--   security definer so it bypasses RLS and always succeeds.
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
-- TABLE: blog_likes
--   One row per (user, blog) pair — enforces one like per authenticated user.
--   The likes counter on blogs is kept in sync by the functions below.
-- ---------------------------------------------------------------------------
create table public.blog_likes (
  user_id    text        not null references public.users(id)  on delete cascade,
  blog_id    text        not null references public.blogs(id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blog_id)
);

alter table public.blog_likes enable row level security;

create policy "blog_likes: select" on public.blog_likes for select using (true);
create policy "blog_likes: insert" on public.blog_likes for insert with check (true);
create policy "blog_likes: delete" on public.blog_likes for delete using (true);


-- ---------------------------------------------------------------------------
-- FUNCTION: add_blog_like(p_blog_id text, p_user_id text)
--   Inserts the (user, blog) row (no-op if duplicate) and increments the
--   counter only if the row was actually inserted.
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
-- FUNCTION: remove_blog_like(p_blog_id text, p_user_id text)
--   Deletes the (user, blog) row and decrements the counter only if a row
--   was actually removed.
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
