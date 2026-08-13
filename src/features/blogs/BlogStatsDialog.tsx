import type { Blog } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Heart, Share2, Clock, AlignLeft, BarChart2 } from "lucide-react";
import { format } from "date-fns";

interface BlogStatsDialogProps {
  blog: Blog;
  open: boolean;
  onClose: () => void;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

/**
 * Dialog showing blog analytics — views, likes, shares, reading time, word count.
 * Only visible to the author (enforced in parent components).
 */
export function BlogStatsDialog({ blog, open, onClose }: BlogStatsDialogProps) {
  const { stats } = blog;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            <BarChart2 className="h-5 w-5 text-primary" />
            Story stats
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Blog title */}
          <div className="rounded-lg border bg-muted/20 px-4 py-3">
            <p className="text-sm font-medium leading-snug">{blog.title || "Untitled"}</p>
            {blog.publishedAt && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Published {format(new Date(blog.publishedAt), "MMM d, yyyy")}
              </p>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Eye className="h-3.5 w-3.5" />}
              label="Views"
              value={stats.views.toLocaleString()}
            />
            <StatCard
              icon={<Heart className="h-3.5 w-3.5" />}
              label="Likes"
              value={stats.likes.toLocaleString()}
            />
            <StatCard
              icon={<Share2 className="h-3.5 w-3.5" />}
              label="Shares"
              value={stats.shares.toLocaleString()}
            />
            <StatCard
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Reading time"
              value={`${stats.readingTime} min`}
            />
          </div>

          <StatCard
            icon={<AlignLeft className="h-3.5 w-3.5" />}
            label="Word count"
            value={stats.wordCount.toLocaleString()}
          />

          {/* Tags */}
          {blog.tags.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {blog.tags.map((t) => (
                  <span key={t} className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
