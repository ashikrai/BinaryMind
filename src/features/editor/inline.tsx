import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Bold, Italic, Underline, Strikethrough, Code, Link as LinkIcon, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Inline mark DSL  (stored in plain text, rendered to HTML)
//   **text**                   → <strong>
//   _text_                     → <em>
//   __text__                   → <u>
//   ~~text~~                   → <s>
//   `text`                     → <code class="inline-code">
//   [color=#hex]text[/color]   → <span style="color:#hex">   (per-span color)
//   [link](url)                → <a href="url" …>link</a>    (hyperlink)
//
// IMPORTANT: color regex uses [\s\S]*? so nested [ chars don't break it.
// ---------------------------------------------------------------------------

export function renderInline(raw: string): string {
  // 1. Escape HTML special chars first (before we inject any tags).
  const esc = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return esc
    // Bold: **text**
    .replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>")
    // Strikethrough: ~~text~~
    .replace(/~~(.+?)~~/gs, "<s>$1</s>")
    // Underline: __text__  (must come before italic _)
    .replace(/__(.+?)__/gs, "<u>$1</u>")
    // Italic: _text_
    .replace(/_(.+?)_/gs, "<em>$1</em>")
    // Inline code: `text`
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Color: [color=#hex]text[/color]  — [\s\S]*? allows [ inside content
    .replace(
      /\[color=(#[0-9a-fA-F]{3,6})\]([\s\S]*?)\[\/color\]/g,
      (_m, hex: string, text: string) =>
        `<span style="color:${hex}">${text}</span>`,
    )
    // Hyperlink: [label](url)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      (_m, label: string, url: string) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-link" data-url="${url}">${label}</a>`,
    );
}

// ---------------------------------------------------------------------------
// InlineText — reader-side, renders marks + hyperlinks with hover tooltip
// ---------------------------------------------------------------------------

/** Reader-side: render inline marks as sanitised HTML, with link tooltips. */
export function InlineText({ text }: { text: string }) {
  const [tooltip, setTooltip] = useState<{ url: string; x: number; y: number } | null>(null);

  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest("a.inline-link");
    if (!target) return;
    const url = target.getAttribute("data-url") ?? "";
    const rect = target.getBoundingClientRect();
    setTooltip({
      url,
      x: rect.left + rect.width / 2,
      y: rect.top - 8 + window.scrollY,
    });
  }, []);

  const handleMouseOut = useCallback((e: React.MouseEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related?.closest?.(".inline-link-tooltip")) return;
    setTooltip(null);
  }, []);

  return (
    <>
      <span
        // Content is always escaped before marks are applied — safe.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderInline(text) }}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
      />
      {tooltip &&
        createPortal(
          <LinkTooltip url={tooltip.url} x={tooltip.x} y={tooltip.y} onClose={() => setTooltip(null)} />,
          document.body,
        )}
    </>
  );
}

