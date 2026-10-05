// Server-only Pollinations.ai client. Credentials are read from process.env
// inside each call and are never logged, returned, or sent to the browser.
//
// Flow: upload photo -> public URL -> kontext img2img edit.
// A registered key (https://auth.pollinations.ai, free) is required:
// the kontext model is gated to registered users and anonymous calls are
// rate-limited per IP, which a shared server exhausts immediately.
const UPLOAD_URL = "https://media.pollinations.ai/upload";
const EDITS_URL = "https://gen.pollinations.ai/v1/images/edits";
const DEFAULT_MODEL = "kontext";
// Paid models with reliable health; tried before the free tier.
const PAID_MODEL_FALLBACKS = ["black-forest-labs/flux.1-kontext-pro", "prunaai/p-image-edit"];
// Zero-price community models (untrusted third-party infra, degraded
// health) — last AI resort before on-device rendering.
const FREE_MODELS = [
  "community/scriptsnsenses-sys/flux-2-dev-free",
  "community/scriptsnsenses-sys/sdxl-lightning-free",
];

export class PollinationsError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function pollinationsKey(): string | undefined {
  const key = process.env["POLLINATIONS_API_KEY"]?.trim();
  return key ? key : undefined;
}

export function pollinationsModel(): string {
  return process.env["POLLINATIONS_IMAGE_MODEL"]?.trim() || DEFAULT_MODEL;
}

export type PollinationsTier = "paid" | "free";

export interface PollinationsResult {
  b64: string;
  tier: PollinationsTier;
  model: string;
}

function paidModels(): string[] {
  return [pollinationsModel(), ...PAID_MODEL_FALLBACKS].filter((m, i, all) => all.indexOf(m) === i);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function uploadImage(image: File, apiKey: string, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.set("file", image, image.name || "photo.jpg");
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    signal: signal ?? null,
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PollinationsError(
      `Photo upload failed (${res.status}). ${text.slice(0, 200)}`,
      res.status,
    );
  }
  const json = (await res.json().catch(() => ({}))) as { url?: string };
  if (!json.url) throw new PollinationsError("Photo upload returned no URL.", 502);
  return json.url;
}

type EditsResponse = {
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { message?: string };
};

async function editWithModel(
  apiKey: string,
  model: string,
  imageUrl: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(EDITS_URL, {
    method: "POST",
    signal: signal ?? null,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model, image: imageUrl }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = `Pollinations request failed (${res.status}).`;
    try {
      const j = JSON.parse(text) as EditsResponse & { message?: string };
      msg = j.error?.message ?? j.message ?? msg;
    } catch {
      if (text) msg = `${msg} ${text.slice(0, 200)}`;
    }
    throw new PollinationsError(msg, res.status);
  }
  const json = (await res.json()) as EditsResponse;
  const item = json.data?.[0];
  if (item?.b64_json) return item.b64_json;
  if (item?.url) {
    const img = await fetch(item.url, { signal: signal ?? null });
    if (!img.ok) throw new PollinationsError("Could not download the artwork.", 502);
    return toBase64(new Uint8Array(await img.arrayBuffer()));
  }
  throw new PollinationsError("The artwork response contained no image.", 502);
}

/**
 * Transform a photo with a text prompt. Tries paid models first, then the
 * zero-price community tier. Returns base64 bytes (no data-URL prefix) plus
 * the serving tier and model so callers can disclose free-tier quality.
 */
export async function pollinationsEditImage(
  image: File,
  prompt: string,
  signal?: AbortSignal,
): Promise<PollinationsResult> {
  const apiKey = pollinationsKey();
  if (!apiKey) throw new PollinationsError("Pollinations is not configured.", 500);

  const imageUrl = await uploadImage(image, apiKey, signal);

  let last: unknown;
  const attempts: Array<{ model: string; tier: PollinationsTier }> = [
    ...paidModels().map((model) => ({ model, tier: "paid" as const })),
    ...FREE_MODELS.map((model) => ({ model, tier: "free" as const })),
  ];
  for (const { model, tier } of attempts) {
    try {
      const b64 = await editWithModel(apiKey, model, imageUrl, prompt, signal);
      return { b64, tier, model };
    } catch (e) {
      last = e;
      // Empty pollen balance (402) on a paid model spills over to the free
      // tier; on a free model it is final. Unknown/dead models advance;
      // auth and rate-limit errors abort the chain.
      const emptyPaidBalance =
        tier === "paid" && e instanceof PollinationsError && e.status === 402;
      if (
        !emptyPaidBalance &&
        (!(e instanceof PollinationsError) ||
          (e.status !== 400 && e.status !== 404 && e.status !== 500 && e.status !== 503))
      ) {
        throw e;
      }
    }
  }
  throw last;
}
