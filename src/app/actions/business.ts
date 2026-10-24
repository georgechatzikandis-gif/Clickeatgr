"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/action-form";
import { db } from "@/db";
import {
  businessHours,
  businesses,
  deliveryZones,
  menuCategories,
  optionGroups,
  options,
  orderStatus,
  products,
  type OrderStatus,
} from "@/db/schema";
import { bool, file, FormError, int, money, str, uuid } from "@/lib/form";
import { AuthError, requireBusinessUser } from "@/server/auth";
import {
  ownedGroupProduct,
  ownedOptionProduct,
  ownsMenuCategory,
  ownsProduct,
} from "@/server/business-data";
import { ImageError, storeImage } from "@/server/images";
import { delayOrder, OrderError, updateOrderStatus } from "@/server/orders";

/** Runs a mutation and turns expected errors into a message for the form. */
async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const ok = await fn();
    return { ok: ok || "Αποθηκεύτηκε." };
  } catch (e) {
    if (e instanceof FormError || e instanceof AuthError || e instanceof OrderError || e instanceof ImageError) {
      return { error: e.message };
    }
    console.error(e);
    return { error: "Κάτι πήγε στραβά. Δοκιμάστε ξανά." };
  }
}

// ---------------------------------------------------------------- orders

export async function setOrderStatusAction(
  orderId: string,
  to: OrderStatus,
  note?: string,
  estimatedMinutes?: number,
): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    if (!orderStatus.enumValues.includes(to)) throw new FormError("Μη έγκυρη κατάσταση.");
    await updateOrderStatus(orderId, to, { userId: u.id, role: "business", businessId: u.businessId }, note?.slice(0, 300), {
      estimatedMinutes,
    });
    revalidatePath("/dashboard");
    return "Ενημερώθηκε.";
  });
}

export async function delayOrderAction(orderId: string, minutes: number): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    await delayOrder(orderId, minutes, { userId: u.id, role: "business", businessId: u.businessId });
    revalidatePath("/dashboard");
    return "Ο πελάτης βλέπει τη νέα ώρα.";
  });
}

// ---------------------------------------------------------------- menu categories

export async function saveMenuCategoryAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    const name = str(fd, "name", 60, true);
    const sortOrder = int(fd, "sortOrder", 0, 999, 0);
    const id = fd.get("id") ? uuid(fd, "id") : null;
    if (id) {
      if (!(await ownsMenuCategory(u.businessId, id))) throw new FormError("Δεν βρέθηκε.");
      await db
        .update(menuCategories)
        .set({ name, sortOrder, active: bool(fd, "active") })
        .where(and(eq(menuCategories.id, id), eq(menuCategories.businessId, u.businessId)));
    } else {
      await db.insert(menuCategories).values({ businessId: u.businessId, name, sortOrder });
    }
    revalidatePath("/dashboard/menu");
  });
}

export async function deleteMenuCategoryAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    const id = uuid(fd, "id");
    // Products in the category are kept and appear under "Άλλα".
    await db.delete(menuCategories).where(and(eq(menuCategories.id, id), eq(menuCategories.businessId, u.businessId)));
    revalidatePath("/dashboard/menu");
    return "Η κατηγορία διαγράφηκε.";
  });
}

// ---------------------------------------------------------------- products

