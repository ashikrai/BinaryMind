import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useBookmarks } from "@/features/bookmarks/bookmarkStore";
import { useBlogs } from "@/features/blogs/blogStore";

export default function Bookmarks() {
  const ids = useBookmarks((s) => s.ids);
  const allBlogs = useBlogs((s) => s.blogs);
  const blogs = useMemo(
    () => allBlogs.filter((b) => ids.includes(b.id)),
    [allBlogs, ids],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-serif text-3xl font-bold">Your bookmarks</h1>
      {blogs.length === 0 ? (
        <p className="text-muted-foreground">You haven't bookmarked any stories yet.</p>
      ) : (
        <ul className="space-y-4">
          {blogs.map((b) => (
            <li key={b.id}>
              <Link to={`/blog/${b.slug}`} className="block rounded-lg border p-4 hover:bg-muted/40">
                <div className="font-serif text-lg font-semibold">{b.title}</div>
                <div className="text-xs text-muted-foreground">{b.stats.readingTime} min read</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
