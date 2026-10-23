import "server-only";
import { timingSafeEqual } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, orderItems, orders } from "@/db/schema";

/** Loads an order for the customer's confirmation page. Requires the secret token from the link. */
export async function getOrderForCustomer(id: string, token: string | undefined) {
  if (!token || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await db
    .select({ order: orders, businessName: businesses.name, businessPhone: businesses.phone, businessAddress: businesses.address, businessSlug: businesses.slug })
    .from(orders)
    .innerJoin(businesses, eq(businesses.id, orders.businessId))
    .where(eq(orders.id, id))
    .limit(1);
  if (!row) return null;
  const a = Buffer.from(row.order.accessToken);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id));
  return { ...row, items };
}
