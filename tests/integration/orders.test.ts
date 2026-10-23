import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as s from "@/db/schema";
import { placeOrderSchema } from "@/lib/validation";
import { OrderError, placeOrder, updateOrderStatus } from "@/server/orders";
import { makeBusiness, orderInput, resetDb } from "./fixtures";

const parse = (v: unknown) => placeOrderSchema.parse(v);

describe("placeOrder", () => {
  beforeEach(resetDb);

  it("saves the order with server-calculated totals and 0% trial commission", async () => {
    const f = await makeBusiness();
    const placed = await placeOrder(parse(orderInput(f)));
    const [o] = await db.select().from(s.orders).where(eq(s.orders.id, placed.id));
    // 2 × 4.00 + (9.00 + 3.00) = 20.00, + 1.50 delivery
    expect(o).toMatchObject({
      subtotalCents: 2000,
      deliveryFeeCents: 150,
      totalCents: 2150,
      status: "pending",
      paymentMethod: "cash_on_delivery",
      customerPhone: "+306900000000",
      isTrial: true,
      commissionRateBps: 0,
      commissionCents: 0,
      commissionStatus: "not_applicable",
    });
    expect(o.reference).toMatch(/^CE-[A-Z0-9]{6}$/);
    const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, o.id));
    expect(items).toHaveLength(2);
    const ledger = await db.select().from(s.commissionLedger).where(eq(s.commissionLedger.orderId, o.id));
    expect(ledger).toMatchObject([{ event: "calculated", isTrial: true, amountCents: 0 }]);
  });

  it("ignores any prices sent by the browser", async () => {
    const f = await makeBusiness();
    const tampered = orderInput(f, {
      subtotalCents: 1,
      totalCents: 1,
      lines: [{ productId: f.souvlaki.id, quantity: 3, priceCents: 1 }],
    });
    const placed = await placeOrder(parse(tampered));
    const [o] = await db.select().from(s.orders).where(eq(s.orders.id, placed.id));
    expect(o.subtotalCents).toBe(1200);
  });

  it("returns the same order for a repeated submission (sequential and concurrent)", async () => {
    const f = await makeBusiness();
    const input = parse(orderInput(f));
    const first = await placeOrder(input);
    const again = await placeOrder(input);
    expect(again.id).toBe(first.id);
    expect(again.duplicate).toBe(true);

    const input2 = parse(orderInput(f));
    const results = await Promise.all([placeOrder(input2), placeOrder(input2), placeOrder(input2)]);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    const all = await db.select().from(s.orders);
    expect(all).toHaveLength(2);
  });

  it("rejects unavailable, deleted and foreign products", async () => {
    const f = await makeBusiness();
    const other = await makeBusiness();
    await db.update(s.products).set({ isAvailable: false }).where(eq(s.products.id, f.souvlaki.id));
    await expect(placeOrder(parse(orderInput(f)))).rejects.toThrow(OrderError);
    await expect(
      placeOrder(parse(orderInput(f, { lines: [{ productId: other.souvlaki.id, quantity: 5 }] }))),
    ).rejects.toThrow(OrderError);
    await db.update(s.products).set({ deletedAt: new Date() }).where(eq(s.products.id, f.pizza.id));
    await expect(
      placeOrder(parse(orderInput(f, { lines: [{ productId: f.pizza.id, quantity: 2, optionIds: [f.medium.id] }] }))),
    ).rejects.toThrow(OrderError);
    expect(await db.select().from(s.orders)).toHaveLength(0);
  });

  it("enforces minimum order, zones, and business state", async () => {
    const f = await makeBusiness();
    const other = await makeBusiness();
    await expect(
      placeOrder(parse(orderInput(f, { lines: [{ productId: f.souvlaki.id, quantity: 1 }] }))),
    ).rejects.toThrow(/ελάχιστη/);
    await expect(placeOrder(parse(orderInput(f, { deliveryZoneId: other.zone.id })))).rejects.toThrow(/περιοχή/);

    await db.update(s.businesses).set({ temporarilyClosed: true }).where(eq(s.businesses.id, f.business.id));
    await expect(placeOrder(parse(orderInput(f)))).rejects.toThrow(/προσωρινά/);
    await db
      .update(s.businesses)
      .set({ temporarilyClosed: false, status: "suspended" })
      .where(eq(s.businesses.id, f.business.id));
    await expect(placeOrder(parse(orderInput(f)))).rejects.toThrow(OrderError);

    await db.update(s.businesses).set({ status: "active" }).where(eq(s.businesses.id, f.business.id));
    await db.delete(s.businessHours).where(eq(s.businessHours.businessId, f.business.id));
    await expect(placeOrder(parse(orderInput(f)))).rejects.toThrow(/κλειστό/);
  });

  it("supports pickup without address or delivery fee", async () => {
    const f = await makeBusiness();
    const placed = await placeOrder(
      parse(orderInput(f, { fulfillment: "pickup", deliveryZoneId: undefined, address: undefined })),
    );
    const [o] = await db.select().from(s.orders).where(eq(s.orders.id, placed.id));
    expect(o).toMatchObject({ deliveryFeeCents: 0, totalCents: 2000, paymentMethod: "pay_at_pickup", address: null });
  });
});

