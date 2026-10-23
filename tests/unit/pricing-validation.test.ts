import { describe, expect, it } from "vitest";
import { formatEuro, parseEuroToCents } from "@/lib/money";
import { canTransition } from "@/lib/order-status";
import { PricingError, priceLines, type MenuProduct } from "@/lib/pricing";
import { normalizePhone, slugify } from "@/lib/validation";

const B = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const SIZE_M = "33333333-3333-4333-8333-333333333331";
const SIZE_L = "33333333-3333-4333-8333-333333333332";
const EXTRA = "33333333-3333-4333-8333-333333333333";
const SOLD_OUT = "33333333-3333-4333-8333-333333333334";

const pizza: MenuProduct = {
  id: P,
  businessId: B,
  name: "Pizza",
  priceCents: 900,
  isAvailable: true,
  deleted: false,
  groups: [
    { id: "g1", name: "Μέγεθος", minSelect: 1, maxSelect: 1, options: [
      { id: SIZE_M, name: "M", priceDeltaCents: 0, isAvailable: true },
      { id: SIZE_L, name: "L", priceDeltaCents: 300, isAvailable: true },
    ] },
    { id: "g2", name: "Υλικά", minSelect: 0, maxSelect: 2, options: [
      { id: EXTRA, name: "Bacon", priceDeltaCents: 120, isAvailable: true },
      { id: SOLD_OUT, name: "Truffle", priceDeltaCents: 500, isAvailable: false },
    ] },
  ],
};
const menu = new Map([[P, pizza]]);

describe("priceLines", () => {
  it("computes unit price from DB prices and options", () => {
    const r = priceLines(B, menu, [{ productId: P, quantity: 2, optionIds: [SIZE_L, EXTRA] }]);
    expect(r.lines[0].unitPriceCents).toBe(1320);
    expect(r.subtotalCents).toBe(2640);
  });
  it("rejects missing required option", () => {
    expect(() => priceLines(B, menu, [{ productId: P, quantity: 1, optionIds: [] }])).toThrow(PricingError);
  });
  it("rejects too many options in a single-choice group", () => {
    expect(() => priceLines(B, menu, [{ productId: P, quantity: 1, optionIds: [SIZE_M, SIZE_L] }])).toThrow(PricingError);
  });
  it("rejects unavailable options and foreign option ids", () => {
    expect(() => priceLines(B, menu, [{ productId: P, quantity: 1, optionIds: [SIZE_M, SOLD_OUT] }])).toThrow(PricingError);
    expect(() =>
      priceLines(B, menu, [{ productId: P, quantity: 1, optionIds: [SIZE_M, "44444444-4444-4444-8444-444444444444"] }]),
    ).toThrow(PricingError);
  });
  it("rejects unavailable products and products from another business", () => {
    const off = new Map([[P, { ...pizza, isAvailable: false }]]);
    expect(() => priceLines(B, off, [{ productId: P, quantity: 1, optionIds: [SIZE_M] }])).toThrow(/διαθέσιμο/);
    expect(() =>
      priceLines("99999999-9999-4999-8999-999999999999", menu, [{ productId: P, quantity: 1, optionIds: [SIZE_M] }]),
    ).toThrow(PricingError);
  });
});

describe("helpers", () => {
  it("formats euros the Greek way", () => {
    expect(formatEuro(1250).replace(/\s/g, " ")).toBe("12,50 €");
    expect(parseEuroToCents("12,5")).toBe(1250);
    expect(parseEuroToCents("abc")).toBeNull();
  });
  it("normalises Greek phone numbers", () => {
    expect(normalizePhone("694 123 4567")).toBe("+306941234567");
    expect(normalizePhone("+30 22410 12345")).toBe("+302241012345");
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
    expect(normalizePhone("12345")).toBeNull();
  });
  it("slugifies Greek names", () => {
    expect(slugify("Σουβλάκια Ο Νίκος")).toBe("souvlakia-o-nikos");
  });
  it("enforces order status flow", () => {
    expect(canTransition("pending", "accepted", "delivery")).toBe(true);
    expect(canTransition("pending", "completed", "delivery")).toBe(false);
    expect(canTransition("ready", "out_for_delivery", "pickup")).toBe(false);
    expect(canTransition("completed", "cancelled", "delivery")).toBe(false);
  });
});
