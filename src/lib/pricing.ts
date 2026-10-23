import type { CartLineInput } from "./validation";

export type MenuOption = { id: string; name: string; priceDeltaCents: number; isAvailable: boolean };
export type MenuOptionGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: MenuOption[];
};
export type MenuProduct = {
  id: string;
  businessId: string;
  name: string;
  priceCents: number;
  isAvailable: boolean;
  deleted: boolean;
  groups: MenuOptionGroup[];
};

export type PricedLine = {
  productId: string;
  productName: string;
  basePriceCents: number;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  selectedOptions: { group: string; name: string; priceDeltaCents: number }[];
  notes?: string;
};

export class PricingError extends Error {
  constructor(
    message: string,
    public readonly code: "product_unavailable" | "invalid_options",
  ) {
    super(message);
  }
}

/**
 * Prices cart lines using ONLY data loaded from the database. Any product that is missing,
 * belongs to another business, is unavailable or deleted, or has invalid options is rejected.
 */
export function priceLines(
  businessId: string,
  products: Map<string, MenuProduct>,
  lines: CartLineInput[],
): { lines: PricedLine[]; subtotalCents: number } {
  const priced: PricedLine[] = lines.map((line) => {
    const p = products.get(line.productId);
    if (!p || p.businessId !== businessId || p.deleted || !p.isAvailable) {
      throw new PricingError(
        p ? `Το προϊόν «${p.name}» δεν είναι πλέον διαθέσιμο.` : "Ένα προϊόν δεν είναι πλέον διαθέσιμο.",
        "product_unavailable",
      );
    }
    const selected = new Set(line.optionIds);
    if (selected.size !== line.optionIds.length) {
      throw new PricingError(`Μη έγκυρες επιλογές για «${p.name}».`, "invalid_options");
    }
    const chosen: PricedLine["selectedOptions"] = [];
    let matched = 0;
    for (const g of p.groups) {
      const picks = g.options.filter((o) => selected.has(o.id));
      matched += picks.length;
      if (picks.some((o) => !o.isAvailable)) {
        throw new PricingError(`Μια επιλογή για «${p.name}» δεν είναι διαθέσιμη.`, "invalid_options");
      }
      if (picks.length < g.minSelect || picks.length > g.maxSelect) {
        throw new PricingError(`Ελέγξτε τις επιλογές «${g.name}» για «${p.name}».`, "invalid_options");
      }
      for (const o of picks) chosen.push({ group: g.name, name: o.name, priceDeltaCents: o.priceDeltaCents });
    }
    if (matched !== selected.size) {
      // An option id that doesn't belong to this product.
      throw new PricingError(`Μη έγκυρες επιλογές για «${p.name}».`, "invalid_options");
    }
    const unit = p.priceCents + chosen.reduce((s, o) => s + o.priceDeltaCents, 0);
    return {
      productId: p.id,
      productName: p.name,
      basePriceCents: p.priceCents,
      unitPriceCents: unit,
      quantity: line.quantity,
      lineTotalCents: unit * line.quantity,
      selectedOptions: chosen,
      notes: line.notes,
    };
  });
  return { lines: priced, subtotalCents: priced.reduce((s, l) => s + l.lineTotalCents, 0) };
}
