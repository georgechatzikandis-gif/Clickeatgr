import { beforeEach, describe, expect, it } from "vitest";
import { placeOrderSchema } from "@/lib/validation";
import { getBusinessPage } from "@/server/catalog";
import { placeOrder } from "@/server/orders";
import { makeBusiness, orderInput, resetDb } from "./fixtures";

describe("popular section", () => {
  beforeEach(resetDb);

  it("appears once two products each have 3+ orders, most ordered first", async () => {
    const f = await makeBusiness();
    let page = await getBusinessPage(f.business.slug);
    expect(page!.sections.some((s) => s.id === "popular")).toBe(false);
    for (let i = 0; i < 3; i++) await placeOrder(placeOrderSchema.parse(orderInput(f)));
    page = await getBusinessPage(f.business.slug);
    const popular = page!.sections.find((s) => s.id === "popular");
    // Each order has 2× σουβλάκι and 1× πίτσα.
    expect(popular?.products.map((p) => p.name)).toEqual(["Σουβλάκι", "Πίτσα"]);
  });
});