export async function saveProductAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    const u = await requireBusinessUser();
    const id = fd.get("id") ? uuid(fd, "id") : null;
    if (id && !(await ownsProduct(u.businessId, id))) throw new FormError("Δεν βρέθηκε.");
    const menuCategoryId = fd.get("menuCategoryId") ? uuid(fd, "menuCategoryId") : null;
    if (menuCategoryId && !(await ownsMenuCategory(u.businessId, menuCategoryId))) throw new FormError("Μη έγκυρη κατηγορία.");
    const values = {
      name: str(fd, "name", 100, true),
      description: str(fd, "description", 500),
      allergens: str(fd, "allergens", 200),
      priceCents: money(fd, "price"),
      menuCategoryId,
      sortOrder: int(fd, "sortOrder", 0, 999, 0),
      isAvailable: bool(fd, "isAvailable"),
    };
    const img = file(fd, "image");
    const imageId = img ? await storeImage(img, u.businessId) : undefined;
    const removeImage = bool(fd, "removeImage");
    if (id) {
      await db
        .update(products)
        .set({ ...values, ...(imageId ? { imageId } : removeImage ? { imageId: null } : {}) })
        .where(and(eq(products.id, id), eq(products.businessId, u.businessId)));
    } else {
      const [p] = await db
        .insert(products)
        .values({ ...values, businessId: u.businessId, imageId: imageId ?? null })
        .returning({ id: products.id });
      return `created:${p.id}`;
    }
    revalidatePath("/dashboard/menu");
  });
  // After creating a product, continue on its edit page so options can be added.
  if (result?.ok?.startsWith("created:")) redirect(`/dashboard/menu/${result.ok.slice(8)}?created=1`);
  return result;
}

export async function toggleProductAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    const id = uuid(fd, "id");
    await db
      .update(products)
      .set({ isAvailable: bool(fd, "isAvailable") })
      .where(and(eq(products.id, id), eq(products.businessId, u.businessId)));
    revalidatePath("/dashboard/menu");
  });
}

export async function deleteProductAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const r = await run(async () => {
    const u = await requireBusinessUser();
    const id = uuid(fd, "id");
    // Soft delete: past orders keep their snapshot, and the product disappears from the menu.
    await db
      .update(products)
      .set({ deletedAt: new Date(), isAvailable: false })
      .where(and(eq(products.id, id), eq(products.businessId, u.businessId)));
    revalidatePath("/dashboard/menu");
  });
  if (r?.ok) redirect("/dashboard/menu");
  return r;
}

export async function addOptionGroupAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    const productId = uuid(fd, "productId");
    if (!(await ownsProduct(u.businessId, productId))) throw new FormError("Δεν βρέθηκε.");
    const minSelect = int(fd, "minSelect", 0, 20, 0);
    const maxSelect = int(fd, "maxSelect", 1, 20, 1);
    if (minSelect > maxSelect) throw new FormError("Το ελάχιστο δεν μπορεί να είναι μεγαλύτερο από το μέγιστο.");
    await db.insert(optionGroups).values({
      productId,
      name: str(fd, "name", 60, true),
      minSelect,
      maxSelect,
      sortOrder: int(fd, "sortOrder", 0, 999, 0),
    });
    revalidatePath(`/dashboard/menu/${productId}`);
    return "Η ομάδα επιλογών προστέθηκε.";
  });
}

export async function deleteOptionGroupAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    const id = uuid(fd, "id");
    const productId = await ownedGroupProduct(u.businessId, id);
    if (!productId) throw new FormError("Δεν βρέθηκε.");
    await db.delete(optionGroups).where(eq(optionGroups.id, id));
    revalidatePath(`/dashboard/menu/${productId}`);
    return "Διαγράφηκε.";
  });
}

export async function addOptionAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    const groupId = uuid(fd, "groupId");
    const productId = await ownedGroupProduct(u.businessId, groupId);
    if (!productId) throw new FormError("Δεν βρέθηκε.");
    await db.insert(options).values({
      groupId,
      name: str(fd, "name", 60, true),
      priceDeltaCents: money(fd, "price", 0),
      sortOrder: int(fd, "sortOrder", 0, 999, 0),
    });
    revalidatePath(`/dashboard/menu/${productId}`);
    return "Η επιλογή προστέθηκε.";
  });
}

export async function updateOptionAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    const id = uuid(fd, "id");
    const productId = await ownedOptionProduct(u.businessId, id);
    if (!productId) throw new FormError("Δεν βρέθηκε.");
    if (fd.get("delete")) {
      await db.delete(options).where(eq(options.id, id));
    } else {
      await db
        .update(options)
        .set({ name: str(fd, "name", 60, true), priceDeltaCents: money(fd, "price", 0), isAvailable: bool(fd, "isAvailable") })
        .where(eq(options.id, id));
    }
    revalidatePath(`/dashboard/menu/${productId}`);
  });
}

