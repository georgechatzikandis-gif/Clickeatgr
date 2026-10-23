"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/action-form";
import { db } from "@/db";
import {
  businessCategories,
  businesses,
  categories,
  commissionLedger,
  deliveryZones,
  orders,
  platformSettings,
  regions,
  sessions,
  users,
  type OrderStatus,
} from "@/db/schema";
import { bool, FormError, int, money, str, uuid } from "@/lib/form";
import { athensDate } from "@/lib/hours";
import { slugify } from "@/lib/validation";
import { AuthError, requireAdmin } from "@/server/auth";
import { ImageError } from "@/server/images";
import { OrderError, updateOrderStatus } from "@/server/orders";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/server/password";

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const ok = await fn();
    return { ok: ok || "Αποθηκεύτηκε." };
  } catch (e) {
    if (e instanceof FormError || e instanceof AuthError || e instanceof OrderError || e instanceof ImageError) {
      return { error: e.message };
    }
    const pg = (e as { cause?: { code?: string } }).cause ?? (e as { code?: string });
    if (pg?.code === "23505") return { error: "Υπάρχει ήδη εγγραφή με αυτό το όνομα / email / slug." };
    console.error(e);
    return { error: "Κάτι πήγε στραβά. Δοκιμάστε ξανά." };
  }
}

/** "2026-12-31" (Athens) → Date at the end of that day, or null for empty. */
function parseTrialEnd(fd: FormData): Date | null {
  const v = str(fd, "trialEndsAt", 10);
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new FormError("Μη έγκυρη ημερομηνία.");
  const [y, m, d] = v.split("-").map(Number);
  return athensDate(y, m, d + 1); // trial includes the whole selected day
}

function slugFrom(fd: FormData, fallbackName: string) {
  const s = slugify(str(fd, "slug", 60) || fallbackName);
  if (!s) throw new FormError("Μη έγκυρο slug (διεύθυνση σελίδας).");
  return s;
}

// ---------------------------------------------------------------- businesses

export async function createBusinessAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  let newId: string | null = null;
  const r = await run(async () => {
    await requireAdmin();
    const name = str(fd, "name", 100, true);
    const [b] = await db
      .insert(businesses)
      .values({ name, slug: slugFrom(fd, name), regionId: uuid(fd, "regionId"), status: "inactive" })
      .returning({ id: businesses.id });
    newId = b.id;
  });
  if (newId) redirect(`/admin/businesses/${newId}?created=1`);
  return r;
}

export async function updateBusinessAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const id = uuid(fd, "id");
    const name = str(fd, "name", 100, true);
    const status = str(fd, "status", 20);
    if (!["active", "inactive", "suspended"].includes(status)) throw new FormError("Μη έγκυρη κατάσταση.");
    const rateRaw = str(fd, "commissionRate", 10);
    let commissionRateBps: number | null = null;
    if (rateRaw) {
      const pct = Number(rateRaw.replace(",", "."));
      if (!Number.isFinite(pct) || pct < 0 || pct > 50) throw new FormError("Η προμήθεια πρέπει να είναι 0–50%.");
      commissionRateBps = Math.round(pct * 100);
    }
    const base = str(fd, "commissionBase", 30);
    const categoryIds = fd.getAll("categoryIds").map(String).filter((c) => /^[0-9a-f-]{36}$/.test(c));

    await db.transaction(async (tx) => {
      await tx
        .update(businesses)
        .set({
          name,
          slug: slugFrom(fd, name),
          regionId: uuid(fd, "regionId"),
          description: str(fd, "description", 500),
          phone: str(fd, "phone", 30),
          email: str(fd, "email", 120),
          address: str(fd, "address", 200),
          legalName: str(fd, "legalName", 150),
          vatNumber: str(fd, "vatNumber", 20),
          status: status as "active" | "inactive" | "suspended",
          isDemo: bool(fd, "isDemo"),
          trialEndsAt: parseTrialEnd(fd),
          commissionRateBps,
          commissionBase: base === "subtotal" || base === "subtotal_plus_delivery" ? base : null,
        })
        .where(eq(businesses.id, id));
      await tx.delete(businessCategories).where(eq(businessCategories.businessId, id));
      if (categoryIds.length) {
        await tx.insert(businessCategories).values(categoryIds.map((categoryId) => ({ businessId: id, categoryId })));
      }
    });
    revalidatePath("/admin/businesses");
    revalidatePath(`/admin/businesses/${id}`);
  });
}

