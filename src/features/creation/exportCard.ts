import type { CreationDraft } from "@/domain/entities/types";
import { draftImageSrc } from "./CardPreview";
import { TEXT_WIDTH, backdropAlpha, canvasSize, imagePlacement, ratioFor, textStyle } from "./composition";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The photo could not be read."));
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the draft with the same geometry and typography as the live preview. */
export async function renderCardToCanvas(draft: CreationDraft, targetWidth = 2400): Promise<HTMLCanvasElement> {
  const src = draftImageSrc(draft);
  if (!src) throw new Error("Add a photo first.");
  const { width, height } = canvasSize(draft, targetWidth);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot create the image.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const img = await loadImage(src);
  const place = imagePlacement(draft, img.naturalWidth, img.naturalHeight, width, height);
  ctx.save();
  ctx.translate(place.centerX, place.centerY);
  ctx.rotate((place.rotation * Math.PI) / 180);
  ctx.drawImage(img, -place.drawWidth / 2, -place.drawHeight / 2, place.drawWidth, place.drawHeight);
  ctx.restore();

  const message = draft.message?.trim();
  if (message) {
    const style = textStyle(draft);
    await document.fonts?.ready;
    const fontSize = style.sizeFraction * width;
    const lineHeight = fontSize * 1.3;
    const padX = fontSize * 0.5;
    const padY = fontSize * 0.3;
    const boxWidth = width * TEXT_WIDTH;
    ctx.font = `${style.italic ? "italic " : ""}${style.weight} ${fontSize}px ${style.font.family}`;
    ctx.textBaseline = "top";
    const lines = wrap(ctx, message, boxWidth - padX * 2);
    const boxHeight = lines.length * lineHeight + padY * 2;
    const boxLeft = style.center.x * width - boxWidth / 2;
    const boxTop = style.center.y * height - boxHeight / 2;

    const alpha = backdropAlpha(style.backdrop);
    if (alpha) {
      ctx.fillStyle = style.darkText ? `rgba(255,253,248,${alpha})` : `rgba(0,0,0,${alpha})`;
      roundRect(ctx, boxLeft, boxTop, boxWidth, boxHeight, fontSize * 0.6);
      ctx.fill();
    }

    ctx.fillStyle = style.color;
    ctx.strokeStyle = style.color;
    ctx.textAlign = style.align;
    if (!style.darkText) {
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = fontSize * 0.4;
      ctx.shadowOffsetY = fontSize * 0.06;
    }
    const x =
      style.align === "left" ? boxLeft + padX : style.align === "right" ? boxLeft + boxWidth - padX : boxLeft + boxWidth / 2;
    lines.forEach((line, index) => {
      const y = boxTop + padY + index * lineHeight + (lineHeight - fontSize) / 2;
      ctx.fillText(line, x, y);
      if (style.underline && line) {
        const w = ctx.measureText(line).width;
        const startX = style.align === "left" ? x : style.align === "right" ? x - w : x - w / 2;
        ctx.lineWidth = Math.max(1, fontSize * 0.06);
        ctx.beginPath();
        ctx.moveTo(startX, y + fontSize * 1.02);
        ctx.lineTo(startX + w, y + fontSize * 1.02);
        ctx.stroke();
      }
    });
    ctx.shadowColor = "transparent";
  }
  return canvas;
}

export async function renderCardToBlob(draft: CreationDraft, targetWidth = 2400): Promise<Blob> {
  const canvas = await renderCardToCanvas(draft, targetWidth);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The image could not be created.");
  return blob;
}

export function cardFileName(draft: CreationDraft, extension: "png" | "pdf") {
  const base = (draft.title || "dearly-card").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "dearly-card";
  return `${base}.${extension}`;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadCard(draft: CreationDraft, fileName = cardFileName(draft, "png")) {
  saveBlob(await renderCardToBlob(draft, 3000), fileName);
}

/** Print-ready PDF: card at true physical size with 3 mm bleed, rendered at ~300 dpi. */
export async function downloadCardPdf(draft: CreationDraft) {
  const { jsPDF } = await import("jspdf");
  const ratio = ratioFor(draft);
  const widthMm =
    ratio.id === "folded" ? 105 : ratio.id === "postcard" ? 152.4 : ratio.id === "story" ? 90 : ratio.id === "portrait" ? 120 : 127;
  const heightMm = widthMm / ratio.aspect;
  const bleed = 3;
  const pageW = widthMm + bleed * 2;
  const pageH = heightMm + bleed * 2;
  const canvas = await renderCardToCanvas(draft, Math.min(4000, Math.round((widthMm / 25.4) * 300)));
  const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: pageW > pageH ? "landscape" : "portrait" });
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageW, pageH, "F");
  // Extend the edge into the bleed by stretching the image slightly beyond trim.
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
  pdf.setProperties({ title: draft.title || "Dearly card", creator: "Dearly Studio" });
  pdf.save(cardFileName(draft, "pdf"));
}
