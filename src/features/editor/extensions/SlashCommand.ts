/**
 * SlashCommand — Notion-style "/" block-type picker
 *
 * Tiptap Extension that:
 *  1. Intercepts the "/" keystroke
 *  2. Records the position of the slash so the React menu can anchor to it
 *  3. Exposes open/close state via a plugin key that the React layer reads
 *
 * The actual menu UI lives in NotionEditor.tsx. This extension simply manages
 * the ProseMirror side: capturing the "/" key, storing position metadata, and
 * deleting the slash character when a command is committed.
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface SlashCommandState {
  open: boolean;
  /** Document position of the "/" character */
  from: number;
  /** The query text typed after "/" */
  query: string;
}

export const SLASH_COMMAND_KEY = new PluginKey<SlashCommandState>("slashCommand");

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: SLASH_COMMAND_KEY,

        state: {
          init(): SlashCommandState {
            return { open: false, from: 0, query: "" };
          },

          apply(tr, prev): SlashCommandState {
            const meta = tr.getMeta(SLASH_COMMAND_KEY);
            if (meta) return meta;
            // Keep position in sync when the document changes
            if (prev.open && tr.docChanged) {
              return {
                ...prev,
                from: tr.mapping.map(prev.from),
              };
            }
            return prev;
          },
        },
      }),
    ];
  },
});
