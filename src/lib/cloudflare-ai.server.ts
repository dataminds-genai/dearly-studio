// Server-only Cloudflare Workers AI client. Credentials are read from process.env
// inside each call and are never logged, returned, or sent to the browser.
const DEFAULT_TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
// Spares confirmed present in this account's catalog; tried in order.
const TEXT_MODEL_FALLBACKS = [
  "@cf/meta/llama-3.1-8b-instruct-fp8",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
];
export function textModel(): string {
  return process.env["CLOUDFLARE_TEXT_MODEL"]?.trim() || DEFAULT_TEXT_MODEL;
}

function textModels(): string[] {
  return [textModel(), ...TEXT_MODEL_FALLBACKS].filter((m, i, all) => all.indexOf(m) === i);
}

export class CloudflareAIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function cloudflareCreds(): { accountId: string; token: string } | undefined {
  const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"]?.trim();
  const token = process.env["CLOUDFLARE_AI_TOKEN"]?.trim();
  return accountId && token ? { accountId, token } : undefined;
}

async function run(model: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const creds = cloudflareCreds();
  if (!creds) throw new CloudflareAIError("AI is not configured.", 500);
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/ai/run/${model}`,
    {
      method: "POST",
      signal: signal ?? null,
      headers: { Authorization: `Bearer ${creds.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    let msg = `Cloudflare AI request failed (${res.status}).`;
    try {
      const j = JSON.parse(text) as { errors?: Array<{ message?: string }> };
      msg = j.errors?.[0]?.message ?? msg;
    } catch {
      /* keep default */
    }
    throw new CloudflareAIError(msg, res.status);
  }
  return res;
}

export async function cfText(prompt: string, signal?: AbortSignal): Promise<string> {
  let last: unknown;
  for (const model of textModels()) {
    try {
      const res = await run(
        model,
        { messages: [{ role: "user", content: prompt }], max_tokens: 800 },
        signal,
      );
      const json = (await res.json()) as { result?: { response?: string } };
      const text = json.result?.response ?? "";
      if (!text.trim()) throw new CloudflareAIError("No message came back. Try again.", 502);
      return text;
    } catch (e) {
      last = e;
      // Move on when the model is unavailable or overloaded; quota/auth
      // errors are final.
      if (
        !(e instanceof CloudflareAIError) ||
        (e.status !== 404 && e.status !== 400 && e.status !== 503)
      ) {
        throw e;
      }
    }
  }
  throw last;
}
