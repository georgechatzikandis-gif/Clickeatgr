import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as s from "@/db/schema";
import { placeOrderSchema } from "@/lib/validation";
import { businessReport } from "@/server/admin-data";
import { getBusinessOrder, listActiveOrders, listOrderHistory } from "@/server/business-data";
import { placeOrder, updateOrderStatus } from "@/server/orders";
import { rateLimit } from "@/server/rate-limit";
import { makeBusiness, orderInput, resetDb } from "./fixtures";

const parse = (v: unknown) => placeOrderSchema.parse(v);

describe("business data isolation", () => {
  beforeEach(resetDb);

  it("only returns a business's own orders", async () => {
    const a = await makeBusiness();
    const b = await makeBusiness();
    const oa = await placeOrder(parse(orderInput(a)));
    const ob = await placeOrder(parse(orderInput(b)));
    expect((await listActiveOrders(a.business.id)).map((o) => o.id)).toEqual([oa.id]);
    expect((await listOrderHistory(b.business.id, {})).orders.map((o) => o.id)).toEqual([ob.id]);
    expect(await getBusinessOrder(a.business.id, ob.id)).toBeNull();
    expect((await getBusinessOrder(a.business.id, oa.id))?.items).toHaveLength(2);
  });
});

describe("monthly report", () => {
  beforeEach(resetDb);

  it("counts revenue and commission only for completed orders", async () => {
    await db.update(s.platformSettings).set({ commissionEnabled: true });
    const f = await makeBusiness({ trialEndsAt: new Date("2026-01-01") });
    const actor = { userId: "00000000-0000-4000-8000-000000000000", role: "business" as const, businessId: f.business.id };
    const done = await placeOrder(parse(orderInput(f)));
    for (const st of ["accepted", "ready", "completed"] as const) await updateOrderStatus(done.id, st, actor);
    const rejected = await placeOrder(parse(orderInput(f)));
    await updateOrderStatus(rejected.id, "rejected", actor);
    await placeOrder(parse(orderInput(f))); // still pending

    const rows = await businessReport(new Date(Date.now() - 86400_000), new Date(Date.now() + 86400_000));
    const r = rows.find((x) => x.id === f.business.id)!;
    expect(r).toMatchObject({ allOrders: 3, completed: 1, cancelled: 1, open: 1, subtotal: 2000, deliveryFees: 150, total: 2150, commissionDue: 100 });
  });

  it("reports zero commission during the trial", async () => {
    const f = await makeBusiness();
    const o = await placeOrder(parse(orderInput(f)));
    const actor = { userId: "00000000-0000-4000-8000-000000000000", role: "business" as const, businessId: f.business.id };
    for (const st of ["accepted", "ready", "completed"] as const) await updateOrderStatus(o.id, st, actor);
    const [row] = await db.select().from(s.orders).where(eq(s.orders.id, o.id));
    expect(row.commissionStatus).toBe("not_applicable");
    const r = (await businessReport(new Date(0), new Date(Date.now() + 86400_000))).find((x) => x.id === f.business.id)!;
    expect(r).toMatchObject({ completed: 1, trialOrders: 1, commissionDue: 0 });
  });
});

describe("rate limit", () => {
  beforeEach(resetDb);
  it("blocks after the limit within the window", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit("test:key", 3, 60));
    expect(results).toEqual([true, true, true, false]);
  });
});
