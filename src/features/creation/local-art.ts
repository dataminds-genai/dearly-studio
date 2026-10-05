import type { StyleId } from "@/domain/entities/types";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The photo could not be opened."));
    image.src = src;
  });
}

/** Deterministic pseudo-random so the same photo always paints the same way. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function luminance(d: Uint8ClampedArray, i: number) {
  return 0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0);
}

function sobel(src: ImageData) {
  const { width: w, height: h, data } = src;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) gray[i] = luminance(data, i * 4);
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const g = (dx: number, dy: number) => gray[(y + dy) * w + x + dx] ?? 0;
      const gx = -g(-1, -1) - 2 * g(-1, 0) - g(-1, 1) + g(1, -1) + 2 * g(1, 0) + g(1, 1);
      const gy = -g(-1, -1) - 2 * g(0, -1) - g(1, -1) + g(-1, 1) + 2 * g(0, 1) + g(1, 1);
      out[y * w + x] = Math.hypot(gx, gy);
    }
  }
  return { gray, edges: out };
}

function paperGrain(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number, rand: () => number) {
  const grain = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (rand() - 0.5) * 255 * alpha;
    grain.data[i] = (grain.data[i] ?? 0) + n;
    grain.data[i + 1] = (grain.data[i + 1] ?? 0) + n;
    grain.data[i + 2] = (grain.data[i + 2] ?? 0) + n;
  }
  ctx.putImageData(grain, 0, 0);
}

/** Paints short strokes sampled from the source; used for oil and impressionist looks. */
function strokes(
  ctx: CanvasRenderingContext2D,
  src: ImageData,
  opts: { size: number; length: number; alpha: number; jitter: number; rand: () => number; edges: Float32Array },
) {
  const { width: w, height: h, data } = src;
  const step = Math.max(2, Math.round(opts.size * 0.7));
  ctx.lineCap = "round";
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const px = Math.min(w - 1, Math.max(0, Math.round(x + (opts.rand() - 0.5) * step)));
      const py = Math.min(h - 1, Math.max(0, Math.round(y + (opts.rand() - 0.5) * step)));
      const i = (py * w + px) * 4;
      const j = opts.jitter;
      const r = (data[i] ?? 0) + (opts.rand() - 0.5) * j;
      const g = (data[i + 1] ?? 0) + (opts.rand() - 0.5) * j;
      const b = (data[i + 2] ?? 0) + (opts.rand() - 0.5) * j;
      // Stroke follows the edge direction so contours stay readable.
      const ex = (opts.edges[py * w + Math.min(w - 1, px + 1)] ?? 0) - (opts.edges[py * w + Math.max(0, px - 1)] ?? 0);
      const ey = (opts.edges[Math.min(h - 1, py + 1) * w + px] ?? 0) - (opts.edges[Math.max(0, py - 1) * w + px] ?? 0);
      const angle = Math.atan2(ey, ex) + Math.PI / 2 + (opts.rand() - 0.5) * 0.6;
      const len = opts.length * (0.6 + opts.rand() * 0.8);
      ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${opts.alpha})`;
      ctx.lineWidth = opts.size * (0.7 + opts.rand() * 0.6);
      ctx.beginPath();
      ctx.moveTo(px - Math.cos(angle) * len, py - Math.sin(angle) * len);
      ctx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
      ctx.stroke();
    }
  }
}

/**
 * In-browser artistic renderer. Style ids map to visible names:
 * impressionist → Impressionist, watercolor → Watercolor Wash,
 * pointillist → Oil Painting, pop-art → Pencil / Charcoal.
 */
export async function renderArtOnDevice(src: string, style: StyleId): Promise<string> {
  if (style === "original") return src;
  const image = await loadImage(src);
  const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser cannot render artwork.");
  const rand = seeded(w * 31 + h * 17 + style.length);

  if (style === "pop-art") {
    // Pencil / charcoal: inverted edges over soft graphite tone with cross-hatching.
    ctx.drawImage(image, 0, 0, w, h);
    const { gray, edges } = sobel(ctx.getImageData(0, 0, w, h));
    const out = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i += 1) {
      const tone = 235 - (255 - (gray[i] ?? 0)) * 0.35;
      const v = Math.max(0, Math.min(255, tone - (edges[i] ?? 0) * 0.9));
      out.data[i * 4] = v;
      out.data[i * 4 + 1] = v;
      out.data[i * 4 + 2] = v * 0.97;
      out.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#2b2b2b";
    ctx.lineWidth = 1;
    const spacing = Math.max(4, Math.round(w / 180));
    for (let y = 0; y < h; y += spacing) {
      for (let x = 0; x < w; x += spacing) {
        const g = gray[Math.min(h - 1, y) * w + Math.min(w - 1, x)] ?? 255;
        if (g < 140) {
          ctx.beginPath();
          ctx.moveTo(x, y + spacing);
          ctx.lineTo(x + spacing, y);
          ctx.stroke();
        }
        if (g < 80) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + spacing, y + spacing);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    paperGrain(ctx, w, h, 0.06, rand);
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  if (style === "watercolor") {
    // Watercolor: blurred pigment, posterized washes, darker bleeding edges, paper grain.
    ctx.filter = `blur(${Math.max(2, w / 260)}px) saturate(1.15) brightness(1.06)`;
    ctx.drawImage(image, 0, 0, w, h);
    ctx.filter = "none";
    const px = ctx.getImageData(0, 0, w, h);
    const levels = 24;
    for (let i = 0; i < px.data.length; i += 4) {
      for (let c = 0; c < 3; c += 1) px.data[i + c] = Math.round((px.data[i + c] ?? 0) / levels) * levels + 10;
    }
    ctx.putImageData(px, 0, 0);
    const sharp = document.createElement("canvas");
    sharp.width = w;
    sharp.height = h;
    const sctx = sharp.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(image, 0, 0, w, h);
    const { edges } = sobel(sctx.getImageData(0, 0, w, h));
    const final = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < w * h; i += 1) {
      const e = Math.min(1, (edges[i] ?? 0) / 260) * 0.35;
      for (let c = 0; c < 3; c += 1) final.data[i * 4 + c] = (final.data[i * 4 + c] ?? 0) * (1 - e);
    }
    ctx.putImageData(final, 0, 0);
    paperGrain(ctx, w, h, 0.08, rand);
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  if (style === "cartoon" || style === "warhol" || style === "ai-character" || style === "picasso") {
    // Flat cel colours with ink outlines (cartoon / pop art / character / cubist blocks).
    const blur = style === "ai-character" ? w / 200 : w / 400;
    const filters: Record<string, string> = {
      cartoon: "saturate(1.5) contrast(1.1)",
      warhol: "saturate(2.6) contrast(1.5) hue-rotate(25deg)",
      "ai-character": "saturate(1.3) brightness(1.08)",
      picasso: "saturate(1.4) contrast(1.25) sepia(0.2)",
    };
    ctx.filter = `blur(${Math.max(1, blur)}px) ${filters[style]}`;
    ctx.drawImage(image, 0, 0, w, h);
    ctx.filter = "none";
    const px = ctx.getImageData(0, 0, w, h);
    const levels = style === "warhol" ? 85 : style === "picasso" ? 64 : style === "ai-character" ? 28 : 48;
    const sharp = document.createElement("canvas");
    sharp.width = w;
    sharp.height = h;
    const sctx = sharp.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(image, 0, 0, w, h);
    const { edges } = sobel(sctx.getImageData(0, 0, w, h));
    const threshold = style === "ai-character" ? 9999 : style === "warhol" ? 140 : 180;
    for (let i = 0; i < w * h; i += 1) {
      const ink = (edges[i] ?? 0) > threshold;
      for (let c = 0; c < 3; c += 1) {
        const v = Math.round((px.data[i * 4 + c] ?? 0) / levels) * levels;
        px.data[i * 4 + c] = ink ? 20 : Math.min(255, v);
      }
    }
    ctx.putImageData(px, 0, 0);
    if (style === "picasso") {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = Math.max(2, w / 300);
      for (let k = 0; k < 14; k += 1) {
        ctx.beginPath();
        ctx.moveTo(rand() * w, rand() * h);
        ctx.lineTo(rand() * w, rand() * h);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (style === "warhol") {
      // Classic 2×2 silkscreen grid, each panel in a different colourway.
      const tile = document.createElement("canvas");
      tile.width = w;
      tile.height = h;
      tile.getContext("2d")!.drawImage(canvas, 0, 0);
      const hw = w / 2;
      const hh = h / 2;
      const hues = [0, 90, 180, 270];
      hues.forEach((hue, k) => {
        ctx.filter = `hue-rotate(${hue}deg) saturate(1.3)`;
        ctx.drawImage(tile, (k % 2) * hw, Math.floor(k / 2) * hh, hw, hh);
      });
      ctx.filter = "none";
    }
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  // Painterly styles: layered directional brush strokes.
  const painterly: Record<string, string> = {
    pointillist: "saturate(1.35) contrast(1.1)",
    vangogh: "saturate(1.8) contrast(1.2) hue-rotate(-6deg)",
    davinci: "sepia(0.55) saturate(0.8) contrast(1.05) brightness(0.92)",
    monet: "saturate(1.2) brightness(1.12) contrast(0.92)",
  };
  ctx.filter = painterly[style] ?? "saturate(1.45) brightness(1.06)";
  ctx.drawImage(image, 0, 0, w, h);
  ctx.filter = "none";
  const base = ctx.getImageData(0, 0, w, h);
  const { edges } = sobel(base);
  const unit = w / 240;
  if (style === "pointillist") {
    strokes(ctx, base, { size: unit * 4, length: unit * 4, alpha: 0.85, jitter: 18, rand, edges });
    strokes(ctx, base, { size: unit * 2, length: unit * 2.5, alpha: 0.75, jitter: 10, rand, edges });
    paperGrain(ctx, w, h, 0.05, rand);
  } else if (style === "vangogh") {
    strokes(ctx, base, { size: unit * 2.2, length: unit * 6, alpha: 0.9, jitter: 30, rand, edges });
    strokes(ctx, base, { size: unit * 1.4, length: unit * 4, alpha: 0.85, jitter: 24, rand, edges });
  } else if (style === "davinci") {
    strokes(ctx, base, { size: unit * 3, length: unit * 2, alpha: 0.5, jitter: 8, rand, edges });
    // Warm varnish vignette, like an aged panel.
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(60,35,10,0)");
    v.addColorStop(1, "rgba(40,22,6,0.65)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    paperGrain(ctx, w, h, 0.07, rand);
  } else {
    ctx.fillStyle = "rgba(255,248,232,0.25)";
    ctx.fillRect(0, 0, w, h);
    strokes(ctx, base, { size: unit * 2.6, length: unit * 1.4, alpha: 0.9, jitter: 40, rand, edges });
    strokes(ctx, base, { size: unit * 1.6, length: unit, alpha: 0.85, jitter: 30, rand, edges });
  }
  return canvas.toDataURL("image/jpeg", 0.9);
}
