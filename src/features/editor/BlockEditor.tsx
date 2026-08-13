import { v4 as uuid } from "uuid";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useStableCallback } from "@/hooks/useStableCallback";
import type { Block, BlockType } from "@/types";
import { Button } from "@/components/ui/button";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  Trash2,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  List,
  ListOrdered,
  CheckSquare,
  Image as ImageIcon,
  Code as CodeIcon,
  Youtube,
  Undo2,
  Redo2,
  Table as TableIcon,
  Info,
  Twitter,
  Github,
  GripVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { InlineEditable } from "./inline";
import { BlockStylePopover } from "./BlockStylePopover";
import { getBlockStyle, styleToCss, type BlockStyle } from "./blockStyle";
import { CropTool } from "./CropTool";


/**
 * Detect leading Markdown-style shortcuts in a paragraph so users can quickly
 * turn a paragraph into a list, quote, or code block. Returns the block patch
 * to apply, or null if no shortcut matched.
 */
function paragraphShortcut(text: string): Partial<Block> | null {
  if (text === "```") return { type: "code", content: "" };
  if (text === "* " || text === "- ") return { type: "bullet", content: "" };
  if (text === "1. ") return { type: "numbered", content: "" };
  if (text === "[] " || text === "[ ] ") return { type: "checklist", content: "[ ] " };
  if (text === "> ") return { type: "quote", content: "" };
  return null;
}

interface Props {
  initial: Block[];
  onChange: (blocks: Block[]) => void;
}

const BLOCK_OPTIONS: { type: BlockType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "h1", label: "Heading 1", icon: Heading1 },
  { type: "h2", label: "Heading 2", icon: Heading2 },
  { type: "h3", label: "Heading 3", icon: Heading3 },
  { type: "paragraph", label: "Paragraph", icon: Type },
  { type: "quote", label: "Quote", icon: Quote },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "bullet", label: "Bullet list", icon: List },
  { type: "numbered", label: "Numbered list", icon: ListOrdered },
  { type: "checklist", label: "Checklist", icon: CheckSquare },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "code", label: "Code block", icon: CodeIcon },
  { type: "youtube", label: "YouTube embed", icon: Youtube },
  { type: "tweet", label: "Tweet / X embed", icon: Twitter },
  { type: "gist", label: "GitHub Gist", icon: Github },
  { type: "table", label: "Table", icon: TableIcon },
  { type: "callout", label: "Callout", icon: Info },
];

/**
 * Block-based editor with undo/redo, reorder, duplicate/delete and autosave.
 * A pragmatic subset of Medium's editor: covers the block types most people
 * actually use. Extending is a matter of adding an entry to BLOCK_OPTIONS
 * and a case in `<BlockView />`.
 */
