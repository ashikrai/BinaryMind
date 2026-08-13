import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useBlogs } from "@/features/blogs/blogStore";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const allBlogs = useBlogs((s) => s.blogs);

  const results = useMemo(() => {
    const published = allBlogs.filter((b) => b.status === "published");
    const needle = q.toLowerCase().trim();
    if (!needle) return published;
    return published.filter((b) => {
      const hay = [
        b.title,
        b.description,
        ...b.tags,
        ...b.categories,
        ...b.blocks.map((x) => x.content),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q, allBlogs]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-3xl font-bold">Search</h1>
      <Input
        autoFocus
        placeholder="Search titles, tags, content…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setParams({ q: e.target.value });
        }}
      />
      <div className="mt-6 space-y-4">
        {results.length === 0 && (
          <p className="text-muted-foreground">No stories match "{q}".</p>
        )}
        {results.map((b) => (
          <Link
            key={b.id}
            to={`/blog/${b.slug}`}
            className="flex gap-4 rounded-lg border p-4 hover:bg-muted/40"
          >
            {b.coverImage && (
              <img
                src={b.coverImage}
                alt=""
                loading="lazy"
                className="h-16 w-24 flex-shrink-0 rounded object-cover"
              />
            )}
            <div className="min-w-0">
              <div className="font-serif text-lg font-semibold">{b.title}</div>
              {b.description && (
                <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{b.description}</div>
              )}
              {b.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {b.tags.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
