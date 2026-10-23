import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  businessHours,
  businesses,
  commissionLedger,
  deliveryZones,
  orderEvents,
  orderItems,
  orders,
  products,
  type OrderStatus,
} from "@/db/schema";
import { calculateCommission } from "@/lib/commission";
import { isOpenAt } from "@/lib/hours";
import { formatEuro } from "@/lib/money";
import { canTransition } from "@/lib/order-status";
import { PricingError, priceLines, type MenuProduct } from "@/lib/pricing";
import type { PlaceOrderData } from "@/lib/validation";
import { loadGroups } from "./catalog";
import { getPlatformSettings } from "./settings";

/** Error whose message is safe to show to the customer / staff. */
export class OrderError extends Error {}

export type PlacedOrder = { id: string; reference: string; accessToken: string; duplicate: boolean };

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
function newReference(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `CE-${s}`;
}

async function findByIdempotencyKey(key: string): Promise<PlacedOrder | null> {
  const [o] = await db
    .select({ id: orders.id, reference: orders.reference, accessToken: orders.accessToken })
    .from(orders)
    .where(eq(orders.idempotencyKey, key))
    .limit(1);
  return o ? { ...o, duplicate: true } : null;
}

function isUniqueViolation(e: unknown, constraint: string): boolean {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  const c = err.cause ?? err;
  return c.code === "23505" && (c.constraint_name ?? "").includes(constraint);
}

/**
 * Places an order. Every price, option, availability rule, fee and commission is recomputed
 * here from the database; nothing calculated in the browser is trusted.
 * Retrying with the same idempotency key returns the original order instead of creating a new one.
 */
export async function placeOrder(input: PlaceOrderData, now = new Date()): Promise<PlacedOrder> {
  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing) return existing;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction((tx) => placeOrderTx(tx, input, now));
    } catch (e) {
      if (isUniqueViolation(e, "idempotency_key")) {
        const dup = await findByIdempotencyKey(input.idempotencyKey);
        if (dup) return dup;
      }
      if (isUniqueViolation(e, "reference")) continue; // extremely rare collision, retry
      throw e;
    }
  }
  throw new OrderError("Δεν ήταν δυνατή η καταχώριση της παραγγελίας. Δοκιμάστε ξανά.");
}

async function placeOrderTx(tx: Tx, input: PlaceOrderData, now: Date): Promise<PlacedOrder> {
  const [b] = await tx.select().from(businesses).where(eq(businesses.id, input.businessId)).limit(1);
  if (!b || b.status !== "active") throw new OrderError("Το κατάστημα δεν δέχεται παραγγελίες.");
  if (b.temporarilyClosed) throw new OrderError("Το κατάστημα είναι προσωρινά κλειστό.");
  const hours = await tx.select().from(businessHours).where(eq(businessHours.businessId, b.id));
  if (!isOpenAt(hours, now)) throw new OrderError("Το κατάστημα είναι κλειστό αυτή τη στιγμή.");

  // ---- fulfilment & delivery zone
  let deliveryFeeCents = 0;
  let minOrderCents = b.pickupMinOrderCents;
  let zone: typeof deliveryZones.$inferSelect | undefined;
  if (input.fulfillment === "delivery") {
    if (!b.acceptsDelivery) throw new OrderError("Το κατάστημα δεν κάνει διανομή.");
    [zone] = await tx
      .select()
      .from(deliveryZones)
      .where(
        and(
          eq(deliveryZones.id, input.deliveryZoneId!),
          eq(deliveryZones.businessId, b.id),
          eq(deliveryZones.active, true),
        ),
      )
      .limit(1);
    if (!zone) throw new OrderError("Το κατάστημα δεν εξυπηρετεί την περιοχή που επιλέξατε.");
    deliveryFeeCents = zone.feeCents;
    minOrderCents = zone.minOrderCents;
  } else if (!b.acceptsPickup) {
    throw new OrderError("Το κατάστημα δεν δέχεται παραλαβή από το κατάστημα.");
  }

  // ---- products & prices from the database
  const ids = [...new Set(input.lines.map((l) => l.productId))];
  const rows = await tx
    .select()
    .from(products)
    .where(and(inArray(products.id, ids), eq(products.businessId, b.id), isNull(products.deletedAt)));
  const groups = await loadGroups(rows.map((r) => r.id));
  const menu = new Map<string, MenuProduct>(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        businessId: r.businessId,
        name: r.name,
        priceCents: r.priceCents,
        isAvailable: r.isAvailable,
        deleted: r.deletedAt !== null,
        groups: groups.get(r.id) ?? [],
      },
    ]),
  );
  let priced;
  try {
    priced = priceLines(b.id, menu, input.lines);
  } catch (e) {
    if (e instanceof PricingError) throw new OrderError(e.message);
    throw e;
  }
  if (priced.subtotalCents < minOrderCents) {
    throw new OrderError(`Η ελάχιστη παραγγελία είναι ${formatEuro(minOrderCents)}.`);
  }

  const discountCents = 0;
  const totalCents = priced.subtotalCents + deliveryFeeCents - discountCents;

  // ---- commission snapshot (0% during the free trial)
  const settings = await getPlatformSettings(tx);
  const commission = calculateCommission(
    {
      commissionEnabled: settings.commissionEnabled,
      defaultRateBps: settings.defaultCommissionRateBps,
      defaultBase: settings.defaultCommissionBase,
    },
    { trialEndsAt: b.trialEndsAt, commissionRateBps: b.commissionRateBps, commissionBase: b.commissionBase },
    { subtotalCents: priced.subtotalCents, deliveryFeeCents, discountCents },
    now,
  );

  const accessToken = randomBytes(18).toString("base64url");
  const [order] = await tx
    .insert(orders)
    .values({
      reference: newReference(),
      accessToken,
      idempotencyKey: input.idempotencyKey,
      businessId: b.id,
      fulfillment: input.fulfillment,
      paymentMethod: input.fulfillment === "delivery" ? "cash_on_delivery" : "pay_at_pickup",
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      deliveryZoneId: zone?.id ?? null,
      deliveryZoneName: zone?.name ?? null,
      address: input.fulfillment === "delivery" ? input.address! : null,
      addressDetails: input.fulfillment === "delivery" ? (input.addressDetails ?? null) : null,
      notes: input.notes ?? null,
      subtotalCents: priced.subtotalCents,
      deliveryFeeCents,
      discountCents,
      totalCents,
      isTrial: commission.isTrial,
      commissionBase: commission.base,
      commissionableCents: commission.commissionableCents,
      commissionRateBps: commission.rateBps,
      commissionCents: commission.commissionCents,
      commissionStatus: commission.status,
    })
    .returning({ id: orders.id, reference: orders.reference });

  await tx.insert(orderItems).values(
    priced.lines.map((l) => ({
      orderId: order.id,
      productId: l.productId,
      productName: l.productName,
      basePriceCents: l.basePriceCents,
      unitPriceCents: l.unitPriceCents,
      quantity: l.quantity,
      lineTotalCents: l.lineTotalCents,
      selectedOptions: l.selectedOptions,
      notes: l.notes ?? null,
    })),
  );
  await tx.insert(orderEvents).values({ orderId: order.id, fromStatus: null, toStatus: "pending" });
  await tx.insert(commissionLedger).values({
    orderId: order.id,
    businessId: b.id,
    event: "calculated",
    isTrial: commission.isTrial,
    baseCents: commission.commissionableCents,
    rateBps: commission.rateBps,
    amountCents: commission.commissionCents,
    note: commission.isTrial ? "Δωρεάν δοκιμαστική περίοδος — 0%" : null,
  });

  return { id: order.id, reference: order.reference, accessToken, duplicate: false };
}

