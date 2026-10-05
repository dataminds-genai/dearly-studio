import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CloudflareAIError, cfText, cloudflareCreds } from "@/lib/cloudflare-ai.server";
import { GeminiError, geminiKey, geminiText } from "@/lib/gemini.server";

const LANG: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  fr: "French",
  es: "Spanish",
  ru: "Russian",
  hi: "Hindi",
  zh: "Simplified Chinese",
};

const schema = z.object({
  recipientNickname: z.string().max(80),
  relationship: z.string().max(40),
  occasion: z.string().max(40),
  mood: z.string().max(40),
  memory: z.string().max(600),
  senderName: z.string().max(80),
  language: z.string().max(20),
  refinement: z.string().max(40).optional(),
  current: z.string().max(2000).optional(),
});

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return Boolean(origin && host && new URL(origin).host === host);
  } catch {
    return false;
  }
}

const MAX_SHORT_CHARS = 160;

function splitOptions(out: string): string[] {
  let parts = out
    .split(/\n\s*---+\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2)
    parts = out
      .split(/(?<=\n— [^\n]+)\s*\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  return parts
    .slice(0, 3)
    .map((p) => (p.length > MAX_SHORT_CHARS ? `${p.slice(0, MAX_SHORT_CHARS - 1).trimEnd()}…` : p));
}

function buildPrompt(d: z.infer<typeof schema>) {
  const v = (s: string) => (s && s !== "unspecified" ? s : "not specified");
  const language = LANG[d.language.split("-")[0] ?? "en"] ?? "English";
  const facts = [
    `Recipient nickname: ${d.recipientNickname.trim() || "not given (do not invent a name)"}`,
    `Relationship: ${v(d.relationship)}`,
    `Occasion: ${v(d.occasion)}`,
    `Mood/tone: ${v(d.mood)}`,
    `Shared memory or detail: ${d.memory.trim() || "none"}`,
    `Sender name for sign-off: ${d.senderName.trim() || "none (no sign-off)"}`,
  ].join("\n");
  const base = `You write short personal messages for a photo card sent to friends and family. Write in ${language}. Keep every message to 1-2 sentences and at most ${MAX_SHORT_CHARS} characters including spaces. Use names and facts exactly as given; never invent names, events, or details. No hashtags, no emojis unless the tone is funny. If a sender name is given, end with a new line "— {name}".`;
  if (d.refinement && d.current) {
    return `${base}\n\nDetails:\n${facts}\n\nRewrite this message to be: ${d.refinement}. Keep it to 1-2 sentences and at most ${MAX_SHORT_CHARS} characters. Return only the rewritten message.\n\nMessage:\n${d.current}`;
  }
  if (d.current?.trim()) {
    return `${base}\n\nDetails:\n${facts}\n\nThe user already wrote this message. Return three options separated by a line containing only ---, each 1-2 sentences and at most ${MAX_SHORT_CHARS} characters: 1) the user's message with spelling and grammar corrected, preserving their voice; 2) a slightly warmer improved version; 3) a fresh alternative using the details above. Return only the messages.\n\nUser message:\n${d.current.trim()}`;
  }
  return `${base}\n\nDetails:\n${facts}\n\nWrite three different short options, each 1-2 sentences and at most ${MAX_SHORT_CHARS} characters. Separate them with a line containing only ---. Return only the messages.`;
}

export const Route = createFileRoute("/api/write-message")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!sameOrigin(request))
          return new Response("This request must come from Dearly Studio.", { status: 403 });
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid request.", { status: 400 });

        // Gemini primary, Cloudflare fallback: quota (429) and overload
        // (503) spill over to Workers AI; other Gemini errors are final.
        // The prompt and option parsing are provider-agnostic.
        const prompt = buildPrompt(parsed.data);
        const toOptions = (out: string) => {
          const opts =
            parsed.data.refinement && !out.includes("---") ? [out.trim()] : splitOptions(out);
          return opts;
        };
        const plain = (msg: string, status: number) =>
          new Response(msg, {
            status,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });

        const gKey = geminiKey();
        if (gKey) {
          try {
            const opts = toOptions(await geminiText(gKey, prompt, request.signal));
            if (!opts.length) return plain("No message came back. Try again.", 502);
            return Response.json({ options: opts });
          } catch (e) {
            const retryable = e instanceof GeminiError && (e.status === 429 || e.status === 503);
            if (!retryable || !cloudflareCreds()) {
              return plain(
                e instanceof Error ? e.message : "Message writing failed.",
                e instanceof GeminiError ? e.status : 500,
              );
            }
            // Fall through to Cloudflare below.
          }
        }

        if (!cloudflareCreds()) {
          return plain("Message writing is not configured. Add GEMINI_API_KEY in .env.", 500);
        }
        try {
          const opts = toOptions(await cfText(prompt, request.signal));
          if (!opts.length) return plain("No message came back. Try again.", 502);
          return Response.json({ options: opts });
        } catch (e) {
          return plain(
            e instanceof Error ? e.message : "Message writing failed.",
            e instanceof CloudflareAIError ? e.status : 500,
          );
        }
      },
    },
  },
});
