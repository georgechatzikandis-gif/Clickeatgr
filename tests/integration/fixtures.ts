import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";

export async function resetDb() {
  await db.execute(
    `truncate table commission_ledger, order_events, order_items, orders, options, option_groups, products,
     menu_categories, delivery_zones, business_hours, business_categories, sessions, users, businesses,
     images, categories, regions, platform_settings, rate_limits restart identity cascade` as never,
  );
  await db.insert(s.platformSettings).values({ id: 1 });
}

export async function makeBusiness(opts: Partial<typeof s.businesses.$inferInsert> = {}) {
  let [region] = await db.select().from(s.regions).where(eq(s.regions.slug, "rodos"));
  if (!region) [region] = await db.insert(s.regions).values({ slug: "rodos", name: "Ρόδος" }).returning();
  const slug = opts.slug ?? `b-${randomUUID().slice(0, 8)}`;
  const [b] = await db
    .insert(s.businesses)
    .values({ slug, name: `Test ${slug}`, regionId: region.id, ...opts })
    .returning();
  await db
    .insert(s.businessHours)
    .values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ businessId: b.id, weekday, opensAt: "00:00", closesAt: "00:00" })));
  const [zone] = await db
    .insert(s.deliveryZones)
    .values({ businessId: b.id, name: "Πόλη", feeCents: 150, minOrderCents: 1000 })
    .returning();
  const [souvlaki] = await db
    .insert(s.products)
    .values({ businessId: b.id, name: "Σουβλάκι", priceCents: 400 })
    .returning();
  const [pizza] = await db.insert(s.products).values({ businessId: b.id, name: "Πίτσα", priceCents: 900 }).returning();
  const [size] = await db
    .insert(s.optionGroups)
    .values({ productId: pizza.id, name: "Μέγεθος", minSelect: 1, maxSelect: 1 })
    .returning();
  const [medium, large] = await db
    .insert(s.options)
    .values([
      { groupId: size.id, name: "Μεσαία", priceDeltaCents: 0 },
      { groupId: size.id, name: "Μεγάλη", priceDeltaCents: 300 },
    ])
    .returning();
  return { business: b, zone, souvlaki, pizza, medium, large };
}

export function orderInput(f: Awaited<ReturnType<typeof makeBusiness>>, overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    businessId: f.business.id,
    fulfillment: "delivery" as const,
    customerName: "Δοκιμαστικός Πελάτης",
    customerPhone: "6900000000",
    deliveryZoneId: f.zone.id,
    address: "Οδός Δοκιμής 1, Ρόδος",
    lines: [
      { productId: f.souvlaki.id, quantity: 2 },
      { productId: f.pizza.id, quantity: 1, optionIds: [f.large.id] },
    ],
    acceptTerms: true as const,
    ...overrides,
  };
}
