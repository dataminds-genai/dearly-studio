import { createFileRoute } from "@tanstack/react-router";

const SEARCH_URL = "https://api.unsplash.com/search/photos";
const PER_PAGE = 18;

// Simple in-memory cache: same query + page within 10 minutes.
const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 10 * 60 * 1000;

function sameOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  // POSTs carry an Origin header even same-origin; same-origin GETs do not,
  // but they do carry a Referer — accept either when the host matches.
  for (const header of ["origin", "referer"] as const) {
    const value = request.headers.get(header);
    if (!value) continue;
    try {
      if (new URL(value).host === host) return true;
    } catch {
      /* malformed — keep checking */
    }
  }
  return false;
}

export interface SearchPhoto {
  id: string;
  thumb: string;
  full: string;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographerUrl: string;
  downloadBeacon: string;
}

export const Route = createFileRoute("/api/photo-search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!sameOrigin(request)) {
          return new Response("This request must come from Dearly Studio.", { status: 403 });
        }
        const key = process.env["UNSPLASH_ACCESS_KEY"]?.trim();
        if (!key) {
          return new Response("Photo search is not configured.", { status: 500 });
        }
        const url = new URL(request.url);
        const query = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
        if (!query) return new Response("A search term is required.", { status: 400 });
        const page = Math.max(1, Math.min(5, Number(url.searchParams.get("page")) || 1));

        const cacheKey = `${query}\n${page}`;
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < TTL_MS) return Response.json(hit.body);

        const upstream = new URL(SEARCH_URL);
        upstream.searchParams.set("query", query);
        upstream.searchParams.set("page", String(page));
        upstream.searchParams.set("per_page", String(PER_PAGE));
        upstream.searchParams.set("orientation", "landscape");
        upstream.searchParams.set("content_filter", "high");
        const res = await fetch(upstream, {
          signal: request.signal,
          headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
        });
        if (res.status === 401 || res.status === 403) {
          return new Response("Photo search rejected the API key.", { status: 502 });
        }
        if (res.status === 429) {
          return new Response("Photo search is busy. Try again in a minute.", { status: 429 });
        }
        if (!res.ok) return new Response("Photo search failed.", { status: 502 });
        const json = (await res.json()) as {
          results?: Array<{
            id: string;
            width: number;
            height: number;
            alt_description?: string | null;
            urls?: { small?: string; raw?: string };
            user?: { name?: string; links?: { html?: string } };
            links?: { download_location?: string };
          }>;
        };
        const body = {
          photos: (json.results ?? []).map((p): SearchPhoto => ({
            id: p.id,
            thumb: p.urls?.small ?? "",
            full: p.urls?.raw ? `${p.urls.raw}&w=1600&q=80&fm=jpg&fit=max` : "",
            width: p.width,
            height: p.height,
            alt: p.alt_description ?? "Unsplash photo",
            photographer: p.user?.name ?? "Unsplash contributor",
            photographerUrl: p.user?.links?.html
              ? `${p.user.links.html}?utm_source=dearly_studio&utm_medium=referral`
              : "https://unsplash.com/?utm_source=dearly_studio&utm_medium=referral",
            downloadBeacon: p.links?.download_location ?? "",
          })),
        };
        cache.set(cacheKey, { at: Date.now(), body });
        if (cache.size > 60) cache.clear();
        return Response.json(body);
      },
      // Mandatory Unsplash view-tracking: called when the user picks a photo.
      POST: async ({ request }) => {
        if (!sameOrigin(request)) {
          return new Response("This request must come from Dearly Studio.", { status: 403 });
        }
        const key = process.env["UNSPLASH_ACCESS_KEY"]?.trim();
        if (!key) return new Response("Photo search is not configured.", { status: 500 });
        const { downloadBeacon } = (await request.json().catch(() => ({}))) as {
          downloadBeacon?: string;
        };
        if (
          typeof downloadBeacon !== "string" ||
          !downloadBeacon.startsWith("https://api.unsplash.com/")
        ) {
          return new Response("Invalid beacon.", { status: 400 });
        }
        await fetch(downloadBeacon, {
          signal: request.signal,
          headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
        }).catch(() => undefined);
        return Response.json({ ok: true });
      },
    },
  },
});
