import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  businessCategories,
  businesses,
  categories,
  deliveryZones,
  orderItems,
  orders,
  regions,
  users,
  type OrderStatus,
} from "@/db/schema";
import { OPEN_STATUSES } from "@/lib/order-status";
import type { OrderWithItems } from "./business-data";

// Admin-only queries. Callers must have passed requireAdmin / requireAdminPage.

export async function listAllBusinesses() {
  const rows = await db
    .select({ b: businesses, regionName: regions.name })
    .from(businesses)
    .innerJoin(regions, eq(regions.id, businesses.regionId))
    .orderBy(asc(businesses.name));
  const counts = await db
    .select({ businessId: orders.businessId, n: count() })
    .from(orders)
    .groupBy(orders.businessId);
  return rows.map((r) => ({ ...r.b, regionName: r.regionName, orderCount: counts.find((c) => c.businessId === r.b.id)?.n ?? 0 }));
}

export async function getBusinessForAdmin(id: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
  if (!b) return null;
  const [cats, staff, zones, [orderCount]] = await Promise.all([
    db.select({ categoryId: businessCategories.categoryId }).from(businessCategories).where(eq(businessCategories.businessId, id)),
    db
      .select({ id: users.id, email: users.email, name: users.name, active: users.active, lastLoginAt: users.lastLoginAt })
      .from(users)
      .where(eq(users.businessId, id))
      .orderBy(asc(users.email)),
    db.select().from(deliveryZones).where(eq(deliveryZones.businessId, id)).orderBy(asc(deliveryZones.sortOrder)),
    db.select({ n: count() }).from(orders).where(eq(orders.businessId, id)),
  ]);
  return { business: b, categoryIds: cats.map((c) => c.categoryId), staff, zones, orderCount: orderCount.n };
}

export async function listAllCategories() {
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function listAllRegions() {
  return db.select().from(regions).orderBy(asc(regions.sortOrder), asc(regions.name));
}

export async function listAdmins() {
  return db
    .select({ id: users.id, email: users.email, name: users.name, active: users.active, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(asc(users.email));
}

export async function searchOrders(f: { from?: Date; to?: Date; status?: OrderStatus; business?: string; page?: number }) {
  const pageSize = 50;
  const where = and(
    f.business && /^[0-9a-f-]{36}$/.test(f.business) ? eq(orders.businessId, f.business) : undefined,
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
  const page = rows.slice(0, pageSize);
  const items = page.length
    ? await db
        .select()
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            page.map((r) => r.id),
          ),
        )
    : [];
  const result: OrderWithItems[] = page.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) }));
  return { orders: result, hasMore: rows.length > pageSize };
}

/** Per-business totals in [from, to). Completed orders only count towards revenue and commission. */
export async function businessReport(from: Date, to: Date) {
  const rows = await db
    .select({
      businessId: orders.businessId,
      allOrders: count(),
      completed: sql<number>`count(*) filter (where ${orders.status} = 'completed')`.mapWith(Number),
      cancelled: sql<number>`count(*) filter (where ${orders.status} in ('rejected','cancelled'))`.mapWith(Number),
      open: sql<number>`count(*) filter (where ${orders.status} in ${OPEN_STATUSES})`.mapWith(Number),
      subtotal: sql<number>`coalesce(sum(${orders.subtotalCents}) filter (where ${orders.status} = 'completed'), 0)`.mapWith(Number),
      deliveryFees: sql<number>`coalesce(sum(${orders.deliveryFeeCents}) filter (where ${orders.status} = 'completed'), 0)`.mapWith(Number),
      total: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} = 'completed'), 0)`.mapWith(Number),
      trialOrders: sql<number>`count(*) filter (where ${orders.status} = 'completed' and ${orders.isTrial})`.mapWith(Number),
      commissionDue: sql<number>`coalesce(sum(${orders.commissionCents}) filter (where ${orders.commissionStatus} = 'due'), 0)`.mapWith(Number),
      commissionSettled: sql<number>`coalesce(sum(${orders.commissionCents}) filter (where ${orders.commissionStatus} = 'settled'), 0)`.mapWith(Number),
    })
    .from(orders)
    .where(and(gte(orders.createdAt, from), lt(orders.createdAt, to)))
    .groupBy(orders.businessId);
  const bs = await db.select({ id: businesses.id, name: businesses.name, trialEndsAt: businesses.trialEndsAt, isDemo: businesses.isDemo }).from(businesses);
  return bs
    .map((b) => {
      const r = rows.find((x) => x.businessId === b.id);
      return {
        ...b,
        allOrders: r?.allOrders ?? 0,
        completed: r?.completed ?? 0,
        cancelled: r?.cancelled ?? 0,
        open: r?.open ?? 0,
        subtotal: r?.subtotal ?? 0,
        deliveryFees: r?.deliveryFees ?? 0,
        total: r?.total ?? 0,
        trialOrders: r?.trialOrders ?? 0,
        commissionDue: r?.commissionDue ?? 0,
        commissionSettled: r?.commissionSettled ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export async function platformStats(todayStart: Date, monthStart: Date) {
  const [[today], [month], [pending], [bizCount]] = await Promise.all([
    db
      .select({ n: count(), total: sum(orders.totalCents) })
      .from(orders)
      .where(and(gte(orders.createdAt, todayStart), eq(orders.status, "completed"))),
    db
      .select({ n: count(), total: sum(orders.totalCents) })
      .from(orders)
      .where(and(gte(orders.createdAt, monthStart), eq(orders.status, "completed"))),
    db.select({ n: count() }).from(orders).where(eq(orders.status, "pending")),
    db.select({ n: count() }).from(businesses).where(eq(businesses.status, "active")),
  ]);
  const [todayAll] = await db.select({ n: count() }).from(orders).where(gte(orders.createdAt, todayStart));
  return {
    todayOrders: todayAll.n,
    todayCompleted: today.n,
    todayTotal: Number(today.total ?? 0),
    monthCompleted: month.n,
    monthTotal: Number(month.total ?? 0),
    pendingNow: pending.n,
    activeBusinesses: bizCount.n,
  };
}
