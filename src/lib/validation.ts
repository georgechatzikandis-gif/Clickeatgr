import { z } from "zod";

/**
 * Normalises Greek phone numbers to +30XXXXXXXXXX. Accepts mobile (69…) and landline (2…),
 * with or without +30 / 0030. Foreign numbers (tourists) are accepted in +CC format.
 */
export function normalizePhone(input: string): string | null {
  const s = input.replace(/[\s\-().]/g, "");
  const greek = s.replace(/^(\+30|0030)/, "");
  if (/^(69\d{8}|2\d{9})$/.test(greek)) return `+30${greek}`;
  if (/^(\+|00)[1-9]\d{7,14}$/.test(s)) return s.replace(/^00/, "+");
  return null;
}

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const cartLineSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(50),
  optionIds: z.array(z.uuid()).max(30).default([]),
  notes: optionalText(200),
});
export type CartLineInput = z.infer<typeof cartLineSchema>;

export const placeOrderSchema = z
  .object({
    idempotencyKey: z.uuid(),
    businessId: z.uuid(),
    fulfillment: z.enum(["delivery", "pickup"]),
    customerName: trimmed(80).min(2, "Συμπληρώστε το ονοματεπώνυμό σας."),
    customerPhone: z
      .string()
      .transform((v, ctx) => {
        const p = normalizePhone(v);
        if (!p) {
          ctx.addIssue({ code: "custom", message: "Μη έγκυρος αριθμός τηλεφώνου." });
          return z.NEVER;
        }
        return p;
      }),
    customerEmail: z
      .union([z.literal(""), z.email("Μη έγκυρο email.").max(120)])
      .optional()
      .transform((v) => (v ? v.toLowerCase() : undefined)),
    deliveryZoneId: z.uuid().optional(),
    address: optionalText(200),
    addressDetails: optionalText(200),
    notes: optionalText(500),
    lines: z.array(cartLineSchema).min(1, "Το καλάθι είναι άδειο.").max(40),
    acceptTerms: z.literal(true, { error: "Πρέπει να αποδεχτείτε τους όρους." }),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === "delivery") {
      if (!v.deliveryZoneId) ctx.addIssue({ code: "custom", path: ["deliveryZoneId"], message: "Επιλέξτε περιοχή." });
      if (!v.address || v.address.length < 5)
        ctx.addIssue({ code: "custom", path: ["address"], message: "Συμπληρώστε τη διεύθυνση." });
    }
  });
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;
export type PlaceOrderData = z.output<typeof placeOrderSchema>;

export function slugify(input: string): string {
  const map: Record<string, string> = {
    α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z", η: "i", ή: "i", θ: "th",
    ι: "i", ί: "i", ϊ: "i", ΐ: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", ό: "o",
    π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", ύ: "y", ϋ: "y", ΰ: "y", φ: "f", χ: "ch",
    ψ: "ps", ω: "o", ώ: "o",
  };
  return input
    .toLowerCase()
    .replace(/ου|ού/g, "ou")
    .replace(/α[υύ]/g, "av")
    .replace(/ε[υύ]/g, "ev")
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
