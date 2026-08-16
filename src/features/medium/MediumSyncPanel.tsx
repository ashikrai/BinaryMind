/**
 * MediumSyncPanel
 *
 * Shown on the Profile page. Lets users:
 *   1. Connect / disconnect their Medium integration token
 *   2. Browse all their Medium posts (via RSS feed) and select which to import
 *      – non-imported posts are pre-checked automatically
 *   3. See the last imported blog with a direct link
 */
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMedium } from "./mediumStore";
import type { MediumRssPost } from "./mediumStore";
import { useAuth } from "@/features/auth/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Link2,
  Link2Off,
  Download,
  ExternalLink,
  RefreshCw,
  Rss,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function MediumSyncPanel() {
  const session = useAuth((s) => s.session!);
  const userId = session.user.id;
  const navigate = useNavigate();
  const {
    connected, mediumUser, integrationToken, loading,
    rssPosts, rssLoading, rssAutoSelected,
    lastImportedBlog,
    load, connect, disconnect, fetchRssPosts, importByUrl,
  } = useMedium();

  const [tokenInput, setTokenInput] = useState("");
  const [saving, setSaving] = useState(false);

  // RSS picker — initialised from store's auto-selected set each time feed loads
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importingBulk, setImportingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Load on mount
  useEffect(() => { load(userId); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill token field from store
  useEffect(() => { if (integrationToken) setTokenInput(integrationToken); }, [integrationToken]);

  // Sync selection whenever the store's auto-selected set changes (after feed load)
  // useEffect(() => { setSelected(new Set(rssAutoSelected)); }, [rssAutoSelected]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;
    setSaving(true);
    try {
      await connect(userId, tokenInput.trim());
      toast.success("Medium account connected");
    } catch (err: unknown) {
      toast.error(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your Medium account? Imported posts will remain in BinaryMind.")) return;
    await disconnect(userId);
    setTokenInput("");
    setSelected(new Set());
    toast.success("Medium account disconnected");
  };

  const toggleSelect = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  };

  // Already-imported Medium URLs (to grey them out in the picker)
  const importedUrls = new Set(
    useMedium.getState().importedPosts.map((p) => p.mediumUrl).filter(Boolean) as string[],
  );

  const nonImportedCount = rssPosts.filter((p) => !importedUrls.has(p.url)).length;
  const toggleSelectAll = () => {
    if (selected.size === nonImportedCount) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rssPosts.filter((p) => !importedUrls.has(p.url)).map((p) => p.url)));
    }
  };

  // Import all selected RSS posts one by one using content from RSS directly
  const handleImportSelected = async () => {
    const toImport = rssPosts.filter((p) => selected.has(p.url));
    if (!toImport.length) return;
    setImportingBulk(true);
    setBulkProgress({ done: 0, total: toImport.length });
    let successCount = 0;
    let lastBlog: { id: string; title: string; slug: string } | null = null;

    for (let i = 0; i < toImport.length; i++) {
      const rssPost = toImport[i];
      try {
        const blog = await importByUrl(
          rssPost.url, userId, session.user.name, session.user.avatar, rssPost,
        );
        if (blog) { 
          successCount = successCount + 1;
          lastBlog = { id: blog.id, title: blog.title, slug: blog.slug }; 
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("already been imported")) toast.error(`"${rssPost.title}": ${msg}`);
      }
      setBulkProgress({ done: i + 1, total: toImport.length });
    }

    setImportingBulk(false);
    setBulkProgress(null);
    setSelected(new Set());

    if (successCount > 0 && lastBlog) {

      toast.custom((id) => (
        <div 
          onClick={() => toast.dismiss(id)}
          className="hover:cursor-pointer p-4"
        >
          <div className="flex flex-row gap-3 items-end pb-2">
            <img src={mediumUser?.imageUrl} height={30} width={30} className="rounded-full border-2 dark:border-lime-100 border-lime-400"/>
            <p>
              {successCount} post{successCount > 1 ? "s" : ""} imported as drafts.{" "}
              <span onClick={() => navigate(`/my-stories?tab=medium-imports`)} className="text-xs text-blue-500 underline font-medium hover:cursor-pointer flex flex-row">
                <Link2 className="text-blue-500 mr-2 h-4 w-4" /> All Medium Imports 
              </span>
            </p>
          </div>
          <p onClick={() => navigate(`/blog/${lastBlog.slug}`)}  className="text-xs font-medium hover:cursor-pointer">
            {/* <span className="font-semibold text-xs dark:text-blue-100 text-blue-800/80">Last Import: </span>  */}
            <div className="flex flex-row">
              <Link2 className="text-blue-500  mr-0.5 h-4 w-4" />
              <span className="underline text-blue-500 pl-0.5 truncate max-w-xs">
                {lastBlog.title}
              </span> 
            </div>
          </p>
        </div>
      ));
    } else if (successCount === 0) {
      toast.info("All selected posts were already imported.");
    }
  };
  
  
  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Connection status card ── */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          {connected && mediumUser ? (
            <>
              <Avatar className="h-10 w-10">
                <AvatarImage src={mediumUser.imageUrl} alt={mediumUser.name} />
                <AvatarFallback>{mediumUser.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{mediumUser.name}</span>
                  <Badge variant="secondary" className="bg-lime-500 text-white dark:bg-green-800 text-xs">
                    Connected
                  </Badge>
                </div>
                <a
                  href={`https://medium.com/@${mediumUser.username}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                >
                  @{mediumUser.username} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </>
          ) : (
            <div>
              <div className="font-medium">Medium</div>
              <div className="text-xs text-muted-foreground">Not connected</div>
            </div>
          )}
        </div>
        {connected && (
          <Button size="sm" variant="destructive" onClick={handleDisconnect} disabled={loading}>
            <Link2Off className="mr-2 h-4 w-4" /> Disconnect
          </Button>
        )}
      </div>

      {/* ── Token input (only when not connected) ── */}
      {!connected && (
        <div className="space-y-2">
          <Label htmlFor="medium-token">Medium Integration Token</Label>
          <p className="text-xs text-muted-foreground">
            Generate a token in your{" "}
            <a href="https://medium.com/me/settings/security" target="_blank" rel="noopener noreferrer" className="underline">
              Medium security settings
            </a>{" "}
            under &ldquo;Integration Tokens&rdquo;.
          </p>
          <div className="flex gap-2">
            <Input
              id="medium-token" type="password" value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste your integration token…"
              className="font-mono text-xs"
            />
            <Button onClick={handleConnect} disabled={saving || !tokenInput.trim()}>
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Connect
            </Button>
          </div>
        </div>
      )}

      {/* ── Connected: RSS feed picker ── */}
      {connected && (
        <>
          <Separator />

          {/* ── Last imported blog quick-link ── */}
          {lastImportedBlog && (
            <div className="rounded-md border border-dashed bg-muted/40 px-4 py-2 text-sm">
              Last imported:{" "}
              <Link
                to={`/edit/${lastImportedBlog.id}`}
                className="font-medium underline-offset-2 hover:underline"
              >
                {lastImportedBlog.title}
              </Link>{" "}
              <span className="text-muted-foreground text-xs">(draft)</span>
            </div>
          )}

          {/* ── RSS post browser ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Your Medium Posts</Label>
              <Button
                size="sm" variant="outline"
                onClick={() => fetchRssPosts()}
                disabled={rssLoading}
              >
                {rssLoading
                  ? <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                  : <Rss className="mr-2 h-3 w-3" />}
                {rssPosts.length > 0 ? "Refresh" : "Load posts"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Posts are fetched from your Medium RSS feed. Posts not yet imported are pre-selected — deselect any you want to skip.
            </p>

            {rssPosts.length > 0 && (
              <>
                {/* Select-all / import bar */}
                <div className="flex items-center gap-2 rounded border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <Checkbox
                    id="select-all"
                    checked={selected.size > 0 && selected.size === nonImportedCount}
                    onCheckedChange={toggleSelectAll}
                  />
                  <label htmlFor="select-all" className="cursor-pointer select-none">
                    {selected.size > 0
                      ? `${selected.size} of ${nonImportedCount} selected`
                      : `${nonImportedCount} posts not yet imported`}
                  </label>
                  {selected.size > 0 && (
                    <Button
                      size="sm"
                      className="ml-auto h-7 text-xs"
                      onClick={handleImportSelected}
                      disabled={importingBulk}
                    >
                      {importingBulk && bulkProgress
                        ? <><RefreshCw className="mr-1 h-3 w-3 animate-spin" />{bulkProgress.done}/{bulkProgress.total}</>
                        : <><Download className="mr-1 h-3 w-3" />Import {selected.size} selected</>}
                    </Button>
                  )}
                </div>

                {/* Post list */}
                <ScrollArea className="h-72 rounded-md border">
                  <ul className="divide-y">
                    {rssPosts.map((post) => {
                      const alreadyDone = importedUrls.has(post.url);
                      return (
                        <RssPostRow
                          key={post.url}
                          post={post}
                          checked={selected.has(post.url)}
                          alreadyImported={alreadyDone}
                          onToggle={() => !alreadyDone && toggleSelect(post.url)}
                        />
                      );
                    })}
                  </ul>
                </ScrollArea>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── RSS post row ────────────────────────────────────────────────────────────
function RssPostRow({
  post,
  checked,
  alreadyImported,
  onToggle,
}: {
  post: MediumRssPost;
  checked: boolean;
  alreadyImported: boolean;
  onToggle: () => void;
}) {
  const pubDate = post.pubDate
    ? (() => { try { return formatDistanceToNow(new Date(post.pubDate)) + " ago"; } catch { return ""; } })()
    : "";

  return (
    <li
      className={[
        "flex items-start gap-3 px-3 py-2.5 text-sm transition-colors",
        alreadyImported ? "opacity-50" : "cursor-pointer hover:bg-muted/40",
      ].join(" ")}
      onClick={onToggle}
    >
      <Checkbox
        checked={alreadyImported ? true : checked}
        disabled={alreadyImported}
        onCheckedChange={onToggle}
        className="mt-0.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      />
      {post.thumbnail && (
        <img src={post.thumbnail} alt="" className="mt-0.5 h-10 w-14 shrink-0 rounded object-cover" loading="lazy" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium leading-snug">{post.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {pubDate && <span>{pubDate}</span>}
          {post.categories.slice(0, 3).map((c) => (
            <Badge key={c} variant="outline" className="h-4 px-1 text-[10px]">{c}</Badge>
          ))}
          {alreadyImported && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">Imported</Badge>
          )}
        </div>
        {post.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{post.description}</p>
        )}
      </div>
      <a
        href={post.url} target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </li>
  );
}
