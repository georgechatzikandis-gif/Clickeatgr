const euro = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" });

/** 1250 -> "12,50 €" (Greek formatting). */
export function formatEuro(cents: number): string {
  return euro.format(cents / 100);
}

/** Parses user input like "12,50", "12.5" or "12" into cents. Returns null when invalid. */
export function parseEuroToCents(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Cents -> "12,50" for form inputs. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
