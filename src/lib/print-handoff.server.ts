// Server-only PrintKit (Social Print Studio) order-handoff client.
//
// Flow: upload rendered print file -> public URL -> POST /api/add-to-cart
// -> redirectUrl. The customer finishes (quantity, address, payment,
// tracking) on the provider's page; we never handle billing or logistics.
// Docs: https://printkit.dev/docs/md/order-handoff
//
// Variant -> SKU mapping lives in @/domain/print-skus (client-safe) so the
// UI and server agree. Variants without a match return null and the UI
// offers the print-ready download instead.
const UPLOAD_URL = "https://printkit.dev/api/upload";
const ADD_TO_CART_URL = "https://printkit.dev/api/add-to-cart";
const SOURCE = "dearly-studio";

import { printSkuForVariantClient } from "@/domain/print-skus";

export function printSkuForVariant(variantId: string): string | null {
  return printSkuForVariantClient(variantId);
}

export class PrintHandoffError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function attributionHeaders(): Record<string, string> {
  const key = process.env["PRINTKIT_API_KEY"]?.trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

function contactEmail(): string | undefined {
  return process.env["PRINTKIT_EMAIL"]?.trim() || undefined;
}

/** Upload a rendered print file; returns a public URL valid for ordering. */
async function uploadPrintFile(image: File, signal?: AbortSignal): Promise<string> {
  const initRes = await fetch(UPLOAD_URL, {
    method: "POST",
    signal: signal ?? null,
    headers: { "Content-Type": "application/json", ...attributionHeaders() },
    body: JSON.stringify({
      filename: image.name || "dearly-card.jpg",
      source: SOURCE,
      ...(contactEmail() ? { email: contactEmail() } : {}),
      fileSize: image.size,
      contentType: image.type || "image/jpeg",
    }),
  });
  if (!initRes.ok) {
    throw new PrintHandoffError(`Print upload failed (${initRes.status}).`, initRes.status);
  }
  const { uploadUrl, publicUrl } = (await initRes.json().catch(() => ({}))) as {
    uploadUrl?: string;
    publicUrl?: string;
  };
  if (!uploadUrl || !publicUrl) throw new PrintHandoffError("Print upload returned no URL.", 502);

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    signal: signal ?? null,
    headers: { "Content-Type": image.type || "image/jpeg" },
    body: image,
  });
  if (!putRes.ok) throw new PrintHandoffError("Print file transfer failed.", 502);
  return publicUrl;
}

export interface HandoffResult {
  redirectUrl: string;
  projectId: string;
}

/**
 * Stage a print order and return the provider URL to redirect the customer
 * to. Direct-to-checkout (single-product handoff) so the customer goes
 * straight to payment without a confusing third-party cart step.
 */
export async function createPrintHandoff(
  image: File,
  variantId: string,
  opts?: { quantity?: number; title?: string; returnUrl?: string; signal?: AbortSignal },
): Promise<HandoffResult> {
  const sku = printSkuForVariant(variantId);
  if (!sku) {
    throw new PrintHandoffError(
      "This size isn't available for one-tap printing yet — use the print-ready download instead.",
      400,
    );
  }
  const quantity = Math.max(1, Math.min(99, Math.floor(opts?.quantity ?? 1)));
  const publicUrl = await uploadPrintFile(image, opts?.signal);

  const res = await fetch(ADD_TO_CART_URL, {
    method: "POST",
    signal: opts?.signal ?? null,
    headers: { "Content-Type": "application/json", ...attributionHeaders() },
    body: JSON.stringify({
      sku,
      source: SOURCE,
      ...(contactEmail() ? { email: contactEmail() } : {}),
      quantity,
      checkout: true,
      projectData: {
        photos: [publicUrl],
        metadata: { app: SOURCE, variantId, title: opts?.title ?? "Dearly card" },
      },
      properties: {
        "Project Name": opts?.title ?? "Dearly card",
        _cover_preview_url: publicUrl,
        // Visible "edit project" link on the provider page back to the app.
        ...(opts?.returnUrl ? { "Edit Project Link": opts.returnUrl } : {}),
      },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    redirectUrl?: string;
    projectId?: string;
    error?: string;
  };
  if (!res.ok || !json.redirectUrl) {
    throw new PrintHandoffError(
      json.error || `Print handoff failed (${res.status}).`,
      res.status || 502,
    );
  }
  return { redirectUrl: json.redirectUrl, projectId: json.projectId ?? "" };
}