export function BlockEditor({ initial, onChange }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const historyRef = useRef<{ past: Block[][]; future: Block[][] }>({ past: [], future: [] });
  const dragIndexRef = useRef<number | null>(null);
  // openMenuForIndex: when set, the "Add block" dropdown for that block index opens.
  const [openMenuForIndex, setOpenMenuForIndex] = useState<number | null>(null);
  // focusBlockId: when set, that block's InlineEditable will autoFocus.
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);

  // Stable-identity autosave: prevents parent-provided inline arrows from
  // retriggering the effect and causing store→render→new-arrow loops.
  const emitChange = useStableCallback(onChange);
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    emitChange(blocks);
  }, [blocks, emitChange]);

  const commit = useCallback((next: Block[]) => {
    historyRef.current.past.push(blocks);
    historyRef.current.future = [];
    setBlocks(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const undo = () => {
    const prev = historyRef.current.past.pop();
    if (!prev) return;
    historyRef.current.future.push(blocks);
    setBlocks(prev);
  };
  const redo = () => {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push(blocks);
    setBlocks(next);
  };

  const updateBlock = useStableCallback((id: string, patch: Partial<Block>) => {
    // No history commit for every keystroke — snapshot only on structural change.
    setBlocks((b) => b.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  });

  const insertAfter = useStableCallback((index: number, type: BlockType) => {
    const nb: Block = { id: uuid(), type, content: "" };
    const next = [...blocks.slice(0, index + 1), nb, ...blocks.slice(index + 1)];
    commit(next);
    setFocusBlockId(nb.id);
  });


  const remove = (id: string) => commit(blocks.filter((b) => b.id !== id));
  const duplicate = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const copy = { ...blocks[i], id: uuid() };
    commit([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]);
  };
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const onDrop = (targetIndex: number) => {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === targetIndex) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(targetIndex, 0, item);
    commit(next);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="sticky top-16 z-30 -mx-2 mb-4 flex items-center gap-1 border-b bg-background/80 px-2 py-2 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={undo} aria-label="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={redo} aria-label="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {blocks.length} block{blocks.length === 1 ? "" : "s"} · autosaved
        </div>
      </div>

      <div className="space-y-1" role="list" aria-label="Content blocks">
        {blocks.map((block, i) => {
          const style = getBlockStyle(block);
          const css = styleToCss(style);
          const setStyle = (next: BlockStyle | undefined) =>
            updateBlock(block.id, { meta: { ...block.meta, style: next } });
          return (
            <div
              key={block.id}
              role="listitem"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              className="group relative"
              // Tab on the block container (not inside an input) inserts a new
              // paragraph and opens the block-type picker.
              onKeyDown={(e) => {
                if (e.key === "Tab" && !e.shiftKey && e.target === e.currentTarget) {
                  e.preventDefault();
                  insertAfter(i, "paragraph");
                  setOpenMenuForIndex(i + 1);
                }
              }}
            >
              {/* Floating block toolbar */}
              <div className="pointer-events-none absolute -top-4 left-1/2 z-20 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <div
                  role="toolbar"
                  aria-label={`Block ${i + 1} actions`}
                  className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-background/90 px-1 py-0.5 shadow-sm backdrop-blur"
                >
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(block.id, -1)} aria-label="Move block up">
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(block.id, 1)} aria-label="Move block down">
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicate(block.id)} aria-label="Duplicate block">
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <BlockStylePopover value={style} onChange={setStyle} />
                  <DropdownMenu
                    open={openMenuForIndex === i}
                    onOpenChange={(o) => setOpenMenuForIndex(o ? i : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Insert block after this one"
                        aria-haspopup="true"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center">
                      {BLOCK_OPTIONS.map((opt) => (
                        <DropdownMenuItem
                          key={opt.type}
                          onClick={() => {
                            insertAfter(i, opt.type);
                            setOpenMenuForIndex(null);
                          }}
                        >
                          <opt.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                          {opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(block.id)} aria-label="Delete block">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div
                className={cn(
                  "relative rounded-md px-10 py-1 transition-colors",
                  !css.hasBackground && "hover:bg-muted/30",
                  css.hasBackground && "px-6 py-4",
                  css.fontOverride && "mc-font-override",
                )}
                style={css.container}
              >
                <div
                  className="absolute -left-1 top-2 flex cursor-grab items-center opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                  draggable
                  onDragStart={() => (dragIndexRef.current = i)}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Drag block ${i + 1} to reorder`}
                  title="Drag to reorder"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <div style={css.text}>
                  <BlockView
                    block={block}
                    blockId={block.id}
                    onUpdate={updateBlock}
                    autoFocus={focusBlockId === block.id}
                    onFocused={() => setFocusBlockId(null)}
                    onEnter={() => {
                      insertAfter(i, "paragraph");
                      setOpenMenuForIndex(i + 1);
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {blocks.length === 0 && (
          <div className="flex justify-center py-16">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-1 h-4 w-4" /> Add first block
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {BLOCK_OPTIONS.map((opt) => (
                  <DropdownMenuItem key={opt.type} onClick={() => insertAfter(-1, opt.type)}>
                    <opt.icon className="mr-2 h-4 w-4" />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

      </div>
    </div>
  );
}

const CALLOUT_VARIANTS = [
  { value: "info",    label: "ℹ️  Info",    border: "border-blue-500",   bg: "bg-blue-500/10"   },
  { value: "success", label: "✅ Success", border: "border-green-500",  bg: "bg-green-500/10"  },
  { value: "warning", label: "⚠️  Warning", border: "border-yellow-500", bg: "bg-yellow-500/10" },
  { value: "danger",  label: "🚨 Danger",  border: "border-red-500",    bg: "bg-red-500/10"    },
] as const;
type CalloutVariant = typeof CALLOUT_VARIANTS[number]["value"];

const BlockView = memo(function BlockView({
  block,
  blockId,
  onUpdate,
  onEnter,
  autoFocus,
  onFocused,
}: {
  block: Block;
  blockId: string;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  onFocused?: () => void;
}) {
  // Bind the id once so children see a stable `onChange(patch)` signature.
  const onChange = useCallback(
    (patch: Partial<Block>) => onUpdate(blockId, patch),
    [blockId, onUpdate],
  );
  const common = "w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground";

  switch (block.type) {
    case "title":
      return (
        <TextareaAuto
          value={block.content}
          onChange={(v) => onChange({ content: v })}
          placeholder="Title"
          className={cn(common, "font-serif text-4xl font-bold leading-tight")}
        />
      );
    case "subtitle":
      return (
        <TextareaAuto
          value={block.content}
          onChange={(v) => onChange({ content: v })}
          placeholder="Subtitle"
          className={cn(common, "font-serif text-xl text-muted-foreground")}
        />
      );
    case "h1":
      return (
        <InlineEditable
          value={block.content}
          onChange={(v) => onChange({ content: v })}
          onEnter={onEnter}
          placeholder="Heading 1"
          singleLine
          autoFocus={autoFocus}
          onFocused={onFocused}
          className={cn(common, "font-serif text-3xl font-bold")}
        />
      );
    case "h2":
      return (
        <InlineEditable
          value={block.content}
          onChange={(v) => onChange({ content: v })}
          onEnter={onEnter}
          placeholder="Heading 2"
          singleLine
          autoFocus={autoFocus}
          onFocused={onFocused}
          className={cn(common, "font-serif text-2xl font-bold")}
        />
      );
    case "h3":
      return (
        <InlineEditable
          value={block.content}
          onChange={(v) => onChange({ content: v })}
          onEnter={onEnter}
          placeholder="Heading 3"
          singleLine
          autoFocus={autoFocus}
          onFocused={onFocused}
          className={cn(common, "font-serif text-xl font-semibold")}
        />
      );
    case "paragraph":
      return (
        <InlineEditable
          value={block.content}
          onChange={(v) => {
            const shortcut = paragraphShortcut(v);
            if (shortcut) onChange(shortcut);
            else onChange({ content: v });
          }}
          onEnter={onEnter}
          autoFocus={autoFocus}
          onFocused={onFocused}
          // placeholder={block.content}
          placeholder="Tell your story… (try `code`, ``` , * , 1. , [] , > )"
          className={cn(common, "font-serif text-lg leading-relaxed")}
        />
      );
    case "quote":
      return (
        <InlineEditable
          value={block.content}
          onChange={(v) => onChange({ content: v })}
          autoFocus={autoFocus}
          onFocused={onFocused}
          placeholder="Quote"
          className={cn(common, "border-l-4 border-foreground/40 pl-4 font-serif text-xl italic")}
        />
      );
    case "divider":
      return <hr className="my-4 border-border" />;
    case "bullet":
    case "numbered":
    case "checklist":
      return (
        <ListEditor
          kind={block.type}
          value={block.content}
          onChange={(content) => onChange({ content })}
          onConvertToParagraph={() => onChange({ type: "paragraph", content: "" })}
          autoFocus={autoFocus}
          onFocused={onFocused}
        />
      );
    case "image":
      return (
        <ImageBlockEditor
          src={block.content}
          alt={(block.meta?.alt as string) ?? ""}
          caption={(block.meta?.caption as string) ?? ""}
          onChange={(patch) =>
            onChange({
              content: patch.src ?? block.content,
              meta: {
                ...block.meta,
                alt: patch.alt ?? (block.meta?.alt as string) ?? "",
                caption: patch.caption ?? (block.meta?.caption as string) ?? "",
              },
            })
          }
        />
      );
    case "code":
      return (
        <div className="rounded-md border bg-muted/40 p-3">
          <Input
            value={(block.meta?.language as string) ?? ""}
            onChange={(e) => onChange({ meta: { ...block.meta, language: e.target.value } })}
            placeholder="Language (e.g. ts, python)"
            className="mb-2 h-7"
          />
          <Textarea
            value={block.content}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder="Code…"
            className="min-h-[140px] font-mono text-sm"
          />
        </div>
      );
    case "youtube":
      return (
        <Input
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="YouTube URL"
        />
      );
    case "tweet":
      return (
        <Input
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Tweet / X URL (https://twitter.com/user/status/…)"
        />
      );
    case "gist":
      return (
        <Input
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="GitHub Gist URL (https://gist.github.com/user/id)"
        />
      );
    case "callout": {
      const variant = ((block.meta?.variant as string) ?? "info") as CalloutVariant;
      const cv = CALLOUT_VARIANTS.find((v) => v.value === variant) ?? CALLOUT_VARIANTS[0];
      return (
        <div className={cn("rounded-lg border-l-4 p-4", cv.border, cv.bg)}>
          {/* Variant pill selector */}
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Callout type">
            {CALLOUT_VARIANTS.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => onChange({ meta: { ...block.meta, variant: v.value } })}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  variant === v.value
                    ? cn("border-transparent text-white", v.value === "info" && "bg-blue-500",
                        v.value === "success" && "bg-green-500",
                        v.value === "warning" && "bg-yellow-500",
                        v.value === "danger" && "bg-red-500")
                    : "border-border bg-background/60 text-muted-foreground hover:bg-background",
                )}
                aria-pressed={variant === v.value}
              >
                {v.label}
              </button>
            ))}
          </div>
          <InlineEditable
            value={block.content}
            onChange={(v) => onChange({ content: v })}
            autoFocus={autoFocus}
            onFocused={onFocused}
            placeholder="Callout text…"
            className={cn(common, "font-serif text-base")}
          />
        </div>
      );
    }
    case "table":
      return (
        <TableEditor
          value={block.content}
          headers={Boolean(block.meta?.headers ?? true)}
          onChange={(content, headers) =>
            onChange({ content, meta: { ...block.meta, headers } })
          }
        />
      );
    default:
      return (
        <TextareaAuto
          value={block.content}
          onChange={(v) => onChange({ content: v })}
          placeholder={block.type}
          className={cn(common, "font-serif text-lg")}
        />
      );
  }
});

