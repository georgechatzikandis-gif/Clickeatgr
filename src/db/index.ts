import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cache } from "react";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };

declare global {
  var __clickeatDb: DB | undefined;
}

const isCloudflare = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

function connect(url: string | undefined, max: number): DB {
  if (!url) throw new Error("DATABASE_URL is not set");
  // prepare:false is required for transaction-mode poolers (Supabase port 6543, PgBouncer, Hyperdrive).
  return drizzle(postgres(url, { max, prepare: false }), { schema });
}

// Cloudflare Workers forbid sharing a connection between requests, so there we open one small
// client per request (React `cache` scopes it to the request). Hyperdrive keeps the real database
// connections pooled, so this is cheap. Everywhere else (Node, tests, scripts) one shared pool is used.
const requestDb = cache((): DB => {
  const env = getCloudflareContext().env as { HYPERDRIVE?: { connectionString: string } };
  return connect(env.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL, 1);
});

function getDb(): DB {
  if (isCloudflare) return requestDb();
  globalThis.__clickeatDb ??= connect(process.env.DATABASE_URL, Number(process.env.DATABASE_POOL_SIZE ?? 5));
  return globalThis.__clickeatDb;
}

/** The database. Resolves to the right connection for the current runtime on every use. */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
