// Server-only Gemini client. The API key is read from process.env inside each call
// and is never sent to the browser.
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiKey(): string | undefined {
  const key = process.env["GEMINI_API_KEY"]?.trim();
  // Presence check only — the key itself is never logged or returned.
  return key ? key : undefined;
}

// Models tried in order. Google retires older models for new keys (e.g.
// gemini-2.5-flash 404s with "use gemini-3.8-flash"), so current entries come
// first. Verified against ModelService.ListModels for this key.
function textModels() {
  const custom = process.env["GEMINI_TEXT_MODEL"]?.trim();
  return [
    ...(custom ? [custom] : []),
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
  ].filter((m, i, all) => all.indexOf(m) === i);
}
function imageModels() {
  const custom = process.env["GEMINI_IMAGE_MODEL"]?.trim();
  return [
    ...(custom ? [custom] : []),
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
  ].filter((m, i, all) => all.indexOf(m) === i);
}

async function withFallback<T>(models: string[], run: (model: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const model of models) {
    try {
      return await run(model);
    } catch (e) {
      last = e;
      // Move on when the model is unavailable (retired) or transiently
      // overloaded; quota/auth/content errors are final.
      if (!(e instanceof GeminiError) || (e.status !== 404 && e.status !== 400 && e.status !== 503))
        throw e;
    }
  }
  throw last;
}

type Part = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
};
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Part[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call(
  model: string,
  apiKey: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<GeminiResponse> {
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    signal: signal ?? null,
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok)
    throw new GeminiError(
      json.error?.message ?? `Gemini request failed (${res.status}).`,
      res.status,
    );
  if (json.promptFeedback?.blockReason) {
    throw new GeminiError("This request was declined by the AI provider.", 422);
  }
  return json;
}

export async function geminiText(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const json = await withFallback(textModels(), (m) =>
    call(m, apiKey, { contents: [{ role: "user", parts: [{ text: prompt }] }] }, signal),
  );
  const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  if (!text.trim()) throw new GeminiError("No message came back. Try again.", 502);
  return text;
}

export async function geminiEditImage(
  apiKey: string,
  image: File,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const bytes = new Uint8Array(await image.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const data64 = btoa(binary);
  const json = await withFallback(imageModels(), (m) =>
    call(
      m,
      apiKey,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, { inlineData: { mimeType: image.type, data: data64 } }],
          },
        ],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      },
      signal,
    ),
  );
  for (const part of json.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data ?? part.inline_data?.data;
    if (data) return data;
  }
  throw new GeminiError("The artwork response contained no image.", 502);
}
