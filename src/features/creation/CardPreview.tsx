import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { templates } from "@/domain/content";
import type { CreationDraft } from "@/domain/entities/types";
import { cn } from "@/lib/utils";
import { artworkKey } from "@/lib/art-style";
import {
  TEXT_WIDTH,
  backdropAlpha,
  clampPan,
  clampZoom,
  imagePlacement,
  PAN_RANGE,
  ratioFor,
  textStyle,
} from "./composition";

export function styleFilter(_draft: CreationDraft): string {
  return "none";
}

export function draftImageSrc(draft: CreationDraft): string | null {
  if (draft.styleId !== "original") {
    const generated = draft.artworkRenders?.[artworkKey(draft.styleId, draft.styleIntensity)];
    if (generated) return generated;
  }
  return draft.photo?.dataUrl ?? null;
}

type ImagePatch = Pick<Partial<CreationDraft>, "imagePan" | "imageZoom">;

export function CardPreview({
  draft,
  className,
  showMessage = true,
  onTextMove,
  onImageChange,
}: {
  draft: CreationDraft;
  className?: string;
  showMessage?: boolean;
  onTextMove?: (coordinates: { x: number; y: number }) => void;
  onImageChange?: (patch: ImagePatch) => void;
}) {
  const previewRef = useRef<HTMLElement>(null);
  const captionRef = useRef<HTMLElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; zoom: number } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const ratio = ratioFor(draft);
  const template = templates.find((t) => t.id === draft.templateId) ?? templates[0]!;
  const text = textStyle(draft);
  const src = draftImageSrc(draft);

  // Same geometry as the exporter, expressed in percentages of the frame.
  const frameW = 100;
  const frameH = 100 / ratio.aspect;
  const place = natural ? imagePlacement(draft, natural.w, natural.h, frameW, frameH) : null;

  // Mouse wheel zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const node = previewRef.current;
    if (!node || !onImageChange) return;
    const onWheel = (event: WheelEvent) => {
      if (!draftRef.current.photo) return;
      event.preventDefault();
      const zoom = clampZoom((draftRef.current.imageZoom ?? 1) * Math.exp(-event.deltaY * 0.0015));
      onImageChange({ imageZoom: zoom });
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [onImageChange]);

  function moveText(event: ReactPointerEvent<HTMLElement>) {
    if (!onTextMove || !previewRef.current) return;
    const bounds = previewRef.current.getBoundingClientRect();
    const caption = captionRef.current?.getBoundingClientRect();
    const halfH = caption ? Math.min(0.45, caption.height / bounds.height / 2) : 0.1;
    const halfW = TEXT_WIDTH / 2;
    const x = Math.min(1 - halfW, Math.max(halfW, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(1 - halfH - 0.02, Math.max(halfH + 0.02, (event.clientY - bounds.top) / bounds.height));
    onTextMove({ x, y });
  }

  function onPhotoPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!onImageChange || !draft.photo) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: draft.imageZoom ?? 1 };
    }
  }

  function onPhotoPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !onImageChange || !previewRef.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      onImageChange({ imageZoom: clampZoom(gesture.current.zoom * (dist / Math.max(1, gesture.current.dist))) });
      return;
    }
    const bounds = previewRef.current.getBoundingClientRect();
    const pan = draftRef.current.imagePan ?? { x: 0, y: 0 };
    onImageChange({
      imagePan: {
        x: clampPan(pan.x + (event.clientX - previous.x) / (bounds.width * PAN_RANGE)),
        y: clampPan(pan.y + (event.clientY - previous.y) / (bounds.height * PAN_RANGE)),
      },
    });
  }

  function onPhotoPointerUp(event: ReactPointerEvent<HTMLElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  }

  const alpha = backdropAlpha(text.backdrop);
  const tint = text.darkText ? "255,253,248" : "0,0,0";
  const processing = draft.styleId !== "original" && draft.styleJobStatus === "processing";

  return (
    <figure
      ref={previewRef}
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-xl border border-border shadow-sm [container-type:inline-size]",
        template.surfaceClass,
        onImageChange && draft.photo && "cursor-move touch-none",
        className,
      )}
      style={{ aspectRatio: String(ratio.aspect) }}
      onPointerDown={onPhotoPointerDown}
      onPointerMove={onPhotoPointerMove}
      onPointerUp={onPhotoPointerUp}
      onPointerCancel={onPhotoPointerUp}
    >
      {src ? (
        <img
          src={src}
          alt={draft.title || "Your card"}
          draggable={false}
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="pointer-events-none absolute max-w-none select-none"
          style={
            place
              ? {
                  width: `${(place.drawWidth / frameW) * 100}%`,
                  height: `${(place.drawHeight / frameH) * 100}%`,
                  left: `${(place.centerX / frameW) * 100}%`,
                  top: `${(place.centerY / frameH) * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${place.rotation}deg)`,
                }
              : { inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0 }
          }
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-muted text-sm text-muted-foreground">
          Your photo appears here
        </div>
      )}

      {processing ? (
        <div className="painting-overlay absolute inset-0 z-10" role="status" aria-live="polite">
          <span className="painting-stroke" style={{ top: "18%" }} />
          <span className="painting-stroke" style={{ top: "42%", animationDelay: "0.4s" }} />
          <span className="painting-stroke" style={{ top: "66%", animationDelay: "0.8s" }} />
          <span className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            Painting your artwork…
          </span>
        </div>
      ) : null}

      {showMessage && draft.message ? (
        <figcaption
          ref={captionRef}
          className={cn(
            "absolute z-10 touch-none select-none rounded-[0.6em] px-[0.5em] py-[0.3em]",
            onTextMove && "cursor-grab active:cursor-grabbing",
          )}
          style={{
            width: `${TEXT_WIDTH * 100}%`,
            left: `${text.center.x * 100}%`,
            top: `${text.center.y * 100}%`,
            transform: "translate(-50%, -50%)",
            fontSize: `${text.sizeFraction * 100}cqw`,
            background: alpha ? `rgba(${tint},${alpha})` : undefined,
          }}
          onPointerDown={(event) => {
            if (!onTextMove) return;
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.stopPropagation();
              moveText(event);
            }
          }}
        >
          <p
            className="w-full whitespace-pre-line text-pretty leading-[1.3]"
            style={{
              fontFamily: text.font.family,
              fontWeight: text.weight,
              fontStyle: text.italic ? "italic" : "normal",
              textDecoration: text.underline ? "underline" : "none",
              textAlign: text.align,
              letterSpacing: text.font.letterSpacing,
              color: text.color,
              textShadow: text.darkText ? "none" : "0 1px 6px rgba(0,0,0,0.55)",
            }}
          >
            {draft.message}
          </p>
          {onTextMove ? <span className="sr-only">Drag to move the message</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
