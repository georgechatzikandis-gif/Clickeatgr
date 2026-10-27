// TEST shops for trying the platform on the LIVE site before launch. All are flagged is_demo (shown with a
// "ΔΟΚΙΜΑΣΤΙΚΟ" badge), named "ΔΟΚΙΜΗ – …", open 24/7, and use slugs starting with "test-".
//   pnpm db:seed:test-shops            add the shops that don't exist yet (safe to run again)
//   pnpm db:seed:test-shops --remove   delete all of them, including their (fake) orders
// The set: 4 coffee shops, 3 pizzerias, 3 sushi bars (logins numbered in this order).
// Shop logins: test1@clickeat.test … test10@clickeat.test, password from TEST_SHOP_PASSWORD (if set).
import { and, eq, inArray, like } from "drizzle-orm";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../src/server/password";
import { client, db, schema } from "./_db";
import { seedBase } from "./seed-base";

type Product = {
  name: string;
  description?: string;
  allergens?: string;
  price: number;
  groups?: { name: string; min: number; max: number; options: [string, number][] }[];
};
type Shop = {
  slug: string;
  name: string;
  description: string;
  address: string;
  categories: string[];
  prep: number;
  delivery: number;
  zones: [string, number, number][]; // name, fee €, minimum €
  menu: Record<string, Product[]>;
};

const SIZE: Product["groups"] = [{ name: "Μέγεθος", min: 1, max: 1, options: [["Κανονικό", 0], ["Μεγάλο", 1.5]] }];
const SUGAR: NonNullable<Product["groups"]> = [{ name: "Ζάχαρη", min: 1, max: 1, options: [["Σκέτος", 0], ["Μέτριος", 0], ["Γλυκός", 0]] }];
const MILK: NonNullable<Product["groups"]> = [{ name: "Γάλα", min: 0, max: 1, options: [["Φυτικό γάλα", 0.5], ["Χωρίς λακτόζη", 0.3]] }];
const PIZZA_SIZE: NonNullable<Product["groups"]> = [{ name: "Μέγεθος", min: 1, max: 1, options: [["Μεσαία", 0], ["Μεγάλη", 3]] }];
const PIZZA_EXTRAS: NonNullable<Product["groups"]> = [
  { name: "Έξτρα υλικά", min: 0, max: 5, options: [["Μανιτάρια", 0.8], ["Πιπεριά", 0.6], ["Μπέικον", 1.2], ["Ελιές", 0.6]] },
];

