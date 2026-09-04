/**
 * ResizableImageLink — Tiptap NodeView extension
 *
 * Features:
 *  • Insert image by URL (no upload)
 *  • Drag-resize handles on all four corners and edges
 *  • Floating toolbar: align left / center / right, resize to 25/50/75/100%, open crop dialog
 *  • Inline crop dialog using react-image-crop
 *  • All colours from CSS variables — theme-aware
 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Crop as CropIcon,
  Maximize2,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Tiptap Node definition
// ─────────────────────────────────────────────────────────────────────────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resizableImageLink: {
      setResizableImage: (attrs: {
        src: string;
        alt?: string;
        title?: string;
        width?: number | null;
        align?: "left" | "center" | "right";
      }) => ReturnType;
    };
  }
}

export const ResizableImageLink = Node.create({
  name: "resizableImageLink",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      title: { default: null },
      width: { default: null },
      align: { default: "center" },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },

  addCommands() {
    return {
      setResizableImage:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs });
        },
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Crop helper — applies a PixelCrop to a canvas and returns a data-URL
// ─────────────────────────────────────────────────────────────────────────────

function getCroppedDataUrl(image: HTMLImageElement, crop: PixelCrop): string {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const cropW = Math.round(crop.width * scaleX);
  const cropH = Math.round(crop.height * scaleY);
  if (cropW === 0 || cropH === 0) return image.src;

  const canvas = document.createElement("canvas");
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return image.src;

  // Needed for cross-origin images painted onto canvas
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH,
  );
  return canvas.toDataURL("image/png");
}

/** Convert a percentage-based Crop to absolute PixelCrop for an image element */
function percentCropToPixel(crop: Crop, image: HTMLImageElement): PixelCrop {
  const w = image.width;
  const h = image.height;
  return {
    unit: "px",
    x: Math.round((crop.x / 100) * w),
    y: Math.round((crop.y / 100) * h),
    width: Math.round((crop.width / 100) * w),
    height: Math.round((crop.height / 100) * h),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NodeView React component
// ─────────────────────────────────────────────────────────────────────────────

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, title, width, align } = node.attrs as {
    src: string;
    alt: string;
    title: string | null;
    width: number | null;
    align: "left" | "center" | "right";
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);

  // ── Resize drag state ──────────────────────────────────────────────────────
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const isDragging = useRef(false);

  const displayWidth = width ?? undefined; // undefined = CSS max-width: 100%

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, side: "left" | "right") => {
      e.preventDefault();
      e.stopPropagation();
      if (!imgRef.current) return;
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartWidth.current = imgRef.current.offsetWidth;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = ev.clientX - dragStartX.current;
        const newWidth =
          side === "right"
            ? Math.max(80, dragStartWidth.current + delta)
            : Math.max(80, dragStartWidth.current - delta);
        updateAttributes({ width: Math.round(newWidth) });
      };

      const onMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [updateAttributes],
  );

  // Show toolbar when image is focused/selected
  useEffect(() => {
    setIsToolbarVisible(selected);
  }, [selected]);

  // ── Crop state ─────────────────────────────────────────────────────────────
  const DEFAULT_CROP: Crop = { unit: "%", x: 10, y: 10, width: 80, height: 80 };
  const [crop, setCrop] = useState<Crop>(DEFAULT_CROP);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  // Reset crop to default every time the dialog opens
  useEffect(() => {
    if (showCropDialog) {
      setCrop(DEFAULT_CROP);
      setCompletedCrop(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCropDialog]);

  const handleCropApply = () => {
    const img = cropImgRef.current;
    if (!img) return;
    // If user never moved the crop handle, derive pixel crop from the default % crop
    const pixelCrop: PixelCrop =
      completedCrop && completedCrop.width > 0
        ? completedCrop
        : percentCropToPixel(crop, img);
    const croppedUrl = getCroppedDataUrl(img, pixelCrop);
    updateAttributes({ src: croppedUrl });
    setShowCropDialog(false);
  };

  // Compute which % preset the current pixel width matches (for active state)
  const currentPct = (() => {
    if (width === null) return 100;
    const parentWidth = containerRef.current?.parentElement?.offsetWidth ?? 0;
    if (!parentWidth) return null;
    const pct = Math.round((width / parentWidth) * 100);
    // Round to nearest preset bucket
    if (pct <= 30) return 25;
    if (pct <= 62) return 50;
    if (pct <= 87) return 75;
    return 100;
  })();

  return (
    <NodeViewWrapper>
      <div
        ref={containerRef}
        className={`notion-img-wrapper notion-img-align-${align}`}
        onMouseEnter={() => setIsToolbarVisible(true)}
        onMouseLeave={() => { if (!selected) setIsToolbarVisible(false); }}
      >
        {/* ── Floating toolbar ── */}
        {isToolbarVisible && (
          <div className="notion-img-toolbar" contentEditable={false}>
            {/* Alignment — dedicated image-float icons */}
            <button
              type="button"
              className={`notion-img-tb-btn${align === "left" ? " notion-img-tb-btn--active" : ""}`}
              title="Float left — text wraps right"
              onMouseDown={(e) => { e.preventDefault(); updateAttributes({ align: "left" }); }}
            >
              {/* Picture on left, 3 text-lines on right */}
              <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor" aria-hidden="true">
                <rect x="1" y="2" width="8" height="9" rx="1.5"/>
                <rect x="11" y="2.5" width="7" height="2" rx="1"/>
                <rect x="11" y="6.5" width="7" height="2" rx="1"/>
                <rect x="11" y="10.5" width="4" height="2" rx="1"/>
                <rect x="1" y="13.5" width="17" height="2" rx="1"/>
                <rect x="1" y="17" width="12" height="2" rx="1"/>
              </svg>
            </button>
            <button
              type="button"
              className={`notion-img-tb-btn${align === "center" ? " notion-img-tb-btn--active" : ""}`}
              title="Center — full width block"
              onMouseDown={(e) => { e.preventDefault(); updateAttributes({ align: "center" }); }}
            >
              {/* Picture centred, text lines below */}
              <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor" aria-hidden="true">
                <rect x="2" y="2" width="16" height="9" rx="1.5"/>
                <rect x="1" y="13.5" width="18" height="2" rx="1"/>
                <rect x="4" y="17" width="12" height="2" rx="1"/>
              </svg>
            </button>
            <button
              type="button"
              className={`notion-img-tb-btn${align === "right" ? " notion-img-tb-btn--active" : ""}`}
              title="Float right — text wraps left"
              onMouseDown={(e) => { e.preventDefault(); updateAttributes({ align: "right" }); }}
            >
              {/* 3 text-lines on left, picture on right */}
              <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor" aria-hidden="true">
                <rect x="11" y="2" width="8" height="9" rx="1.5"/>
                <rect x="2" y="2.5" width="7" height="2" rx="1"/>
                <rect x="2" y="6.5" width="7" height="2" rx="1"/>
                <rect x="2" y="10.5" width="4" height="2" rx="1"/>
                <rect x="1" y="13.5" width="17" height="2" rx="1"/>
                <rect x="4" y="17" width="12" height="2" rx="1"/>
              </svg>
            </button>

            <div className="notion-img-tb-sep" />

            {/* Width presets with active highlight */}
            {([25, 50, 75, 100] as const).map((pct) => (
              <button
                key={pct}
                type="button"
                className={`notion-img-tb-btn notion-img-tb-btn--text${currentPct === pct ? " notion-img-tb-btn--active" : ""}`}
                title={`${pct}% width`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!containerRef.current) return;
                  const parentWidth = containerRef.current.parentElement?.offsetWidth ?? 800;
                  updateAttributes({ width: pct === 100 ? null : Math.round(parentWidth * pct / 100) });
                }}
              >
                {pct}%
              </button>
            ))}

            <div className="notion-img-tb-sep" />

            {/* Reset size */}
            <button
              type="button"
              className="notion-img-tb-btn"
              title="Reset to natural size"
              onMouseDown={(e) => { e.preventDefault(); updateAttributes({ width: null }); }}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            {/* Crop */}
            <button
              type="button"
              className="notion-img-tb-btn"
              title="Crop image"
              onMouseDown={(e) => { e.preventDefault(); setShowCropDialog(true); }}
            >
              <CropIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Image + resize handles ── */}
        <div className="notion-img-inner" style={{ width: displayWidth }}>
          <img
            ref={imgRef}
            src={src}
            alt={alt ?? ""}
            title={title ?? undefined}
            className={`notion-img${selected ? " notion-img--selected" : ""}`}
            draggable={false}
            crossOrigin="anonymous"
          />

          {/* Left resize handle */}
          {isToolbarVisible && (
            <div
              className="notion-img-handle notion-img-handle--left"
              onMouseDown={(e) => handleResizeMouseDown(e, "left")}
            />
          )}
          {/* Right resize handle */}
          {isToolbarVisible && (
            <div
              className="notion-img-handle notion-img-handle--right"
              onMouseDown={(e) => handleResizeMouseDown(e, "right")}
            />
          )}
        </div>
      </div>

      {/* ── Crop dialog ── */}
      <Dialog open={showCropDialog} onOpenChange={(o) => { if (!o) setShowCropDialog(false); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CropIcon className="h-4 w-4" /> Crop Image
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center overflow-auto max-h-[60vh] py-2">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={undefined}
            >
              <img
                ref={cropImgRef}
                src={src}
                alt={alt ?? ""}
                crossOrigin="anonymous"
                style={{ maxHeight: "55vh", maxWidth: "100%" }}
              />
            </ReactCrop>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCropDialog(false)}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={handleCropApply} disabled={!completedCrop}>
              <Check className="mr-1 h-4 w-4" /> Apply Crop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NodeViewWrapper>
  );
}
