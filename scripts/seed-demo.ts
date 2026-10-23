// DEMO data for local development and testing ONLY. Every demo business is flagged is_demo
// and named "ΔΟΚΙΜΗ" so it cannot be mistaken for a real partner. Refuses to run in production.
//   pnpm db:seed:demo
import { eq, inArray } from "drizzle-orm";
import { hashPassword } from "../src/server/password";
import { client, db, schema } from "./_db";
import { seedBase } from "./seed-base";

export const DEMO_PASSWORD = "demo-password-123";

type DemoProduct = {
  name: string;
  description?: string;
  allergens?: string;
  price: number;
  groups?: { name: string; min: number; max: number; options: [string, number][] }[];
};

const DEMO: {
  slug: string;
  name: string;
  description: string;
  categories: string[];
  email: string;
  menu: Record<string, DemoProduct[]>;
}[] = [
  {
    slug: "demo-souvlaki",
    name: "ΔΟΚΙΜΗ – Σουβλατζίδικο",
    description: "Δοκιμαστικό κατάστημα για έλεγχο της πλατφόρμας.",
    categories: ["souvlaki", "gyros"],
    email: "souvlaki@demo.clickeat.local",
    menu: {
      "Τυλιχτά": [
        {
          name: "Πίτα γύρος χοιρινός",
          description: "Ντομάτα, κρεμμύδι, τζατζίκι, πατάτες",
          allergens: "Γλουτένη, γάλα",
          price: 3.8,
          groups: [
            { name: "Χωρίς", min: 0, max: 4, options: [["Χωρίς κρεμμύδι", 0], ["Χωρίς ντομάτα", 0], ["Χωρίς τζατζίκι", 0], ["Χωρίς πατάτες", 0]] },
            { name: "Έξτρα", min: 0, max: 3, options: [["Έξτρα κρέας", 1.2], ["Τυρί", 0.5], ["Μουστάρδα", 0]] },
          ],
        },
        { name: "Πίτα καλαμάκι κοτόπουλο", description: "Ντομάτα, μαρούλι, σως", allergens: "Γλουτένη, αυγό", price: 3.9 },
      ],
      "Μερίδες": [
        {
          name: "Μερίδα γύρος",
          description: "Με πατάτες, πίτα και σαλάτα",
          allergens: "Γλουτένη, γάλα",
          price: 11.5,
          groups: [{ name: "Κρέας", min: 1, max: 1, options: [["Χοιρινός", 0], ["Κοτόπουλο", 0.5]] }],
        },
      ],
      "Ποτά": [{ name: "Αναψυκτικό 330ml", price: 1.8 }],
    },
  },
  {
    slug: "demo-pizza",
    name: "ΔΟΚΙΜΗ – Πιτσαρία",
    description: "Δοκιμαστικό κατάστημα για έλεγχο της πλατφόρμας.",
    categories: ["pizza"],
    email: "pizza@demo.clickeat.local",
    menu: {
      "Πίτσες": [
        {
          name: "Μαργαρίτα",
          description: "Σάλτσα ντομάτας, μοτσαρέλα, βασιλικός",
          allergens: "Γλουτένη, γάλα",
          price: 9,
          groups: [
            { name: "Μέγεθος", min: 1, max: 1, options: [["Μεσαία", 0], ["Μεγάλη", 3]] },
            { name: "Υλικά", min: 0, max: 5, options: [["Μανιτάρια", 0.8], ["Πιπεριά", 0.6], ["Μπέικον", 1.2]] },
          ],
        },
        {
          name: "Σπέσιαλ",
          description: "Ζαμπόν, μπέικον, πιπεριά, μανιτάρια",
          allergens: "Γλουτένη, γάλα",
          price: 12,
          groups: [{ name: "Μέγεθος", min: 1, max: 1, options: [["Μεσαία", 0], ["Μεγάλη", 3.5]] }],
        },
      ],
      "Σαλάτες": [{ name: "Χωριάτικη", allergens: "Γάλα", price: 7.5 }],
    },
  },
  {
    slug: "demo-cafe",
    name: "ΔΟΚΙΜΗ – Καφέ",
    description: "Δοκιμαστικό κατάστημα για έλεγχο της πλατφόρμας.",
    categories: ["kafes", "glyka"],
    email: "cafe@demo.clickeat.local",
    menu: {
      "Καφέδες": [
        {
          name: "Freddo espresso",
          price: 2.5,
          groups: [{ name: "Ζάχαρη", min: 1, max: 1, options: [["Σκέτος", 0], ["Μέτριος", 0], ["Γλυκός", 0]] }],
        },
        {
          name: "Freddo cappuccino",
          allergens: "Γάλα",
          price: 3,
          groups: [
            { name: "Ζάχαρη", min: 1, max: 1, options: [["Σκέτος", 0], ["Μέτριος", 0], ["Γλυκός", 0]] },
            { name: "Γάλα", min: 0, max: 1, options: [["Φυτικό γάλα", 0.5]] },
          ],
        },
      ],
      "Γλυκά": [{ name: "Πορτοκαλόπιτα", allergens: "Γλουτένη, αυγό, γάλα", price: 4 }],
    },
  },
];

