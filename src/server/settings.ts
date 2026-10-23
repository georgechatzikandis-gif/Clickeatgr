import "server-only";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import type { DB, Tx } from "@/db";

export async function getPlatformSettings(conn: DB | Tx = db) {
  const [row] = await conn.select().from(platformSettings).limit(1);
  if (row) return row;
  // First run: create the singleton row with commission OFF.
  const [created] = await conn.insert(platformSettings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await conn.select().from(platformSettings).limit(1))[0];
}
