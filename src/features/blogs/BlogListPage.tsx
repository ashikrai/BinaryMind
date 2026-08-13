import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/authStore";
import { useBlogs } from "@/features/blogs/blogStore";
import type { BlogStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Copy, Edit, Eye, Trash2, Archive as ArchiveIcon, Send, Settings2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Props {
  status: BlogStatus;
  title: string;
}

export function BlogListPage({ status, title }: Props) {
  const user = useAuth((s) => s.session!.user);
  const allBlogs = useBlogs((s) => s.blogs);
  const blogs = useMemo(
    () => allBlogs.filter((b) => b.authorId === user.id && b.status === status),
    [allBlogs, user.id, status],
  );
  const setStatus = useBlogs((s) => s.setStatus);
  const duplicate = useBlogs((s) => s.duplicate);
  const remove = useBlogs((s) => s.remove);
  const nav = useNavigate();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">{title}</h1>
        <Button asChild className="rounded-full">
          <Link to="/write">New story</Link>
        </Button>
      </div>
      {blogs.length === 0 ? (
        <p className="text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="space-y-3">
          {blogs.map((b) => (
            <li key={b.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  {/* Cover image thumbnail */}
                  {b.coverImage && (
                    <img
                      src={b.coverImage}
                      alt=""
                      loading="lazy"
                      className="h-14 w-20 flex-shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0">
                  {/* Published blogs open the reader; drafts/archived open the editor */}
                  {status === "published" ? (
                    <Link
                      to={`/blog/${b.slug}`}
                      className="font-serif text-lg font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {b.title || "Untitled"}
                    </Link>
                  ) : (
                    <button
                      onClick={() => nav(`/edit/${b.id}`)}
                      className="text-left font-serif text-lg font-semibold hover:underline"
                    >
                      {b.title || "Untitled"}
                    </button>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {status === "published" && b.publishedAt
                      ? `Published ${formatDistanceToNow(new Date(b.publishedAt))} ago`
                      : `Updated ${formatDistanceToNow(new Date(b.updatedAt))} ago`}{" "}
                    · {b.stats.wordCount} words
                  </div>
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  {/* Published: view button; others: edit button */}
                  {status === "published" ? (
                    <Button size="icon" variant="ghost" asChild aria-label="View blog">
                      <Link to={`/blog/${b.slug}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" onClick={() => nav(`/edit/${b.id}`)} aria-label="Edit">
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {/* Always show edit for published too (secondary action) */}
                  {status === "published" && (
                    <Button size="icon" variant="ghost" onClick={() => nav(`/edit/${b.id}`)} aria-label="Edit">
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {/* Settings — opens editor where the Settings slide-over lives */}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Settings"
                    onClick={() => nav(`/edit/${b.id}`)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Duplicate"
                    onClick={() => {
                      duplicate(b.id);
                      toast.success("Duplicated");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {status !== "published" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Publish"
                      onClick={() => {
                        setStatus(b.id, "published");
                        toast.success("Published");
                      }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                  {status !== "archived" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Archive"
                      onClick={() => {
                        setStatus(b.id, "archived");
                        toast.success("Archived");
                      }}
                    >
                      <ArchiveIcon className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete"
                    onClick={() => {
                      if (confirm("Delete this story?")) {
                        remove(b.id);
                        toast.success("Deleted");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