/**
 * Editable list with visible markers (bullets, numbers, or checkboxes).
 * Stored as newline-separated lines to stay compatible with the existing
 * BlogRenderer format. Checklist lines are prefixed with `[ ]`/`[x]`.
 */
const ListEditor = memo(function ListEditor({
  kind,
  value,
  onChange,
  onConvertToParagraph,
  autoFocus,
  onFocused,
}: {
  kind: "bullet" | "numbered" | "checklist";
  value: string;
  onChange: (v: string) => void;
  onConvertToParagraph: () => void;
  autoFocus?: boolean;
  onFocused?: () => void;
}) {
  const rawItems = value.length ? value.split("\n") : [""];
  const items = rawItems.map((line) => {
    if (kind !== "checklist") return { checked: false, text: line };
    if (line.startsWith("[x] ") || line.startsWith("[X] ")) return { checked: true, text: line.slice(4) };
    if (line.startsWith("[ ] ")) return { checked: false, text: line.slice(4) };
    return { checked: false, text: line };
  });
  const serialize = (next: { checked: boolean; text: string }[]) =>
    next
      .map((it) => (kind === "checklist" ? `${it.checked ? "[x]" : "[ ]"} ${it.text}` : it.text))
      .join("\n");
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const setItem = (i: number, patch: Partial<{ checked: boolean; text: string }>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    onChange(serialize(next));
  };
  const insertAfter = (i: number) => {
    const next = [...items.slice(0, i + 1), { checked: false, text: "" }, ...items.slice(i + 1)];
    onChange(serialize(next));
    setFocusIndex(i + 1);
  };
  const removeAt = (i: number) => {
    if (items.length === 1) {
      onConvertToParagraph();
      return;
    }
    const next = items.filter((_, idx) => idx !== i);
    onChange(serialize(next));
    setFocusIndex(Math.max(0, i - 1));
  };

  return (
    <div className="font-serif text-lg">
      <ol className={cn("space-y-1 pl-6", kind === "numbered" ? "list-decimal" : kind === "bullet" ? "list-disc" : "list-none pl-0")}>
        {items.map((it, i) => (
          <li key={i} className={cn("flex items-start gap-2", kind !== "checklist" && "block")}>
            {kind === "checklist" && (
              <input
                type="checkbox"
                checked={it.checked}
                onChange={(e) => setItem(i, { checked: e.target.checked })}
                className="mt-2 h-4 w-4"
                aria-label="Toggle item"
              />
            )}
            <InlineEditable
              value={it.text}
              onChange={(v) => setItem(i, { text: v })}
              onEnter={() => insertAfter(i)}
              onBackspaceEmpty={() => removeAt(i)}
              placeholder="List item"
              singleLine
              autoFocus={i === 0 ? autoFocus : (focusIndex === i)}
              onFocused={i === 0 ? onFocused : undefined}
              className={cn(
                "flex-1",
                kind === "checklist" && it.checked && "text-muted-foreground line-through",
              )}
            />
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => insertAfter(items.length - 1)}
        className="mt-1 pl-6 text-xs text-muted-foreground hover:text-foreground"
      >
        + Add item
      </button>
    </div>
  );
});

const TextareaAuto = memo(function TextareaAuto({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = ref.current.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      rows={1}
    />
  );
});

/**
 * Table storage format: TSV — rows separated by "\n", cells by "\t".
 * Keeps persistence trivial while allowing an interactive grid editor.
 */
function parseTable(v: string): string[][] {
  const rows = v.split("\n").map((r) => r.split("\t"));
  return rows.length ? rows : [[""]];
}
function serializeTable(rows: string[][]): string {
  return rows.map((r) => r.join("\t")).join("\n");
}

const TableEditor = memo(function TableEditor({
  value,
  headers,
  onChange,
}: {
  value: string;
  headers: boolean;
  onChange: (content: string, headers: boolean) => void;
}) {
  const rows = parseTable(value || "Column 1\tColumn 2\n\t");
  const setCell = (r: number, c: number, v: string) => {
    const next = rows.map((row) => [...row]);
    next[r][c] = v;
    onChange(serializeTable(next), headers);
  };
  const addRow = () => {
    const cols = rows[0]?.length ?? 1;
    onChange(serializeTable([...rows, Array(cols).fill("")]), headers);
  };
  const addCol = () => {
    onChange(serializeTable(rows.map((r) => [...r, ""])), headers);
  };
  const removeRow = (r: number) => {
    if (rows.length <= 1) return;
    onChange(serializeTable(rows.filter((_, i) => i !== r)), headers);
  };
  const removeCol = (c: number) => {
    if ((rows[0]?.length ?? 0) <= 1) return;
    onChange(serializeTable(rows.map((r) => r.filter((_, i) => i !== c))), headers);
  };
  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={headers}
            onChange={(e) => onChange(value, e.target.checked)}
          />
          Header row
        </label>
        <Button size="sm" variant="ghost" onClick={addRow}>+ Row</Button>
        <Button size="sm" variant="ghost" onClick={addCol}>+ Column</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="group/row">
                {row.map((cell, c) => (
                  <td key={c} className="border p-0">
                    <input
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      className={cn(
                        "w-full bg-transparent px-2 py-1 outline-none",
                        headers && r === 0 && "font-semibold",
                      )}
                      placeholder={headers && r === 0 ? `Column ${c + 1}` : ""}
                    />
                  </td>
                ))}
                <td className="w-6 pl-1 opacity-0 group-hover/row:opacity-100">
                  <button
                    onClick={() => removeRow(r)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                    aria-label="Delete row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              {(rows[0] ?? []).map((_, c) => (
                <td key={c} className="text-center">
                  <button
                    onClick={() => removeCol(c)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                    aria-label="Delete column"
                  >
                    ×
                  </button>
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
});

/**
 * Image block editor: supports URL or file upload, interactive rectangular
 * crop (drag on the preview), alt text, and caption — the fields Medium
 * exposes for every image.
 */
interface ImagePatch {
  src?: string;
  alt?: string;
  caption?: string;
}

const ImageBlockEditor = memo(function ImageBlockEditor({
  src,
  alt,
  caption,
  onChange,
}: {
  src: string;
  alt: string;
  caption: string;
  onChange: (patch: ImagePatch) => void;
}) {
  const [cropping, setCropping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ src: String(reader.result) });
    reader.readAsDataURL(f);
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={src.startsWith("data:") ? "" : src}
          onChange={(e) => onChange({ src: e.target.value })}
          placeholder="Paste image URL (https://…)"
          className="min-w-[200px] flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <ImageIcon className="mr-1 h-4 w-4" /> Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      {src && !cropping && (
        <div className="space-y-2">
          <figure className="overflow-hidden rounded-md border bg-muted/20">
            <img src={src} alt={alt} className="max-h-96 w-full object-contain" />
          </figure>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCropping(true)}>
              Crop
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ src: "" })}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      )}

      {src && cropping && (
        <CropTool
          src={src}
          onCancel={() => setCropping(false)}
          onApply={(cropped) => {
            onChange({ src: cropped });
            setCropping(false);
          }}
        />
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={alt}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Alt text (for accessibility & SEO)"
        />
        <Input
          value={caption}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Caption (optional)"
        />
      </div>
    </div>
  );
});



