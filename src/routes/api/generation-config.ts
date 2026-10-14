import { createFileRoute } from "@tanstack/react-router";
import { getGenerationConfig } from "@/domain/services/generation-limit";

export const Route = createFileRoute("/api/generation-config")({
  server: {
    handlers: {
      GET: async () => {
        const config = getGenerationConfig();
        return Response.json(config, {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      },
    },
  },
});
