import { createFileRoute } from "@tanstack/react-router";
import { getVariant } from "@/domain/catalog";
import { assessQuality } from "@/domain/services/print-quality";
import {
  PrintHandoffError,
  createPrintHandoff,
  printSkuForVariant,
} from "@/lib/print-handoff.server";

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return Boolean(origin && host && new URL(origin).host === host);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/print-handoff")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!sameOrigin(request)) {
          return new Response("This request must come from Dearly Studio.", { status: 403 });
        }
        const incoming = await request.formData();
        const image = incoming.get("image");
        const variantId = incoming.get("variantId");
        if (!(image instanceof File) || typeof variantId !== "string") {
          return new Response("A print file and product are required.", { status: 400 });
        }
        if (!ALLOWED_TYPES.has(image.type) || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
          return new Response("Use a JPEG or PNG file smaller than 50 MB.", { status: 400 });
        }
        const variant = getVariant(variantId);
        if (!variant) return new Response("Unknown product.", { status: 400 });
        if (!printSkuForVariant(variantId)) {
          return new Response(
            "This size isn't available for one-tap printing yet — use the print-ready download instead.",
            { status: 400 },
          );
        }
        const widthPx = Number(incoming.get("widthPx"));
        const heightPx = Number(incoming.get("heightPx"));
        if (Number.isFinite(widthPx) && Number.isFinite(heightPx) && widthPx > 0 && heightPx > 0) {
          const quality = assessQuality(widthPx, heightPx, variant);
          if (quality.blocksCheckout) {
            return new Response(
              `Too low to print at this size (${quality.effectiveDpi} dpi, needs ${quality.requiredDpi}). Pick a smaller size or upload a larger photo.`,
              { status: 422 },
            );
          }
        }
        const quantity = Math.max(
          1,
          Math.min(99, Math.floor(Number(incoming.get("quantity")) || 1)),
        );
        const title =
          typeof incoming.get("title") === "string" && (incoming.get("title") as string).trim()
            ? (incoming.get("title") as string).trim().slice(0, 80)
            : "Dearly card";
        try {
          const origin = request.headers.get("origin") ?? new URL(request.url).origin;
          const result = await createPrintHandoff(image, variantId, {
            quantity,
            title,
            returnUrl: origin,
            signal: request.signal,
          });
          return Response.json(result);
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "Print handoff failed.", {
            status: e instanceof PrintHandoffError ? e.status : 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
