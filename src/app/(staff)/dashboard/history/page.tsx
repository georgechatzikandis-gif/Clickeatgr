import type { Metadata } from "next";
import Link from "next/link";
import { OrderFilters } from "@/components/dashboard/order-filters";
import { OrderTable } from "@/components/dashboard/order-table";
import { parseOrderFilters } from "@/lib/filters";
import { requireBusinessPage } from "@/server/auth";
import { listOrderHistory } from "@/server/business-data";

export const metadata: Metadata = { title: "Ιστορικό παραγγελιών" };

export default async function HistoryPage(props: PageProps<"/dashboard/history">) {
  const user = await requireBusinessPage();
  const f = parseOrderFilters(await props.searchParams);
  const { orders, hasMore } = await listOrderHistory(user.businessId, f);
  const qs = (page: number) => new URLSearchParams({ ...f.raw, page: String(page) }).toString();
  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">Ιστορικό παραγγελιών</h1>
      <OrderFilters raw={f.raw} />
      <OrderTable orders={orders} />
      <div className="mt-4 flex justify-between">
        {f.page > 1 ? <Link className="btn-ghost" href={`?${qs(f.page - 1)}`}>← Νεότερες</Link> : <span />}
        {hasMore && <Link className="btn-ghost" href={`?${qs(f.page + 1)}`}>Παλαιότερες →</Link>}
      </div>
    </div>
  );
}