/** Deletes a business that has never received an order; otherwise asks to deactivate instead. */
export async function deleteBusinessAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const r = await run(async () => {
    await requireAdmin();
    const id = uuid(fd, "id");
    const [o] = await db.select({ id: orders.id }).from(orders).where(eq(orders.businessId, id)).limit(1);
    if (o) throw new FormError("Το κατάστημα έχει παραγγελίες και δεν μπορεί να διαγραφεί. Ορίστε το ως «Ανενεργό».");
    await db.delete(businesses).where(eq(businesses.id, id));
  });
  if (r?.ok) redirect("/admin/businesses");
  return r;
}

export async function adminZoneAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const businessId = uuid(fd, "businessId");
    const id = fd.get("id") ? uuid(fd, "id") : null;
    if (id && fd.get("delete")) {
      await db.delete(deliveryZones).where(and(eq(deliveryZones.id, id), eq(deliveryZones.businessId, businessId)));
    } else {
      const values = {
        name: str(fd, "name", 80, true),
        feeCents: money(fd, "fee", 0),
        minOrderCents: money(fd, "minOrder", 0),
        active: id ? bool(fd, "active") : true,
      };
      if (id) await db.update(deliveryZones).set(values).where(and(eq(deliveryZones.id, id), eq(deliveryZones.businessId, businessId)));
      else await db.insert(deliveryZones).values({ ...values, businessId });
    }
    revalidatePath(`/admin/businesses/${businessId}`);
  });
}

// ---------------------------------------------------------------- users

export async function createStaffUserAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const role = fd.get("role") === "admin" ? "admin" : "business";
    const businessId = role === "business" ? uuid(fd, "businessId") : null;
    const email = str(fd, "email", 120, true).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new FormError("Μη έγκυρο email.");
    const password = String(fd.get("password") ?? "");
    if (password.length < PASSWORD_MIN_LENGTH) throw new FormError(`Ο κωδικός πρέπει να έχει τουλάχιστον ${PASSWORD_MIN_LENGTH} χαρακτήρες.`);
    await db.insert(users).values({
      email,
      name: str(fd, "name", 80),
      passwordHash: await hashPassword(password),
      role,
      businessId,
    });
    revalidatePath(businessId ? `/admin/businesses/${businessId}` : "/admin/settings");
    return `Ο λογαριασμός ${email} δημιουργήθηκε. Δώστε τον κωδικό στον χρήστη με ασφαλή τρόπο.`;
  });
}

export async function updateStaffUserAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await requireAdmin();
    const id = uuid(fd, "id");
    const password = String(fd.get("password") ?? "");
    const patch: Partial<typeof users.$inferInsert> = { active: bool(fd, "active") };
    if (id === me.id && !patch.active) throw new FormError("Δεν μπορείτε να απενεργοποιήσετε τον δικό σας λογαριασμό.");
    if (password) {
      if (password.length < PASSWORD_MIN_LENGTH) throw new FormError(`Ο κωδικός πρέπει να έχει τουλάχιστον ${PASSWORD_MIN_LENGTH} χαρακτήρες.`);
      patch.passwordHash = await hashPassword(password);
    }
    await db.update(users).set(patch).where(eq(users.id, id));
    // Log the user out everywhere when deactivated or the password changes.
    if (!patch.active || password) await db.delete(sessions).where(eq(sessions.userId, id));
    revalidatePath("/admin", "layout");
    return password ? "Ο κωδικός άλλαξε." : "Αποθηκεύτηκε.";
  });
}

