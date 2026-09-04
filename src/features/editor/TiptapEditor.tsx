/**
 * TiptapEditor
 *
 * A rich-text editor built on Tiptap that replaces the old BlockEditor.
 * Content is stored as an HTML string and synced via the `onChange` callback.
 *
 * Features:
 *  - Full formatting toolbar (bold, italic, underline, strike, code,
 *    headings H1–H3, paragraph, blockquote, bullet/ordered/task lists,
 *    horizontal rule, highlight, text colour)
 *  - Link insertion (URL prompt)
 *  - Image insertion by URL (no upload required)
 *  - Dark / light theme aware (uses CSS variables from the app theme)
 *  - Undo / redo
 */
import { useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { ImageLink } from "./extensions/ImageLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Highlighter,
  Pilcrow,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------
interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-7 w-7 shrink-0 rounded",
        active && "bg-accent text-accent-foreground",
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Separator
// ---------------------------------------------------------------------------
function Sep() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}

// ---------------------------------------------------------------------------
// Image URL Dialog
// ---------------------------------------------------------------------------
interface ImageDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (src: string, alt: string, caption: string) => void;
}

function ImageDialog({ open, onClose, onInsert }: ImageDialogProps) {
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");

  const handleInsert = () => {
    const trimmed = src.trim();
    if (!trimmed) return;
    onInsert(trimmed, alt.trim(), caption.trim());
    setSrc("");
    setAlt("");
    setCaption("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert Image</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Image URL <span className="text-destructive">*</span></label>
            <Input
              autoFocus
              placeholder="https://example.com/photo.jpg"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInsert()}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Alt text</label>
            <Input
              placeholder="Describe the image…"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Caption (optional)</label>
            <Input
              placeholder="Image caption…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
          {src && (
            <div className="overflow-hidden rounded-md border">
              <img
                src={src}
                alt={alt || "preview"}
                className="max-h-40 w-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleInsert} disabled={!src.trim()}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Link URL Dialog
// ---------------------------------------------------------------------------
interface LinkDialogProps {
  open: boolean;
  initial?: string;
  onClose: () => void;
  onInsert: (url: string) => void;
}

function LinkDialog({ open, initial = "", onClose, onInsert }: LinkDialogProps) {
  const [url, setUrl] = useState(initial);

  const handleInsert = () => {
    const trimmed = url.trim();
    onInsert(trimmed);
    setUrl("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Insert Link</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            autoFocus
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInsert()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleInsert}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------
interface TiptapEditorProps {
  /** Initial HTML content */
  initial: string;
  /** Called whenever editor content changes (debounced by ~300 ms via Tiptap onUpdate) */
  onChange: (html: string) => void;
  placeholder?: string;
}

export function TiptapEditor({ initial, onChange, placeholder = "Start writing your story…" }: TiptapEditorProps) {
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Highlight.configure({ multicolor: false }),
      TextStyle,
      Color,
      Placeholder.configure({ placeholder }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      ImageLink.configure({ inline: false, allowBase64: false }),
    ],
    content: initial,
    editorProps: {
      attributes: {
        class: "tiptap-editor-content",
        spellcheck: "true",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  const insertImage = useCallback(
    (src: string, alt: string, caption: string) => {
      editor?.chain().focus().insertContent({
        type: "imageLink",
        attrs: { src, alt, caption },
      }).run();
    },
    [editor],
  );

  const insertLink = useCallback(
    (url: string) => {
      if (!url) {
        editor?.chain().focus().unsetLink().run();
      } else {
        editor?.chain().focus().setLink({ href: url, target: "_blank" }).run();
      }
    },
    [editor],
  );

  if (!editor) return null;

  const { isFocused } = editor;

  return (
    <div
      className={cn(
        "tiptap-wrapper rounded-lg border bg-background transition-shadow",
        isFocused && "ring-2 ring-ring ring-offset-1",
      )}
    >
      {/* ── Toolbar ── */}
      <div className="tiptap-toolbar flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5">
        {/* History */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        {/* Block type */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive("paragraph")}
          title="Paragraph"
        >
          <Pilcrow className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        {/* Inline marks */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline code"
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive("highlight")}
          title="Highlight"
        >
          <Highlighter className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive("taskList")}
          title="Task list"
        >
          <ListTodo className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        {/* Block elements */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code block"
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule"
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Align left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Align center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="Align right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          active={editor.isActive({ textAlign: "justify" })}
          title="Justify"
        >
          <AlignJustify className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        {/* Link & Image */}
        <ToolbarButton
          onClick={() => setShowLinkDialog(true)}
          active={editor.isActive("link")}
          title="Insert link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setShowImageDialog(true)}
          title="Insert image (URL)"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* ── Editable area ── */}
      <EditorContent editor={editor} className="tiptap-editor-area" />

      {/* ── Dialogs ── */}
      <ImageDialog
        open={showImageDialog}
        onClose={() => setShowImageDialog(false)}
        onInsert={insertImage}
      />
      <LinkDialog
        open={showLinkDialog}
        initial={editor.isActive("link") ? (editor.getAttributes("link").href ?? "") : ""}
        onClose={() => setShowLinkDialog(false)}
        onInsert={insertLink}
      />
    </div>
  );
}