export type StatusActor = { userId: string; role: "admin" | "business"; businessId: string | null };

/**
 * Changes an order's status. Business users can only touch orders of their own business
 * (enforced in the WHERE clause); admins can touch any order.
 */
export async function updateOrderStatus(
  orderId: string,
  to: OrderStatus,
  actor: StatusActor,
  note?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const scope =
      actor.role === "admin" ? eq(orders.id, orderId) : and(eq(orders.id, orderId), eq(orders.businessId, actor.businessId!));
    const [o] = await tx.select().from(orders).where(scope).for("update").limit(1);
    if (!o) throw new OrderError("Η παραγγελία δεν βρέθηκε.");

    const adminCancel = actor.role === "admin" && to === "cancelled" && !["completed", "rejected", "cancelled"].includes(o.status);
    if (!adminCancel && !canTransition(o.status, to, o.fulfillment)) {
      throw new OrderError("Αυτή η αλλαγή κατάστασης δεν επιτρέπεται.");
    }

    const now = new Date();
    const patch: Partial<typeof orders.$inferInsert> = { status: to };
    if (to === "accepted") patch.acceptedAt = now;
    if (to === "completed") patch.completedAt = now;
    if (to === "cancelled" || to === "rejected") {
      patch.cancelledAt = now;
      if (note) patch.rejectionReason = note.slice(0, 300);
    }

    // Commission lifecycle: pending → due on completion; reversed on rejection/cancellation.
    let ledger: typeof commissionLedger.$inferInsert | null = null;
    if (to === "completed" && o.commissionStatus === "pending") {
      patch.commissionStatus = "due";
      ledger = {
        orderId: o.id,
        businessId: o.businessId,
        event: "due",
        isTrial: false,
        baseCents: o.commissionableCents,
        rateBps: o.commissionRateBps,
        amountCents: o.commissionCents,
      };
    } else if ((to === "cancelled" || to === "rejected") && o.commissionCents > 0) {
      patch.commissionStatus = "not_applicable";
      patch.commissionCents = 0;
      ledger = {
        orderId: o.id,
        businessId: o.businessId,
        event: "reversed",
        isTrial: false,
        baseCents: o.commissionableCents,
        rateBps: o.commissionRateBps,
        amountCents: -o.commissionCents,
        note: to === "rejected" ? "Απόρριψη παραγγελίας" : "Ακύρωση παραγγελίας",
      };
    }

    await tx.update(orders).set(patch).where(eq(orders.id, o.id));
    await tx.insert(orderEvents).values({
      orderId: o.id,
      fromStatus: o.status,
      toStatus: to,
      userId: actor.userId,
      note: note?.slice(0, 300) ?? null,
    });
    if (ledger) await tx.insert(commissionLedger).values(ledger);
  });
}
