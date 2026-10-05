import { createFileRoute } from "@tanstack/react-router";
import { buildArtEditPrompt, isArtIntensity, isArtStyleId } from "@/lib/art-style";
import { GeminiError, geminiEditImage, geminiKey } from "@/lib/gemini.server";
import {
  PollinationsError,
  pollinationsEditImage,
  pollinationsKey,
} from "@/lib/pollinations.server";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const Route = createFileRoute("/api/edit-artwork")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
        let originHost: string | null = null;
        try {
          originHost = origin ? new URL(origin).host : null;
        } catch {
          originHost = null;
        }
        if (!originHost || !host || originHost !== host) {
          return new Response("This artwork request must come from Dearly Studio.", {
            status: 403,
          });
        }

        const incoming = await request.formData();
        const image = incoming.get("image");
        const styleId = incoming.get("styleId");
        const intensity = incoming.get("intensity");
        if (
          !(image instanceof File) ||
          typeof styleId !== "string" ||
          typeof intensity !== "string"
        ) {
          return new Response("A photo, artist, and strength are required.", { status: 400 });
        }
        if (!ALLOWED_TYPES.has(image.type) || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
          return new Response("Use a JPEG, PNG, or WebP image smaller than 25 MB.", {
            status: 400,
          });
        }
        if (!isArtStyleId(styleId) || !isArtIntensity(intensity)) {
          return new Response("Choose a supported artist and strength.", { status: 400 });
        }

        const prompt = buildArtEditPrompt(styleId, intensity);
        // freeTier flags a zero-price community serve so the client can
        // disclose that quality may vary. Additive and backward-compatible.
        const respond = (b64: string, freeTier = false) => {
          if (incoming.get("stream") === "false")
            return Response.json({ data: [{ b64_json: b64, freeTier }] });
          const sse = `event: image_edit.completed\ndata: ${JSON.stringify({ type: "image_edit.completed", b64_json: b64, freeTier })}\n\n`;
          return new Response(sse, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
          });
        };

        // Provider order: Gemini → Pollinations (paid, then free community
        // tier). Either provider can fail — always try the next one so the
        // client only falls back to on-device as a last resort. The
        // "allowance ... on device" messages intentionally match the
        // client's on-device fallback trigger.
        const plain = (msg: string, status: number) =>
          new Response(msg, {
            status,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });

        const failures: unknown[] = [];
        const gKey = geminiKey();
        if (gKey) {
          try {
            return respond(await geminiEditImage(gKey, image, prompt, request.signal));
          } catch (e) {
            failures.push(e);
          }
        }

        if (pollinationsKey()) {
          try {
            const result = await pollinationsEditImage(image, prompt, request.signal);
            return respond(result.b64, result.tier === "free");
          } catch (e) {
            failures.push(e);
          }
        }

        // Report the most recent failure; both remaining providers
        // produce actionable messages (quota, balance, auth).
        const meaningful = failures[failures.length - 1];
        if (meaningful instanceof PollinationsError) {
          const msg =
            meaningful.status === 429 || meaningful.status === 503
              ? "The free art allowance is used up. Rendering on device instead."
              : meaningful.status === 402
                ? `${meaningful.message} Add pollen at enter.pollinations.ai to restore AI art.`
                : meaningful.message;
          return plain(msg, meaningful.status);
        }
        if (meaningful instanceof GeminiError) {
          const msg =
            meaningful.status === 429
              ? "The free Google art allowance is used up. Rendering on device instead."
              : meaningful.message;
          return plain(msg, meaningful.status);
        }
        if (failures.length === 0) {
          return plain(
            "Artwork creation is not configured. Add GEMINI_API_KEY or POLLINATIONS_API_KEY in .env.",
            500,
          );
        }
        return plain(
          meaningful instanceof Error ? meaningful.message : "Artwork creation failed.",
          500,
        );
      },
    },
  },
});
