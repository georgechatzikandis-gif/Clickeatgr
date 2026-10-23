import { describe, expect, it } from "vitest";
import { calculateCommission } from "@/lib/commission";

const now = new Date("2026-10-23T12:00:00Z");
const amounts = { subtotalCents: 2000, deliveryFeeCents: 250, discountCents: 0 };
const on = { commissionEnabled: true, defaultRateBps: 500, defaultBase: "subtotal" as const };
const noOverride = { commissionRateBps: null, commissionBase: null };

describe("commission", () => {
  it("is always 0 while the platform switch is off", () => {
    const r = calculateCommission({ ...on, commissionEnabled: false }, { trialEndsAt: new Date(0), ...noOverride }, amounts, now);
    expect(r).toMatchObject({ isTrial: true, rateBps: 0, commissionCents: 0, status: "not_applicable" });
  });
  it("is 0 while the business trial has no end date", () => {
    const r = calculateCommission(on, { trialEndsAt: null, ...noOverride }, amounts, now);
    expect(r).toMatchObject({ isTrial: true, commissionCents: 0 });
  });
  it("is 0 before the trial end date", () => {
    const r = calculateCommission(on, { trialEndsAt: new Date("2026-12-31"), ...noOverride }, amounts, now);
    expect(r.isTrial).toBe(true);
    expect(r.commissionCents).toBe(0);
  });
  it("charges the default 5% on the subtotal only (delivery excluded) after the trial", () => {
    const r = calculateCommission(on, { trialEndsAt: new Date("2026-01-01"), ...noOverride }, amounts, now);
    expect(r).toMatchObject({ isTrial: false, base: "subtotal", commissionableCents: 2000, rateBps: 500, commissionCents: 100, status: "pending" });
  });
  it("can include delivery and use a business-specific rate", () => {
    const r = calculateCommission(
      on,
      { trialEndsAt: new Date("2026-01-01"), commissionRateBps: 300, commissionBase: "subtotal_plus_delivery" },
      amounts,
      now,
    );
    expect(r.commissionableCents).toBe(2250);
    expect(r.commissionCents).toBe(68); // 67.5 rounded half up
  });
  it("subtracts discounts from the commissionable amount", () => {
    const r = calculateCommission(on, { trialEndsAt: new Date("2026-01-01"), ...noOverride }, { ...amounts, discountCents: 500 }, now);
    expect(r.commissionableCents).toBe(1500);
    expect(r.commissionCents).toBe(75);
  });
});