/** Small link preview tooltip shown on hover over an inline link. */
function LinkTooltip({ url, x, y, onClose }: { url: string; x: number; y: number; onClose: () => void }) {
  let displayUrl = url;
  try {
    const u = new URL(url);
    displayUrl = u.hostname + (u.pathname !== "/" ? u.pathname : "");
  } catch { /* keep raw */ }

  return (
    <div
      className="inline-link-tooltip pointer-events-auto fixed z-[9999] max-w-xs rounded-lg border bg-popover px-3 py-2 shadow-xl"
      style={{ left: x - 120, top: y - 56, transform: "translateY(-100%)" }}
      onMouseLeave={onClose}
    >
      <div className="flex items-center gap-2 text-xs">
        <LinkIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 truncate text-primary hover:underline"
          title={url}
        >
          {displayUrl}
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Caret helpers (plain-text character offset inside a contenteditable)
// ---------------------------------------------------------------------------

function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

function setCaretOffset(el: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  let remaining = Math.max(0, offset);
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent!.length;
      if (remaining <= len) {
        range.setStart(node, remaining);
        range.collapse(true);
        return true;
      }
      remaining -= len;
      return false;
    }
    for (const child of Array.from(node.childNodes)) {
      if (walk(child)) return true;
    }
    return false;
  };
  if (!walk(el)) {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

// Get selected plain-text range inside a contenteditable element.
function getSelectionRange(el: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !el.contains(sel.anchorNode)) return null;
  const range = sel.getRangeAt(0);
  const preStart = range.cloneRange();
  preStart.selectNodeContents(el);
  preStart.setEnd(range.startContainer, range.startOffset);
  const start = preStart.toString().length;
  return { start, end: start + sel.toString().length };
}

// ---------------------------------------------------------------------------
// DSL-aware input reconciliation
//
// Problem: the browser's contenteditable contains rendered HTML (e.g.
// <strong>bold</strong>).  When the user types a character, `oninput` fires
// and el.textContent gives us only the visible text — all DSL marks are lost.
// We must map the new visible text back to a DSL string that preserves the
// existing marks.
//
// Strategy:
//   1. The previous DSL (dslRef) has a known "rendered length" (plain text of
//      renderInline(dsl)).  The new visible text (newVisible) gives us a
//      character diff at the caret position.
//   2. We compute the delta (characters added or removed) at the visible-text
//      caret offset.
//   3. We find the corresponding DSL position by counting visible characters
//      through the DSL, skipping over mark syntax.
//   4. We splice the delta into the DSL string.
// ---------------------------------------------------------------------------

/**
 * Given a DSL string and a visible-text offset, return the index in the DSL
 * string that corresponds to that visible character offset — i.e. skip over
 * all mark syntax tokens.
 *
 * This is intentionally conservative: it walks left-to-right and counts only
 * literal characters (not mark delimiters or tag names).
 */
function visibleOffsetToDslIndex(dsl: string, visibleOffset: number): number {
  // Strip mark syntax to get a mapping from visible position → DSL index.
  // We build a list of [dslIdx, visibleChar] pairs.
  // Rather than a full parser, we use a regex that matches all DSL tokens and
  // skips their syntax chars while counting their content chars.
  type Segment = { dslStart: number; dslEnd: number; visLen: number };
  const segments: Segment[] = [];
  const tokenRe =
    /\*\*(.+?)\*\*|~~(.+?)~~|__(.+?)__|_(.+?)_|`([^`]+)`|\[color=#[0-9a-fA-F]{3,6}\]([\s\S]*?)\[\/color\]|\[([^\]]+)\]\(https?:\/\/[^\)]+\)|([^*_~`\[]+)/gs;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(dsl)) !== null) {
    // Group 8 is literal text; groups 1–7 are mark contents
    const content = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? m[7] ?? m[8] ?? "";
    segments.push({ dslStart: m.index, dslEnd: m.index + m[0].length, visLen: content.length });
  }

  let vis = 0;
  for (const seg of segments) {
    if (vis + seg.visLen >= visibleOffset) {
      // The offset lands inside this segment.
      // For marks: the content starts after the opening delimiter.
      const contentOffset = visibleOffset - vis;
      // Find where the content starts inside the DSL token.
      const token = dsl.slice(seg.dslStart, seg.dslEnd);
      // Detect opening delimiter length (chars before content).
      const contentInToken = m ? (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? m[7]) : null;
      const openLen = contentInToken !== null
        ? token.indexOf(contentInToken)
        : 0;
      return seg.dslStart + openLen + contentOffset;
    }
    vis += seg.visLen;
  }
  return dsl.length;
}

/**
 * Reconcile a user-typed change back into the DSL string.
 * prevDsl  — DSL before the keystroke
 * prevVis  — visible (plain) text before the keystroke
 * newVis   — visible (plain) text after the keystroke (el.textContent)
 * caretPos — visible caret position AFTER the change
 */
function reconcileDsl(prevDsl: string, prevVis: string, newVis: string, caretPos: number): string {
  // Fast path: no change in visible text.
  if (newVis === prevVis) return prevDsl;

  const lenDiff = newVis.length - prevVis.length;

  if (lenDiff > 0) {
    // Characters inserted. The inserted text ends at caretPos.
    const inserted = newVis.slice(caretPos - lenDiff, caretPos);
    const visInsertAt = caretPos - lenDiff;
    const dslIdx = visibleOffsetToDslIndex(prevDsl, visInsertAt);
    return prevDsl.slice(0, dslIdx) + inserted + prevDsl.slice(dslIdx);
  }

  if (lenDiff < 0) {
    // Characters deleted. caretPos is where the deletion ended.
    const delCount = -lenDiff;
    const visDelEnd = caretPos + delCount; // visible position before delete
    const dslStart = visibleOffsetToDslIndex(prevDsl, caretPos);
    const dslEnd = visibleOffsetToDslIndex(prevDsl, visDelEnd);
    return prevDsl.slice(0, dslStart) + prevDsl.slice(dslEnd);
  }

  // Same length — replacement (e.g. autocorrect). Replace at caret.
  // Fall back to treating newVis as plain text in this rare case.
  return newVis;
}

