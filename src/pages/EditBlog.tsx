import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/authStore";
import { useBlogs } from "@/features/blogs/blogStore";
import { NotionEditor } from "@/features/editor/NotionEditor";
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
import { Eye, Pencil, Trash2, Settings2, Save, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Block } from "@/types";
import { v4 as uuid } from "uuid";

// ---------------------------------------------------------------------------
// Convert legacy Block[] to an HTML string for Tiptap initial content
// ---------------------------------------------------------------------------
function blocksToHtml(blocks: Block[]): string {
  if (blocks.length === 1 && blocks[0].type === "html") {
    return blocks[0].content;
  }
  return blocks
    .map((b) => {
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      switch (b.type) {
        case "title":    return `<h1>${esc(b.content)}</h1>`;
        case "subtitle": return `<p><em>${esc(b.content)}</em></p>`;
        case "h1":       return `<h1>${esc(b.content)}</h1>`;
        case "h2":       return `<h2>${esc(b.content)}</h2>`;
        case "h3":       return `<h3>${esc(b.content)}</h3>`;
        case "paragraph":return `<p>${esc(b.content)}</p>`;
        case "quote":    return `<blockquote><p>${esc(b.content)}</p></blockquote>`;
        case "divider":  return `<hr />`;
        case "bullet": {
          const items = b.content.split("\n").filter(Boolean).map((l) => `<li>${esc(l)}</li>`).join("");
          return `<ul>${items}</ul>`;
        }
        case "numbered": {
          const items = b.content.split("\n").filter(Boolean).map((l) => `<li>${esc(l)}</li>`).join("");
          return `<ol>${items}</ol>`;
        }
        case "code":  return `<pre><code>${esc(b.content)}</code></pre>`;
        case "image": {
          const alt = esc((b.meta?.alt as string) ?? "");
          return `<img src="${esc(b.content)}" alt="${alt}" />`;
        }
        default: return b.content ? `<p>${esc(b.content)}</p>` : "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

export default function EditBlog() {
  const { id } = useParams<{ id: string }>();
  const session = useAuth((s) => s.session);

  // Fine-grained selectors — each only re-renders when its own value changes.
  // Avoid subscribing to the whole blog object so autosave writes don't
  // cause a re-render of the editor page on every keystroke.
  const blogExists    = useBlogs((s) => s.blogs.some((b) => b.id === id));
  const blogAuthorId  = useBlogs((s) => s.blogs.find((b) => b.id === id)?.authorId);
  const blogStatus    = useBlogs((s) => s.blogs.find((b) => b.id === id)?.status ?? "draft");
  const blogWordCount = useBlogs((s) => s.blogs.find((b) => b.id === id)?.stats.wordCount ?? 0);
  const blogReadTime  = useBlogs((s) => s.blogs.find((b) => b.id === id)?.stats.readingTime ?? 1);
  // Full blog object — only needed for one-off dialog text and settings panel
  const blog          = useBlogs((s) => s.blogs.find((b) => b.id === id));

  const updateBlocks = useBlogs((s) => s.updateBlocks);
  const setStatus = useBlogs((s) => s.setStatus);
  const remove = useBlogs((s) => s.remove);
  const nav = useNavigate();

  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // ── Dirty / change-tracking ──────────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  // The "saved draft" HTML that we revert to on cancel
  const savedHtmlRef = useRef<string | null>(null);

  // Convert the blog's blocks to the initial HTML for NotionEditor only once
  const initialHtml = useMemo(
    () => (blog ? blocksToHtml(blog.blocks) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blog?.id],
  );

  // Track live HTML for preview — updated on every editor change
  const [previewHtml, setPreviewHtml] = useState(initialHtml);

  // Initialise savedHtmlRef once
  if (savedHtmlRef.current === null && initialHtml) {
    savedHtmlRef.current = initialHtml;
  }

  // Keep a stable id for the HTML block
  const htmlBlockId = useRef(
    blog?.blocks.length === 1 && blog.blocks[0].type === "html"
      ? blog.blocks[0].id
      : uuid(),
  );

  // Current (unsaved) HTML – tracked in a ref so we don't re-render on every keystroke
  const currentHtmlRef = useRef(initialHtml);

  // Debounce timer for store writes — avoids a Zustand re-render on every keystroke
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the debounce timer on unmount so we don't write to an unmounted store
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Track the current mode in a ref so handleChange can read it without being
  // re-created every time mode changes (avoids NotionEditor re-mounting)
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const handleChange = useCallback(
    (html: string) => {
      currentHtmlRef.current = html;

      // Only update preview state when preview is actually visible — avoids a
      // React re-render on every keystroke while the user is in edit mode
      if (modeRef.current === "preview") setPreviewHtml(html);

      // Only flip isDirty when the boolean value actually changes, not every keystroke
      const dirty = html !== savedHtmlRef.current;
      setIsDirty((prev) => (prev === dirty ? prev : dirty));

      // Debounce store + DB writes — fires 800 ms after the user stops typing
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateBlocks(id!, [{ id: htmlBlockId.current, type: "html", content: html }]);
      }, 800);
    },
    [id, updateBlocks],
  );

  // ── Save: persist current content and clear dirty flag ──────────────────
  const handleSave = useCallback(async () => {
    await updateBlocks(id!, [
      { id: htmlBlockId.current, type: "html", content: currentHtmlRef.current },
    ]);
    savedHtmlRef.current = currentHtmlRef.current;
    setIsDirty(false);
    toast.success("Changes saved");
  }, [id, updateBlocks]);

  // ── Cancel: revert to last saved state ───────────────────────────────────
  const handleCancelConfirm = useCallback(async () => {
    // Revert the store to the saved content
    await updateBlocks(id!, [
      { id: htmlBlockId.current, type: "html", content: savedHtmlRef.current ?? initialHtml },
    ]);
    setIsDirty(false);
    setShowCancelDialog(false);
    nav(-1); // go back to previous page
  }, [id, updateBlocks, initialHtml, nav]);

  if (!blogExists || !blog) {
    return <div className="mx-auto max-w-2xl px-4 py-12">Story not found.</div>;
  }

  const isOwner = blogAuthorId === session?.user.id;
  const isPublished = blogStatus === "published";

  const handleDelete = async () => {
    await remove(blog.id);
    toast.success("Story deleted");
    nav("/my-stories", { replace: true });
  };

  // Build a synthetic html block for the preview renderer — uses live content
  const previewBlocks: Block[] = [
    { id: htmlBlockId.current, type: "html", content: previewHtml || initialHtml },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
    {/* <div className="mx-auto max-w-4xl px-4 py-8"> */}
      {/* ── Top action bar ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          <span
            className={
              blogStatus === "published"
                ? "text-green-600 dark:text-green-400 font-medium"
                : "capitalize"
            }
          >
            {blogStatus}
          </span>
          {isDirty && (
            <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
              · Unsaved changes
            </span>
          )}
          {" "}· {blogWordCount} words · {blogReadTime} min
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Preview / Edit toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMode((m) => {
                const next = m === "edit" ? "preview" : "edit";
                // Sync preview HTML from the live ref when entering preview mode
                if (next === "preview") setPreviewHtml(currentHtmlRef.current);
                return next;
              });
            }}
          >
            {mode === "edit" ? (
              <><Eye className="mr-1 h-4 w-4" /> Preview</>
            ) : (
              <><Pencil className="mr-1 h-4 w-4" /> Edit</>
            )}
          </Button>

          {/* Settings — always visible */}
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Settings2 className="mr-1 h-4 w-4" /> Settings
          </Button>

          {isOwner && (
            <>
              {/* ── Published story: Save / Cancel / Re-publish ── */}
              {isPublished ? (
                <>
                  {/* Save: always visible for published stories so partial work isn't lost */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={!isDirty}
                    className={isDirty ? "border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950" : ""}
                  >
                    <Save className="mr-1 h-4 w-4" /> Save
                  </Button>

                  {/* Cancel — always in the DOM, invisible until dirty to prevent layout shift */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCancelDialog(true)}
                    className="text-destructive hover:border-destructive hover:bg-destructive/10"
                    //  Uncomment this to show cancel button only when blog content is changed.
                    // style={isDirty ? undefined : { visibility: "hidden", pointerEvents: "none" }}
                  >
                    <X className="mr-1 h-4 w-4" /> Cancel changes
                  </Button>

                  {/* Re-publish — always in the DOM, invisible until dirty to prevent layout shift */}
                  <Button
                    size="sm"
                    onClick={async () => {
                      await handleSave();
                      await setStatus(blog.id, "published");
                      toast.success("Re-published!");
                      nav(`/blog/${blog.slug}`);
                    }}
                    style={isDirty ? undefined : { visibility: "hidden", pointerEvents: "none" }}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" /> Re-publish
                  </Button>

                  {/* Archive */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setStatus(blog.id, "archived"); toast.success("Archived"); }}
                  >
                    Archive
                  </Button>
                </>
              ) : (
                <>
                  {/* Draft / archived story: original flow */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setStatus(blog.id, "archived"); toast.success("Archived"); }}
                  >
                    Archive
                  </Button>

                  {blog.status === "draft" ? (
                    <Button size="sm" onClick={() => setShowPublishDialog(true)}>Publish</Button>
                  ) : (
                    <Button
                      size="sm"
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

              {/* Delete — always available */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:border-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this story?</AlertDialogTitle>
                    <AlertDialogDescription>
                      <strong>"{blog.title}"</strong> will be permanently deleted. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* ── Editor — always mounted so it never loses state on mode toggle ── */}
      <div style={{ display: mode === "edit" ? undefined : "none" }}>
        <NotionEditor
          key={blog.id}
          initial={currentHtmlRef.current || initialHtml}
          onChange={handleChange}
        />
      </div>

      {/* ── Preview — rendered from the live HTML ref ── */}
      {mode === "preview" && (
        <div className="rounded-lg border bg-background p-6">
          <div className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">Preview</div>
          <BlockRenderer blocks={previewBlocks} />
        </div>
      )}

      {/* ── Cancel changes confirmation dialog ── */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits to <strong>"{blog.title}"</strong> will be discarded and the story will revert to its last saved state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Publish dialog (drafts only) ── */}
      {showPublishDialog && (
        <PublishDialog
          blog={blog}
          open={showPublishDialog}
          onClose={() => setShowPublishDialog(false)}
          onPublished={(slug) => nav(`/blog/${slug}`)}
        />
      )}

      {/* ── Settings side panel ── */}
      <BlogSettingsPanel blog={blog} open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