const cents = (euros: number) => Math.round(euros * 100);

export async function seedDemo() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    throw new Error("Refusing to seed demo data in production.");
  }
  await seedBase();
  const [region] = await db.select().from(schema.regions).where(eq(schema.regions.slug, "rodos"));
  const cats = await db.select().from(schema.categories);

  // Re-create demo businesses from scratch (orders of demo businesses are removed too).
  const old = await db
    .select({ id: schema.businesses.id })
    .from(schema.businesses)
    .where(eq(schema.businesses.isDemo, true));
  if (old.length) {
    const ids = old.map((o) => o.id);
    await db.delete(schema.commissionLedger).where(inArray(schema.commissionLedger.businessId, ids));
    await db.delete(schema.orders).where(inArray(schema.orders.businessId, ids));
    await db.delete(schema.businesses).where(inArray(schema.businesses.id, ids));
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const d of DEMO) {
    const [b] = await db
      .insert(schema.businesses)
      .values({
        slug: d.slug,
        name: d.name,
        description: d.description,
        regionId: region.id,
        phone: "+302241000000",
        address: "Δοκιμαστική διεύθυνση, Ρόδος",
        isDemo: true,
        prepTimeMinutes: 20,
        deliveryTimeMinutes: 30,
      })
      .returning();
    await db.insert(schema.businessCategories).values(
      d.categories.map((slug) => ({ businessId: b.id, categoryId: cats.find((c) => c.slug === slug)!.id })),
    );
    // Open 24/7 so demo orders can be tested at any time.
    await db
      .insert(schema.businessHours)
      .values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ businessId: b.id, weekday, opensAt: "00:00", closesAt: "00:00" })));
    await db.insert(schema.deliveryZones).values([
      { businessId: b.id, name: "Ρόδος – Πόλη", feeCents: 100, minOrderCents: 800, sortOrder: 0 },
      { businessId: b.id, name: "Ιξιά / Ιαλυσός", feeCents: 200, minOrderCents: 1200, sortOrder: 1 },
      { businessId: b.id, name: "Φαληράκι", feeCents: 300, minOrderCents: 1500, sortOrder: 2 },
    ]);
    let sort = 0;
    for (const [catName, items] of Object.entries(d.menu)) {
      const [mc] = await db
        .insert(schema.menuCategories)
        .values({ businessId: b.id, name: catName, sortOrder: sort++ })
        .returning();
      for (const [i, p] of items.entries()) {
        const [prod] = await db
          .insert(schema.products)
          .values({
            businessId: b.id,
            menuCategoryId: mc.id,
            name: p.name,
            description: p.description ?? "",
            allergens: p.allergens ?? "",
            priceCents: cents(p.price),
            sortOrder: i,
          })
          .returning();
        for (const [gi, g] of (p.groups ?? []).entries()) {
          const [grp] = await db
            .insert(schema.optionGroups)
            .values({ productId: prod.id, name: g.name, minSelect: g.min, maxSelect: g.max, sortOrder: gi })
            .returning();
          await db.insert(schema.options).values(
            g.options.map(([name, price], oi) => ({ groupId: grp.id, name, priceDeltaCents: cents(price), sortOrder: oi })),
          );
        }
      }
    }
    await db
      .insert(schema.users)
      .values({ email: d.email, name: d.name, passwordHash, role: "business", businessId: b.id });
  }
  await db.delete(schema.users).where(eq(schema.users.email, "admin@demo.clickeat.local"));
  await db
    .insert(schema.users)
    .values({ email: "admin@demo.clickeat.local", name: "Demo Admin", passwordHash, role: "admin" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo()
    .then(() => {
      console.log("Demo data ready. Logins (password: " + DEMO_PASSWORD + "):");
      console.log("  admin@demo.clickeat.local");
      for (const d of DEMO) console.log("  " + d.email);
    })
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => client.end());
}
