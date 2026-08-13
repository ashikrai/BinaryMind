import { Link, useNavigate } from "react-router-dom";
import { useMemo, useCallback } from "react";
import { useBlogs } from "@/features/blogs/blogStore";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Blog } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { PenSquare, SearchIcon, Bookmark } from "lucide-react";
import { useBookmarks } from "@/features/bookmarks/bookmarkStore";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/authStore";

export default function Home() {
  const blogs = useBlogs((s) => s.blogs);
  const session = useAuth((s) => s.session);
  const navigate = useNavigate();

  const handleStartWriting = useCallback(() => {
    if (session) {
      navigate("/write");
    } else {
      navigate("/login", { state: { from: "/write" } });
    }
  }, [session, navigate]);
  const published = useMemo(
    () =>
      blogs
        .filter((b) => b.status === "published")
        .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")),
    [blogs]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="mb-10 rounded-2xl border bg-primary/5 p-8 md:p-14">
        <h1 className="max-w-3xl font-serif text-4xl font-bold leading-tight md:text-6xl">
          Human stories & ideas
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          A place to read, write, and deepen your understanding.
        </p>
        <div className="mt-6 flex gap-3">
          <Button className="rounded-full" size="lg" onClick={handleStartWriting}>
            <PenSquare/> Start writing
          </Button>
          <Button asChild variant="outline" className="rounded-full" size="lg">
            <Link to="/search"> <SearchIcon/> Explore stories</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-8 md:col-span-2">
          <h2 className="border-b pb-2 text-xl font-semibold">Latest stories</h2>
          {published.length === 0 ? (
            <EmptyFeed />
          ) : (
            published.map((b) => <StoryCard key={b.id} blog={b} />)
          )}
        </div>
        <aside className="space-y-6">
          <div className="rounded-lg border p-5">
            <h3 className="mb-3 font-semibold">Discover more</h3>
            <div className="flex flex-wrap gap-2">
              {["Programming", "Design", "Product", "Startups", "AI", "Writing", "Life"].map(
                (t) => (
                  <Link key={t} to={`/search?q=${encodeURIComponent(t)}`}>
                    <Badge variant="secondary" className="rounded-full">
                      {t}
                    </Badge>
                  </Link>
                )
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyFeed() {
  const session = useAuth((s) => s.session);
  const navigate = useNavigate();
  return (
    <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
      No published stories yet.{" "}
      <button
        className="text-foreground underline"
        onClick={() =>
          session
            ? navigate("/write")
            : navigate("/login", { state: { from: "/write" } })
        }
      >
        Write the first one
      </button>
      .
    </div>
  );
}

function StoryCard({ blog }: { blog: Blog }) {
  const bookmarks = useBookmarks();
  return (
    <article className="border-b pb-8">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar className="h-6 w-6">
          <AvatarImage src={blog.authorAvatar} alt={blog.authorName} />
          <AvatarFallback>{blog.authorName?.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="font-medium text-foreground">{blog.authorName}</span>
        <span>·</span>
        <span>{formatDistanceToNow(new Date(blog.publishedAt ?? blog.updatedAt))} ago</span>
      </div>
      <Link to={`/blog/${blog.slug}`} className="block group">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <h3 className="text-2xl font-bold leading-tight group-hover:underline">
              {blog.title}
            </h3>
            {blog.description && (
              <p className="mt-1 line-clamp-2 text-muted-foreground">{blog.description}</p>
            )}
          </div>
          {blog.coverImage && (
            <img
              src={blog.coverImage}
              alt=""
              loading="lazy"
              className="h-24 w-40 rounded object-cover"
            />
          )}
        </div>
      </Link>
      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <span>{blog.stats.readingTime} min read</span>
        {blog.tags.map((t) => (
        // {blog.tags.slice(0, 2).map((t) => (
          <Badge key={t} variant="outline" className="rounded-full">{t}</Badge>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8"
          aria-label="Bookmark"
          onClick={() => bookmarks.toggle(blog.id)}
        >
          <Bookmark className={bookmarks.has(blog.id) ? "h-4 w-4 fill-current" : "h-4 w-4"} />
        </Button>
      </div>
    </article>
  );
}
