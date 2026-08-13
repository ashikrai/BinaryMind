import { useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Pencil, Upload, X, AlignLeft, AlignCenter, AlignRight, AlignJustify, Crop,
} from "lucide-react";
import { FONT_OPTIONS, withAlpha, type BlockStyle } from "./blockStyle";
import { CropTool } from "./CropTool";
import { cn } from "@/lib/utils";

interface Props {
  value: BlockStyle | undefined;
  onChange: (next: BlockStyle | undefined) => void;
}

const SWATCHES = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#f59e0b",
  "#eab308", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
];

function ColorRow({
  label, value, onChange, alpha, onAlphaChange, allowClear = true,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  alpha?: number;
  onAlphaChange?: (a: number) => void;
  allowClear?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border bg-transparent p-0"
          aria-label={`${label} color`}
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="#000000"
          className="h-7 w-24 text-xs"
        />
        {allowClear && value && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(undefined)} aria-label="Clear">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="flex flex-wrap gap-1">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className="h-4 w-4 rounded-sm border border-border/60"
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>
      {onAlphaChange && (
        <div className="flex items-center gap-2">
          <Label className="w-16 text-xs">Opacity</Label>
          <Slider
            value={[Math.round((alpha ?? 1) * 100)]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => onAlphaChange(v / 100)}
            className="flex-1"
          />
          <span className="w-10 text-right text-xs tabular-nums">{Math.round((alpha ?? 1) * 100)}%</span>
          <div
            className="h-5 w-8 rounded border"
            style={{ background: withAlpha(value || "#000000", alpha) }}
          />
        </div>
      )}
    </div>
  );
}

