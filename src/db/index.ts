import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __clickeatSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    // Required for transaction-mode poolers (Supabase port 6543, PgBouncer).
    prepare: false,
  });
}

// Reuse one pool across hot reloads in development.
const client = globalThis.__clickeatSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__clickeatSql = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
