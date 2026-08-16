/**
 * MediumImportsTab
 *
 * Renders the "Medium Imports" tab inside MyStories.
 * Shows all blogs that were imported from Medium with their sync status.
 */
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMedium } from "./mediumStore";
import { useBlogs } from "@/features/blogs/blogStore";
import { useAuth } from "@/features/auth/authStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Edit, Send, Upload, ExternalLink, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function MediumImportsTab() {
  const session = useAuth((s) => s.session!);
  const userId = session.user.id;

  const { connected, importedPosts, load, pushToMedium, removeImported } = useMedium();
  const allBlogs = useBlogs((s) => s.blogs);
  const setStatus = useBlogs((s) => s.setStatus);
  const nav = useNavigate();

  useEffect(() => {
    load(userId);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-reference import records with full blog objects
  const importedIds = new Set(importedPosts.map((p) => p.id));
  const importedBlogs = allBlogs.filter((b) => importedIds.has(b.id));

  const getRecord = (blogId: string) => importedPosts.find((p) => p.id === blogId);

  if (!connected) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          Connect your Medium account in{" "}
          <Link to="/profile" className="underline">
            Profile settings
          </Link>{" "}
          to start importing posts.
        </p>
      </div>
    );
  }

  if (importedBlogs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No Medium posts imported yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use the import tool in your{" "}
          <Link to="/profile" className="underline">
            Profile
          </Link>{" "}
          to pull posts from Medium.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <ul className="space-y-3">
        {importedBlogs.map((blog) => {
          const record = getRecord(blog.id);
          return (
            <li key={blog.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  {blog.coverImage && (
                    <img
                      src={blog.coverImage}
                      alt=""
                      loading="lazy"
                      className="h-14 w-20 flex-shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <button
                      onClick={() => nav(`/edit/${blog.id}`)}
                      className="text-left font-serif text-lg font-semibold hover:underline"
                    >
                      {blog.title || "Untitled"}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Imported {formatDistanceToNow(new Date(record?.importedAt ?? blog.createdAt))} ago
                      </span>
                      <span>·</span>
                      <StatusBadge blog={blog} pushStatus={record?.pushStatus} />
                      {record?.mediumUrl && (
                        <>
                          <span>·</span>
                          <a
                            href={record.mediumUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:underline"
                          >
                            View on Medium <ExternalLink className="h-3 w-3" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-shrink-0 gap-1">
                  {/* Edit */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => nav(`/edit/${blog.id}`)}
                        aria-label="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Edit</p></TooltipContent>
                  </Tooltip>

                  {/* Publish in BinaryMind (if still draft) */}
                  {blog.status === "draft" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Publish"
                          onClick={async () => {
                            await setStatus(blog.id, "published");
                            toast.success("Published on BinaryMind");
                          }}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Publish on BinaryMind</p></TooltipContent>
                    </Tooltip>
                  )}

                  {/* Push to Medium (if not yet pushed) */}
                  {record?.pushStatus !== "pushed" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Push to Medium"
                          onClick={async () => {
                            try {
                              await pushToMedium(blog);
                              toast.success("Pushed to Medium as a draft");
                            } catch (err: unknown) {
                              toast.error(err instanceof Error ? err.message : "Push failed");
                            }
                          }}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Push to Medium (as draft)</p></TooltipContent>
                    </Tooltip>
                  )}

                  {/* Delete — removes from both blogs table and medium_imported_posts */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete"
                        onClick={async () => {
                          if (confirm("Delete this imported post from BinaryMind?")) {
                            await removeImported(blog.id);
                            toast.success("Deleted");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Delete</p></TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}

function StatusBadge({
  blog,
  pushStatus,
}: {
  blog: { status: string };
  pushStatus?: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <Badge variant={blog.status === "published" ? "default" : "secondary"} className="text-xs">
        {blog.status === "published" ? "Published" : "Draft"}
      </Badge>
      {pushStatus === "pushed" && (
        <Badge variant="outline" className="text-xs text-green-600 border-green-400">
          Pushed to Medium
        </Badge>
      )}
    </span>
  );
}
