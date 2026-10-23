import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://clickeat:clickeat@localhost:5432/clickeat_test";
  const client = postgres(url, { max: 1, onnotice: () => {} });
  await client`drop schema if exists public cascade`;
  await client`drop schema if exists drizzle cascade`;
  await client`create schema public`;
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.end();
}
