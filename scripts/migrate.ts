// Applies the SQL migrations in ./drizzle to DATABASE_URL and prints a clear reason if it fails.
//   pnpm db:migrate
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { client, db } from "./_db";

const HINTS: Record<string, string> = {
  "28P01": "Wrong database password (check the password inside the connection string).",
  XX000: "Supabase rejected the user/project (check 'postgres.<project-id>' and the pooler host).",
  ENOTFOUND: "Host not found (check the host part after '@').",
  ECONNREFUSED: "Connection refused (check host and port 5432).",
  ETIMEDOUT: "Connection timed out (check host/port; direct db.* hosts are IPv6-only — use the session pooler).",
};

/** Facts about the password that help find typos without revealing it. */
function describePassword(raw: string): string {
  const pw = decodeURIComponent(raw);
  const symbols = [...new Set(pw.replace(/[A-Za-z0-9]/g, "").split(""))].map((c) => (c === " " ? "space" : c));
  const notes = [`${pw.length} characters`, symbols.length ? `symbols: ${symbols.join(" ")}` : "letters and digits only"];
  if (/^\[|\]$/.test(pw)) notes.push("WARNING: starts/ends with a bracket — remove the [ ]");
  if (/YOUR-PASSWORD/i.test(pw)) notes.push("WARNING: still contains the placeholder YOUR-PASSWORD");
  if (/\s/.test(pw)) notes.push("WARNING: contains whitespace");
  if (pw.startsWith("@") || pw.endsWith("@")) notes.push(`WARNING: an @ at the ${pw.startsWith("@") ? "start" : "end"}, probably copied by mistake`);
  return notes.join(", ");
}

async function main() {
  const raw = process.env.DATABASE_URL!;
  if (raw !== raw.trim()) console.log("WARNING: the connection string has spaces or line breaks at the start or end");
  const url = new URL(raw.trim().replace(/^postgres(ql)?:/, "http:"));
  // Safe diagnostics: never prints the password itself.
  console.log(`Connecting as "${decodeURIComponent(url.username)}" to ${url.hostname}:${url.port || 5432}${url.pathname}`);
  console.log(`Password check: ${describePassword(url.password)}`);
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
  } catch (e) {
    const code = ((e as { cause?: { code?: string } }).cause ?? (e as { code?: string })).code;
    const pw = decodeURIComponent(url.password);
    const cleaned = pw.replace(/^[@\s[\]]+|[@\s[\]]+$/g, "");
    if (code !== "28P01" || cleaned === pw) throw e;
    // Retry once without stray characters at the edges, to tell the owner exactly what to fix.
    url.password = encodeURIComponent(cleaned);
    const retry = postgres(url.toString().replace(/^http:/, "postgresql:"), { max: 1, prepare: false, onnotice: () => {} });
    try {
      await migrate(drizzle(retry), { migrationsFolder: "drizzle" });
      console.log("NOTE: it worked after removing the extra characters at the start/end of the password.");
      console.log("      Please fix the SUPABASE_DB_PASSWORD secret (remove the extra @ or spaces).");
      process.exitCode = 2; // succeed at migrating, but fail the job so the secret gets fixed
    } finally {
      await retry.end();
    }
  }
  if (!process.exitCode) console.log("Migrations applied.");
}

main()
  .catch((e) => {
    const err = (e?.cause ?? e) as { code?: string; message?: string };
    console.error(`Migration failed: [${err.code ?? "?"}] ${err.message ?? e}`);
    if (err.code && HINTS[err.code]) console.error(`Hint: ${HINTS[err.code]}`);
    process.exitCode = 1;
  })
  .finally(() => client.end());
