import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  businessHours,
  businesses,
  deliveryZones,
  menuCategories,
  optionGroups,
  options,
  orderItems,
  orders,
  products,
  type OrderStatus,
} from "@/db/schema";
import { OPEN_STATUSES } from "@/lib/order-status";

// Every function here takes the businessId from the logged-in user's session (never from the browser)
// and filters by it, so one business can never read or change another business's data.

export type OrderWithItems = typeof orders.$inferSelect & { items: (typeof orderItems.$inferSelect)[] };

async function attachItems(rows: (typeof orders.$inferSelect)[]): Promise<OrderWithItems[]> {
  if (!rows.length) return [];
  const items = await db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((r) => r.id),
      ),
    );
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.orderId === r.id) }));
}

export async function listActiveOrders(businessId: string): Promise<OrderWithItems[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.businessId, businessId), inArray(orders.status, OPEN_STATUSES)))
    .orderBy(asc(orders.createdAt));
  return attachItems(rows);
}

export async function listOrderHistory(
  businessId: string,
  f: { from?: Date; to?: Date; status?: OrderStatus; page?: number },
) {
  const pageSize = 30;
  const where = and(
    eq(orders.businessId, businessId),
    f.from ? gte(orders.createdAt, f.from) : undefined,
    f.to ? lt(orders.createdAt, f.to) : undefined,
    f.status ? eq(orders.status, f.status) : undefined,
  );
  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize + 1)
    .offset(((f.page ?? 1) - 1) * pageSize);
  return { orders: await attachItems(rows.slice(0, pageSize)), hasMore: rows.length > pageSize };
}

export async function getBusinessOrder(businessId: string, orderId: string) {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId)))
    .limit(1);
  return (await attachItems(rows))[0] ?? null;
}

export async function todayStats(businessId: string, since: Date) {
  const [r] = await db
    .select({ n: count(), total: sum(orders.totalCents) })
    .from(orders)
    .where(and(eq(orders.businessId, businessId), eq(orders.status, "completed"), gte(orders.createdAt, since)));
  return { completed: Number(r.n), totalCents: Number(r.total ?? 0) };
}

export async function getBusinessSettings(businessId: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  const [hours, zones] = await Promise.all([
    db.select().from(businessHours).where(eq(businessHours.businessId, businessId)),
    db
      .select()
      .from(deliveryZones)
      .where(eq(deliveryZones.businessId, businessId))
      .orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.name)),
  ]);
  return { business: b, hours, zones };
}

export async function getMenuForEditing(businessId: string) {
  const [cats, prods] = await Promise.all([
    db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.businessId, businessId))
      .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name)),
    db
      .select()
      .from(products)
      .where(and(eq(products.businessId, businessId), isNull(products.deletedAt)))
      .orderBy(asc(products.sortOrder), asc(products.name)),
  ]);
  return { categories: cats, products: prods };
}

export async function getProductForEditing(businessId: string, productId: string) {
  const [p] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.businessId, businessId), isNull(products.deletedAt)))
    .limit(1);
  if (!p) return null;
  const groups = await db
    .select()
    .from(optionGroups)
    .where(eq(optionGroups.productId, p.id))
    .orderBy(asc(optionGroups.sortOrder));
  const opts = groups.length
    ? await db
        .select()
        .from(options)
        .where(
          inArray(
            options.groupId,
            groups.map((g) => g.id),
          ),
        )
        .orderBy(asc(options.sortOrder))
    : [];
  return { product: p, groups: groups.map((g) => ({ ...g, options: opts.filter((o) => o.groupId === g.id) })) };
}

// ---- ownership checks used by mutations

export async function ownsMenuCategory(businessId: string, id: string) {
  const [r] = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(and(eq(menuCategories.id, id), eq(menuCategories.businessId, businessId)));
  return !!r;
}

export async function ownsProduct(businessId: string, id: string) {
  const [r] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, id), eq(products.businessId, businessId), isNull(products.deletedAt)));
  return !!r;
}

/** Returns the product id if the option group belongs to one of the business's products. */
export async function ownedGroupProduct(businessId: string, groupId: string) {
  const [r] = await db
    .select({ productId: optionGroups.productId })
    .from(optionGroups)
    .innerJoin(products, eq(products.id, optionGroups.productId))
    .where(and(eq(optionGroups.id, groupId), eq(products.businessId, businessId)));
  return r?.productId ?? null;
}

export async function ownedOptionProduct(businessId: string, optionId: string) {
  const [r] = await db
    .select({ productId: optionGroups.productId })
    .from(options)
    .innerJoin(optionGroups, eq(optionGroups.id, options.groupId))
    .innerJoin(products, eq(products.id, optionGroups.productId))
    .where(and(eq(options.id, optionId), eq(products.businessId, businessId)));
  return r?.productId ?? null;
}

