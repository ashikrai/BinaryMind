/**
 * NotionEditor — Notion-style Tiptap v3 editor.
 *
 * Features:
 *  • "/" slash menu — block type picker, anchored to caret position
 *  • ":" emoji picker — full phone-like searchable emoji grid w/ category tabs
 *  • Drag-to-reorder — GripVertical handle in left gutter on hover
 *  • Bubble toolbar on text selection — bold/italic/underline/strike/code/
 *    highlight, text color picker, highlight color picker, heading toggles,
 *    alignment buttons, link insert
 *  • Heading ToC sidebar on the right
 *  • Styled placeholder: slash shown as a <kbd> badge
 *  • Images: URL-based insertion, resize handles (drag), floating toolbar
 *    (alignment + width presets + crop dialog)
 *  • All colours from CSS variables → theme-aware
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Extension } from "@tiptap/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey, NodeSelection } from "@tiptap/pm/state";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { ResizableImageLink } from "./extensions/ResizableImageLink";
import { CodeBlockView } from "./extensions/CodeBlockView";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Minus,
  Image as ImageIcon,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  X,
  Hash,
  GripVertical,
  Palette,
  Search,
} from "lucide-react";
import { EMOJI_CATEGORIES, ALL_EMOJIS, type EmojiItem } from "./emojiData";

// ─────────────────────────────────────────────────────────────────────────────
// Custom placeholder extension
// ─────────────────────────────────────────────────────────────────────────────

const PLACEHOLDER_KEY = new PluginKey("styledPlaceholder");

const StyledPlaceholder = Extension.create({
  name: "styledPlaceholder",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: PLACEHOLDER_KEY,
        props: {
          decorations(state) {
            const { doc, selection } = state;
            const isDocEmpty =
              doc.childCount === 1 &&
              doc.firstChild?.type.name === "paragraph" &&
              doc.firstChild?.nodeSize === 2;
            if (!isDocEmpty) return null;
            const deco = Decoration.widget(1, () => {
              const span = document.createElement("span");
              span.className = "notion-placeholder";
              span.setAttribute("contenteditable", "false");
              span.innerHTML =
                'Start writing, or type <kbd class="notion-placeholder-kbd">/</kbd> for commands…';
              span.style.pointerEvents = "none";
              span.style.userSelect = "none";
              return span;
            });
            void selection;
            return DecorationSet.create(doc, [deco]);
          },
        },
      }),
    ];
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Color palettes
// ─────────────────────────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Gray", value: "#6b7280" },
  { label: "Brown", value: "#92400e" },
  { label: "Orange", value: "#ea580c" },
  { label: "Yellow", value: "#ca8a04" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#9333ea" },
  { label: "Pink", value: "#db2777" },
  { label: "Red", value: "#dc2626" },
];

const HIGHLIGHT_COLORS = [
  { label: "None", value: "" },
  { label: "Yellow", value: "#fef08a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Purple", value: "#e9d5ff" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Orange", value: "#fed7aa" },
  { label: "Red", value: "#fecaca" },
  { label: "Gray", value: "#e5e7eb" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Slash-command items
// ─────────────────────────────────────────────────────────────────────────────

interface SlashItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  action: (editor: ReturnType<typeof useEditor>) => void;
}

const SLASH_ITEMS: SlashItem[] = [
  { id: "text", label: "Text", description: "Plain paragraph", icon: Type,
    keywords: ["paragraph", "text", "p"], action: (e) => e?.chain().focus().setParagraph().run() },
  { id: "h1", label: "Heading 1", description: "Big section title", icon: Heading1,
    keywords: ["h1", "heading", "title", "1"], action: (e) => e?.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: "h2", label: "Heading 2", description: "Medium section title", icon: Heading2,
    keywords: ["h2", "heading", "subtitle", "2"], action: (e) => e?.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: "h3", label: "Heading 3", description: "Small section title", icon: Heading3,
    keywords: ["h3", "heading", "3"], action: (e) => e?.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: "bullet", label: "Bullet List", description: "Simple unordered list", icon: List,
    keywords: ["bullet", "list", "ul", "unordered"], action: (e) => e?.chain().focus().toggleBulletList().run() },
  { id: "numbered", label: "Numbered List", description: "Ordered list with numbers", icon: ListOrdered,
    keywords: ["numbered", "ordered", "list", "ol", "1."], action: (e) => e?.chain().focus().toggleOrderedList().run() },
  { id: "todo", label: "To-do List", description: "Track tasks with checkboxes", icon: ListTodo,
    keywords: ["todo", "task", "check", "checkbox"], action: (e) => e?.chain().focus().toggleTaskList().run() },
  { id: "quote", label: "Quote", description: "Capture a quote", icon: Quote,
    keywords: ["quote", "blockquote"], action: (e) => e?.chain().focus().toggleBlockquote().run() },
  { id: "code", label: "Code Block", description: "Write code with syntax style", icon: Code,
    keywords: ["code", "codeblock", "pre", "```"], action: (e) => e?.commands.setCodeBlockView() },
  { id: "divider", label: "Divider", description: "A visual horizontal line", icon: Minus,
    keywords: ["divider", "hr", "rule", "line", "---"], action: (e) => e?.chain().focus().setHorizontalRule().run() },
  { id: "image", label: "Image", description: "Embed an image via URL", icon: ImageIcon,
    keywords: ["image", "img", "photo", "picture", "url"], action: () => { /* handled specially */ } },
];

