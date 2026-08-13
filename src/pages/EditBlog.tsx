import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/authStore";
import { useBlogs } from "@/features/blogs/blogStore";
import { BlockEditor } from "@/features/editor/BlockEditor";
import { BlockRenderer } from "@/features/editor/BlockRenderer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PublishDialog } from "@/features/blogs/PublishDialog";
import { BlogSettingsPanel } from "@/features/blogs/BlogSettingsPanel";
import { Eye, Pencil, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";

export default function EditBlog() {
  const { id } = useParams<{ id: string }>();
  const session = useAuth((s) => s.session);
  const blog = useBlogs((s) => s.blogs.find((b) => b.id === id));
  const updateBlocks = useBlogs((s) => s.updateBlocks);
  const setStatus = useBlogs((s) => s.setStatus);
  const remove = useBlogs((s) => s.remove);
  const nav = useNavigate();

  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (!blog) {
    return <div className="mx-auto max-w-2xl px-4 py-12">Story not found.</div>;
  }

  const isOwner = blog.authorId === session?.user.id;

  const handleDelete = async () => {
    await remove(blog.id);
    toast.success("Story deleted");
    nav("/drafts", { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* ── Top action bar ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {blog.status === "draft" ? "Draft" : blog.status} · {blog.stats.wordCount} words ·{" "}
          {blog.stats.readingTime} min
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Preview / Edit toggle */}
          <Button
            variant="outline"
            onClick={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
          >
            {mode === "edit" ? (
              <>
                <Eye className="mr-1 h-4 w-4" /> Preview
              </>
            ) : (
              <>
                <Pencil className="mr-1 h-4 w-4" /> Edit
              </>
            )}
          </Button>

          {/* Settings (cover, tags, collaborators) — always visible */}
          <Button variant="outline" onClick={() => setShowSettings(true)}>
            <Settings2 className="mr-1 h-4 w-4" /> Settings
          </Button>

          {isOwner && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStatus(blog.id, "archived");
                  toast.success("Archived");
                }}
              >
                Archive
              </Button>

              {/* Delete */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="text-destructive hover:border-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-black/90 text-foreground">Delete this story?</AlertDialogTitle>
                    <AlertDialogDescription className="text-black/70 text-foreground">
                      <strong>"{blog.title}"</strong> will be permanently deleted. This cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Publish — draft only shows PublishDialog; published/archived go directly */}
              {blog.status === "draft" ? (
                <Button onClick={() => setShowPublishDialog(true)}>Publish</Button>
              ) : (
                <Button
                  onClick={() => {
                    setStatus(blog.id, "published");
                    toast.success("Re-published!");
                    nav(`/blog/${blog.slug}`);
                  }}
                >
                  Re-publish
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Editor / Preview ── */}
      {mode === "edit" ? (
        <BlockEditor initial={blog.blocks} onChange={(blocks) => updateBlocks(blog.id, blocks)} />
      ) : (
        <div className="rounded-lg border bg-background p-6">
          <div className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">Preview</div>
          <BlockRenderer blocks={blog.blocks} />
        </div>
      )}

      {/* ── Publish dialog (drafts only) ── */}
      {showPublishDialog && (
        <PublishDialog
          blog={blog}
          open={showPublishDialog}
          onClose={() => setShowPublishDialog(false)}
          onPublished={(slug) => nav(`/blog/${slug}`)}
        />
      )}

      {/* ── Settings side panel (all statuses) ── */}
      <BlogSettingsPanel blog={blog} open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
