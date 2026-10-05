import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { shippableVariants } from "@/domain/catalog";
import { printSkuForVariantClient } from "@/domain/print-skus";
import { assessQuality, bleedSize } from "@/domain/services/print-quality";
import type { CreationDraft } from "@/domain/entities/types";
import { renderCardToCanvas } from "./exportCard";
import { draftImageSrc } from "./CardPreview";
import { usePrintNotice } from "./print-notice";

const PRINT_DPI = 300;

/**
 * One-tap print: renders the draft at press size, stages a provider order,
 * and redirects the customer to finish (quantity, address, payment) there.
 * Variants without a provider SKU stay on the print-ready download path.
 */
export function PrintHandoff({ draft }: { draft: CreationDraft }) {
  const [busy, setBusy] = useState<string | null>(null);
  const { requestPrintGoAhead, dialog: printNotice } = usePrintNotice();
  const printable = shippableVariants().filter((v) => printSkuForVariantClient(v.id));
  const downloadOnly = shippableVariants().filter((v) => !printSkuForVariantClient(v.id));

  async function orderPrint(variantId: string) {
    const src = draftImageSrc(draft);
    if (!src) {
      toast.error("Add a photo first.");
      return;
    }
    const variant = printable.find((v) => v.id === variantId);
    if (!variant) return;
    // Open the tab inside the tap gesture so popup blockers let it through.
    // If the user cancels the notice below, the blank tab is closed again.
    const printTab = window.open("about:blank", "_blank");
    if (!(await requestPrintGoAhead(draft))) {
      printTab?.close();
      return;
    }
    setBusy(variantId);
    try {
      const bleed = bleedSize(variant);
      const targetWidth = Math.max(
        2000,
        Math.round((Math.max(bleed.widthMm, bleed.heightMm) / 25.4) * PRINT_DPI),
      );
      const canvas = await renderCardToCanvas(draft, targetWidth);
      const quality = assessQuality(canvas.width, canvas.height, variant);
      if (quality.blocksCheckout) {
        toast.error(
          `Too low to print at this size (${quality.effectiveDpi} dpi, needs ${quality.requiredDpi}). Pick a smaller size or upload a larger photo.`,
        );
        return;
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("The print file could not be created.");
      const form = new FormData();
      form.set("image", new File([blob], "dearly-card.png", { type: "image/png" }));
      form.set("variantId", variant.id);
      form.set("quantity", "1");
      form.set("title", draft.title || "Dearly card");
      form.set("widthPx", String(canvas.width));
      form.set("heightPx", String(canvas.height));
      const res = await fetch("/api/print-handoff", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.text()) || "Print handoff failed.");
      const { redirectUrl } = (await res.json()) as { redirectUrl: string };
      // Single-use URL — opens in a new tab so Dearly Studio stays open
      // behind it. Falls back to same-tab redirect if popups are blocked.
      if (printTab && !printTab.closed) printTab.location.href = redirectUrl;
      else window.location.href = redirectUrl;
      toast.success("Print page opened in a new tab — Dearly Studio is still here.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the print order.");
    } finally {
      setBusy(null);
    }
  }

  if (!printable.length) return null;

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
      {printNotice}
      <p className="border-b border-border px-4 pb-2 pt-3 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
        Order a print
      </p>
      <ul className="divide-y divide-border">
        {printable.map((variant) => (
          <li key={variant.id}>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void orderPrint(variant.id)}
              className="flex w-full items-center gap-3 p-4 text-left text-[16px] disabled:opacity-60"
            >
              {busy === variant.id ? (
                <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
              ) : (
                <Printer className="size-5 shrink-0 text-primary" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className="block truncate">{variant.label}</span>
                <span className="block text-[13px] text-muted-foreground">
                  {busy === variant.id
                    ? "Preparing your print…"
                    : "Printed & shipped by our partner — you pay there"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {downloadOnly.length ? (
        <p className="border-t border-border px-4 py-2.5 text-[13px] text-muted-foreground">
          Other sizes ({downloadOnly.map((v) => v.label).join(", ")}) — use Save print-ready PDF
          below and print locally.
        </p>
      ) : null}
    </div>
  );
}