describe("commission after the trial", () => {
  beforeEach(resetDb);

  it("records 5% on the subtotal, makes it due on completion and reverses it on cancellation", async () => {
    await db.update(s.platformSettings).set({ commissionEnabled: true });
    const f = await makeBusiness({ trialEndsAt: new Date("2026-01-01") });
    const actor = { userId: "00000000-0000-4000-8000-000000000000", role: "business" as const, businessId: f.business.id };

    const a = await placeOrder(parse(orderInput(f)));
    let [o] = await db.select().from(s.orders).where(eq(s.orders.id, a.id));
    expect(o).toMatchObject({ isTrial: false, commissionRateBps: 500, commissionableCents: 2000, commissionCents: 100, commissionStatus: "pending" });

    for (const st of ["accepted", "preparing", "ready", "out_for_delivery", "completed"] as const) {
      await updateOrderStatus(a.id, st, actor);
    }
    [o] = await db.select().from(s.orders).where(eq(s.orders.id, a.id));
    expect(o).toMatchObject({ status: "completed", commissionStatus: "due", commissionCents: 100 });

    const b = await placeOrder(parse(orderInput(f)));
    await updateOrderStatus(b.id, "rejected", actor, "Τελείωσαν τα υλικά");
    [o] = await db.select().from(s.orders).where(eq(s.orders.id, b.id));
    expect(o).toMatchObject({ status: "rejected", commissionStatus: "not_applicable", commissionCents: 0 });
    const ledger = await db.select().from(s.commissionLedger).where(eq(s.commissionLedger.orderId, b.id));
    expect(ledger.map((l) => [l.event, l.amountCents])).toEqual([["calculated", 100], ["reversed", -100]]);
  });

  it("keeps 0% for a business still in trial even when commission is enabled", async () => {
    await db.update(s.platformSettings).set({ commissionEnabled: true });
    const f = await makeBusiness({ trialEndsAt: new Date(Date.now() + 30 * 86400_000) });
    const a = await placeOrder(parse(orderInput(f)));
    const [o] = await db.select().from(s.orders).where(eq(s.orders.id, a.id));
    expect(o).toMatchObject({ isTrial: true, commissionCents: 0 });
  });
});

describe("updateOrderStatus authorization", () => {
  beforeEach(resetDb);

  it("prevents a business from changing another business's order", async () => {
    const f = await makeBusiness();
    const intruder = await makeBusiness();
    const a = await placeOrder(parse(orderInput(f)));
    await expect(
      updateOrderStatus(a.id, "accepted", { userId: "00000000-0000-4000-8000-000000000000", role: "business", businessId: intruder.business.id }),
    ).rejects.toThrow(/δεν βρέθηκε/);
    const [o] = await db.select().from(s.orders).where(eq(s.orders.id, a.id));
    expect(o.status).toBe("pending");
  });

  it("rejects invalid transitions", async () => {
    const f = await makeBusiness();
    const a = await placeOrder(parse(orderInput(f)));
    const actor = { userId: "00000000-0000-4000-8000-000000000000", role: "business" as const, businessId: f.business.id };
    await expect(updateOrderStatus(a.id, "completed", actor)).rejects.toThrow(OrderError);
  });
});
