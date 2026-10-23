// GDPR retention: removes customer personal data from orders older than N months (default 12).
// Amounts, items and commission records are kept for accounting.
//   pnpm data:anonymize            (dry run: shows how many orders would change)
//   pnpm data:anonymize --apply
import { sql } from "drizzle-orm";
import { client, db } from "./_db";

const months = Number(process.env.RETENTION_MONTHS ?? 12);
const apply = process.argv.includes("--apply");

async function main() {
  const where = sql`created_at < now() - make_interval(months => ${months}) and anonymized_at is null`;
  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from orders where ${where}`);
  console.log(`${n} orders older than ${months} months contain personal data.`);
  if (!apply) {
    console.log("Dry run. Re-run with --apply to anonymise them.");
    return;
  }
  await db.execute(sql`
    update orders set
      customer_name = 'Ανώνυμος', customer_phone = '-', customer_email = null,
      address = case when fulfillment = 'delivery' then '-' else null end,
      address_details = null, notes = null, anonymized_at = now()
    where ${where}`);
  await db.execute(sql`update order_items set notes = null where order_id in (select id from orders where anonymized_at is not null)`);
  await db.execute(sql`delete from sessions where expires_at < now()`);
  await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  console.log(`Anonymised ${n} orders.`);
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
