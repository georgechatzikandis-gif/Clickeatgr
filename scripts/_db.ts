import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example)");
export const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
export const db = drizzle(client, { schema });
export { schema };
