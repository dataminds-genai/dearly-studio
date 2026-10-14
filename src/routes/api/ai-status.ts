import { createFileRoute } from "@tanstack/react-router";
import { cloudflareCreds, textModel, imageModel } from "@/lib/cloudflare-ai.server";
import { geminiKey } from "@/lib/gemini.server";
import { pollinationsKey, pollinationsModel } from "@/lib/pollinations.server";

export const Route = createFileRoute("/api/ai-status")({
  server: {
    handlers: {
      GET: async () => {
        const gemini = Boolean(geminiKey());
        const cf = cloudflareCreds();
        const status = {
          gemini: {
            configured: gemini,
            textModel: process.env["GEMINI_TEXT_MODEL"]?.trim() || "gemini-3.5-flash-lite",
            imageModel: process.env["GEMINI_IMAGE_MODEL"]?.trim() || "gemini-3.1-flash-image",
          },
          cloudflare: {
            configured: Boolean(cf),
            textModel: textModel(),
            imageModel: imageModel(),
          },
          pollinations: {
            // kontext is gated: without a registered key the provider fails
            // and the route falls through to on-device rendering.
            configured: Boolean(pollinationsKey()),
            imageModel: pollinationsModel(),
            needsKey: !pollinationsKey(),
          },
        };
        return Response.json(status);
      },
    },
  },
});
