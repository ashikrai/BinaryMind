import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Lock,
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

interface ArticleHeading {
  id: string;
  level: 1 | 2;
  text: string;
}

interface HeadingData{
  heading : ArticleHeading;
  node: HTMLHeadingElement
}


function ArticleHeadingRail({
  articleRef,
  blogId,
}: {
  articleRef: React.RefObject<HTMLElement | null>;
  blogId: string;
}) {
  const [headings, setHeadings] = useState<HeadingData[]>([]);
  const [activeH1Id, setActiveH1Id] = useState<string | null>(null);
  const [isRailHovered, setIsRailHovered] = useState(false);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    const allHeadings = Array.from(article.querySelectorAll<HTMLHeadingElement>("h1, h2"))
    const entries= Array.from(allHeadings)
      .map((node, index) => {
        const text = node.textContent?.trim();
        if (!text) return null;

        const id = node.id || `article-heading-${blogId}-${index}`;
        node.id = id;
        
        return {
          node,
          heading: { id, level: node.tagName === "H1" ? 1 : 2, text } as ArticleHeading,
        };
      })
      .filter(
        (entry): entry is { node: HTMLHeadingElement; heading: ArticleHeading } => entry !== null,
      );
  
    const h1Headings = entries.filter((heading) => heading.heading.level === 1);
    setHeadings(h1Headings);
    if (entries.length === 0) return;

    const h1Entries = entries.filter(({ heading }) => heading.level === 1);

    const updateActiveHeading = () => {
      const scrollPosition = window.scrollY + 160;
      const active = h1Entries.reduce(
        (current, entry) =>
          entry.node.getBoundingClientRect().top + window.scrollY <= scrollPosition
            ? entry
            : current,
        h1Entries[0],
      );
      setActiveH1Id(active?.heading.id ?? null);
    };

    updateActiveHeading();
    window.addEventListener("scroll", updateActiveHeading, { passive: true });
    window.addEventListener("resize", updateActiveHeading);
    return () => {
      window.removeEventListener("scroll", updateActiveHeading);
      window.removeEventListener("resize", updateActiveHeading);
    };
  }, [articleRef, blogId]);

  if (headings.length === 0) return null;
  
  const scrollToHeading = (node: HTMLHeadingElement, id:string) => {
    const heading = document.getElementById(id);
    if (!heading) return;
    window.scrollTo({
      top: heading.getBoundingClientRect().top + window.scrollY - 96,
      behavior: "smooth",
    });
    setActiveH1Id(id);
  };

  return (
    <aside
      className="article-heading-rail fixed right-3 top-1/2 z-20 hidden -translate-y-1/2 lg:block"
      aria-label="Article navigation"
      onMouseLeave={() => setIsRailHovered(false)}
    >
      <nav
        className="flex flex-col gap-1.5"
        onMouseEnter={() => setIsRailHovered(true)}
        onFocus={() => setIsRailHovered(true)}
      >
        {headings.map((heading) => (
          <button
            key={heading.heading.id}
            type="button"
            title={heading.heading.text}
            aria-label={`Go to ${heading.heading.text}`}
            aria-current={activeH1Id === heading.heading.id ? "location" : undefined}
            onClick={() => {heading.node.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });}}
            // onClick={() => scrollToHeading(heading.node, heading.heading.id)}
            className={cn(
              "article-heading-rail-marker",
              heading.heading.level === 2 && "article-heading-rail-marker--nested",
              activeH1Id === heading.heading.id && "article-heading-rail-marker--active",
            )}
          />
        ))}
      </nav>

      <div
        onMouseEnter={()=>setIsRailHovered(true)}
        className={cn(
          "article-heading-rail-popover absolute right-full top-1/2 mr-1 w-64 -translate-y-1/2 transition-opacity duration-200",
          isRailHovered ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="max-h-[min(70vh,32rem)] overflow-y-auto p-2">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">On this page</div>
          {headings.map((heading) => (
            <button
              key={heading.heading.id}
              type="button"
              // onClick={() => scrollToHeading(heading.node, heading.heading.id)}
              onClick={() => {heading.node.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });}}
              className={cn(
                "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeH1Id === heading.heading.id && "font-semibold text-foreground",
              )}
            >
              {heading.heading.text} 123
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

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
  const articleRef = useRef<HTMLElement>(null);
  // Paywall state for unauthenticated readers
  const [paywallTriggered, setPaywallTriggered] = useState(false);
  const contentWrapRef = useRef<HTMLDivElement>(null);
  // The maximum scrollY the guest is allowed to reach (set once, never changes)
  const scrollCapRef = useRef<number | null>(null);

  const isAuthor = Boolean(session && blog && session.user.id === blog.authorId);

  // liked is derived from the store — no local state needed
  const liked = blog ? likedBlogIds.has(blog.id) : false;

  // Scroll to top whenever a new blog is opened
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

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

  // Compute the scroll cap: the scrollY value at which the midpoint of the
  // article element reaches the top of the viewport.  Once set it never changes.
  const computeScrollCap = useCallback(() => {
    if (session || scrollCapRef.current !== null) return;
    const article = articleRef.current;
    if (!article) return;
    const articleTop = article.getBoundingClientRect().top + window.scrollY;
    const articleHeight = article.offsetHeight;
    // Cap = position where the 50 % mark of the article is at the top of the viewport
    scrollCapRef.current = articleTop + articleHeight * 0.3;
  }, [session]);

  // Passive scroll watcher: once the user reaches the cap, trigger the paywall.
  const handlePaywallScroll = useCallback(() => {
    if (session || paywallTriggered) return;
    computeScrollCap();
    const cap = scrollCapRef.current;
    if (cap === null) return;
    if (window.scrollY >= cap) {
      setPaywallTriggered(true);
    }
  }, [session, paywallTriggered, computeScrollCap]);

  // Non-passive wheel handler: prevent scrolling further down past the cap.
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (session) return;
      computeScrollCap();
      const cap = scrollCapRef.current;
      if (cap === null) return;
      // Block downward scroll once at or past the cap
      if (e.deltaY > 0 && window.scrollY >= cap) {
        e.preventDefault();
        // Snap to exact cap so there's no over-scroll gap
        window.scrollTo({ top: cap });
      }
    },
    [session, computeScrollCap],
  );

  // Non-passive touch handler for mobile swipe-up (scroll down)
  const touchStartYRef = useRef<number>(0);
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  }, []);
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (session) return;
      computeScrollCap();
      const cap = scrollCapRef.current;
      if (cap === null) return;
      const deltaY = touchStartYRef.current - e.touches[0].clientY; // positive = scroll down
      if (deltaY > 0 && window.scrollY >= cap) {
        e.preventDefault();
        window.scrollTo({ top: cap });
      }
    },
    [session, computeScrollCap],
  );

  useEffect(() => {
    if (session) return;
    window.addEventListener("scroll", handlePaywallScroll, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener("scroll", handlePaywallScroll);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [session, handlePaywallScroll, handleWheel, handleTouchStart, handleTouchMove]);

  // Reset paywall when user logs in
  useEffect(() => {
    if (session && paywallTriggered) {
      setPaywallTriggered(false);
      scrollCapRef.current = null;
    }
  }, [session, paywallTriggered]);

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

      {/* <ArticleHeadingRail articleRef={articleRef} blogId={blog.id} /> */}

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
        {/* Reference point used to measure article height for scroll-cap */}
        <div ref={contentWrapRef} />

        <article ref={articleRef}>
          <BlockRenderer blocks={blog.blocks} blogId={blog.id} />
        </article>

        {/* Full-viewport paywall overlay — shown once guest hits 50 % of article */}
        {!session && paywallTriggered && (
          <div
            aria-modal="true"
            role="dialog"
            aria-label="Sign in to continue reading"
            className="fixed inset-0 z-40 flex flex-col items-center justify-end"
          >
            {/* Gradient scrim — transparent at top, opaque at bottom half */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent"
            />

            {/* CTA card sitting at the bottom */}
            <div className="relative z-10 mb-16 flex flex-col items-center gap-4 px-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                Sign in to keep reading
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Create a free account to read the full story and access all content.
              </p>
              <Button
                size="lg"
                onClick={() => nav("/login", { state: { from: location.pathname } })}
              >
                Sign in to continue
              </Button>
              <p className="text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => nav("/login", { state: { from: location.pathname } })}
                >
                  Log in
                </button>
              </p>
            </div>
          </div>
        )}

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
