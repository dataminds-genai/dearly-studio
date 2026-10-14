import { createFileRoute } from "@tanstack/react-router";
import { buildArtEditPrompt, isArtIntensity, isArtStyleId } from "@/lib/art-style";
import { GeminiError, geminiEditImage, geminiKey } from "@/lib/gemini.server";
import {
  PollinationsError,
  pollinationsEditImage,
  pollinationsKey,
} from "@/lib/pollinations.server";
import {
  cfEditImage,
  cloudflareCreds,
  CloudflareAIError,
} from "@/lib/cloudflare-ai.server";
import { getGenerationConfig, GENERATION_WINDOW_MS } from "@/domain/services/generation-limit";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const serverGenerations = new Map<string, number[]>();

function checkServerRateLimit(key: string, isLoggedIn: boolean): { allowed: boolean; retryAfterSeconds: number } {
  const config = getGenerationConfig();
  const limit = isLoggedIn ? config.limitLoggedIn : config.limitAnon;
  const now = Date.now();
  const threshold = now - GENERATION_WINDOW_MS;

  const current = (serverGenerations.get(key) || []).filter((t) => t > threshold);
  if (current.length >= limit) {
    serverGenerations.set(key, current);
    const oldest = current[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + GENERATION_WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  current.push(now);
  serverGenerations.set(key, current);
  return { allowed: true, retryAfterSeconds: 0 };
}

export const Route = createFileRoute("/api/edit-artwork")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
        if (origin) {
          try {
            const originHost = new URL(origin).host;
            if (originHost !== host && !originHost.includes("localhost") && !originHost.includes("127.0.0.1")) {
              return new Response("This artwork request must come from Dearly Studio.", {
                status: 403,
              });
            }
          } catch {
            // allow fallback
          }
        }

        const incoming = await request.formData();
        const rawUserId = incoming.get("userId");
        const userId = typeof rawUserId === "string" && rawUserId.trim().length > 0 ? rawUserId.trim() : null;
        const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "anonymous";
        const rateKey = userId ? `user:${userId}` : `ip:${clientIp}`;

        const rateResult = checkServerRateLimit(rateKey, Boolean(userId));
        if (!rateResult.allowed) {
          return new Response("Daily image generation limit reached. Please try again after 24 hours.", {
            status: 429,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Retry-After": String(rateResult.retryAfterSeconds),
            },
          });
        }
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
        const isAllowedType = ALLOWED_TYPES.has(image.type) || Boolean(image.name?.match(/\.(jpg|jpeg|png|webp)$/i));
        if (!isAllowedType || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
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

        // Provider order: Gemini → Cloudflare AI (@cf/black-forest-labs/flux-2-klein-4b) →
        // Pollinations (paid, then free community tier) → on-device canvas.
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
            console.warn("Gemini edit artwork failed:", e);
            failures.push(e);
          }
        }

        if (cloudflareCreds()) {
          try {
            const b64 = await cfEditImage(image, prompt, request.signal);
            return respond(b64, false);
          } catch (e) {
            console.warn("Cloudflare AI edit artwork failed:", e);
            failures.push(e);
          }
        }

        try {
          const result = await pollinationsEditImage(image, prompt, request.signal);
          return respond(result.b64, result.tier === "free");
        } catch (e) {
          console.warn("Pollinations edit artwork failed:", e);
          failures.push(e);
        }

        // Report the most recent failure; providers produce actionable messages (quota, balance, auth).
        const meaningful = failures[failures.length - 1];
        if (meaningful instanceof CloudflareAIError) {
          return plain(meaningful.message, meaningful.status);
        }
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
            "Artwork creation is not configured. Add GEMINI_API_KEY, CLOUDFLARE_AI_TOKEN, or POLLINATIONS_API_KEY in .env.",
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
