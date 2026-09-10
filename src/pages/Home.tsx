import { Link, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useBlogs } from "@/features/blogs/blogStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Blog } from "@/types";
import { format } from "date-fns";
import { Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import bMind_BG from "@/media/images/BMind.png"

// ---------------------------------------------------------------------------
// Featured story card
// ---------------------------------------------------------------------------
function FeaturedCard({ blog }: { blog: Blog }) {
  const tag = blog.tags ?? blog.categories;
  return (
    <Link
      to={`/blog/${blog.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card/50 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Cover image */}
      <div className="relative h-44 w-full flex-shrink-0 overflow-hidden bg-muted">
        {blog.coverImage ? (
          <img
            src={blog.coverImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          /* Placeholder gradient when no cover image */
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/10 to-muted flex items-center justify-center">
            <span className="text-4xl font-bold text-primary/20 font-serif select-none">
              {blog.title.slice(0, 1)}
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-row flex-wrap gap-1">
          {tag && tag.slice(0,3).map(data =>  (
            <span className="w-fit rounded-full bg-indigo-700/40 px-2.5 py-0.5 text-xs font-medium text-primary">
              {data}
            </span>
          ))}
        </div>
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground group-hover:text-primary transition-colors">
          {blog.title}
        </h3>
        {blog.description && (
          <p className="line-clamp-3 text-xs text-muted-foreground leading-relaxed">
            {blog.description}
          </p>
        )}
        {/* Author + meta */}
        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted-foreground">
          <Avatar className="h-5 w-5 flex-shrink-0">
            <AvatarImage src={blog.authorAvatar} alt={blog.authorName} />
            <AvatarFallback>{blog.authorName?.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="truncate font-medium text-foreground">{blog.authorName}</span>
          <span className="flex-shrink-0">·</span>
          <span className="flex-shrink-0">
            {blog.publishedAt ? format(new Date(blog.publishedAt), "MMM d, yyyy") : ""}
          </span>
          <span className="ml-auto flex flex-shrink-0 items-center gap-1">
            <Clock className="h-3 w-3" />
            {blog.stats.readingTime} min
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Home() {
  const blogs = useBlogs((s) => s.blogs);
  const navigate = useNavigate();

  const featured = useMemo(
    () =>
      blogs
        .filter((b) => b.status === "published")
        .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
        .slice(0, 4),
    [blogs],
  );

  return (
    <div>
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="hero-section relative overflow-hidden bg-background">
        <div className="mx-auto grid max-w-full grid-cols-1 items-center gap-0 px-40 py-14 md:grid-cols-2 md:py-20">
          {/* Left copy */}
          <div className="flex w-fit flex-col gap-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Share&nbsp;·&nbsp;Read&nbsp;·&nbsp;Grow
            </p>
            <h1 className="font-serif text-5xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
              Ideas. Stories.
              <br />
              <span className="text-primary">Better Together.</span>
            </h1>
            <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
              BinaryMind is a modern platform for writers and readers.
              Discover insightful stories, share your perspective,
              and be part of a growing community.
            </p>
            <div className="flex gap-3 pt-1">
              <Button
                size="lg"
                className="rounded-full gap-2"
                onClick={() => navigate("/search")}
              >
                Explore Stories <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Right illustration */}
          
        </div>
      </section>

      {/* ── Featured Stories ───────────────────────────────────── */}
      <section className="mx-auto max-w-full px-40 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Featured Stories</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore some of our most popular and insightful stories.
            </p>
          </div>
          <Link
            to="/search"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            No published stories yet.{" "}
            <button
              className="text-foreground underline"
              onClick={() => navigate("/login", { state: { from: "/write" } })}
            >
              Write the first one
            </button>
            .
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((b) => (
              <FeaturedCard key={b.id} blog={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
