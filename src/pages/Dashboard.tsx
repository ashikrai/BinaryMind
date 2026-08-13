import { useMemo } from "react";
import { useAuth } from "@/features/auth/authStore";
import { useBlogs } from "@/features/blogs/blogStore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const user = useAuth((s) => s.session!.user);
  const blogs = useBlogs((s) => s.blogs);
  const mine = useMemo(() => blogs.filter((b) => b.authorId === user.id), [blogs, user.id]);

  const counts = useMemo(() => {
    return {
      total: mine.length,
      drafts: mine.filter((b) => b.status === "draft").length,
      published: mine.filter((b) => b.status === "published").length,
      archived: mine.filter((b) => b.status === "archived").length,
    };
  }, [mine]);

  const totals = useMemo(() => {
    return mine.reduce(
      (acc, b) => ({
        views: acc.views + b.stats.views,
        likes: acc.likes + b.stats.likes,
        shares: acc.shares + b.stats.shares,
        words: acc.words + b.stats.wordCount,
      }),
      { views: 0, likes: 0, shares: 0, words: 0 }
    );
  }, [mine]);

  const chartData = useMemo(() => {
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = subDays(new Date(), 13 - i);
      const key = format(d, "yyyy-MM-dd");
      const count = mine.filter(
        (b) => b.publishedAt && format(parseISO(b.publishedAt), "yyyy-MM-dd") === key
      ).length;
      return { day: format(d, "MMM d"), published: count };
    });
    return days;
  }, [mine]);

  const mostViewed = [...mine].sort((a, b) => b.stats.views - a.stats.views)[0];
  const avgLength = mine.length ? Math.round(totals.words / mine.length) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {user.name}.</p>
        </div>
        <Link
          to="/write"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New story
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Total stories" value={counts.total} />
        <Stat label="Drafts" value={counts.drafts} />
        <Stat label="Published" value={counts.published} />
        <Stat label="Archived" value={counts.archived} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Views" value={totals.views} />
        <Stat label="Likes" value={totals.likes} />
        <Stat label="Total words" value={totals.words} />
        <Stat label="Avg length" value={`${avgLength} words`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publishing (last 14 days)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="published" radius={[4, 4, 0, 0]} fill="currentColor" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Writing insights</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Most viewed</div>
            <div className="font-medium">{mostViewed?.title ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Average reading time</div>
            <div className="font-medium">
              {mine.length
                ? Math.round(mine.reduce((a, b) => a + b.stats.readingTime, 0) / mine.length)
                : 0}{" "}
              min
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
