export type CommissionBase = "subtotal" | "subtotal_plus_delivery";

export type CommissionSettings = {
  commissionEnabled: boolean; // platform master switch
  defaultRateBps: number;
  defaultBase: CommissionBase;
};

export type BusinessCommission = {
  trialEndsAt: Date | null; // null = trial until the admin sets an end date
  commissionRateBps: number | null;
  commissionBase: CommissionBase | null;
};

export type CommissionResult = {
  isTrial: boolean;
  base: CommissionBase;
  commissionableCents: number;
  rateBps: number;
  commissionCents: number;
  status: "not_applicable" | "pending";
};

export function isInTrial(platform: CommissionSettings, business: BusinessCommission, now: Date): boolean {
  if (!platform.commissionEnabled) return true;
  if (business.trialEndsAt === null) return true;
  return now < business.trialEndsAt;
}

/**
 * Commission recorded on an order at placement time. Never collected automatically;
 * it becomes "due" only when the order is completed (see order status logic).
 */
export function calculateCommission(
  platform: CommissionSettings,
  business: BusinessCommission,
  amounts: { subtotalCents: number; deliveryFeeCents: number; discountCents: number },
  now: Date,
): CommissionResult {
  const base = business.commissionBase ?? platform.defaultBase;
  const gross = amounts.subtotalCents + (base === "subtotal_plus_delivery" ? amounts.deliveryFeeCents : 0);
  const commissionableCents = Math.max(0, gross - amounts.discountCents);

  if (isInTrial(platform, business, now)) {
    return { isTrial: true, base, commissionableCents, rateBps: 0, commissionCents: 0, status: "not_applicable" };
  }
  const rateBps = business.commissionRateBps ?? platform.defaultRateBps;
  // Round half up to the nearest cent.
  const commissionCents = Math.round((commissionableCents * rateBps) / 10000);
  return {
    isTrial: false,
    base,
    commissionableCents,
    rateBps,
    commissionCents,
    status: commissionCents > 0 ? "pending" : "not_applicable",
  };
}

export function formatRate(bps: number): string {
  return `${(bps / 100).toLocaleString("el-GR", { maximumFractionDigits: 2 })}%`;
}

/** Human-readable trial status. trialEndsAt is the first moment AFTER the trial. */
export function trialLabel(trialEndsAt: Date | null, now = new Date()): string {
  if (!trialEndsAt) return "Δωρεάν περίοδος (χωρίς λήξη)";
  if (trialEndsAt <= now) return "Η δωρεάν περίοδος έληξε";
  const last = new Date(trialEndsAt.getTime() - 1).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
  return `Δωρεάν έως ${last}`;
}
