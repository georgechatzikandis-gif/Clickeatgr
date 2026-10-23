// Base data needed in every environment (production too): settings, Rhodes region, food categories.
// Safe to run repeatedly. Usage: pnpm db:seed
import { client, db, schema } from "./_db";

export async function seedBase() {
  await db.insert(schema.platformSettings).values({ id: 1 }).onConflictDoNothing();
  await db
    .insert(schema.regions)
    .values({ slug: "rodos", name: "Ρόδος", sortOrder: 0 })
    .onConflictDoNothing();
  const cats = [
    ["kafes", "Καφές", "☕"],
    ["souvlaki", "Σουβλάκια", "🍢"],
    ["gyros", "Γύρος", "🥙"],
    ["burgers", "Burgers", "🍔"],
    ["pizza", "Πίτσα", "🍕"],
    ["estiatoria", "Εστιατόρια", "🍽️"],
    ["glyka", "Γλυκά", "🍰"],
    ["snacks", "Σνακ", "🥪"],
  ] as const;
  await db
    .insert(schema.categories)
    .values(cats.map(([slug, name, icon], i) => ({ slug, name, icon, sortOrder: i })))
    .onConflictDoNothing();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedBase()
    .then(() => console.log("Base data ready."))
    .finally(() => client.end());
}
