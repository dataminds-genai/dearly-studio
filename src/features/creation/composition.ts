import { cardFonts, ratios } from "@/domain/content";
import type { CreationDraft, TextPosition } from "@/domain/entities/types";

export const DEFAULT_CANVAS_WIDTH = 2400;
/** Pan offsets are normalized to [-1, 1]; 1 moves the photo centre by this share of the frame. */
export const PAN_RANGE = 0.35;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
/** Message block width as a share of the card width. */
export const TEXT_WIDTH = 0.85;

export function ratioFor(draft: CreationDraft) {
  return ratios.find((ratio) => ratio.id === draft.ratioId) ?? { id: "square" as const, label: "Square 1:1", aspect: 1, note: "Square" };
}

export function canvasSize(draft: CreationDraft, width = DEFAULT_CANVAS_WIDTH) {
  const ratio = ratioFor(draft);
  return { width, height: Math.round(width / ratio.aspect) };
}

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
export const clampPan = (value: number) => Math.min(1, Math.max(-1, value));

export function imagePlacement(
  draft: CreationDraft,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
) {
  const rotation = draft.imageRotation ?? 0;
  const quarterTurn = rotation === 90 || rotation === 270;
  const effectiveWidth = quarterTurn ? imageHeight : imageWidth;
  const effectiveHeight = quarterTurn ? imageWidth : imageHeight;
  const zoom = clampZoom(draft.imageZoom ?? 1);
  const scale = Math.max(frameWidth / effectiveWidth, frameHeight / effectiveHeight) * zoom;
  const pan = draft.imagePan ?? { x: 0, y: 0 };
  return {
    rotation,
    drawWidth: imageWidth * scale,
    drawHeight: imageHeight * scale,
    centerX: frameWidth / 2 + clampPan(pan.x) * frameWidth * PAN_RANGE,
    centerY: frameHeight / 2 + clampPan(pan.y) * frameHeight * PAN_RANGE,
  };
}

export const textColorValues = {
  light: "#fffdf8",
  dark: "#292522",
  rose: "#b84f63",
  gold: "#d6aa42",
} as const;

const positionCoordinates: Record<TextPosition, { x: number; y: number }> = {
  "top-left": { x: 0.5, y: 0.14 },
  "top-center": { x: 0.5, y: 0.14 },
  "top-right": { x: 0.5, y: 0.14 },
  "middle-left": { x: 0.5, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  "middle-right": { x: 0.5, y: 0.5 },
  "bottom-left": { x: 0.5, y: 0.86 },
  "bottom-center": { x: 0.5, y: 0.86 },
  "bottom-right": { x: 0.5, y: 0.86 },
};

/** Shared typography settings; sizes are fractions of the card width. */
export function textStyle(draft: CreationDraft) {
  const font = cardFonts.find((f) => f.id === draft.fontId) ?? cardFonts[0]!;
  const color = draft.textColor ?? "light";
  const center = draft.textCoordinates ?? positionCoordinates[draft.textPosition] ?? { x: 0.5, y: 0.86 };
  return {
    font,
    center,
    sizeFraction: (draft.textFontSize ?? 4.5) / 100,
    weight: (draft.textBold ?? true) ? Math.max(font.weight, 700) : Math.min(font.weight, 400),
    italic: draft.textItalic ?? false,
    underline: draft.textUnderline ?? false,
    align: draft.textAlign ?? "center",
    color: textColorValues[color],
    darkText: color === "dark",
    backdrop: draft.textBackdrop ?? "soft",
  };
}

/** Backdrop alpha behind the message block. */
export function backdropAlpha(backdrop: "none" | "soft" | "strong") {
  return backdrop === "strong" ? 0.55 : backdrop === "soft" ? 0.28 : 0;
}
