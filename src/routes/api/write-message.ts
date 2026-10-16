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

import { fallbackMessage } from "@/domain/services/message-writer";
import type { MoodId, OccasionId, RecipientId } from "@/domain/entities/types";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return true;
    if (originHost.includes("localhost") || originHost.includes("127.0.0.1")) return true;
    return false;
  } catch {
    return true;
  }
}

const MAX_SHORT_CHARS = 160;

function cleanModelOutput(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/##\s+Step[\s\S]*?(?=\n\n|\n[A-Z]|\n—|$)/gi, "")
    .replace(/\\boxed\{([^}]+)\}/g, "$1")
    .replace(/\$+/g, "")
    .trim();
}

function splitOptions(out: string): string[] {
  const cleaned = cleanModelOutput(out);
  let parts = cleaned
    .split(/\n\s*---+\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2)
    parts = cleaned
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

        const prompt = buildPrompt(parsed.data);
        const toOptions = (out: string) => {
          const opts =
            parsed.data.refinement && !out.includes("---") ? [out.trim()] : splitOptions(out);
          return opts;
        };

        const gKey = geminiKey();
        if (gKey) {
          try {
            const opts = toOptions(await geminiText(gKey, prompt, request.signal));
            if (opts.length > 0) return Response.json({ options: opts });
          } catch (e) {
            console.warn("Gemini text failed, falling back to Cloudflare AI:", e);
          }
        }

        if (cloudflareCreds()) {
          try {
            const opts = toOptions(await cfText(prompt, request.signal));
            if (opts.length > 0) return Response.json({ options: opts });
          } catch (e) {
            console.warn("Cloudflare AI text failed, falling back to local writer:", e);
          }
        }

        // Always guarantee a thoughtful personalized message
        const fallback = fallbackMessage({
          recipientNickname: parsed.data.recipientNickname,
          relationship: parsed.data.relationship as RecipientId | "unspecified",
          occasion: parsed.data.occasion as OccasionId | "unspecified",
          mood: parsed.data.mood as MoodId | "unspecified",
          memory: parsed.data.memory,
          senderName: parsed.data.senderName,
          language: parsed.data.language,
        });
        return Response.json({ options: [fallback] });
      },
    },
  },
});
