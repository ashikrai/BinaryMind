import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/authStore";
import { useBlogs } from "@/features/blogs/blogStore";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  Copy,
  Edit,
  Eye,
  Trash2,
  Archive as ArchiveIcon,
  Send,
  Settings2,
  BarChart2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Blog } from "@/types";
import { BlogSettingsPanel } from "@/features/blogs/BlogSettingsPanel";
import { BlogStatsDialog } from "@/features/blogs/BlogStatsDialog";

type Tab = "published" | "draft" | "collabs";

const TABS: { id: Tab; label: string }[] = [
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
  { id: "collabs", label: "Collaborations" },
];

export default function MyStories() {
  const [params, setParams] = useSearchParams();
  const activeTab: Tab = (params.get("tab") as Tab) ?? "published";

  const user = useAuth((s) => s.session!.user);
  const allBlogs = useBlogs((s) => s.blogs);
  const setStatus = useBlogs((s) => s.setStatus);
  const duplicate = useBlogs((s) => s.duplicate);
  const remove = useBlogs((s) => s.remove);
  const nav = useNavigate();

  const [settingsBlog, setSettingsBlog] = useState<Blog | null>(null);
  const [statsBlog, setStatsBlog] = useState<Blog | null>(null);

  const blogs = useMemo<Blog[]>(() => {
    if (activeTab === "collabs") {
      return allBlogs.filter(
        (b) => b.authorId !== user.id && (b.collaborators ?? []).some((c) => c.userId === user.id),
      );
    }
    return allBlogs.filter((b) => b.authorId === user.id && b.status === activeTab);
  }, [allBlogs, user.id, activeTab]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">My Stories</h1>
        <Button asChild className="rounded-full">
          <Link to="/write">New story</Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setParams({ tab: t.id })}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors hover:cursor-pointer",
              activeTab === t.id
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {blogs.length === 0 ? (
        <p className="text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="space-y-3">
          {blogs.map((b) => (
            <li key={b.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  {b.coverImage && (
                    <img
                      src={b.coverImage}
                      alt=""
                      loading="lazy"
                      className="h-14 w-20 flex-shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    {activeTab === "published" ? (
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
                      {activeTab === "published" && b.publishedAt
                        ? `Published ${formatDistanceToNow(new Date(b.publishedAt))} ago`
                        : `Updated ${formatDistanceToNow(new Date(b.updatedAt))} ago`}{" "}
                      · {b.stats.wordCount} words
                      {activeTab === "collabs" && (
                        <span className="ml-2">
                          · by <span className="font-medium">{b.authorName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-shrink-0 gap-1">
                  <TooltipProvider>
                    {/* View (published) or Edit */}
                    {activeTab === "published" ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" asChild aria-label="View blog">
                              <Link to={`/blog/${b.slug}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="flex gap-2 text-foreground"> <Eye className="h-4 w-4" /> View</p>
                          </TooltipContent>
                        </Tooltip>
                          
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => nav(`/edit/${b.id}`)}
                              aria-label="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="flex gap-2 text-foreground"> <Edit className="h-4 w-4" /> Edit</p>
                          </TooltipContent>
                        </Tooltip>
                      </>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => nav(`/edit/${b.id}`)}
                            aria-label="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="flex gap-2 text-foreground"> <Edit className="h-4 w-4" /> Edit</p>
                        </TooltipContent>
                      </Tooltip>

                    )}

                    {/* Settings — opens side panel directly (no redirect) */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Settings"
                          onClick={() => setSettingsBlog(b)}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="flex gap-2 text-foreground"><Settings2 className="h-4 w-4" /> Settings</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Stats (published, owner only) */}
                    {activeTab === "published" && b.authorId === user.id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="View stats"
                            onClick={() => setStatsBlog(b)}
                          >
                            <BarChart2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="flex gap-2 text-foreground"> <BarChart2 className="h-4 w-4" /> Stats</p>
                        </TooltipContent>
                        </Tooltip>
                    )}

                    {/* Duplicate */}
                    <Tooltip>
                      <TooltipTrigger asChild>
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
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="flex gap-2 text-foreground"> <Copy className="h-4 w-4" /> Copy</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Publish (non-published only) */}
                    {activeTab !== "published" && b.authorId === user.id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="flex gap-2 text-foreground"> <Send className="h-4 w-4" /> Send</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Archive (non-archived owned blogs only) */}
                    {b.status !== "archived" && b.authorId === user.id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="flex gap-2 text-foreground"> <ArchiveIcon className="h-4 w-4" /> Archive</p>
                        </TooltipContent>
                        </Tooltip>
                    )}

                    {/* Delete (owned blogs only) */}
                    {b.authorId === user.id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="flex gap-2 text-foreground"> <Trash2 className="h-4 w-4" /> Delete</p>
                        </TooltipContent>
                        </Tooltip>
                    )}
                  </TooltipProvider>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Settings side panel */}
      {settingsBlog && (
        <BlogSettingsPanel
          blog={settingsBlog}
          open={Boolean(settingsBlog)}
          onClose={() => setSettingsBlog(null)}
        />
      )}

      {/* Stats dialog */}
      {statsBlog && (
        <BlogStatsDialog
          blog={statsBlog}
          open={Boolean(statsBlog)}
          onClose={() => setStatsBlog(null)}
        />
      )}
    </div>
  );
}
