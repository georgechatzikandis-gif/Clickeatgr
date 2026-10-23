// Creates (or resets the password of) a staff account.
//   pnpm user:create admin you@example.com
//   pnpm user:create business owner@shop.gr <business-slug>
// The password is read from the CLICKEAT_PASSWORD env var or prompted, so it never lands in shell history files.
import { sql } from "drizzle-orm";
import { createInterface } from "node:readline/promises";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../src/server/password";
import { client, db, schema } from "./_db";

async function main() {
  const [role, email, slug] = process.argv.slice(2);
  if ((role !== "admin" && role !== "business") || !email || (role === "business" && !slug)) {
    console.error("Usage: pnpm user:create admin <email> | pnpm user:create business <email> <business-slug>");
    process.exit(1);
  }
  let password = process.env.CLICKEAT_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question(`Password (min ${PASSWORD_MIN_LENGTH} chars): `);
    rl.close();
  }
  if (password.length < PASSWORD_MIN_LENGTH) throw new Error("Password too short");

  let businessId: string | null = null;
  if (role === "business") {
    const [b] = await db.select().from(schema.businesses).where(sql`slug = ${slug}`);
    if (!b) throw new Error(`No business with slug ${slug}`);
    businessId = b.id;
  }
  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(schema.users).where(sql`lower(email) = ${email.toLowerCase()}`);
  if (existing) {
    await db.update(schema.users).set({ passwordHash, role, businessId, active: true }).where(sql`id = ${existing.id}`);
    console.log(`Updated ${role} ${email}`);
  } else {
    await db.insert(schema.users).values({ email: email.toLowerCase(), passwordHash, role, businessId });
    console.log(`Created ${role} ${email}`);
  }
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