// ---------------------------------------------------------------- categories & regions

export async function saveCategoryAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const id = fd.get("id") ? uuid(fd, "id") : null;
    const name = str(fd, "name", 40, true);
    const values = {
      name,
      icon: str(fd, "icon", 8) || "🍽️",
      sortOrder: int(fd, "sortOrder", 0, 999, 0),
      active: id ? bool(fd, "active") : true,
    };
    if (id) await db.update(categories).set(values).where(eq(categories.id, id));
    else await db.insert(categories).values({ ...values, slug: slugify(name) });
    revalidatePath("/admin/categories");
  });
}

export async function saveRegionAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const id = fd.get("id") ? uuid(fd, "id") : null;
    const name = str(fd, "name", 60, true);
    const values = { name, sortOrder: int(fd, "sortOrder", 0, 999, 0), active: id ? bool(fd, "active") : false };
    if (id) await db.update(regions).set(values).where(eq(regions.id, id));
    else await db.insert(regions).values({ ...values, slug: slugify(name) });
    revalidatePath("/admin/categories");
  });
}

// ---------------------------------------------------------------- orders & commission

export async function adminCancelOrderAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await requireAdmin();
    const reason = str(fd, "reason", 300) || "Ακύρωση από τον διαχειριστή";
    await updateOrderStatus(uuid(fd, "id"), "cancelled" as OrderStatus, { userId: me.id, role: "admin", businessId: null }, reason);
    revalidatePath("/admin/orders");
    return "Η παραγγελία ακυρώθηκε.";
  });
}

export async function savePlatformSettingsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const pct = Number(str(fd, "defaultRate", 10).replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) throw new FormError("Η προμήθεια πρέπει να είναι 0–50%.");
    const base = str(fd, "defaultBase", 30);
    await db
      .insert(platformSettings)
      .values({ id: 1 })
      .onConflictDoNothing();
    await db
      .update(platformSettings)
      .set({
        commissionEnabled: bool(fd, "commissionEnabled"),
        defaultCommissionRateBps: Math.round(pct * 100),
        defaultCommissionBase: base === "subtotal_plus_delivery" ? "subtotal_plus_delivery" : "subtotal",
      })
      .where(eq(platformSettings.id, 1));
    revalidatePath("/admin", "layout");
    return "Οι ρυθμίσεις προμήθειας αποθηκεύτηκαν. Ισχύουν μόνο για νέες παραγγελίες.";
  });
}

/** Marks all "due" commission of a business in a period as settled (after you have been paid). */
export async function settleCommissionAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const businessId = uuid(fd, "businessId");
    const [y, m] = str(fd, "month", 7, true).split("-").map(Number);
    if (!y || !m) throw new FormError("Μη έγκυρος μήνας.");
    const from = athensDate(y, m, 1);
    const to = athensDate(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1);
    const due = await db
      .select({ id: orders.id, base: orders.commissionableCents, rate: orders.commissionRateBps, amount: orders.commissionCents })
      .from(orders)
      .where(
        and(
          eq(orders.businessId, businessId),
          eq(orders.commissionStatus, "due"),
          sql`${orders.createdAt} >= ${from} and ${orders.createdAt} < ${to}`,
        ),
      );
    if (!due.length) throw new FormError("Δεν υπάρχει οφειλόμενη προμήθεια για αυτόν τον μήνα.");
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ commissionStatus: "settled" }).where(inArray(orders.id, due.map((d) => d.id)));
      await tx.insert(commissionLedger).values(
        due.map((d) => ({
          orderId: d.id,
          businessId,
          event: "settled",
          isTrial: false,
          baseCents: d.base,
          rateBps: d.rate,
          amountCents: d.amount,
          note: `Εξόφληση ${str(fd, "month", 7)}`,
        })),
      );
    });
    revalidatePath("/admin/reports");
    return `Σημειώθηκαν ως εξοφλημένες ${due.length} παραγγελίες.`;
  });
}
