import { createFileRoute } from "@tanstack/react-router";
import { getDynamicGenerationConfig } from "@/domain/services/generation-tracker.server";

export const Route = createFileRoute("/api/generation-config")({
  server: {
    handlers: {
      GET: async () => {
        const config = await getDynamicGenerationConfig();
        return Response.json(config, {
          headers: {
            "Cache-Control": "public, max-age=30, s-maxage=60",
            "CDN-Cache-Control": "max-age=60",
            "Cloudflare-CDN-Cache-Control": "max-age=60",
          },
        });
      },
    },
  },
});
