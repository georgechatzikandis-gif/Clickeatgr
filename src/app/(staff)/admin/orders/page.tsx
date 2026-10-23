import type { Metadata } from "next";
import Link from "next/link";
import { adminCancelOrderAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { OrderFilters } from "@/components/dashboard/order-filters";
import { OrderTable } from "@/components/dashboard/order-table";
import { parseOrderFilters } from "@/lib/filters";
import { formatEuro } from "@/lib/money";
import { FINAL_STATUSES } from "@/lib/order-status";
import { requireAdminPage } from "@/server/auth";
import { listAllBusinesses, searchOrders } from "@/server/admin-data";

export const metadata: Metadata = { title: "Όλες οι παραγγελίες" };

export default async function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  await requireAdminPage();
  const f = parseOrderFilters(await props.searchParams);
  const [{ orders, hasMore }, businesses] = await Promise.all([searchOrders(f), listAllBusinesses()]);
  const names = new Map(businesses.map((b) => [b.id, b.name]));
  const open = orders.filter((o) => !FINAL_STATUSES.includes(o.status));
  const qs = (page: number) => new URLSearchParams({ ...f.raw, page: String(page) }).toString();
  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">Όλες οι παραγγελίες</h1>
      <OrderFilters raw={f.raw} businesses={businesses.map((b) => ({ id: b.id, name: b.name }))} />
      <OrderTable orders={orders} businessNames={names} />
      <div className="mt-4 flex justify-between">
        {f.page > 1 ? <Link className="btn-ghost" href={`?${qs(f.page - 1)}`}>← Νεότερες</Link> : <span />}
        {hasMore && <Link className="btn-ghost" href={`?${qs(f.page + 1)}`}>Παλαιότερες →</Link>}
      </div>
      {open.length > 0 && (
        <section className="mt-8">
          <h2 className="font-bold">Ακύρωση ανοιχτής παραγγελίας</h2>
          <p className="text-sm text-ink-soft">Χρησιμοποιήστε μόνο αν ο πελάτης ή το κατάστημα ζητήσει ακύρωση και το κατάστημα δεν μπορεί.</p>
          <ul className="mt-2 space-y-2">
            {open.map((o) => (
              <li key={o.id}>
                <ActionForm action={adminCancelOrderAction} confirm={`Ακύρωση της ${o.reference};`} className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="hidden" name="id" value={o.id} />
                  <span className="font-mono font-bold">{o.reference}</span>
                  <span>{names.get(o.businessId)} · {formatEuro(o.totalCents)}</span>
                  <input name="reason" placeholder="Αιτία" maxLength={300} className="input !w-56 !py-1.5" />
                  <SubmitButton className="btn-ghost !py-1.5 text-danger">Ακύρωση</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