interface PopupCoords { top: number; left: number; }

// ─────────────────────────────────────────────────────────────────────────────
// Image URL dialog
// ─────────────────────────────────────────────────────────────────────────────

function ImageDialog({ open, onClose, onInsert }: {
  open: boolean; onClose: () => void;
  onInsert: (src: string, alt: string) => void;
}) {
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [hasError, setHasError] = useState(false);
  const reset = () => { setSrc(""); setAlt(""); setHasError(false); };
  const handleInsert = () => {
    const url = src.trim();
    if (!url) return;
    onInsert(url, alt.trim());
    reset(); onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Insert Image</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Image URL <span className="text-destructive">*</span></label>
            <Input autoFocus placeholder="https://example.com/photo.jpg" value={src}
              onChange={(e) => { setSrc(e.target.value); setHasError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleInsert()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Alt text (optional)</label>
            <Input placeholder="Describe the image…" value={alt} onChange={(e) => setAlt(e.target.value)} />
          </div>
          {src && !hasError && (
            <div className="overflow-hidden rounded-lg border bg-muted/40">
              <img src={src} alt={alt || "preview"} className="max-h-48 w-full object-contain p-1"
                onError={() => setHasError(true)} />
            </div>
          )}
          {hasError && <p className="text-sm text-destructive">Could not load image — check the URL.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={handleInsert} disabled={!src.trim()}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Link popover
// ─────────────────────────────────────────────────────────────────────────────

function LinkPopover({ initial, onCommit, onClose }: {
  initial: string; onCommit: (url: string) => void; onClose: () => void;
}) {
  const [url, setUrl] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 0); }, []);
  const commit = () => { onCommit(url.trim()); onClose(); };
  return (
    <div className="notion-link-popover flex items-center gap-1 px-2 py-1.5">
      <input ref={inputRef}
        className="h-7 w-52 rounded border bg-background px-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
        placeholder="https://example.com" value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onClose(); }} />
      <Button size="sm" className="h-7 px-2 text-xs" onClick={commit}>Apply</Button>
      <button type="button" onClick={onClose}
        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Color picker popovers (text color + highlight)
// ─────────────────────────────────────────────────────────────────────────────

function ColorPicker({ colors, currentValue, onSelect, onClose }: {
  colors: { label: string; value: string }[];
  currentValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="notion-color-picker" onMouseDown={(e) => e.stopPropagation()}>
      <div className="notion-color-grid">
        {colors.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            className={cn("notion-color-swatch", !value && "notion-color-swatch--none",
              currentValue === value && "notion-color-swatch--active")}
            title={label}
            style={value ? { backgroundColor: value } : undefined}
            onMouseDown={(e) => { e.preventDefault(); onSelect(value); onClose(); }}
          >
            {!value && <span className="notion-color-none-line" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slash command menu
// ─────────────────────────────────────────────────────────────────────────────

function SlashMenu({ query, selectedIndex, onSelect, coords }: {
  query: string; selectedIndex: number;
  onSelect: (item: SlashItem) => void; coords: PopupCoords | null;
}) {
  const filtered = SLASH_ITEMS.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return item.label.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q));
  });
  if (filtered.length === 0) return null;
  const style: React.CSSProperties = coords ? { top: coords.top + 4, left: coords.left } : {};
  return (
    <div className="notion-slash-menu" style={style}>
      {filtered.map((item, i) => {
        const Icon = item.icon;
        return (
          <button key={item.id} type="button"
            className={cn("notion-slash-item", i === selectedIndex && "notion-slash-item--active")}
            onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}>
            <span className="notion-slash-icon"><Icon className="h-4 w-4" /></span>
            <span className="notion-slash-text">
              <span className="notion-slash-label">{item.label}</span>
              <span className="notion-slash-desc">{item.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full phone-like emoji picker
// ─────────────────────────────────────────────────────────────────────────────

function EmojiPicker({ triggerQuery, onSelect, coords, onClose }: {
  /** Query seeded from ":keyword" typed in the editor (may be ""). */
  triggerQuery: string;
  onSelect: (emoji: EmojiItem) => void;
  coords: PopupCoords | null;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id);
  // Internal search box value — pre-filled from the editor trigger query
  const [searchValue, setSearchValue] = useState(triggerQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keep internal search in sync when trigger query changes
  useEffect(() => { setSearchValue(triggerQuery); }, [triggerQuery]);

  // Auto-focus search on mount
  useEffect(() => { setTimeout(() => searchInputRef.current?.focus(), 10); }, []);

  const displayEmojis = useMemo(() => {
    if (!searchValue) {
      return EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.emojis ?? [];
    }
    const q = searchValue.toLowerCase();
    return ALL_EMOJIS.filter(
      (item) => item.name.includes(q) || item.keywords.some((k) => k.includes(q))
    ).slice(0, 72);
  }, [searchValue, activeCategory]);

  const style: React.CSSProperties = coords ? { top: coords.top + 4, left: coords.left } : {};

  return (
    <div className="notion-emoji-picker" style={style} onMouseDown={(e) => e.stopPropagation()}>
      {/* ── Search bar ── */}
      <div className="notion-emoji-search-bar">
        <Search className="notion-emoji-search-icon h-3.5 w-3.5" />
        <input
          ref={searchInputRef}
          className="notion-emoji-search-input"
          placeholder="Search emoji…"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        />
        {searchValue && (
          <button type="button" className="notion-emoji-close" onMouseDown={(e) => { e.preventDefault(); setSearchValue(""); }}>
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* ── Category tabs — only when not searching ── */}
      {!searchValue && (
        <div className="notion-emoji-tabs">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={cn("notion-emoji-tab", activeCategory === cat.id && "notion-emoji-tab--active")}
              title={cat.label}
              onMouseDown={(e) => { e.preventDefault(); setActiveCategory(cat.id); }}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* ── Category label ── */}
      {!searchValue && (
        <div className="notion-emoji-cat-label">
          {EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.label}
        </div>
      )}

      {/* ── Emoji grid ── */}
      <div className="notion-emoji-grid">
        {displayEmojis.map((item) => (
          <button
            key={`${item.name}-${item.emoji}`}
            type="button"
            className="notion-emoji-btn"
            title={`:${item.name}:`}
            onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
          >
            {item.emoji}
          </button>
        ))}
        {displayEmojis.length === 0 && (
          <div className="col-span-8 py-3 text-center text-xs text-muted-foreground">
            No emojis found for "{searchValue}"
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bubble toolbar button
// ─────────────────────────────────────────────────────────────────────────────

function BubbleBtn({ onClick, active, title, children, ref: _ref, ...rest }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title} aria-label={title}
      className={cn("notion-bubble-btn", active && "notion-bubble-btn--active")}
      {...rest}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ToC sidebar
// ─────────────────────────────────────────────────────────────────────────────

interface TocHeading { id: string; level: number; text: string; }

function TocSidebar({ headings, activeId }: { headings: TocHeading[]; activeId: string | null; }) {
  if (headings.length === 0) return null;
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="notion-toc">
      <div className="notion-toc-title"><Hash className="h-3.5 w-3.5" />On this page</div>
      <div className="notion-toc-title">Type '/' for command, and ':' for emoji's</div>
      <nav>
        {headings.map((h) => (
          <button key={h.id} type="button"
            className={cn("notion-toc-item", `notion-toc-h${h.level}`, activeId === h.id && "notion-toc-item--active")}
            onClick={() => scrollTo(h.id)} title={h.text}>
            {h.text}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NotionEditor
// ─────────────────────────────────────────────────────────────────────────────

export interface NotionEditorProps {
  initial: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function NotionEditor({ initial, onChange }: NotionEditorProps) {

  // ── slash state ───────────────────────────────────────────────────────────
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const slashFrom = useRef(0);
  const [slashCoords, setSlashCoords] = useState<PopupCoords | null>(null);

  // ── emoji picker state ────────────────────────────────────────────────────
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const emojiFrom = useRef(0);
  const [emojiCoords, setEmojiCoords] = useState<PopupCoords | null>(null);

  // ── bubble toolbar sub-states ─────────────────────────────────────────────
  const [showLinkEdit, setShowLinkEdit] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // ── image dialog state ────────────────────────────────────────────────────
  const [showImageDialog, setShowImageDialog] = useState(false);
  const imageResolveRef = useRef<((r: { src: string; alt: string } | null) => void) | null>(null);

  // ── drag-and-drop reorder state ───────────────────────────────────────────
  const [dragHandlePos, setDragHandlePos] = useState<{ nodePos: number; top: number } | null>(null);
  /** The doc-position of the node currently being dragged */
  const dragSrcIndex = useRef<number | null>(null);
  /** The top-level child index where the drop indicator should appear (−1 = none) */
  const [dropTargetIndex, setDropTargetIndex] = useState<number>(-1);
  const isDraggingBlock = useRef(false);

  // ── ToC state ─────────────────────────────────────────────────────────────
  const [tocHeadings, setTocHeadings] = useState<TocHeading[]>([]);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const tocUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Update the drag handle to the top-level block element that the mouse is
   * currently hovering over.  This runs on `mousemove` over the editor area so
   * the handle glides smoothly even when the user hasn't clicked (no selection).
   */
  const updateDragHandleFromMouse = useCallback((clientY: number) => {
    if (isDraggingBlock.current) return; // don't jump during an active drag
    const editorEl = editorAreaRef.current;
    if (!editorEl) return;
    const areaRect = editorEl.getBoundingClientRect();
    // Walk the top-level ProseMirror children to find which block the mouse is in
    const pmDom = editorEl.querySelector(".ProseMirror") as HTMLElement | null;
    if (!pmDom) return;
    const children = Array.from(pmDom.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const midY = rect.top + rect.height / 2 - areaRect.top;
        // Derive nodePos for this child from its position in the doc
        setDragHandlePos((prev) => {
          // Keep nodePos stable if we already have it for this element
          // (we'll use index i as a proxy key — exact pos is only needed for drag)
          const nodePos = i; // used as index key; real pos computed on drag start
          if (prev?.nodePos === nodePos && Math.abs((prev?.top ?? 0) - midY) < 1) return prev;
          return { nodePos, top: midY };
        });
        return;
      }
    }
  }, []);

  // ── helpers ───────────────────────────────────────────────────────────────
  const promptForImage = useCallback((): Promise<{ src: string; alt: string } | null> => {
    return new Promise((resolve) => { imageResolveRef.current = resolve; setShowImageDialog(true); });
  }, []);

  const getPopupCoords = useCallback((
    view: { coordsAtPos: (pos: number) => { bottom: number; left: number } }, pos: number
  ): PopupCoords | null => {
    const caretCoords = view.coordsAtPos(pos);
    const areaRect = editorAreaRef.current?.getBoundingClientRect();
    if (!areaRect) return null;
    return { top: caretCoords.bottom - areaRect.top, left: caretCoords.left - areaRect.left };
  }, []);

  // ── filtered slash ────────────────────────────────────────────────────────
  const filteredSlash = useMemo(() =>
    slashOpen ? SLASH_ITEMS.filter((item) => {
      if (!slashQuery) return true;
      const q = slashQuery.toLowerCase();
      return item.label.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q));
    }) : [],
    [slashOpen, slashQuery],
  );

  // ── ToC updater ───────────────────────────────────────────────────────────
  const updateToc = useCallback((editorEl: HTMLElement | null) => {
    if (!editorEl) return;
    const nodes = editorEl.querySelectorAll("h1, h2, h3");
    const headings: TocHeading[] = [];
    nodes.forEach((node) => {
      const el = node as HTMLElement;
      const text = el.textContent?.trim() ?? "";
      if (!text) return;
      const id = `heading-${text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "").slice(0, 40)}-${headings.length}`;
      el.id = id;
      const tag = el.tagName.toLowerCase();
      headings.push({ id, level: tag === "h1" ? 1 : tag === "h2" ? 2 : 3, text });
    });
    // Skip the state update when the heading list hasn't actually changed
    setTocHeadings((prev) => {
      if (
        prev.length === headings.length &&
        prev.every((h, i) => h.id === headings[i].id && h.text === headings[i].text)
      ) {
        return prev;
      }
      return headings;
    });
  }, []);

  // ── editor ────────────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
      CodeBlockView,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      ResizableImageLink,
      StyledPlaceholder,
    ],
    content: initial,
    editorProps: {
      attributes: { class: "notion-editor-content", spellcheck: "true" },
      handleKeyDown(view, event) {
        // "/" on empty paragraph → slash menu
        if (event.key === "/" && !event.ctrlKey && !event.metaKey) {
          const { $from } = view.state.selection;
          if ($from.parent.type.name === "paragraph" && $from.parent.textContent === "") {
            slashFrom.current = $from.pos;
            setSlashCoords(getPopupCoords(view, $from.pos));
            setSlashQuery(""); setSlashIndex(0); setSlashOpen(true);
            setEmojiOpen(false);
            return false;
          }
        }

        // ":" → emoji picker
        if (event.key === ":" && !event.ctrlKey && !event.metaKey) {
          const { $from } = view.state.selection;
          const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
          const isAtWordStart = textBefore === "" || textBefore.endsWith(" ") || textBefore.endsWith("\n");
          if (isAtWordStart) {
            emojiFrom.current = $from.pos;
            setEmojiCoords(getPopupCoords(view, $from.pos));
            setEmojiQuery(""); setEmojiOpen(true);
            setSlashOpen(false);
            return false;
          }
        }

        // navigate slash menu
        if (slashOpen) {
          if (event.key === "ArrowDown") { event.preventDefault(); setSlashIndex((i) => Math.min(i + 1, filteredSlash.length - 1)); return true; }
          if (event.key === "ArrowUp") { event.preventDefault(); setSlashIndex((i) => Math.max(i - 1, 0)); return true; }
          if (event.key === "Enter") { event.preventDefault(); const item = filteredSlash[slashIndex]; if (item) commitSlash(item); return true; }
          if (event.key === "Escape" || (event.key === "Backspace" && slashQuery === "")) { setSlashOpen(false); return false; }
        }

        // close emoji on escape
        if (emojiOpen) {
          if (event.key === "Escape" || (event.key === "Backspace" && emojiQuery === "")) { setEmojiOpen(false); return false; }
        }

        return false;
      },
    },
    onUpdate({ editor: e }) {
      if (slashOpen) {
        const pos = e.state.selection.from;
        const text = e.state.doc.textBetween(slashFrom.current, pos, "");
        if (text.startsWith("/")) { setSlashQuery(text.slice(1)); setSlashIndex(0); }
        else setSlashOpen(false);
      }
      if (emojiOpen) {
        const pos = e.state.selection.from;
        const text = e.state.doc.textBetween(emojiFrom.current, pos, "");
        if (text.startsWith(":")) { setEmojiQuery(text.slice(1)); }
        else setEmojiOpen(false);
      }
      onChange(e.getHTML());
      // Debounce ToC updates — heading text rarely changes on every keystroke,
      // and setTocHeadings re-renders NotionEditor each time it fires
      if (tocUpdateTimerRef.current) clearTimeout(tocUpdateTimerRef.current);
      tocUpdateTimerRef.current = setTimeout(
        () => updateToc(editorAreaRef.current?.querySelector(".notion-editor-content") ?? null),
        500,
      );
    },
    onSelectionUpdate({ editor: e }) {
      const sel = e.state.selection;

      // NodeSelection: an atomic node (image, etc.) is selected
      if (sel instanceof NodeSelection) {
        const nodePos = sel.from;
        const domNode = e.view.nodeDOM(nodePos);
        const areaRect = editorAreaRef.current?.getBoundingClientRect();
        if (domNode instanceof HTMLElement && areaRect) {
          const rect = domNode.getBoundingClientRect();
          const midY = rect.top + rect.height / 2 - areaRect.top;
          // Only update state when the position actually changes
          setDragHandlePos((prev) =>
            prev?.nodePos === nodePos && Math.abs((prev?.top ?? 0) - midY) < 1
              ? prev
              : { nodePos, top: midY }
          );
        }
        return;
      }

      // TextSelection: use the $from resolved position
      const { $from } = sel;
      const nodePos = $from.start($from.depth) - 1;
      if (nodePos < 0) {
        setDragHandlePos((prev) => (prev === null ? prev : null));
        return;
      }
      const coords = e.view.coordsAtPos($from.pos);
      const areaRect = editorAreaRef.current?.getBoundingClientRect();
      if (areaRect) {
        const top = coords.top - areaRect.top;
        // Only update state when nodePos or top changes meaningfully
        setDragHandlePos((prev) =>
          prev?.nodePos === nodePos && Math.abs((prev?.top ?? 0) - top) < 1
            ? prev
            : { nodePos, top }
        );
      }
    },
  });

  // Initial ToC scan + timer cleanup on unmount
  useEffect(() => {
    const t = setTimeout(() => updateToc(editorAreaRef.current?.querySelector(".notion-editor-content") ?? null), 200);
    return () => {
      clearTimeout(t);
      if (tocUpdateTimerRef.current) clearTimeout(tocUpdateTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ToC scroll spy
  useEffect(() => {
    if (tocHeadings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => { for (const e of entries) { if (e.isIntersecting) { setActiveTocId(e.target.id); break; } } },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    tocHeadings.forEach((h) => { const el = document.getElementById(h.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [tocHeadings]);

  // ── commit slash ──────────────────────────────────────────────────────────
  const commitSlash = useCallback(async (item: SlashItem) => {
    if (!editor) return;
    setSlashOpen(false);
    const pos = editor.state.selection.from;
    editor.chain().focus().deleteRange({ from: slashFrom.current, to: pos }).run();
    if (item.id === "image") {
      const result = await promptForImage();
      if (result) editor.chain().focus().setResizableImage({ src: result.src, alt: result.alt }).run();
    } else {
      item.action(editor);
    }
  }, [editor, promptForImage]);

  // ── commit emoji ──────────────────────────────────────────────────────────
  const commitEmoji = useCallback((item: EmojiItem) => {
    if (!editor) return;
    setEmojiOpen(false);
    const pos = editor.state.selection.from;
    editor.chain().focus().deleteRange({ from: emojiFrom.current, to: pos }).insertContent(item.emoji + " ").run();
  }, [editor]);

  const handleImageInsert = useCallback((src: string, alt: string) => {
    if (imageResolveRef.current) { imageResolveRef.current({ src, alt }); imageResolveRef.current = null; }
    else if (editor) editor.chain().focus().setResizableImage({ src, alt }).run();
    setShowImageDialog(false);
  }, [editor]);
  const handleImageClose = useCallback(() => {
    if (imageResolveRef.current) { imageResolveRef.current(null); imageResolveRef.current = null; }
    setShowImageDialog(false);
  }, []);
  const commitLink = useCallback((url: string) => {
    if (!editor) return;
    if (!url) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
    setShowLinkEdit(false);
  }, [editor]);

  // ── block drag-and-drop ───────────────────────────────────────────────────

  /** Return the index of the top-level block at a given client Y coordinate */
  const getBlockIndexAtY = useCallback((clientY: number): number => {
    if (!editor) return -1;
    const view = editor.view;
    const dom = view.dom;
    const children = Array.from(dom.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return children.length; // after last block
  }, [editor]);

  /** Move a top-level block from srcIndex to destIndex */
  const moveBlockToIndex = useCallback((srcIndex: number, destIndex: number) => {
    if (!editor || srcIndex === destIndex || srcIndex === destIndex - 1) return;
    const { state } = editor;
    const { doc } = state;
    const nodes: { node: import("@tiptap/pm/model").Node; offset: number }[] = [];
    doc.forEach((node, offset) => nodes.push({ node, offset }));
    if (srcIndex < 0 || srcIndex >= nodes.length) return;

    const src = nodes[srcIndex];
    const tr = state.tr;

    // Delete the source node first, then insert at the adjusted destination
    const adjustedDest = destIndex > srcIndex ? destIndex - 1 : destIndex;
    tr.delete(src.offset, src.offset + src.node.nodeSize);

    // After deletion, recalculate offset of the destination
    let insertOffset = 0;
    let remaining = 0;
    doc.forEach((node, offset, idx) => {
      if (idx === adjustedDest) insertOffset = offset;
      remaining = offset + node.nodeSize;
    });
    if (adjustedDest >= nodes.length - 1) insertOffset = remaining;

    // Account for the deletion shifting offsets
    if (adjustedDest > srcIndex) insertOffset -= src.node.nodeSize;

    tr.insert(insertOffset, src.node);
    editor.view.dispatch(tr);
    editor.commands.focus();
  }, [editor]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!editor || dragHandlePos === null) return;
    e.dataTransfer.effectAllowed = "move";
    // Invisible drag image
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);

    // dragHandlePos.nodePos is now the DOM child index (set by mousemove handler).
    // Use it directly as the block index.
    dragSrcIndex.current = dragHandlePos.nodePos;
    isDraggingBlock.current = true;
  }, [editor, dragHandlePos]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isDraggingBlock.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const idx = getBlockIndexAtY(e.clientY);
    setDropTargetIndex(idx);
  }, [getBlockIndexAtY]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isDraggingBlock.current || dragSrcIndex.current === null) return;
    const destIdx = getBlockIndexAtY(e.clientY);
    moveBlockToIndex(dragSrcIndex.current, destIdx);
    isDraggingBlock.current = false;
    dragSrcIndex.current = null;
    setDropTargetIndex(-1);
  }, [getBlockIndexAtY, moveBlockToIndex]);

  const handleDragEnd = useCallback(() => {
    isDraggingBlock.current = false;
    dragSrcIndex.current = null;
    setDropTargetIndex(-1);
  }, []);

  if (!editor) return null;

  const currentLinkHref = editor.isActive("link") ? (editor.getAttributes("link").href as string | undefined) ?? "" : "";
  const currentTextColor = (editor.getAttributes("textStyle").color as string | undefined) ?? "";
  const currentHighlight = (editor.getAttributes("highlight").color as string | undefined) ?? "";

  return (
    <div className="notion-layout">
      {/* ── Main editor column ── */}
      <div className="notion-editor-wrapper">

        {/* ── Bubble menu ── */}
        <BubbleMenu editor={editor}
          shouldShow={({ editor: e, state }) => {
            if (slashOpen || emojiOpen) return false;
            if (e.isActive("codeBlock") || e.isActive("code")) return false;
            // Never show the text toolbar when an image node is selected
            if (e.isActive("resizableImageLink")) return false;
            return !state.selection.empty;
          }}>
          <div className="notion-bubble-toolbar">
            {showLinkEdit ? (
              <LinkPopover initial={currentLinkHref} onCommit={commitLink} onClose={() => setShowLinkEdit(false)} />
            ) : showTextColorPicker ? (
              <ColorPicker
                colors={TEXT_COLORS}
                currentValue={currentTextColor}
                onSelect={(val) => {
                  if (!val) editor.chain().focus().unsetColor().run();
                  else editor.chain().focus().setColor(val).run();
                }}
                onClose={() => setShowTextColorPicker(false)}
              />
            ) : showHighlightPicker ? (
              <ColorPicker
                colors={HIGHLIGHT_COLORS}
                currentValue={currentHighlight}
                onSelect={(val) => {
                  if (!val) editor.chain().focus().unsetHighlight().run();
                  else editor.chain().focus().setHighlight({ color: val }).run();
                }}
                onClose={() => setShowHighlightPicker(false)}
              />
            ) : (
              <>
                {/* Text formatting */}
                <BubbleBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></BubbleBtn>
                <BubbleBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></BubbleBtn>
                <BubbleBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)"><UnderlineIcon className="h-3.5 w-3.5" /></BubbleBtn>
                <BubbleBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></BubbleBtn>
                <BubbleBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code"><Code className="h-3.5 w-3.5" /></BubbleBtn>

                {/* Text color */}
                <BubbleBtn
                  onClick={() => { setShowTextColorPicker(true); setShowHighlightPicker(false); }}
                  active={!!currentTextColor}
                  title="Text color"
                >
                  <span className="notion-bubble-color-indicator" style={currentTextColor ? { borderBottomColor: currentTextColor } : undefined}>
                    <Palette className="h-3.5 w-3.5" />
                  </span>
                </BubbleBtn>

                {/* Highlight color */}
                <BubbleBtn
                  onClick={() => { setShowHighlightPicker(true); setShowTextColorPicker(false); }}
                  active={!!currentHighlight}
                  title="Highlight color"
                >
                  <span className="notion-bubble-color-indicator" style={currentHighlight ? { borderBottomColor: currentHighlight } : undefined}>
                    <Highlighter className="h-3.5 w-3.5" />
                  </span>
                </BubbleBtn>

                <div className="notion-bubble-sep" />

                {/* Headings */}
                <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></BubbleBtn>
                <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></BubbleBtn>
                <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3"><Heading3 className="h-3.5 w-3.5" /></BubbleBtn>

                <div className="notion-bubble-sep" />

                {/* Alignment */}
                <BubbleBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left"><AlignLeft className="h-3.5 w-3.5" /></BubbleBtn>
                <BubbleBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center"><AlignCenter className="h-3.5 w-3.5" /></BubbleBtn>
                <BubbleBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right"><AlignRight className="h-3.5 w-3.5" /></BubbleBtn>

                <div className="notion-bubble-sep" />

                {/* Link */}
                <BubbleBtn onClick={() => { setShowLinkEdit(true); setShowTextColorPicker(false); setShowHighlightPicker(false); }} active={editor.isActive("link")} title="Insert / edit link"><LinkIcon className="h-3.5 w-3.5" /></BubbleBtn>
              </>
            )}
          </div>
        </BubbleMenu>

        {/* ── Floating "+" button ── */}
        <FloatingMenu editor={editor}
          shouldShow={({ state }) => {
            if (slashOpen || emojiOpen) return false;
            const { $from } = state.selection;
            return $from.parent.type.name === "paragraph" && $from.parent.textContent === "" && $from.depth === 1;
          }}>
          <button type="button" className="notion-add-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              if (editor) {
                const from = editor.state.selection.from;
                slashFrom.current = from;
                setSlashCoords(getPopupCoords(editor.view, from));
                setSlashQuery(""); setSlashIndex(0); setSlashOpen(true);
              }
            }}
            title="Click or type '/' to insert a block">
            <span className="notion-add-plus">+</span>
          </button>
        </FloatingMenu>

        {/* ── Drag handle ── */}
        {dragHandlePos !== null && (
          <div
            ref={dragHandleRef}
            className="notion-drag-handle"
            style={{ top: dragHandlePos.top }}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onMouseLeave={(e) => {
              if (isDraggingBlock.current) return;
              // Hide only when leaving to outside the editor area too
              const related = e.relatedTarget as Node | null;
              if (editorAreaRef.current && related && editorAreaRef.current.contains(related)) return;
              setDragHandlePos(null);
            }}
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* ── Editable area ── */}
        <div
          ref={editorAreaRef}
          className="notion-editor-area"
          onClick={() => editor.chain().focus().run()}
          onMouseMove={(e) => updateDragHandleFromMouse(e.clientY)}
          onMouseLeave={(e) => {
            if (isDraggingBlock.current) return;
            // Don't hide the handle when the mouse moves onto the handle itself
            const related = e.relatedTarget as Node | null;
            if (dragHandleRef.current && related && dragHandleRef.current.contains(related)) return;
            setDragHandlePos(null);
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={() => setDropTargetIndex(-1)}
        >
          <EditorContent editor={editor} />

          {/* Drop indicator line */}
          {dropTargetIndex >= 0 && (() => {
            const view = editor.view;
            const children = Array.from(view.dom.children) as HTMLElement[];
            const areaRect = editorAreaRef.current?.getBoundingClientRect();
            if (!areaRect) return null;
            let lineTop: number;
            if (dropTargetIndex < children.length) {
              lineTop = children[dropTargetIndex].getBoundingClientRect().top - areaRect.top - 1;
            } else {
              const last = children[children.length - 1];
              lineTop = last ? (last.getBoundingClientRect().bottom - areaRect.top + 2) : 0;
            }
            return (
              <div
                className="notion-drop-indicator"
                style={{ top: lineTop }}
                aria-hidden="true"
              />
            );
          })()}

          {/* Slash menu */}
          {slashOpen && filteredSlash.length > 0 && (
            <SlashMenu query={slashQuery} selectedIndex={Math.min(slashIndex, filteredSlash.length - 1)}
              onSelect={commitSlash} coords={slashCoords} />
          )}

          {/* Emoji picker */}
          {emojiOpen && (
            <EmojiPicker
              triggerQuery={emojiQuery}
              onSelect={commitEmoji}
              coords={emojiCoords}
              onClose={() => setEmojiOpen(false)}
            />
          )}
        </div>
      </div>

      {/* ── ToC sidebar ── */}
      <TocSidebar headings={tocHeadings} activeId={activeTocId} />

      {/* ── Image dialog ── */}
      <ImageDialog open={showImageDialog} onClose={handleImageClose} onInsert={handleImageInsert} />
    </div>
  );
}
