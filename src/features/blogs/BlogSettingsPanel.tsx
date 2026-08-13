import { useState, useEffect, useRef } from "react";
import { useBlogs } from "@/features/blogs/blogStore";
import { supabase } from "@/lib/supabase";
import type { Blog } from "@/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, ImageIcon, UserPlus } from "lucide-react";
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

interface BlogSettingsPanelProps {
  blog: Blog;
  open: boolean;
  onClose: () => void;
  /** If provided, the panel will have a "Publish" action instead of "Save" */
  publishMode?: boolean;
  onPublished?: (slug: string) => void;
}

/**
 * Reusable side-panel for blog settings (cover image, tags, collaborators).
 * Used from both MyStories (published) and EditBlog (draft/published).
 * In publishMode=true it also publishes the blog after saving.
 */
export function BlogSettingsPanel({
  blog,
  open,
  onClose,
  publishMode = false,
  onPublished,
}: BlogSettingsPanelProps) {
  const update = useBlogs((s) => s.update);
  const setStatus = useBlogs((s) => s.setStatus);
  const setCollaborators = useBlogs((s) => s.setCollaborators);

  const [coverImage, setCoverImage] = useState(blog.coverImage ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(blog.tags.slice(0, MAX_TAGS));
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>((blog.collaborators ?? []).map((c) => c.email));
  const [saving, setSaving] = useState(false);

  // Collaborator autocomplete
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Re-sync local state when the blog prop changes (e.g. after a store update)
  useEffect(() => {
    if (open) {
      setCoverImage(blog.coverImage ?? "");
      setTags(blog.tags.slice(0, MAX_TAGS));
      setEmails((blog.collaborators ?? []).map((c) => c.email));
      setTagInput("");
      setEmailInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, blog.id]);

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

  // Fetch user suggestions as user types
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

  // ── Email helpers ──────────────────────────────────────────────────────────
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

  // ── Save / Publish ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await update(blog.id, { coverImage: coverImage.trim() || undefined, tags });
      await setCollaborators(blog.id, emails);
      if (publishMode) {
        await setStatus(blog.id, "published");
        toast.success("Published!");
        onClose();
        onPublished?.(blog.slug);
      } else {
        toast.success("Settings saved");
        onClose();
      }
    } catch {
      toast.error(publishMode ? "Failed to publish" : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-serif text-lg">
            {publishMode ? "Ready to publish?" : "Blog settings"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto pr-1">
          {/* Cover image */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4" />
              Cover image URL
            </Label>
            {coverImage && (
              <img
                src={coverImage}
                alt="Cover preview"
                className="h-28 w-full rounded-md object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            )}
            <Input
              type="url"
              placeholder="https://images.unsplash.com/…"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>Tags</span>
              <span className="text-xs font-normal text-muted-foreground">
                {tags.length}/{MAX_TAGS}
              </span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1 rounded-full">
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    aria-label={`Remove tag ${t}`}
                    className="ml-0.5 rounded-full hover:text-destructive focus-visible:outline-none"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {tags.length < MAX_TAGS && (
              <Input
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
          </div>

          {/* Collaborators */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" />
              Collaborators
            </Label>
            <p className="text-xs text-muted-foreground">
              Add by email (must have a Binary Mind account)
            </p>
            {emails.length > 0 && (
              <div className="space-y-1.5 rounded-lg border p-2">
                {emails.map((email) => {
                  const c = (blog.collaborators ?? []).find((x) => x.email === email);
                  return (
                    <div key={email} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={c?.avatar} />
                        <AvatarFallback className="text-xs">
                          {(c?.name ?? email).slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {c?.name ? `${c.name} (${email})` : email}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="text-muted-foreground hover:text-destructive"
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
                <Input
                  type="email"
                  placeholder="collaborator@example.com"
                  value={emailInput}
                  autoComplete="off"
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addEmail(emailInput)}
                  disabled={!emailInput.trim()}
                >
                  Add
                </Button>
              </div>
              {showSuggestions && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-md">
                  {suggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectSuggestion(u);
                      }}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={u.avatar} />
                        <AvatarFallback className="text-xs">
                          {u.name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex gap-2 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving
              ? publishMode
                ? "Publishing…"
                : "Saving…"
              : publishMode
                ? "Publish story"
                : "Save settings"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
