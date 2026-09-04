/**
 * CodeBlockView — Tiptap NodeView for code blocks
 *
 * Replaces StarterKit's plain <pre><code> with a rich code block that adds:
 *  • Optional language label (editable inline in the header bar)
 *  • Optional filename label (editable inline in the header bar)
 *  • Copy-to-clipboard button
 *  • All colours from CSS variables → theme-aware (dark + light)
 *
 * The `language` and `filename` attributes are stored as Tiptap node attrs
 * so they round-trip correctly through getHTML() / setContent().
 */

import React, { useCallback, useRef, useState } from "react";
import { Node, mergeAttributes, textblockTypeInputRule } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Copy, Check, FileCode2, ChevronDown } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Well-known languages (for the dropdown suggestions)
// ─────────────────────────────────────────────────────────────────────────────

const LANGUAGES = [
  "plain", "bash", "c", "cpp", "css", "diff", "go", "graphql",
  "html", "ini", "java", "javascript", "json", "jsx", "kotlin",
  "lua", "makefile", "markdown", "objectivec", "perl", "php",
  "python", "r", "ruby", "rust", "scala", "shell", "sql",
  "swift", "toml", "tsx", "typescript", "xml", "yaml",
];

// ─────────────────────────────────────────────────────────────────────────────
// Tiptap Node definition
// ─────────────────────────────────────────────────────────────────────────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    codeBlockView: {
      /** Insert a code block with optional language and filename */
      setCodeBlockView: (attrs?: { language?: string; filename?: string }) => ReturnType;
    };
  }
}

export const CodeBlockView = Node.create({
  name: "codeBlock",  // same name as StarterKit — replaces it
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,

  addAttributes() {
    return {
      language: { default: "" },
      filename: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "pre",
        preserveWhitespace: "full",
        getAttrs: (node) => {
          const el = node as HTMLElement;
          const code = el.querySelector("code");
          const lang =
            code?.getAttribute("data-language") ??
            code?.className.replace(/^language-/, "") ??
            "";
          const filename = el.getAttribute("data-filename") ?? "";
          return { language: lang, filename };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, {
        "data-filename": node.attrs.filename || null,
      }),
      [
        "code",
        {
          "data-language": node.attrs.language || null,
          class: node.attrs.language ? `language-${node.attrs.language}` : null,
        },
        0,
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },

  addCommands() {
    return {
      setCodeBlockView:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-c": () => this.editor.commands.setCodeBlockView(),
    };
  },

  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^```([a-z]*)[\s\n]$/,
        type: this.type,
        getAttributes: (match) => ({ language: match[1] ?? "" }),
      }),
    ];
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// NodeView React component
// ─────────────────────────────────────────────────────────────────────────────

function CodeBlockNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const { language, filename } = node.attrs as { language: string; filename: string };

  const [copied, setCopied] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [langFilter, setLangFilter] = useState("");
  const langInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(node.textContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [node.textContent]);

  const filteredLangs = langFilter
    ? LANGUAGES.filter((l) => l.includes(langFilter.toLowerCase()))
    : LANGUAGES;

  const selectLang = (lang: string) => {
    updateAttributes({ language: lang === "plain" ? "" : lang });
    setLangFilter("");
    setShowLangDropdown(false);
  };

  return (
    <NodeViewWrapper>
      <div
        className={`notion-code-block${selected ? " notion-code-block--selected" : ""}`}
      >
        {/* ── Header bar — not editable by ProseMirror ── */}
        <div className="notion-code-header" contentEditable={false}>
          {/* Left: file icon + filename input */}
          <div className="notion-code-header-left">
            <FileCode2 className="notion-code-file-icon h-3.5 w-3.5" />
            <input
              className="notion-code-filename-input"
              value={filename}
              onChange={(e) => updateAttributes({ filename: e.target.value })}
              placeholder="filename (optional)"
              spellCheck={false}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>

          {/* Right: language badge + copy button */}
          <div className="notion-code-header-right">
            {/* Language selector */}
            <div className="notion-code-lang-wrapper" ref={dropdownRef}>
              <button
                type="button"
                className="notion-code-lang-btn"
                title="Set language"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLangFilter(language);
                  setShowLangDropdown((v) => !v);
                  setTimeout(() => langInputRef.current?.focus(), 10);
                }}
              >
                <span>{language || "plain"}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>

              {showLangDropdown && (
                <div className="notion-code-lang-dropdown">
                  <input
                    ref={langInputRef}
                    className="notion-code-lang-search"
                    value={langFilter}
                    onChange={(e) => setLangFilter(e.target.value)}
                    placeholder="Filter…"
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setShowLangDropdown(false);
                      if (e.key === "Enter" && filteredLangs[0]) selectLang(filteredLangs[0]);
                    }}
                  />
                  <div className="notion-code-lang-list">
                    {filteredLangs.map((l) => (
                      <button
                        key={l}
                        type="button"
                        className={`notion-code-lang-option${(language || "plain") === l ? " notion-code-lang-option--active" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); selectLang(l); }}
                      >
                        {l}
                      </button>
                    ))}
                    {filteredLangs.length === 0 && (
                      <span className="notion-code-lang-empty">No match</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Copy button */}
            <button
              type="button"
              className="notion-code-copy-btn"
              title={copied ? "Copied!" : "Copy code"}
              onMouseDown={(e) => { e.preventDefault(); handleCopy(); }}
            >
              {copied
                ? <Check className="h-3.5 w-3.5" />
                : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* ── Code content area ── */}
        {/* NodeViewContent renders the live ProseMirror text; we wrap it in <pre> */}
        <pre className="notion-code-content">
          <NodeViewContent className="notion-code-inner" />
        </pre>
      </div>
    </NodeViewWrapper>
  );
}
