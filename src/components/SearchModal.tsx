import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useBlogs } from "@/features/blogs/blogStore";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const allBlogs = useBlogs((s) => s.blogs);

  const results = useMemo(() => {
    const published = allBlogs.filter((b) => b.status === "published");
    const needle = q.toLowerCase().trim();

    // Empty query — show nothing (prompt the user to type)
    if (!needle) return [];

    // Split into individual words; require ALL words to match (AND logic)
    const words = needle.split(/\s+/).filter(Boolean);

    /**
     * Convert raw Tiptap HTML block content to searchable plain text.
     * Every block type uses HTML output, so we must strip tags from all of them.
     * We decode common HTML entities so "&amp;" doesn't block a match on "&".
     */
    function blockToPlainText(raw: string): string {
      return raw
        .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ") // drop entire anchor + link text
        .replace(/<[^>]*>/g, " ")                   // strip remaining HTML tags
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    const scored = published.flatMap((b) => {
      const titleText = b.title.toLowerCase();
      const descText  = (b.description ?? "").toLowerCase();
      const tagsText  = b.tags.map((t) => t.toLowerCase());
      const catsText  = b.categories.map((c) => c.toLowerCase());
      // Concatenate all block plain-text bodies into one searchable string
      const bodyText  = b.blocks.map((x) => blockToPlainText(x.content)).join(" ");

      let score = 0;
      for (const word of words) {
        let wordHit = false;

        // Title match — use word-boundary check for short words to avoid
        // substring false positives (e.g. "aws" inside "drawstring")
        const titleMatch =
          word.length <= 4
            ? new RegExp(`\\b${word}\\b`).test(titleText)
            : titleText.includes(word);
        if (titleMatch) {
          score += titleText === word ? 100 : 40;
          wordHit = true;
        }

        // Tags — exact tag match only (no substring within a tag)
        if (tagsText.some((t) => t === word || t.includes(word))) {
          score += 20;
          wordHit = true;
        }
        // Categories
        if (catsText.some((c) => c === word || c.includes(word))) {
          score += 15;
          wordHit = true;
        }
        // Description
        if (descText.includes(word)) {
          score += 10;
          wordHit = true;
        }
        // Body — use word-boundary regex so "aws" doesn't match "drawstring"
        if (word.length >= 2) {
          const bodyMatch =
            word.length <= 5
              ? new RegExp(`\\b${word}\\b`).test(bodyText)
              : bodyText.includes(word);
          if (bodyMatch) {
            score += 3;
            wordHit = true;
          }
        }

        // AND logic: every word must hit at least one field
        if (!wordHit) return [];
      }

      return [{ blog: b, score }];
    });

    // Sort by descending score, return blogs only
    return scored
      .sort((a, b) => b.score - a.score)
      .map((s) => s.blog);
  }, [q, allBlogs]);

  // Focus input when modal opens, reset query on close
  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  function handleSelectBlog(slug: string) {
    onClose();
    navigate(`/blog/${slug}`);
  }

  return (
    /* Backdrop */
    <div
      className="search-modal-backdrop"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Search"
    >
      {/* Modal panel — stop click propagation so clicks inside don't close */}
      <div
        className="search-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input row */}
        <div className="search-modal-input-row">
          <Search className="search-modal-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="search-modal-input"
            placeholder="Search titles, tags, content…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            className="search-modal-close"
            onClick={onClose}
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="search-modal-results">
          {!q.trim() && (
            <p className="search-modal-empty">Type to search stories…</p>
          )}
          {q.trim() && results.length === 0 && (
            <p className="search-modal-empty">No stories match "{q}".</p>
          )}
          {results.map((b) => (
            <button
              key={b.id}
              className="search-modal-result-item"
              onClick={() => handleSelectBlog(b.slug)}
            >
              {b.coverImage && (
                <img
                  src={b.coverImage}
                  alt=""
                  loading="lazy"
                  className="search-modal-result-cover"
                />
              )}
              <div className="search-modal-result-body">
                <div className="search-modal-result-title">{b.title}</div>
                {b.description && (
                  <div className="search-modal-result-desc">{b.description}</div>
                )}
                {b.tags.length > 0 && (
                  <div className="search-modal-result-tags">
                    {b.tags.slice(0, 4).map((t) => (
                      <span key={t} className="search-modal-tag">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
