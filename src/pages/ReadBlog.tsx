import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useBlogs } from "@/features/blogs/blogStore";
import { useAuth } from "@/features/auth/authStore";
import { BlockRenderer } from "@/features/editor/BlockRenderer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  Heart,
  Link as LinkIcon,
  Linkedin,
  Mail,
  MessageCircle,
  Share2,
  Twitter,
  Facebook,
  BarChart2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBookmarks } from "@/features/bookmarks/bookmarkStore";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { localStore } from "@/storage/localStore";
import { STORAGE_KEYS } from "@/constants";
import { BlogStatsDialog } from "@/features/blogs/BlogStatsDialog";

export default function ReadBlog() {
  const { slug } = useParams<{ slug: string }>();
  const blog = useBlogs((s) => s.blogs.find((b) => b.slug === slug));
  const all = useBlogs((s) => s.blogs);
  const inc = useBlogs((s) => s.incrementView);
  const likeAction = useBlogs((s) => s.toggleLike);
  const likedBlogIds = useBlogs((s) => s.likedBlogIds);
  const session = useAuth((s) => s.session);
  const bookmarks = useBookmarks();
  const nav = useNavigate();
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [showStats, setShowStats] = useState(false);

  const isAuthor = Boolean(session && blog && session.user.id === blog.authorId);

  // liked is derived from the store — no local state needed
  const liked = blog ? likedBlogIds.has(blog.id) : false;

  useEffect(() => {
    if (blog) {
      inc(blog.id);
      const history = (localStore.get<string[]>(STORAGE_KEYS.history) ?? []).filter(
        (x) => x !== blog.id,
      );
      localStore.set(STORAGE_KEYS.history, [blog.id, ...history].slice(0, 50));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blog?.id]);

  useEffect(() => {
    const handler = () => {
      const el = document.documentElement;
      const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
      setProgress(Math.min(100, Math.max(0, pct)));
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const handleLike = () => {
    if (!blog) return;
    if (!session) {
      toast("Sign in to like stories", {
        description: "Create a free account to like and save stories.",
        action: {
          label: "Sign in",
          onClick: () => nav("/login", { state: { from: location.pathname } }),
        },
      });
      return;
    }
    likeAction(blog.id, session.user.id);
  };

  const { prev, next, related } = useMemo(() => {
    if (!blog) return { prev: null, next: null, related: [] };
    const published = all
      .filter((b) => b.status === "published")
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    const idx = published.findIndex((b) => b.id === blog.id);
    return {
      prev: idx > 0 ? published[idx - 1] : null,
      next: idx >= 0 && idx < published.length - 1 ? published[idx + 1] : null,
      related: published.filter((b) => b.id !== blog.id).slice(0, 3),
    };
  }, [all, blog]);

  if (!blog) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p>Story not found.</p>
        <Button className="mt-4" onClick={() => nav("/")}>
          Go home
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Reading progress bar */}
      <div
        role="progressbar"
        aria-label="Reading progress"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="fixed left-0 top-16 z-30 h-0.5 bg-primary transition-[width]"
        style={{ width: `${progress}%` }}
      />

      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Author byline */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={blog.authorAvatar} alt="" />
              <AvatarFallback aria-hidden="true">
                {blog.authorName?.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <div className="font-medium">{blog.authorName}</div>
              <div className="text-muted-foreground">
                {blog.publishedAt ? format(new Date(blog.publishedAt), "MMM d, yyyy") : "Draft"} ·{" "}
                {blog.stats.readingTime} min read
              </div>
            </div>
          </div>

          {/* Stats button — author only */}
          {isAuthor && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStats(true)}
              aria-label="View story stats"
            >
              <BarChart2 className="mr-1.5 h-4 w-4" />
              Stats
            </Button>
          )}
        </div>

        <ArticleActions
          blog={blog}
          liked={liked}
          bookmarked={bookmarks.has(blog.id)}
          onLike={handleLike}
          onBookmark={() => bookmarks.toggle(blog.id)}
        />

        <BlockRenderer blocks={blog.blocks} />

        <div className="mt-10 border-t pt-4">
          <ArticleActions
            blog={blog}
            liked={liked}
            bookmarked={bookmarks.has(blog.id)}
            onLike={handleLike}
            onBookmark={() => bookmarks.toggle(blog.id)}
          />
        </div>

        {/* Prev / Next navigation with cover images */}
        <nav aria-label="Adjacent articles" className="mt-8 grid gap-4 md:grid-cols-2">
          {prev && (
            <Link
              to={`/blog/${prev.slug}`}
              className="group overflow-hidden rounded-xl border hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              {prev.coverImage && (
                <img
                  src={prev.coverImage}
                  alt=""
                  className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
              <div className="p-4">
                <div className="text-xs text-muted-foreground">← Previous</div>
                <div className="mt-1 font-serif font-semibold leading-snug">{prev.title}</div>
              </div>
            </Link>
          )}
          {next && (
            <Link
              to={`/blog/${next.slug}`}
              className="group overflow-hidden rounded-xl border text-right hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors md:col-start-2"
            >
              {next.coverImage && (
                <img
                  src={next.coverImage}
                  alt=""
                  className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
              <div className="p-4">
                <div className="text-xs text-muted-foreground">Next →</div>
                <div className="mt-1 font-serif font-semibold leading-snug">{next.title}</div>
              </div>
            </Link>
          )}
        </nav>

        {/* Related stories with cover images */}
        {related.length > 0 && (
          <section aria-labelledby="related-heading" className="mt-12">
            <h2
              id="related-heading"
              className="mb-4 border-b pb-2 font-serif text-xl font-semibold"
            >
              Related stories
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/blog/${r.slug}`}
                  className="group overflow-hidden rounded-xl border hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                >
                  {r.coverImage ? (
                    <img
                      src={r.coverImage}
                      alt=""
                      className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-20 w-full bg-muted/50" />
                  )}
                  <div className="p-3">
                    <div className="font-serif font-semibold leading-snug line-clamp-2">
                      {r.title}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.stats.readingTime} min read
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Stats dialog — author only */}
      {isAuthor && showStats && (
        <BlogStatsDialog blog={blog} open={showStats} onClose={() => setShowStats(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action bar
// ---------------------------------------------------------------------------
function ArticleActions({
  blog,
  liked,
  bookmarked,
  onLike,
  onBookmark,
}: {
  blog: { id: string; title: string; description: string; stats: { likes: number } };
  liked: boolean;
  bookmarked: boolean;
  onLike: () => void;
  onBookmark: () => void;
}) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const title = blog.title;
  const summary = blog.description ?? "";
  const enc = encodeURIComponent;

  const shareLinks = [
    {
      label: "LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    },
    {
      label: "X / Twitter",
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`,
    },
    {
      label: "Facebook",
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    },
    {
      label: "Reddit",
      icon: MessageCircle,
      href: `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`,
    },
    {
      label: "WhatsApp",
      icon: MessageCircle,
      href: `https://api.whatsapp.com/send?text=${enc(`${title} ${url}`)}`,
    },
    {
      label: "Email",
      icon: Mail,
      href: `mailto:?subject=${enc(title)}&body=${enc(`${summary}\n\n${url}`)}`,
    },
  ];

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: summary, url });
      } catch {
        /* user dismissed */
      }
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Article actions"
      className="flex flex-wrap items-center gap-1 py-2"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onLike}
        aria-label={
          liked ? `Unlike — ${blog.stats.likes} likes` : `Like — ${blog.stats.likes} likes`
        }
        aria-pressed={liked}
        className={cn(liked && "text-red-500 hover:text-red-500")}
      >
        <Heart className={cn("mr-1 h-4 w-4", liked && "fill-current")} aria-hidden="true" />
        <span>{blog.stats.likes}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onBookmark}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark this article"}
        aria-pressed={bookmarked}
      >
        <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} aria-hidden="true" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(url);
          toast.success("Link copied");
        }}
        aria-label="Copy link to clipboard"
      >
        <LinkIcon className="mr-1 h-4 w-4" aria-hidden="true" /> Copy link
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Share this article">
            <Share2 className="mr-1 h-4 w-4" aria-hidden="true" /> Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {typeof navigator !== "undefined" && "share" in navigator && (
            <DropdownMenuItem onClick={nativeShare}>
              <Share2 className="mr-2 h-4 w-4" aria-hidden="true" /> System share…
            </DropdownMenuItem>
          )}
          {shareLinks.map((s) => (
            <DropdownMenuItem key={s.label} asChild>
              <a href={s.href} target="_blank" rel="noreferrer">
                <s.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                {s.label}
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