/** Compute the plain visible text of a DSL string (strip all mark syntax). */
function dslToVisible(dsl: string): string {
  return dsl
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/~~(.+?)~~/gs, "$1")
    .replace(/__(.+?)__/gs, "$1")
    .replace(/_(.+?)_/gs, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[color=#[0-9a-fA-F]{3,6}\]([\s\S]*?)\[\/color\]/g, "$1")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g, "$1");
}

// ---------------------------------------------------------------------------
// Mark helpers
// ---------------------------------------------------------------------------

type Mark = "**" | "_" | "__" | "~~" | "`";

/** Toggle a mark around [start,end] in raw DSL. */
function toggleMark(raw: string, start: number, end: number, mark: Mark): string {
  const before = raw.slice(0, start);
  const sel = raw.slice(start, end);
  const after = raw.slice(end);
  if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length > mark.length * 2) {
    return before + sel.slice(mark.length, sel.length - mark.length) + after;
  }
  return `${before}${mark}${sel}${mark}${after}`;
}

/** Wrap selected range with a per-span color tag. */
function applyColorToRange(raw: string, start: number, end: number, hex: string): string {
  const before = raw.slice(0, start);
  const sel = raw.slice(start, end);
  const after = raw.slice(end);
  const stripped = sel.replace(/\[color=#[0-9a-fA-F]{3,6}\]([\s\S]*?)\[\/color\]/g, "$1");
  return `${before}[color=${hex}]${stripped}[/color]${after}`;
}

/** Wrap selected text as a hyperlink: [selected text](url) */
function applyLink(raw: string, start: number, end: number, url: string): string {
  const before = raw.slice(0, start);
  const sel = raw.slice(start, end) || url;
  const after = raw.slice(end);
  const linkRe = /^\[([^\]]+)\]\(https?:\/\/[^\)]+\)$/;
  if (linkRe.test(sel)) {
    const label = sel.replace(linkRe, "$1");
    return `${before}[${label}](${url})${after}`;
  }
  return `${before}[${sel}](${url})${after}`;
}

// ---------------------------------------------------------------------------
// Floating formatting toolbar (portal, follows selection)
// ---------------------------------------------------------------------------

const FORMATS: { mark: Mark; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { mark: "**", icon: Bold,          label: "Bold (Ctrl+B)"        },
  { mark: "_",  icon: Italic,        label: "Italic (Ctrl+I)"      },
  { mark: "__", icon: Underline,     label: "Underline (Ctrl+U)"   },
  { mark: "~~", icon: Strikethrough, label: "Strikethrough"        },
  { mark: "`",  icon: Code,          label: "Inline code"          },
];

interface FormatToolbarProps {
  editorRef: React.RefObject<HTMLElement | null>;
  rawText: string;
  onChange: (next: string) => void;
  onOpenLink?: () => void;  // called when toolbar Link button is clicked
}

