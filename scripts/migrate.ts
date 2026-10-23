// Applies the SQL migrations in ./drizzle to DATABASE_URL and prints a clear reason if it fails.
//   pnpm db:migrate
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { client, db } from "./_db";

const HINTS: Record<string, string> = {
  "28P01": "Wrong database password (check the password inside the connection string).",
  XX000: "Supabase rejected the user/project (check 'postgres.<project-id>' and the pooler host).",
  ENOTFOUND: "Host not found (check the host part after '@').",
  ECONNREFUSED: "Connection refused (check host and port 5432).",
  ETIMEDOUT: "Connection timed out (check host/port; direct db.* hosts are IPv6-only — use the session pooler).",
};

async function main() {
  const url = new URL(process.env.DATABASE_URL!.replace(/^postgres(ql)?:/, "http:"));
  // Safe diagnostics: never prints the password.
  console.log(`Connecting as "${decodeURIComponent(url.username)}" to ${url.hostname}:${url.port || 5432}${url.pathname}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
}

main()
  .catch((e) => {
    const err = (e?.cause ?? e) as { code?: string; message?: string };
    console.error(`Migration failed: [${err.code ?? "?"}] ${err.message ?? e}`);
    if (err.code && HINTS[err.code]) console.error(`Hint: ${HINTS[err.code]}`);
    process.exitCode = 1;
  })
  .finally(() => client.end());