export const TEST_SHOPS: Shop[] = [
  // ---------------------------------------------------------------- coffee (4)
  {
    slug: "test-cafe-akti",
    name: "ΔΟΚΙΜΗ – Καφέ Ακτή",
    description: "Specialty καφές δίπλα στη θάλασσα.",
    address: "Ακτή Μιαούλη, Ρόδος",
    categories: ["kafes"],
    prep: 10,
    delivery: 15,
    zones: [["Ρόδος – Πόλη", 0.5, 4], ["Ιξιά", 1, 6]],
    menu: {
      Καφέδες: [
        { name: "Freddo espresso", price: 2.5, groups: SUGAR },
        { name: "Freddo cappuccino", allergens: "Γάλα", price: 3, groups: [...SUGAR, ...MILK] },
        { name: "Cappuccino ζεστό", allergens: "Γάλα", price: 2.8, groups: [...SUGAR, ...MILK] },
        { name: "Ελληνικός", price: 2, groups: SUGAR },
      ],
      Σνακ: [
        { name: "Τοστ γαλοπούλα-τυρί", allergens: "Γλουτένη, γάλα", price: 3 },
        { name: "Κρουασάν βουτύρου", allergens: "Γλουτένη, γάλα, αυγό", price: 2.2 },
      ],
    },
  },
  {
    slug: "test-cafe-kremasti",
    name: "ΔΟΚΙΜΗ – Coffee Lab Κρεμαστή",
    description: "Καφές για το δρόμο, smoothies και brunch.",
    address: "Κρεμαστή, Ρόδος",
    categories: ["kafes"],
    prep: 10,
    delivery: 15,
    zones: [["Κρεμαστή", 0.5, 4], ["Παραδείσι", 1.5, 6], ["Ιαλυσός", 1.5, 6]],
    menu: {
      Καφέδες: [
        { name: "Freddo espresso", price: 2.3, groups: SUGAR },
        { name: "Flat white", allergens: "Γάλα", price: 3.2, groups: MILK },
        { name: "Iced latte καραμέλα", allergens: "Γάλα", price: 3.8, groups: MILK },
      ],
      Smoothies: [{ name: "Smoothie φράουλα-μπανάνα", allergens: "Γάλα", price: 4.5 }],
      Brunch: [{ name: "Pancakes με μέλι", allergens: "Γλουτένη, γάλα, αυγό", price: 6.5 }],
    },
  },
  {
    slug: "test-cafe-faliraki",
    name: "ΔΟΚΙΜΗ – Beans & Waves Φαληράκι",
    description: "Καφέδες, φρέσκοι χυμοί και γλυκά.",
    address: "Φαληράκι, Ρόδος",
    categories: ["kafes", "glyka"],
    prep: 10,
    delivery: 15,
    zones: [["Φαληράκι", 0.5, 4], ["Κοσκινού", 1.5, 6], ["Αφάντου", 2, 8]],
    menu: {
      Καφέδες: [
        { name: "Freddo espresso", price: 2.5, groups: SUGAR },
        { name: "Frappé", allergens: "Γάλα", price: 2.5, groups: [...SUGAR, ...MILK] },
      ],
      Χυμοί: [{ name: "Χυμός πορτοκάλι φρέσκος", price: 3.5, groups: SIZE }],
      Γλυκά: [{ name: "Cheesecake φράουλα", allergens: "Γλουτένη, γάλα, αυγό", price: 4.5 }],
    },
  },
  {
    slug: "test-cafe-ialysos",
    name: "ΔΟΚΙΜΗ – Το Καφενείο της Ιαλυσού",
    description: "Παραδοσιακός καφές, τσάι και σπιτικές πίτες.",
    address: "Ιαλυσός, Ρόδος",
    categories: ["kafes", "snacks"],
    prep: 10,
    delivery: 20,
    zones: [["Ιαλυσός", 0.5, 4], ["Κρεμαστή", 1, 5], ["Ιξιά", 1.5, 6]],
    menu: {
      Καφέδες: [
        { name: "Ελληνικός διπλός", price: 2.5, groups: SUGAR },
        { name: "Φίλτρου", allergens: "", price: 2.2, groups: MILK },
      ],
      Ροφήματα: [{ name: "Τσάι του βουνού", price: 2, groups: [{ name: "Μέλι", min: 0, max: 1, options: [["Με μέλι", 0.3]] }] }],
      Πίτες: [
        { name: "Τυρόπιτα σπιτική", allergens: "Γλουτένη, γάλα, αυγό", price: 2.5 },
        { name: "Σπανακόπιτα σπιτική", allergens: "Γλουτένη, γάλα", price: 2.5 },
      ],
    },
  },
  // ---------------------------------------------------------------- pizza (3)
  {
    slug: "test-pizza-rodini",
    name: "ΔΟΚΙΜΗ – Pizza Rodini",
    description: "Πίτσες σε ξυλόφουρνο.",
    address: "Ροδίνι, Ρόδος",
    categories: ["pizza"],
    prep: 20,
    delivery: 25,
    zones: [["Ρόδος – Πόλη", 1.5, 10], ["Ιξιά", 2, 12]],
    menu: {
      Πίτσες: [
        { name: "Μαργαρίτα", description: "Σάλτσα ντομάτας, μοτσαρέλα, βασιλικός", allergens: "Γλουτένη, γάλα", price: 9, groups: [...PIZZA_SIZE, ...PIZZA_EXTRAS] },
        { name: "Σπέσιαλ", description: "Ζαμπόν, μπέικον, πιπεριά, μανιτάρια", allergens: "Γλουτένη, γάλα", price: 12, groups: PIZZA_SIZE },
        { name: "Πεπερόνι", description: "Σάλτσα, μοτσαρέλα, πεπερόνι", allergens: "Γλουτένη, γάλα", price: 11, groups: PIZZA_SIZE },
      ],
      Σαλάτες: [{ name: "Χωριάτικη", allergens: "Γάλα", price: 7.5 }],
      Ποτά: [{ name: "Αναψυκτικό 330ml", price: 1.8 }],
    },
  },
  {
    slug: "test-pizza-napoli",
    name: "ΔΟΚΙΜΗ – Napoli Express",
    description: "Ναπολιτάνικη πίτσα με προζύμι 48 ωρών.",
    address: "Ιξιά, Ρόδος",
    categories: ["pizza"],
    prep: 15,
    delivery: 25,
    zones: [["Ιξιά", 1, 10], ["Ιαλυσός", 1.5, 10], ["Ρόδος – Πόλη", 2, 12]],
    menu: {
      "Ναπολιτάνικες": [
        { name: "Marinara", description: "Ντομάτα San Marzano, σκόρδο, ρίγανη", allergens: "Γλουτένη", price: 8 },
        { name: "Diavola", description: "Μοτσαρέλα, πικάντικο σαλάμι", allergens: "Γλουτένη, γάλα", price: 11.5, groups: PIZZA_EXTRAS },
        { name: "Quattro formaggi", description: "Τέσσερα τυριά", allergens: "Γλουτένη, γάλα", price: 12.5 },
      ],
      Ορεκτικά: [{ name: "Σκορδόψωμο με μοτσαρέλα", allergens: "Γλουτένη, γάλα", price: 4.5 }],
    },
  },
  {
    slug: "test-pizza-kremasti",
    name: "ΔΟΚΙΜΗ – Πιτσαρία ο Φούρνος της Κρεμαστής",
    description: "Οικογενειακές πίτσες και μακαρονάδες.",
    address: "Κρεμαστή, Ρόδος",
    categories: ["pizza"],
    prep: 20,
    delivery: 20,
    zones: [["Κρεμαστή", 1, 8], ["Παραδείσι", 2, 10], ["Θεολόγος", 2.5, 12]],
    menu: {
      Πίτσες: [
        { name: "Χωριάτικη πίτσα", description: "Φέτα, ντομάτα, ελιές, πιπεριά", allergens: "Γλουτένη, γάλα", price: 10.5, groups: PIZZA_SIZE },
        { name: "Καρμπονάρα πίτσα", description: "Κρέμα, μπέικον, μανιτάρια", allergens: "Γλουτένη, γάλα, αυγό", price: 11.5, groups: PIZZA_SIZE },
      ],
      Μακαρονάδες: [{ name: "Σπαγγέτι μπολονέζ", allergens: "Γλουτένη, γάλα", price: 9 }],
    },
  },
  // ---------------------------------------------------------------- sushi (3)
  {
    slug: "test-sushi-ixia",
    name: "ΔΟΚΙΜΗ – Sakura Sushi",
    description: "Sushi, sashimi και ιαπωνική κουζίνα.",
    address: "Ιξιά, Ρόδος",
    categories: ["sushi"],
    prep: 25,
    delivery: 25,
    zones: [["Ιξιά", 1, 15], ["Ρόδος – Πόλη", 2, 15], ["Ιαλυσός", 2, 15]],
    menu: {
      Rolls: [
        { name: "California roll (8 τεμ.)", description: "Καβούρι, αβοκάντο, αγγούρι", allergens: "Οστρακοειδή, αυγό, σουσάμι, σόγια", price: 10 },
        { name: "Spicy tuna roll (8 τεμ.)", description: "Τόνος, πικάντικη μαγιονέζα", allergens: "Ψάρι, αυγό, σουσάμι, σόγια", price: 11.5 },
      ],
      Nigiri: [{ name: "Nigiri σολομός (2 τεμ.)", allergens: "Ψάρι, σόγια", price: 5 }],
      Συνοδευτικά: [{ name: "Edamame", allergens: "Σόγια", price: 4 }, { name: "Miso soup", allergens: "Σόγια, ψάρι", price: 3.5 }],
    },
  },
  {
    slug: "test-sushi-city",
    name: "ΔΟΚΙΜΗ – Tokyo Bay Ρόδος",
    description: "Sushi boxes για παρέες.",
    address: "Ρόδος – Πόλη",
    categories: ["sushi"],
    prep: 25,
    delivery: 20,
    zones: [["Ρόδος – Πόλη", 1, 15], ["Κοσκινού", 2.5, 20]],
    menu: {
      "Sushi boxes": [
        {
          name: "Box για 2 (24 τεμ.)",
          description: "Ποικιλία rolls, nigiri και maki",
          allergens: "Ψάρι, οστρακοειδή, αυγό, σουσάμι, σόγια",
          price: 28,
          groups: [{ name: "Σάλτσες", min: 0, max: 2, options: [["Έξτρα wasabi", 0], ["Spicy mayo", 0.5], ["Teriyaki", 0.5]] }],
        },
        { name: "Box vegan (16 τεμ.)", description: "Αβοκάντο, αγγούρι, καρότο", allergens: "Σουσάμι, σόγια", price: 16 },
      ],
      Maki: [{ name: "Maki σολομός (6 τεμ.)", allergens: "Ψάρι, σόγια", price: 6 }],
    },
  },
  {
    slug: "test-sushi-faliraki",
    name: "ΔΟΚΙΜΗ – Umami Sushi & Poke",
    description: "Sushi, poke bowls και wok.",
    address: "Φαληράκι, Ρόδος",
    categories: ["sushi"],
    prep: 20,
    delivery: 25,
    zones: [["Φαληράκι", 1, 12], ["Κοσκινού", 1.5, 12], ["Αφάντου", 2.5, 15]],
    menu: {
      "Poke bowls": [
        {
          name: "Poke σολομός",
          description: "Ρύζι sushi, σολομός, αβοκάντο, edamame, mango",
          allergens: "Ψάρι, σόγια, σουσάμι",
          price: 12.5,
          groups: [{ name: "Βάση", min: 1, max: 1, options: [["Ρύζι sushi", 0], ["Μαύρο ρύζι", 0.5], ["Σαλάτα", 0]] }],
        },
      ],
      Rolls: [
        { name: "Dragon roll (8 τεμ.)", description: "Γαρίδα tempura, χέλι, αβοκάντο", allergens: "Οστρακοειδή, ψάρι, γλουτένη, σουσάμι, σόγια", price: 14 },
        { name: "Philadelphia roll (8 τεμ.)", description: "Σολομός, τυρί κρέμα", allergens: "Ψάρι, γάλα, σουσάμι, σόγια", price: 11 },
      ],
    },
  },
];

