import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Interactive rectangular crop. Users drag on the preview to draw a
 * selection; Apply rasterizes the region into a new data URL so the
 * cropped image travels with the block regardless of the original source.
 */
export function CropTool({
  src,
  onCancel,
  onApply,
}: {
  src: string;
  onCancel: () => void;
  onApply: (cropped: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const toLocal = (e: React.PointerEvent) => {
    const box = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toLocal(e);
    startRef.current = p;
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const p = toLocal(e);
    const s = startRef.current;
    setRect({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };
  const onUp = () => {
    startRef.current = null;
  };

  const apply = () => {
    const img = imgRef.current;
    const wrap = wrapRef.current;
    if (!img || !wrap || !rect || rect.w < 5 || rect.h < 5) return;
    const box = wrap.getBoundingClientRect();
    const scaleX = img.naturalWidth / box.width;
    const scaleY = img.naturalHeight / box.height;
    const sx = rect.x * scaleX;
    const sy = rect.y * scaleY;
    const sw = rect.w * scaleX;
    const sh = rect.h * scaleY;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      onApply(canvas.toDataURL("image/png"));
    } catch {
      // Cross-origin images taint the canvas — fall back to keeping the original.
      onApply(src);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        Drag on the image to select a crop area.
      </div>
      <div
        ref={wrapRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        className="relative inline-block max-w-full cursor-crosshair select-none overflow-hidden rounded-md border bg-muted/20"
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          crossOrigin="anonymous"
          className="block max-h-96 w-auto"
        />
        {rect && (
          <div
            className="pointer-events-none absolute border-2 border-primary bg-primary/20"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={apply} disabled={!rect || rect.w < 5}>
          Apply crop
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setRect(null)}>
          Reset selection
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
