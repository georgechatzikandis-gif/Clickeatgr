import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  businessCategories,
  businessHours,
  businesses,
  categories,
  deliveryZones,
  menuCategories,
  optionGroups,
  options,
  products,
  regions,
} from "@/db/schema";
import { isOpenAt, type HoursRange } from "@/lib/hours";

export type BusinessCard = {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoImageId: string | null;
  coverImageId: string | null;
  isDemo: boolean;
  isOpen: boolean;
  temporarilyClosed: boolean;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  prepTimeMinutes: number;
  deliveryTimeMinutes: number;
  minDeliveryFeeCents: number | null;
  minOrderCents: number | null;
  categorySlugs: string[];
  categoryNames: string[];
  hours: HoursRange[];
};

export async function listRegions() {
  return db.select().from(regions).where(eq(regions.active, true)).orderBy(asc(regions.sortOrder));
}

export async function listCategories() {
  return db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sortOrder));
}

/** Public list of active businesses in a region. */
export async function listBusinessCards(regionSlug: string, now = new Date()): Promise<BusinessCard[]> {
  const rows = await db
    .select({ b: businesses })
    .from(businesses)
    .innerJoin(regions, eq(regions.id, businesses.regionId))
    .where(and(eq(businesses.status, "active"), eq(regions.slug, regionSlug)))
    .orderBy(asc(businesses.name));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.b.id);
  const [hours, zones, cats] = await Promise.all([
    db.select().from(businessHours).where(inArray(businessHours.businessId, ids)),
    db
      .select()
      .from(deliveryZones)
      .where(and(inArray(deliveryZones.businessId, ids), eq(deliveryZones.active, true))),
    db
      .select({ businessId: businessCategories.businessId, slug: categories.slug, name: categories.name })
      .from(businessCategories)
      .innerJoin(categories, eq(categories.id, businessCategories.categoryId))
      .where(inArray(businessCategories.businessId, ids)),
  ]);
  const cards = rows.map(({ b }) => {
    const h = hours.filter((x) => x.businessId === b.id);
    const z = zones.filter((x) => x.businessId === b.id);
    const c = cats.filter((x) => x.businessId === b.id);
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      logoImageId: b.logoImageId,
      coverImageId: b.coverImageId,
      isDemo: b.isDemo,
      isOpen: !b.temporarilyClosed && isOpenAt(h, now),
      temporarilyClosed: b.temporarilyClosed,
      acceptsDelivery: b.acceptsDelivery && z.length > 0,
      acceptsPickup: b.acceptsPickup,
      prepTimeMinutes: b.prepTimeMinutes,
      deliveryTimeMinutes: b.deliveryTimeMinutes,
      minDeliveryFeeCents: z.length ? Math.min(...z.map((x) => x.feeCents)) : null,
      minOrderCents: z.length ? Math.min(...z.map((x) => x.minOrderCents)) : null,
      categorySlugs: c.map((x) => x.slug),
      categoryNames: c.map((x) => x.name),
      hours: h,
    };
  });
  // Open businesses first.
  return cards.sort((a, b) => Number(b.isOpen) - Number(a.isOpen));
}

export type PublicMenuProduct = {
  id: string;
  name: string;
  description: string;
  allergens: string;
  priceCents: number;
  imageId: string | null;
  isAvailable: boolean;
  groups: {
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    options: { id: string; name: string; priceDeltaCents: number; isAvailable: boolean }[];
  }[];
};

/** Everything needed to render a business page. Returns null for unknown or non-active businesses. */
export async function getBusinessPage(slug: string, now = new Date()) {
  const [b] = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (!b || b.status !== "active") return null;
  const [hours, zones, mcats, prods] = await Promise.all([
    db.select().from(businessHours).where(eq(businessHours.businessId, b.id)),
    db
      .select()
      .from(deliveryZones)
      .where(and(eq(deliveryZones.businessId, b.id), eq(deliveryZones.active, true)))
      .orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.name)),
    db
      .select()
      .from(menuCategories)
      .where(and(eq(menuCategories.businessId, b.id), eq(menuCategories.active, true)))
      .orderBy(asc(menuCategories.sortOrder)),
    db
      .select()
      .from(products)
      .where(and(eq(products.businessId, b.id), isNull(products.deletedAt)))
      .orderBy(asc(products.sortOrder), asc(products.name)),
  ]);
  const groups = await loadGroups(prods.map((p) => p.id));
  const menuProducts = prods.map(
    (p): PublicMenuProduct & { menuCategoryId: string | null } => ({
      id: p.id,
      name: p.name,
      description: p.description,
      allergens: p.allergens,
      priceCents: p.priceCents,
      imageId: p.imageId,
      isAvailable: p.isAvailable,
      menuCategoryId: p.menuCategoryId,
      groups: groups.get(p.id) ?? [],
    }),
  );
  const sections = mcats
    .map((c) => ({ id: c.id, name: c.name, products: menuProducts.filter((p) => p.menuCategoryId === c.id) }))
    .filter((s) => s.products.length);
  const uncategorised = menuProducts.filter(
    (p) => !p.menuCategoryId || !mcats.some((c) => c.id === p.menuCategoryId),
  );
  if (uncategorised.length) sections.push({ id: "other", name: "Άλλα", products: uncategorised });

  return {
    business: b,
    hours,
    zones,
    sections,
    isOpen: !b.temporarilyClosed && isOpenAt(hours, now),
    acceptsDelivery: b.acceptsDelivery && zones.length > 0,
  };
}

export async function loadGroups(productIds: string[]) {
  const map = new Map<string, PublicMenuProduct["groups"]>();
  if (!productIds.length) return map;
  const gs = await db
    .select()
    .from(optionGroups)
    .where(inArray(optionGroups.productId, productIds))
    .orderBy(asc(optionGroups.sortOrder));
  const os = gs.length
    ? await db
        .select()
        .from(options)
        .where(
          inArray(
            options.groupId,
            gs.map((g) => g.id),
          ),
        )
        .orderBy(asc(options.sortOrder))
    : [];
  for (const g of gs) {
    const list = map.get(g.productId) ?? [];
    list.push({
      id: g.id,
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      options: os
        .filter((o) => o.groupId === g.id)
        .map((o) => ({ id: o.id, name: o.name, priceDeltaCents: o.priceDeltaCents, isAvailable: o.isAvailable })),
    });
    map.set(g.productId, list);
  }
  return map;
}