const cents = (euros: number) => Math.round(euros * 100);
const TEST_SLUGS = TEST_SHOPS.map((s) => s.slug);

async function removeAll() {
  const shops = await db
    .select({ id: schema.businesses.id })
    .from(schema.businesses)
    .where(and(like(schema.businesses.slug, "test-%"), eq(schema.businesses.isDemo, true)));
  if (!shops.length) return console.log("No test shops to remove.");
  const ids = shops.map((s) => s.id);
  await db.transaction(async (tx) => {
    await tx.delete(schema.commissionLedger).where(inArray(schema.commissionLedger.businessId, ids));
    await tx.delete(schema.orders).where(inArray(schema.orders.businessId, ids));
    await tx.delete(schema.businesses).where(inArray(schema.businesses.id, ids)); // cascades menus, hours, zones, logins
  });
  console.log(`Removed ${ids.length} test shops and their test orders.`);
}

async function addMissing() {
  await seedBase();
  const password = process.env.TEST_SHOP_PASSWORD?.trim();
  if (password && password.length < PASSWORD_MIN_LENGTH) throw new Error(`TEST_SHOP_PASSWORD must be ${PASSWORD_MIN_LENGTH}+ characters`);
  const passwordHash = password ? await hashPassword(password) : null;
  const [region] = await db.select().from(schema.regions).where(eq(schema.regions.slug, "rodos"));
  const cats = await db.select().from(schema.categories);
  const existing = new Map(
    (
      await db
        .select({ slug: schema.businesses.slug, id: schema.businesses.id })
        .from(schema.businesses)
        .where(inArray(schema.businesses.slug, TEST_SLUGS))
    ).map((r) => [r.slug, r.id]),
  );

  for (const [i, s] of TEST_SHOPS.entries()) {
    const existingId = existing.get(s.slug);
    if (existingId) {
      // Add the login if the password was configured after the shop was created.
      if (passwordHash) {
        await db
          .insert(schema.users)
          .values({ email: `test${i + 1}@clickeat.test`, name: s.name, passwordHash, role: "business", businessId: existingId })
          .onConflictDoNothing();
      }
      console.log(`exists: ${s.name}`);
      continue;
    }
    await db.transaction(async (tx) => {
      const [b] = await tx
        .insert(schema.businesses)
        .values({
          slug: s.slug,
          name: s.name,
          description: s.description,
          address: s.address,
          phone: "+302241000000",
          regionId: region.id,
          isDemo: true,
          prepTimeMinutes: s.prep,
          deliveryTimeMinutes: s.delivery,
        })
        .returning();
      await tx
        .insert(schema.businessCategories)
        .values(s.categories.map((slug) => ({ businessId: b.id, categoryId: cats.find((c) => c.slug === slug)!.id })));
      // 00:00–00:00 every day = open 24/7.
      await tx
        .insert(schema.businessHours)
        .values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ businessId: b.id, weekday, opensAt: "00:00", closesAt: "00:00" })));
      await tx.insert(schema.deliveryZones).values(
        s.zones.map(([name, fee, min], sortOrder) => ({ businessId: b.id, name, feeCents: cents(fee), minOrderCents: cents(min), sortOrder })),
      );
      let catOrder = 0;
      for (const [catName, items] of Object.entries(s.menu)) {
        const [mc] = await tx
          .insert(schema.menuCategories)
          .values({ businessId: b.id, name: catName, sortOrder: catOrder++ })
          .returning();
        for (const [pi, p] of items.entries()) {
          const [prod] = await tx
            .insert(schema.products)
            .values({
              businessId: b.id,
              menuCategoryId: mc.id,
              name: p.name,
              description: p.description ?? "",
              allergens: p.allergens ?? "",
              priceCents: cents(p.price),
              sortOrder: pi,
            })
            .returning();
          for (const [gi, g] of (p.groups ?? []).entries()) {
            const [grp] = await tx
              .insert(schema.optionGroups)
              .values({ productId: prod.id, name: g.name, minSelect: g.min, maxSelect: g.max, sortOrder: gi })
              .returning();
            await tx
              .insert(schema.options)
              .values(g.options.map(([name, price], oi) => ({ groupId: grp.id, name, priceDeltaCents: cents(price), sortOrder: oi })));
          }
        }
      }
      if (passwordHash) {
        await tx
          .insert(schema.users)
          .values({ email: `test${i + 1}@clickeat.test`, name: s.name, passwordHash, role: "business", businessId: b.id })
          .onConflictDoNothing();
      }
    });
    console.log(`added: ${s.name}${passwordHash ? `  (login: test${i + 1}@clickeat.test)` : ""}`);
  }
  if (!passwordHash) console.log("No TEST_SHOP_PASSWORD set: shops created without logins.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (process.argv.includes("--remove") ? removeAll() : addMissing())
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => client.end());
}