// ---------------------------------------------------------------- business settings

export async function saveProfileAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    await db
      .update(businesses)
      .set({
        description: str(fd, "description", 500),
        phone: str(fd, "phone", 30),
        email: str(fd, "email", 120),
        address: str(fd, "address", 200),
        prepTimeMinutes: int(fd, "prepTimeMinutes", 0, 240),
        deliveryTimeMinutes: int(fd, "deliveryTimeMinutes", 0, 240),
        acceptsDelivery: bool(fd, "acceptsDelivery"),
        acceptsPickup: bool(fd, "acceptsPickup"),
        pickupMinOrderCents: money(fd, "pickupMinOrder", 0),
      })
      .where(eq(businesses.id, u.businessId));
    revalidatePath("/dashboard/settings");
  });
}

export async function setTemporarilyClosedAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    const closed = bool(fd, "closed");
    await db.update(businesses).set({ temporarilyClosed: closed }).where(eq(businesses.id, u.businessId));
    revalidatePath("/dashboard", "layout");
    return closed ? "Το κατάστημα εμφανίζεται κλειστό." : "Το κατάστημα δέχεται ξανά παραγγελίες.";
  });
}

export async function uploadBusinessImageAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    const kind = fd.get("kind") === "cover" ? "coverImageId" : "logoImageId";
    const img = file(fd, "image");
    if (!img) throw new FormError("Επιλέξτε εικόνα.");
    const id = await storeImage(img, u.businessId);
    await db.update(businesses).set({ [kind]: id }).where(eq(businesses.id, u.businessId));
    revalidatePath("/dashboard/settings");
    return "Η εικόνα ανέβηκε.";
  });
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Replaces all opening hours. Each weekday has up to two ranges: h{day}_{n}_open / _close. */
export async function saveHoursAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    const rows: { businessId: string; weekday: number; opensAt: string; closesAt: string }[] = [];
    for (let d = 0; d < 7; d++) {
      for (let n = 0; n < 2; n++) {
        const o = str(fd, `h${d}_${n}_open`, 5);
        const c = str(fd, `h${d}_${n}_close`, 5);
        if (!o && !c) continue;
        if (!TIME.test(o) || !TIME.test(c)) throw new FormError("Συμπληρώστε ώρες στη μορφή ΩΩ:ΛΛ.");
        rows.push({ businessId: u.businessId, weekday: d, opensAt: o, closesAt: c });
      }
    }
    await db.transaction(async (tx) => {
      await tx.delete(businessHours).where(eq(businessHours.businessId, u.businessId));
      if (rows.length) await tx.insert(businessHours).values(rows);
    });
    revalidatePath("/dashboard/settings");
    return "Το ωράριο αποθηκεύτηκε.";
  });
}

export async function saveZoneAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await requireBusinessUser();
    const id = fd.get("id") ? uuid(fd, "id") : null;
    if (id && fd.get("delete")) {
      await db.delete(deliveryZones).where(and(eq(deliveryZones.id, id), eq(deliveryZones.businessId, u.businessId)));
      revalidatePath("/dashboard/settings");
      return "Η περιοχή διαγράφηκε.";
    }
    const values = {
      name: str(fd, "name", 80, true),
      feeCents: money(fd, "fee", 0),
      minOrderCents: money(fd, "minOrder", 0),
      active: id ? bool(fd, "active") : true,
      sortOrder: int(fd, "sortOrder", 0, 999, 0),
    };
    if (id) {
      await db
        .update(deliveryZones)
        .set(values)
        .where(and(eq(deliveryZones.id, id), eq(deliveryZones.businessId, u.businessId)));
    } else {
      await db.insert(deliveryZones).values({ ...values, businessId: u.businessId });
    }
    revalidatePath("/dashboard/settings");
  });
}
