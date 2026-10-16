import { createFileRoute } from "@tanstack/react-router";
import { formatTimeRemaining } from "@/domain/services/generation-limit";
import {
  getGenerationStatusServer,
  getDynamicGenerationConfig,
} from "@/domain/services/generation-tracker.server";

export const Route = createFileRoute("/api/generation-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const rawUserId = url.searchParams.get("userId");
        const userId =
          typeof rawUserId === "string" && rawUserId.trim().length > 0 ? rawUserId.trim() : null;

        const clientIp =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "127.0.0.1";
        const userAgent = request.headers.get("user-agent") ?? "";

        const serverStatus = await getGenerationStatusServer(userId, clientIp, userAgent);
        const config = await getDynamicGenerationConfig();
        const isLoggedIn = Boolean(userId);

        const payload = {
          limit: serverStatus.limit,
          limitLoggedIn: config.limitLoggedIn,
          limitAnon: config.limitAnon,
          count: serverStatus.count,
          remaining: serverStatus.remaining,
          isAllowed: serverStatus.allowed,
          shouldWarn:
            isLoggedIn &&
            serverStatus.count >= config.warningThreshold &&
            serverStatus.count < serverStatus.limit,
          isLimitReached: serverStatus.remaining === 0,
          isLoggedIn,
          msUntilNextReset: serverStatus.resetMs,
          formattedResetTime: formatTimeRemaining(serverStatus.resetMs),
          warningThreshold: config.warningThreshold,
          source: serverStatus.source,
        };

        return Response.json(payload, {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
            Pragma: "no-cache",
            Expires: "0",
            "CDN-Cache-Control": "no-store",
            "Cloudflare-CDN-Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
