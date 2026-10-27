// TEST shops for trying the platform on the LIVE site before launch. All are flagged is_demo (shown with a
// "ΔΟΚΙΜΑΣΤΙΚΟ" badge), named "ΔΟΚΙΜΗ – …", open 24/7, and use slugs starting with "test-".
//   pnpm db:seed:test-shops            add the shops that don't exist yet (safe to run again)
//   pnpm db:seed:test-shops --remove   delete all of them, including their (fake) orders
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
const SUGAR: Product["groups"] = [{ name: "Ζάχαρη", min: 1, max: 1, options: [["Σκέτος", 0], ["Μέτριος", 0], ["Γλυκός", 0]] }];

export const TEST_SHOPS: Shop[] = [
  {
    slug: "test-souvlaki",
    name: "ΔΟΚΙΜΗ – Σουβλάκια του Λιμανιού",
    description: "Πίτες, καλαμάκια και μερίδες στα κάρβουνα.",
    address: "Μανδράκι, Ρόδος",
    categories: ["souvlaki", "gyros"],
    prep: 15,
    delivery: 20,
    zones: [["Ρόδος – Πόλη", 1, 6], ["Ιξιά", 1.5, 8], ["Κοσκινού", 2, 10]],
    menu: {
      Τυλιχτά: [
        {
          name: "Πίτα γύρος χοιρινός",
          description: "Ντομάτα, κρεμμύδι, τζατζίκι, πατάτες",
          allergens: "Γλουτένη, γάλα",
          price: 3.8,
          groups: [
            { name: "Χωρίς", min: 0, max: 4, options: [["Χωρίς κρεμμύδι", 0], ["Χωρίς ντομάτα", 0], ["Χωρίς τζατζίκι", 0], ["Χωρίς πατάτες", 0]] },
            { name: "Έξτρα", min: 0, max: 2, options: [["Έξτρα κρέας", 1.2], ["Τυρί", 0.5]] },
          ],
        },
        { name: "Πίτα καλαμάκι κοτόπουλο", description: "Ντομάτα, μαρούλι, σως μουστάρδας", allergens: "Γλουτένη, αυγό, μουστάρδα", price: 3.9 },
      ],
      Μερίδες: [
        { name: "Μερίδα γύρος", description: "Με πατάτες, πίτα, ντομάτα, τζατζίκι", allergens: "Γλουτένη, γάλα", price: 11.5 },
        { name: "Καλαμάκια χοιρινά (4 τεμ.)", description: "Με πατάτες και πίτα", allergens: "Γλουτένη", price: 10.5 },
      ],
      Ποτά: [{ name: "Αναψυκτικό 330ml", price: 1.8 }, { name: "Νερό 500ml", price: 0.5 }],
    },
  },
  {
    slug: "test-pizza",
    name: "ΔΟΚΙΜΗ – Pizza Rodini",
    description: "Πίτσες σε ξυλόφουρνο και φρέσκες σαλάτες.",
    address: "Ροδίνι, Ρόδος",
    categories: ["pizza"],
    prep: 20,
    delivery: 25,
    zones: [["Ρόδος – Πόλη", 1.5, 10], ["Ιαλυσός", 2, 12], ["Φαληράκι", 3, 15]],
    menu: {
      Πίτσες: [
        {
          name: "Μαργαρίτα",
          description: "Σάλτσα ντομάτας, μοτσαρέλα, βασιλικός",
          allergens: "Γλουτένη, γάλα",
          price: 9,
          groups: [
            { name: "Μέγεθος", min: 1, max: 1, options: [["Μεσαία", 0], ["Μεγάλη", 3]] },
            { name: "Έξτρα υλικά", min: 0, max: 5, options: [["Μανιτάρια", 0.8], ["Πιπεριά", 0.6], ["Μπέικον", 1.2], ["Ελιές", 0.6]] },
          ],
        },
        {
          name: "Σπέσιαλ",
          description: "Ζαμπόν, μπέικον, πιπεριά, μανιτάρια",
          allergens: "Γλουτένη, γάλα",
          price: 12,
          groups: [{ name: "Μέγεθος", min: 1, max: 1, options: [["Μεσαία", 0], ["Μεγάλη", 3.5]] }],
        },
        { name: "Πεπερόνι", description: "Σάλτσα, μοτσαρέλα, πεπερόνι", allergens: "Γλουτένη, γάλα", price: 11 },
      ],
      Σαλάτες: [{ name: "Χωριάτικη", allergens: "Γάλα", price: 7.5 }, { name: "Σαλάτα του Καίσαρα", allergens: "Γλουτένη, αυγό, γάλα, ψάρι", price: 8.5 }],
    },
  },
  {
    slug: "test-burger",
    name: "ΔΟΚΙΜΗ – Burger Station",
    description: "Smash burgers, πατάτες και mozzarella sticks.",
    address: "Κρεμαστή, Ρόδος",
    categories: ["burgers", "snacks"],
    prep: 15,
    delivery: 20,
    zones: [["Κρεμαστή", 1, 5], ["Παραδείσι", 2, 8], ["Ιαλυσός", 2, 8]],
    menu: {
      Burgers: [
        {
          name: "Cheeseburger",
          description: "Μοσχαρίσιο μπιφτέκι, cheddar, τουρσί, σως",
          allergens: "Γλουτένη, γάλα, μουστάρδα, σουσάμι",
          price: 6.5,
          groups: [{ name: "Έξτρα", min: 0, max: 3, options: [["Διπλό μπιφτέκι", 2.5], ["Έξτρα cheddar", 0.8], ["Μπέικον", 1.2]] }],
        },
        { name: "Special burger", description: "Διπλό μπιφτέκι, μπέικον, μαρούλι, ντομάτα, special σως", allergens: "Γλουτένη, γάλα, αυγό, σουσάμι", price: 9.5 },
      ],
      "Συνοδευτικά": [
        { name: "Πατάτες τηγανητές", allergens: "", price: 3, groups: SIZE },
        { name: "Mozzarella sticks (6 τεμ.)", description: "Με σως ντομάτας", allergens: "Γλουτένη, γάλα, αυγό", price: 5 },
      ],
      Ποτά: [{ name: "Αναψυκτικό 330ml", price: 1.8 }],
    },
  },
  {
    slug: "test-cafe",
    name: "ΔΟΚΙΜΗ – Καφέ Ακτή",
    description: "Καφέδες, ροφήματα και γρήγορα σνακ.",
    address: "Ακτή Μιαούλη, Ρόδος",
    categories: ["kafes", "snacks"],
    prep: 10,
    delivery: 15,
    zones: [["Ρόδος – Πόλη", 0.5, 4], ["Ιξιά", 1, 6]],
    menu: {
      Καφέδες: [
        { name: "Freddo espresso", price: 2.5, groups: SUGAR },
        {
          name: "Freddo cappuccino",
          allergens: "Γάλα",
          price: 3,
          groups: [...(SUGAR ?? []), { name: "Γάλα", min: 0, max: 1, options: [["Φυτικό γάλα", 0.5]] }],
        },
        { name: "Ελληνικός", price: 2, groups: SUGAR },
      ],
      Σνακ: [
        { name: "Τοστ γαλοπούλα-τυρί", allergens: "Γλουτένη, γάλα", price: 3 },
        { name: "Κουλούρι Θεσσαλονίκης", allergens: "Γλουτένη, σουσάμι", price: 1 },
      ],
    },
  },
  {
    slug: "test-glyka",
    name: "ΔΟΚΙΜΗ – Ζαχαροπλαστείο Ροδόπη",
    description: "Γλυκά ταψιού, παγωτά και τούρτες.",
    address: "Ιαλυσός, Ρόδος",
    categories: ["glyka"],
    prep: 10,
    delivery: 20,
    zones: [["Ιαλυσός", 1, 6], ["Κρεμαστή", 1.5, 8], ["Ρόδος – Πόλη", 2, 8]],
    menu: {
      Γλυκά: [
        { name: "Πορτοκαλόπιτα", allergens: "Γλουτένη, αυγό, γάλα", price: 4 },
        { name: "Γαλακτομπούρεκο", allergens: "Γλουτένη, αυγό, γάλα", price: 4.5 },
        { name: "Προφιτερόλ", allergens: "Γλουτένη, αυγό, γάλα", price: 5 },
      ],
      Παγωτά: [
        {
          name: "Παγωτό κύπελλο",
          allergens: "Γάλα",
          price: 3.5,
          groups: [{ name: "Γεύσεις", min: 1, max: 3, options: [["Βανίλια", 0], ["Σοκολάτα", 0], ["Φράουλα", 0], ["Φιστίκι", 0.5]] }],
        },
      ],
    },
  },
  {
    slug: "test-taverna",
    name: "ΔΟΚΙΜΗ – Ταβέρνα ο Μύλος",
    description: "Μαγειρευτά της ημέρας και ψητά.",
    address: "Κοσκινού, Ρόδος",
    categories: ["estiatoria"],
    prep: 25,
    delivery: 25,
    zones: [["Κοσκινού", 1, 10], ["Φαληράκι", 2, 12], ["Ρόδος – Πόλη", 2.5, 15]],
    menu: {
      Μαγειρευτά: [
        { name: "Μουσακάς", allergens: "Γλουτένη, γάλα, αυγό", price: 10 },
        { name: "Παστίτσιο", allergens: "Γλουτένη, γάλα, αυγό", price: 9.5 },
        { name: "Γεμιστά", description: "Ντομάτες και πιπεριές με ρύζι", allergens: "", price: 8.5 },
      ],
      Ψητά: [{ name: "Μπριζόλα χοιρινή", description: "Με πατάτες", allergens: "", price: 12 }],
      Ορεκτικά: [{ name: "Τζατζίκι", allergens: "Γάλα", price: 4 }, { name: "Πίτα σκορδόψωμο", allergens: "Γλουτένη, γάλα", price: 3 }],
    },
  },
  {
    slug: "test-snack",
    name: "ΔΟΚΙΜΗ – Κρεπερί Δωδεκάνησα",
    description: "Γλυκές και αλμυρές κρέπες, βάφλες.",
    address: "Φαληράκι, Ρόδος",
    categories: ["snacks", "glyka"],
    prep: 10,
    delivery: 20,
    zones: [["Φαληράκι", 1, 6], ["Κοσκινού", 1.5, 8], ["Αφάντου", 2, 10]],
    menu: {
      "Αλμυρές κρέπες": [
        {
          name: "Κρέπα γαλοπούλα",
          description: "Γαλοπούλα, gouda, ντομάτα",
          allergens: "Γλουτένη, αυγό, γάλα",
          price: 5.5,
          groups: [{ name: "Έξτρα", min: 0, max: 3, options: [["Μπέικον", 1], ["Μανιτάρια", 0.6], ["Αυγό", 0.6]] }],
        },
      ],
      "Γλυκές κρέπες": [
        { name: "Κρέπα πραλίνα-μπισκότο", allergens: "Γλουτένη, αυγό, γάλα, ξηροί καρποί", price: 5 },
        { name: "Βάφλα με παγωτό", allergens: "Γλουτένη, αυγό, γάλα", price: 6 },
      ],
    },
  },
  {
    slug: "test-asian",
    name: "ΔΟΚΙΜΗ – Wok & Sushi",
    description: "Νουντλς, ρύζι και sushi rolls.",
    address: "Ιξιά, Ρόδος",
    categories: ["estiatoria"],
    prep: 20,
    delivery: 25,
    zones: [["Ιξιά", 1, 10], ["Ρόδος – Πόλη", 2, 12], ["Ιαλυσός", 2, 12]],
    menu: {
      Wok: [
        {
          name: "Noodles κοτόπουλο",
          description: "Λαχανικά, σάλτσα σόγιας",
          allergens: "Γλουτένη, σόγια, αυγό",
          price: 9.5,
          groups: [{ name: "Καυτερό", min: 1, max: 1, options: [["Καθόλου", 0], ["Λίγο", 0], ["Πολύ", 0]] }],
        },
        { name: "Τηγανητό ρύζι με γαρίδες", allergens: "Οστρακοειδή, σόγια, αυγό", price: 11 },
      ],
      Sushi: [{ name: "California roll (8 τεμ.)", allergens: "Οστρακοειδή, αυγό, σουσάμι, σόγια", price: 10 }],
    },
  },
  {
    slug: "test-fish",
    name: "ΔΟΚΙΜΗ – Ψαροταβέρνα το Κύμα",
    description: "Φρέσκα ψάρια και θαλασσινά.",
    address: "Παραδείσι, Ρόδος",
    categories: ["estiatoria"],
    prep: 25,
    delivery: 25,
    zones: [["Παραδείσι", 1, 12], ["Κρεμαστή", 1.5, 12], ["Θεολόγος", 2, 15]],
    menu: {
      Θαλασσινά: [
        { name: "Καλαμαράκια τηγανητά", allergens: "Μαλάκια, γλουτένη", price: 11 },
        { name: "Γαρίδες σαγανάκι", allergens: "Οστρακοειδή, γάλα", price: 14 },
      ],
      Ψάρια: [{ name: "Τσιπούρα σχάρας", description: "Με χόρτα", allergens: "Ψάρι", price: 15 }],
      Σαλάτες: [{ name: "Χωριάτικη", allergens: "Γάλα", price: 7.5 }],
    },
  },
  {
    slug: "test-bakery",
    name: "ΔΟΚΙΜΗ – Φούρνος η Ζύμη",
    description: "Πίτες, κουλούρια και πρωινό.",
    address: "Αφάντου, Ρόδος",
    categories: ["snacks", "kafes"],
    prep: 5,
    delivery: 15,
    zones: [["Αφάντου", 0.5, 4], ["Φαληράκι", 1.5, 6], ["Αρχάγγελος", 2, 8]],
    menu: {
      Πίτες: [
        { name: "Τυρόπιτα", allergens: "Γλουτένη, γάλα, αυγό", price: 2.2 },
        { name: "Σπανακόπιτα", allergens: "Γλουτένη, γάλα", price: 2.3 },
        { name: "Μπουγάτσα κρέμα", allergens: "Γλουτένη, γάλα, αυγό", price: 3 },
      ],
      Ροφήματα: [{ name: "Χυμός πορτοκάλι", price: 2.5, groups: SIZE }, { name: "Freddo espresso", price: 2.2, groups: SUGAR }],
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
