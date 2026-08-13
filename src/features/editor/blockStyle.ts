import type { CSSProperties } from "react";
import type { Block } from "@/types";

/**
 * Per-block visual overrides applied to both the editor surface and the
 * published/preview renderer. Stored under `block.meta.style` so it round-trips
 * through the existing block persistence.
 */
export interface BlockStyle {
  textColor?: string;
  highlight?: string;
  bgColor?: string;
  bgColorAlpha?: number; // 0..1
  bgGradient?: {
    from: string;
    to: string;
    angle: number;
    fromAlpha?: number; // 0..1
    toAlpha?: number; // 0..1
  };
  bgImage?: string;
  /** Optional pre-computed crop of bgImage, stored as its own data URL. */
  bgImageCropped?: string;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  border?: { width: number; color: string; style: "solid" | "dashed" | "dotted"; radius: number };
  shadow?: "none" | "sm" | "md" | "lg" | "xl";
}

export const FONT_OPTIONS: { label: string; value: string; css: string }[] = [
  { label: "Default", value: "", css: "" },
  { label: "Serif", value: "serif", css: "Georgia, 'Times New Roman', serif" },
  { label: "Sans-serif", value: "sans", css: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { label: "Monospace", value: "mono", css: "ui-monospace, 'SF Mono', Menlo, monospace" },
  { label: "Cursive", value: "cursive", css: "'Brush Script MT', cursive" },
  { label: "Display", value: "display", css: "'Playfair Display', 'Georgia', serif" },
];

const SHADOWS: Record<NonNullable<BlockStyle["shadow"]>, string> = {
  none: "none",
  sm: "0 1px 2px rgba(0,0,0,0.08)",
  md: "0 4px 12px rgba(0,0,0,0.12)",
  lg: "0 10px 24px rgba(0,0,0,0.18)",
  xl: "0 20px 40px rgba(0,0,0,0.25)",
};

export function fontFamilyCss(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return FONT_OPTIONS.find((f) => f.value === value)?.css;
}

export function getBlockStyle(block: Block): BlockStyle | undefined {
  const raw = block.meta?.style as BlockStyle | undefined;
  return raw && typeof raw === "object" ? raw : undefined;
}

/** Convert `#rrggbb` (or `#rgb`) into an rgba() string using the given alpha. */
export function withAlpha(color: string | undefined, alpha: number | undefined): string | undefined {
  if (!color) return color;
  const a = alpha == null ? 1 : Math.max(0, Math.min(1, alpha));
  if (a >= 1) return color;
  let hex = color.trim();
  const short = hex.match(/^#([\da-f])([\da-f])([\da-f])$/i);
  if (short) hex = "#" + short.slice(1).map((c) => c + c).join("");
  const m = hex.match(/^#([\da-f]{6})$/i);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Produce the outer container style for a block (background layers, padding
 * hint when a background is present, and font family) plus the inner text
 * style (color, highlighter marker).
 */
export function styleToCss(
  s: BlockStyle | undefined,
): { container: CSSProperties; text: CSSProperties; hasBackground: boolean; fontOverride: boolean } {
  if (!s) return { container: {}, text: {}, hasBackground: false, fontOverride: false };

  const container: CSSProperties = {};
  const backgrounds: string[] = [];

  const bgImg = s.bgImageCropped || s.bgImage;
  if (bgImg) backgrounds.push(`url("${bgImg}") center/cover no-repeat`);
  if (s.bgGradient) {
    const from = withAlpha(s.bgGradient.from, s.bgGradient.fromAlpha) ?? s.bgGradient.from;
    const to = withAlpha(s.bgGradient.to, s.bgGradient.toAlpha) ?? s.bgGradient.to;
    backgrounds.push(`linear-gradient(${s.bgGradient.angle}deg, ${from}, ${to})`);
  } else if (s.bgColor) {
    container.backgroundColor = withAlpha(s.bgColor, s.bgColorAlpha) ?? s.bgColor;
  }
  if (backgrounds.length) container.background = backgrounds.join(", ");

  const hasBackground = Boolean(bgImg || s.bgGradient || s.bgColor);

  const fam = fontFamilyCss(s.fontFamily);
  if (fam) container.fontFamily = fam;

  if (s.border && s.border.width > 0) {
    container.border = `${s.border.width}px ${s.border.style} ${s.border.color}`;
    if (s.border.radius) container.borderRadius = s.border.radius;
  }
  if (s.shadow && s.shadow !== "none") {
    container.boxShadow = SHADOWS[s.shadow];
  }
  if (s.textAlign) container.textAlign = s.textAlign;

  const text: CSSProperties = {};
  if (s.textColor) text.color = s.textColor;
  if (s.highlight) {
    // Highlighter-marker look: painted band behind text, honors line breaks.
    text.backgroundImage = `linear-gradient(${s.highlight}, ${s.highlight})`;
    text.backgroundRepeat = "no-repeat";
    text.backgroundSize = "100% 65%";
    text.backgroundPosition = "0 88%";
    (text as unknown as Record<string, string>).WebkitBoxDecorationBreak = "clone";
    text.boxDecorationBreak = "clone" as CSSProperties["boxDecorationBreak"];
  }
  return { container, text, hasBackground, fontOverride: Boolean(fam) };
}