export function BlockStylePopover({ value, onChange }: Props) {
  const s = value ?? {};
  const set = (patch: Partial<BlockStyle>) => {
    const next = { ...s, ...patch };
    const empty =
      !next.textColor && !next.highlight && !next.bgColor &&
      !next.bgGradient && !next.bgImage && !next.fontFamily &&
      !next.textAlign && !next.border && (!next.shadow || next.shadow === "none");
    onChange(empty ? undefined : next);
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("text");
  const [cropping, setCropping] = useState(false);

  const onFile = (f: File | null | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => set({ bgImage: String(reader.result), bgImageCropped: undefined });
    reader.readAsDataURL(f);
  };

  const gradient = s.bgGradient ?? { from: "#a855f7", to: "#3b82f6", angle: 135, fromAlpha: 1, toAlpha: 1 };
  const border = s.border ?? { width: 0, color: "#000000", style: "solid" as const, radius: 8 };
  const align = s.textAlign ?? "left";
  const shadow = s.shadow ?? "none";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit block style">
          <Pencil className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className="w-[360px] p-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="text" className="text-xs">Text</TabsTrigger>
            <TabsTrigger value="bg" className="text-xs">Background</TabsTrigger>
            <TabsTrigger value="image" className="text-xs">Image</TabsTrigger>
            <TabsTrigger value="font" className="text-xs">Font</TabsTrigger>
            <TabsTrigger value="frame" className="text-xs">Frame</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              These apply to the whole block. To color selected text only, highlight it and use the floating toolbar.
            </p>
            <ColorRow label="Block text color" value={s.textColor} onChange={(v) => set({ textColor: v })} />
            <ColorRow label="Highlight" value={s.highlight} onChange={(v) => set({ highlight: v })} />
            <div className="space-y-1.5">
              <Label className="text-xs">Alignment</Label>
              <div className="flex gap-1">
                {([
                  ["left", AlignLeft],
                  ["center", AlignCenter],
                  ["right", AlignRight],
                  ["justify", AlignJustify],
                ] as const).map(([val, Icon]) => (
                  <Button
                    key={val}
                    type="button"
                    size="icon"
                    variant={align === val ? "default" : "outline"}
                    className="h-8 w-8"
                    onClick={() => set({ textAlign: val === "left" ? undefined : val })}
                    aria-label={`Align ${val}`}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bg" className="space-y-3 pt-3">
            <ColorRow
              label="Solid color"
              value={s.bgColor}
              onChange={(v) => set({ bgColor: v, bgGradient: undefined })}
              alpha={s.bgColorAlpha ?? 1}
              onAlphaChange={(a) => set({ bgColorAlpha: a })}
            />
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs">Gradient</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={gradient.from}
                  onChange={(e) => set({ bgGradient: { ...gradient, from: e.target.value }, bgColor: undefined })}
                  className="h-7 w-9 cursor-pointer rounded border bg-transparent p-0"
                  aria-label="Gradient from"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <input
                  type="color"
                  value={gradient.to}
                  onChange={(e) => set({ bgGradient: { ...gradient, to: e.target.value }, bgColor: undefined })}
                  className="h-7 w-9 cursor-pointer rounded border bg-transparent p-0"
                  aria-label="Gradient to"
                />
                {s.bgGradient && (
                  <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => set({ bgGradient: undefined })} aria-label="Clear gradient">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-16 text-xs">From α</Label>
                <Slider
                  value={[Math.round((gradient.fromAlpha ?? 1) * 100)]}
                  min={0} max={100} step={1}
                  onValueChange={([v]) => set({ bgGradient: { ...gradient, fromAlpha: v / 100 }, bgColor: undefined })}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs tabular-nums">{Math.round((gradient.fromAlpha ?? 1) * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-16 text-xs">To α</Label>
                <Slider
                  value={[Math.round((gradient.toAlpha ?? 1) * 100)]}
                  min={0} max={100} step={1}
                  onValueChange={([v]) => set({ bgGradient: { ...gradient, toAlpha: v / 100 }, bgColor: undefined })}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs tabular-nums">{Math.round((gradient.toAlpha ?? 1) * 100)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-16 text-xs">Angle</Label>
                <Slider
                  value={[gradient.angle]}
                  min={0} max={360} step={5}
                  onValueChange={([v]) => set({ bgGradient: { ...gradient, angle: v }, bgColor: undefined })}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs tabular-nums">{gradient.angle}°</span>
              </div>
              <div
                className="h-8 rounded-md border"
                style={{
                  background: `linear-gradient(${gradient.angle}deg, ${withAlpha(gradient.from, gradient.fromAlpha)}, ${withAlpha(gradient.to, gradient.toAlpha)})`,
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="image" className="space-y-3 pt-3">
            <Label className="text-xs">Background image</Label>
            <div className="flex gap-2">
              <Input
                value={s.bgImage?.startsWith("data:") ? "" : (s.bgImage ?? "")}
                onChange={(e) => set({ bgImage: e.target.value || undefined, bgImageCropped: undefined })}
                placeholder="Paste image URL"
                className="h-8 flex-1 text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1 h-3.5 w-3.5" /> Upload
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
            {s.bgImage && !cropping && (
              <>
                <div
                  className="h-24 rounded-md border bg-muted"
                  style={{
                    backgroundImage: `url("${s.bgImageCropped || s.bgImage}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCropping(true)}>
                    <Crop className="mr-1 h-3.5 w-3.5" /> Crop area
                  </Button>
                  {s.bgImageCropped && (
                    <Button variant="ghost" size="sm" onClick={() => set({ bgImageCropped: undefined })}>
                      Reset crop
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => set({ bgImage: undefined, bgImageCropped: undefined })}>
                    <X className="mr-1 h-3.5 w-3.5" /> Remove image
                  </Button>
                </div>
              </>
            )}
            {s.bgImage && cropping && (
              <CropTool
                src={s.bgImage}
                onCancel={() => setCropping(false)}
                onApply={(cropped) => {
                  set({ bgImageCropped: cropped });
                  setCropping(false);
                }}
              />
            )}
          </TabsContent>

          <TabsContent value="font" className="space-y-3 pt-3">
            <Label className="text-xs">Font family</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.value || "default"}
                  type="button"
                  onClick={() => set({ fontFamily: f.value || undefined })}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-left text-sm hover:bg-muted/50",
                    (s.fontFamily ?? "") === f.value && "border-primary ring-1 ring-primary",
                  )}
                  style={{ fontFamily: f.css || undefined }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="frame" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label className="text-xs">Border</Label>
              <div className="flex items-center gap-2">
                <Label className="w-16 text-xs">Width</Label>
                <Slider
                  value={[border.width]}
                  min={0} max={10} step={1}
                  onValueChange={([v]) => set({ border: { ...border, width: v } })}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs tabular-nums">{border.width}px</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-16 text-xs">Radius</Label>
                <Slider
                  value={[border.radius]}
                  min={0} max={32} step={1}
                  onValueChange={([v]) => set({ border: { ...border, radius: v } })}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs tabular-nums">{border.radius}px</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={border.color}
                  onChange={(e) => set({ border: { ...border, color: e.target.value } })}
                  className="h-7 w-9 cursor-pointer rounded border bg-transparent p-0"
                  aria-label="Border color"
                />
                <select
                  value={border.style}
                  onChange={(e) => set({ border: { ...border, style: e.target.value as "solid" | "dashed" | "dotted" } })}
                  className="h-7 rounded border bg-background px-2 text-xs"
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
                {s.border && (
                  <Button variant="ghost" size="sm" onClick={() => set({ border: undefined })}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5 border-t pt-2">
              <Label className="text-xs">Shadow</Label>
              <div className="flex flex-wrap gap-1">
                {(["none", "sm", "md", "lg", "xl"] as const).map((sz) => (
                  <Button
                    key={sz}
                    type="button"
                    size="sm"
                    variant={shadow === sz ? "default" : "outline"}
                    onClick={() => set({ shadow: sz === "none" ? undefined : sz })}
                  >
                    {sz.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-3 flex justify-between border-t pt-2">
          <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            Reset all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
