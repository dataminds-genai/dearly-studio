// Client-safe PrintKit SKU map. Variants absent here are download-only
// (no matching provider SKU) — the UI offers the print-ready download
// for those instead of the one-tap handoff.
export const PRINT_SKU_BY_VARIANT: Record<string, string> = {
  // 4 x 6 in postcard — exact size match.
  var_postcard_4x6: "postcards-4x6-new",
  // A6 folded is closest to the 4x6 folded greeting card.
  // LAYOUT UNVERIFIED: confirm with a real test order before advertising.
  var_folded_a6: "greeting-cards-medium-fb",
  // 8 x 10 in photo print — exact size match.
  var_print_8x10: "photo-print-8x10",
};

export function printSkuForVariantClient(variantId: string): string | null {
  return PRINT_SKU_BY_VARIANT[variantId] ?? null;
}
