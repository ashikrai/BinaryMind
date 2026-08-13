import { useState, useEffect, useRef } from "react";
import { useBlogs } from "@/features/blogs/blogStore";
import { supabase } from "@/lib/supabase";
import type { Blog } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, ImageIcon, UserPlus, Tag } from "lucide-react";
import { toast } from "sonner";

const MAX_TAGS = 7;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface UserSuggestion {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface PublishDialogProps {
  blog: Blog;
  open: boolean;
  onClose: () => void;
  onPublished: (slug: string) => void;
}

/**
 * Liquid-glass publish dialog shown before a blog goes live.
 * Lets the author set cover image, tags, and collaborators.
 */
export function PublishDialog({ blog, open, onClose, onPublished }: PublishDialogProps) {
  const update = useBlogs((s) => s.update);
  const setStatus = useBlogs((s) => s.setStatus);
  const setCollaborators = useBlogs((s) => s.setCollaborators);

  const [coverImage, setCoverImage] = useState(blog.coverImage ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(blog.tags.slice(0, MAX_TAGS));
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>((blog.collaborators ?? []).map((c) => c.email));
  const [publishing, setPublishing] = useState(false);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setCoverImage(blog.coverImage ?? "");
    setTags(blog.tags.slice(0, MAX_TAGS));
    setEmails((blog.collaborators ?? []).map((c) => c.email));
    setTagInput("");
    setEmailInput("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // User autocomplete fetch
  useEffect(() => {
    const q = emailInput.trim().toLowerCase();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await db
        .from("users")
        .select("id, email, name, avatar")
        .or(`email.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(6);
      if (data) {
        const filtered = (data as UserSuggestion[]).filter((u) => !emails.includes(u.email));
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [emailInput, emails]);

  // ── Tag helpers ────────────────────────────────────────────────────────────
  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t || tags.includes(t) || tags.length >= MAX_TAGS) return;
    setTags((prev) => [...prev, t]);
    setTagInput("");
  };
  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  // ── Collaborator helpers ───────────────────────────────────────────────────
  const addEmail = (raw: string) => {
    const e = raw.trim().toLowerCase();
    if (!e || emails.includes(e)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error("Invalid email address");
      return;
    }
    setEmails((prev) => [...prev, e]);
    setEmailInput("");
    setShowSuggestions(false);
  };
  const removeEmail = (e: string) => setEmails((prev) => prev.filter((x) => x !== e));
  const selectSuggestion = (user: UserSuggestion) => {
    setEmails((prev) => (prev.includes(user.email) ? prev : [...prev, user.email]));
    setEmailInput("");
    setShowSuggestions(false);
  };

  // ── Publish ────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    setPublishing(true);
    try {
      await update(blog.id, { coverImage: coverImage.trim() || undefined, tags });
      await setCollaborators(blog.id, emails);
      await setStatus(blog.id, "published");
      toast.success("Published!");
      onClose();
      onPublished(blog.slug);
    } catch {
      toast.error("Failed to publish — check your connection");
    } finally {
      setPublishing(false);
    }
  };

  if (!open) return null;

  return (
    /* Backdrop with heavy blur */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-label="Publish story"
    >
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Liquid-glass card */}
      <div
        className="relative z-10 w-full max-w-lg rounded-3xl border border-white/60 bg-white/10 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm dark:bg-black/30"
        style={{
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        {/* Glass sheen strip */}
        <div className="absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-white/90 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-xl font-semibold text-black/50 text-foreground">Ready to publish?</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 space-y-5 pb-4">
          {/* Cover image */}
          <GlassSection icon={<ImageIcon className="h-4 w-4" />} label="Cover image">
            {coverImage && (
              <img
                src={coverImage}
                alt="Cover preview"
                className="h-36 w-full rounded-2xl object-cover mb-2"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            )}
            <GlassInput
              type="url"
              placeholder="https://images.unsplash.com/…"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
            />
          </GlassSection>

          {/* Tags */}
          <GlassSection
            icon={<Tag className="h-4 w-4" />}
            label="Tags"
            aside={
              <span className="text-xs text-white/60">
                {tags.length}/{MAX_TAGS}
              </span>
            }
          >
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="opacity-60 hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            {tags.length < MAX_TAGS && (
              <GlassInput
                placeholder="Add tag — Enter or comma"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                onBlur={() => tagInput.trim() && addTag(tagInput)}
              />
            )}
          </GlassSection>

          {/* Collaborators */}
          <GlassSection icon={<UserPlus className="h-4 w-4" />} label="Collaborators">
            <p className="mb-2 text-xs font-semibold text-white/50">
              Add by email (must have a Binary Mind account)
            </p>
            {emails.length > 0 && (
              <div className="mb-2 space-y-1.5 rounded-2xl bg-white/10 p-2 backdrop-blur-sm">
                {emails.map((email) => {
                  const collab = (blog.collaborators ?? []).find((c) => c.email === email);
                  return (
                    <div key={email} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={collab?.avatar} />
                        <AvatarFallback className="text-xs bg-white/20">
                          {(collab?.name ?? email).slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {collab?.name ? `${collab.name} (${email})` : email}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="opacity-50 hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="relative" ref={suggestionsRef}>
              <div className="flex gap-2">
                <GlassInput
                  type="email"
                  placeholder="collaborator@example.com"
                  value={emailInput}
                  autoComplete="off"
                  className="flex-1"
                  onChange={(e) => setEmailInput(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (showSuggestions && suggestions[0]) {
                        selectSuggestion(suggestions[0]);
                      } else {
                        addEmail(emailInput);
                      }
                    }
                    if (e.key === "Escape") setShowSuggestions(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => addEmail(emailInput)}
                  disabled={!emailInput.trim()}
                  className="rounded-xl bg-white/15 px-4 text-sm font-medium backdrop-blur-sm hover:bg-white/25 disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </div>
              {showSuggestions && (
                <div className="absolute z-50 mt-1 w-full rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-2xl overflow-hidden">
                  {suggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/15 transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectSuggestion(u);
                      }}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={u.avatar} />
                        <AvatarFallback className="text-xs bg-white/20">
                          {u.name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs opacity-60">{u.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </GlassSection>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="flex-1 rounded-2xl bg-white/10 py-2.5 text-sm font-medium backdrop-blur-sm hover:bg-white/20 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 rounded-2xl bg-foreground py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {publishing ? "Publishing…" : "Publish story"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small glass primitives ────────────────────────────────────────────────────

function GlassSection({
  icon,
  label,
  aside,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/8 p-4 backdrop-blur-sm border border-white/10">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium opacity-80">
          {icon}
          {label}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

function GlassInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/70 backdrop-blur-sm",
        "focus:outline-none focus:ring-2 focus:ring-white/30",
        "dark:bg-white/5 dark:border-white/10",
        className,
      ].join(" ")}
    />
  );
}
