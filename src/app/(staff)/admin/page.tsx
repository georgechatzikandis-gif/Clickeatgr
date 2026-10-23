import type { Metadata } from "next";
import Link from "next/link";
import { athensDate, athensStartOfDay } from "@/lib/hours";
import { formatEuro } from "@/lib/money";
import { requireAdminPage } from "@/server/auth";
import { businessReport, platformStats } from "@/server/admin-data";

export const metadata: Metadata = { title: "Διαχείριση" };

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {sub && <p className="text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}

export default async function AdminHome() {
  await requireAdminPage();
  const today = athensStartOfDay();
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  const monthStart = athensDate(y, m, 1);
  const nextMonth = athensDate(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1);
  const [s, rows] = await Promise.all([platformStats(today, monthStart), businessReport(monthStart, nextMonth)]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Παραγγελίες σήμερα" value={s.todayOrders} sub={`${s.todayCompleted} ολοκληρωμένες · ${formatEuro(s.todayTotal)}`} />
        <Stat label="Αναμένουν αποδοχή" value={s.pendingNow} />
        <Stat label="Αυτόν τον μήνα" value={s.monthCompleted} sub={`ολοκληρωμένες · ${formatEuro(s.monthTotal)}`} />
        <Stat label="Ενεργά καταστήματα" value={s.activeBusinesses} />
      </div>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">Καταστήματα αυτόν τον μήνα</h2>
          <Link href="/admin/reports" className="text-sm underline">Αναλυτική αναφορά →</Link>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-ink-soft">
              <tr>
                <th className="px-4 py-2 font-medium">Κατάστημα</th>
                <th className="px-4 py-2 font-medium">Παραγγελίες</th>
                <th className="px-4 py-2 font-medium">Ολοκλ.</th>
                <th className="px-4 py-2 font-medium">Τζίρος (ολοκλ.)</th>
                <th className="px-4 py-2 font-medium">Προμήθεια</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/admin/businesses/${r.id}`} className="hover:underline">{r.name}</Link>
                  </td>
                  <td className="px-4 py-2">{r.allOrders}</td>
                  <td className="px-4 py-2">{r.completed}</td>
                  <td className="px-4 py-2">{formatEuro(r.total)}</td>
                  <td className="px-4 py-2">{formatEuro(r.commissionDue + r.commissionSettled)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