function FormatToolbar({ editorRef, rawText, onChange, onOpenLink }: FormatToolbarProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const selRef = useRef<{ start: number; end: number } | null>(null);
  // Always read latest DSL via ref so stale closures can't lose marks.
  const rawRef = useRef(rawText);
  rawRef.current = rawText;

  useEffect(() => {
    const handle = () => {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !el || !el.contains(sel.anchorNode)) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      // Map the VISIBLE selection range back to DSL indices.
      const visSel = getSelectionRange(el as HTMLElement);
      if (!visSel) { setPos(null); return; }
      // Convert visible offsets → DSL offsets.
      const dsl = rawRef.current;
      const dslStart = visibleOffsetToDslIndex(dsl, visSel.start);
      const dslEnd   = visibleOffsetToDslIndex(dsl, visSel.end);
      selRef.current = { start: dslStart, end: dslEnd };
      setPos({
        x: rect.left + rect.width / 2 + window.scrollX,
        y: rect.top  + window.scrollY - 48,
      });
    };
    document.addEventListener("selectionchange", handle);
    return () => document.removeEventListener("selectionchange", handle);
  }, [editorRef]);

  const apply = useCallback((mark: Mark) => {
    const sr = selRef.current;
    if (!sr) return;
    onChange(toggleMark(rawRef.current, sr.start, sr.end, mark));
    setPos(null);
  }, [onChange]);

  const applyColor = useCallback((hex: string) => {
    const sr = selRef.current;
    if (!sr) return;
    onChange(applyColorToRange(rawRef.current, sr.start, sr.end, hex));
    setPos(null);
  }, [onChange]);

  const handleLinkClick = useCallback(() => {
    setPos(null);
    onOpenLink?.();
  }, [onOpenLink]);

  if (!pos) return null;

  return createPortal(
    <div
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-[9999] flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1.5 py-1 shadow-xl"
      style={{ left: pos.x - 145, top: pos.y }}
    >
      {FORMATS.map(({ mark, icon: Icon, label }) => (
        <button
          key={mark}
          type="button"
          onClick={() => apply(mark)}
          title={label}
          aria-label={label}
          className="rounded p-1.5 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}

      <span className="mx-0.5 h-4 w-px bg-border" />

      {/* Link button */}
      <button
        type="button"
        onClick={handleLinkClick}
        title="Add hyperlink (⌘K / Ctrl+K)"
        aria-label="Add hyperlink"
        className="rounded p-1.5 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </button>

      <span className="mx-0.5 h-4 w-px bg-border" />

      {/* Per-selection color swatches */}
      {["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"].map((hex) => (
        <button
          key={hex}
          type="button"
          title={`Color ${hex}`}
          aria-label={`Text color ${hex}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyColor(hex)}
          className="h-4 w-4 rounded-full border border-white/20 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ background: hex }}
        />
      ))}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Link input popover (portal, anchored to selection)
// ---------------------------------------------------------------------------

interface LinkPopoverProps {
  anchorRect: DOMRect;
  initialUrl?: string;
  onCommit: (url: string) => void;
  onClose: () => void;
}

function LinkPopover({ anchorRect, initialUrl = "", onCommit, onClose }: LinkPopoverProps) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus on mount
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const val = url.trim();
    if (!val) { onClose(); return; }
    onCommit(val.startsWith("http") ? val : `https://${val}`);
  };

  const left = anchorRect.left + anchorRect.width / 2 - 140;
  const top  = anchorRect.bottom + window.scrollY + 8;

  return createPortal(
    <>
      {/* Backdrop to close on click-away */}
      <div className="fixed inset-0 z-[9998]" onMouseDown={onClose} />
      <div
        className="fixed z-[9999] flex items-center gap-1 rounded-lg border border-border bg-popover px-2 py-1.5 shadow-xl"
        style={{ left, top }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")  { e.preventDefault(); commit(); }
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
          }}
          placeholder="https://example.com"
          className="h-6 min-w-[200px] rounded border-none bg-transparent text-xs outline-none placeholder:text-muted-foreground focus:ring-0"
          aria-label="Link URL"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
          className="rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Add
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          aria-label="Cancel"
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// InlineEditable
// ---------------------------------------------------------------------------

interface InlineEditableProps {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  onBackspaceEmpty?: () => void;
  placeholder?: string;
  className?: string;
  singleLine?: boolean;
  autoFocus?: boolean;
  /** Called once after the component gains focus due to autoFocus (one-shot). */
  onFocused?: () => void;
}

/**
 * ContentEditable that live-renders inline marks while typing.
 *
 * KEY DESIGN: the DSL string is the source of truth stored in `dslRef`.
 * `handleInput` reads the new visible text from `el.textContent`, computes
 * what changed, and splices the delta back into the DSL — so all existing
 * marks are preserved across keystrokes.
 *
 * Keyboard shortcuts:
 *   Ctrl/Cmd + B  Bold
 *   Ctrl/Cmd + I  Italic
 *   Ctrl/Cmd + U  Underline
 *   Ctrl/Cmd + K  Hyperlink (opens link popover)
 */
export const InlineEditable = memo(function InlineEditable({
  value,
  onChange,
  onEnter,
  onBackspaceEmpty,
  placeholder,
  className,
  singleLine,
  autoFocus,
  onFocused,
}: InlineEditableProps) {
  const ref = useRef<HTMLDivElement>(null);

  // dslRef is the authoritative DSL — always up to date.
  const dslRef = useRef(value);

  // Link popover state — stored as anchor rect so it survives DOM focus loss.
  const [linkAnchor, setLinkAnchor] = useState<{ rect: DOMRect; selStart: number; selEnd: number } | null>(null);

  // Sync DSL → DOM.
  // On first mount the DOM is empty even though dslRef already holds the value,
  // so we must always write innerHTML on mount. On subsequent renders we only
  // re-render if the prop genuinely changed (e.g. undo/redo from outside).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const isMount = el.innerHTML === "";
    if (!isMount && dslRef.current === value) return;
    dslRef.current = value;
    const caretBefore = isMount ? 0 : getCaretOffset(el);
    el.innerHTML = renderInline(value);
    if (!isMount) setCaretOffset(el, caretBefore);
  }, [value]);

  useEffect(() => {
    if (autoFocus && ref.current) {
      const el = ref.current;
      el.focus();
      setCaretOffset(el, dslToVisible(dslRef.current).length);
      onFocused?.();
    }
  // onFocused intentionally excluded — it's a one-shot callback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  // ── handleInput ──────────────────────────────────────────────────────────
  // The browser changed the DOM. We need to:
  //   1. Read the new visible text and caret position.
  //   2. Reconcile the change into the DSL string.
  //   3. Re-render the DSL HTML, restoring the caret.
  const handleInput = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const caretPos  = getCaretOffset(el);          // visible offset after change
    const newVis    = el.textContent ?? "";
    const prevDsl   = dslRef.current;
    const prevVis   = dslToVisible(prevDsl);

    const nextDsl = reconcileDsl(prevDsl, prevVis, newVis, caretPos);
    dslRef.current = nextDsl;

    // Re-render DSL HTML (may change DOM), then restore caret.
    el.innerHTML = renderInline(nextDsl);
    setCaretOffset(el, caretPos);

    onChange(nextDsl);
  }, [onChange]);

  // ── openLinkPopover ───────────────────────────────────────────────────────
  const openLinkPopover = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const sel = window.getSelection();
    const dsl = dslRef.current;
    // Get visible selection for anchor rect
    let rect: DOMRect;
    let dslStart = dsl.length;
    let dslEnd   = dsl.length;
    if (sel && !sel.isCollapsed && el.contains(sel.anchorNode)) {
      rect = sel.getRangeAt(0).getBoundingClientRect();
      const visSel = getSelectionRange(el);
      if (visSel) {
        dslStart = visibleOffsetToDslIndex(dsl, visSel.start);
        dslEnd   = visibleOffsetToDslIndex(dsl, visSel.end);
      }
    } else {
      rect = el.getBoundingClientRect();
    }
    setLinkAnchor({ rect, selStart: dslStart, selEnd: dslEnd });
  }, []);

  // ── handleKeyDown ─────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.shiftKey) {
        const el = ref.current;
        const sel = el ? getSelectionRange(el) : null;
        const dsl = dslRef.current;

        // Bold / Italic / Underline — operate on DSL indices.
        let mark: Mark | null = null;
        if (e.key === "b") mark = "**";
        if (e.key === "i") mark = "_";
        if (e.key === "u") mark = "__";
        if (mark) {
          e.preventDefault();
          if (!sel) return;
          const dslStart = visibleOffsetToDslIndex(dsl, sel.start);
          const dslEnd   = visibleOffsetToDslIndex(dsl, sel.end);
          const next = toggleMark(dsl, dslStart, dslEnd, mark);
          dslRef.current = next;
          if (el) el.innerHTML = renderInline(next);
          onChange(next);
          return;
        }

        // Cmd/Ctrl + K — open link popover.
        if (e.key === "k" || e.key === "L=K") {
          e.preventDefault();
          openLinkPopover();
          return;
        }
      }

      // Tab → insert new block (mirrors Enter for block creation).
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        onEnter?.();
        return;
      }

      if (e.key === "Enter") {
        if (singleLine || onEnter) {
          e.preventDefault();
          onEnter?.();
        }
        return;
      }

      if (e.key === "Backspace" && onBackspaceEmpty) {
        const el = ref.current;
        if (el && (el.textContent ?? "").length === 0) {
          e.preventDefault();
          onBackspaceEmpty();
        }
      }
    },
    [onEnter, onBackspaceEmpty, singleLine, onChange, openLinkPopover],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  // Toolbar format-change: just re-render and bubble.
  const handleFormatChange = useCallback((next: string) => {
    dslRef.current = next;
    const el = ref.current;
    if (el) el.innerHTML = renderInline(next);
    onChange(next);
  }, [onChange]);

  // Commit link from popover.
  const handleLinkCommit = useCallback((url: string) => {
    if (!linkAnchor) return;
    const next = applyLink(dslRef.current, linkAnchor.selStart, linkAnchor.selEnd, url);
    dslRef.current = next;
    const el = ref.current;
    if (el) el.innerHTML = renderInline(next);
    onChange(next);
    setLinkAnchor(null);
    // Restore focus to the editor.
    el?.focus();
  }, [linkAnchor, onChange]);

  return (
    <>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={!singleLine}
        data-placeholder={placeholder}
        className={cn("inline-editable", className)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
      <FormatToolbar
        editorRef={ref as React.RefObject<HTMLElement | null>}
        rawText={value}
        onChange={handleFormatChange}
        onOpenLink={openLinkPopover}
      />
      {linkAnchor && (
        <LinkPopover
          anchorRect={linkAnchor.rect}
          onCommit={handleLinkCommit}
          onClose={() => setLinkAnchor(null)}
        />
      )}
    </>
  );
});
