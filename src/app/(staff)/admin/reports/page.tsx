import type { Metadata } from "next";
import { settleCommissionAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { trialLabel } from "@/lib/commission";
import { formatEuro } from "@/lib/money";
import { monthRange } from "@/lib/months";
import { requireAdminPage } from "@/server/auth";
import { businessReport } from "@/server/admin-data";

export const metadata: Metadata = { title: "Μηνιαία αναφορά" };

export default async function ReportsPage(props: PageProps<"/admin/reports">) {
  await requireAdminPage();
  const { month } = await props.searchParams;
  const range = monthRange(typeof month === "string" ? month : undefined);
  const rows = await businessReport(range.from, range.to);
  const t = rows.reduce(
    (a, r) => ({ completed: a.completed + r.completed, total: a.total + r.total, due: a.due + r.commissionDue, settled: a.settled + r.commissionSettled }),
    { completed: 0, total: 0, due: 0, settled: 0 },
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-bold">Μηνιαία αναφορά</h1>
        <form method="get" className="flex items-end gap-2">
          <div>
            <label className="label" htmlFor="month">Μήνας</label>
            <input id="month" name="month" type="month" defaultValue={range.key} className="input !py-2" />
          </div>
          <button className="btn-dark">Προβολή</button>
          <a className="btn-ghost" href={`/admin/reports/export?month=${range.key}`}>CSV</a>
        </form>
      </div>
      <p className="mb-3 text-sm text-ink-soft">
        Τζίρος και προμήθεια υπολογίζονται μόνο σε <strong>ολοκληρωμένες</strong> παραγγελίες. Ακυρωμένες/απορριφθείσες δεν χρεώνονται. Η προμήθεια κάθε
        παραγγελίας «παγώνει» τη στιγμή της παραγγελίας (ποσοστό & δωρεάν περίοδος εκείνης της στιγμής).
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface text-left text-ink-soft">
            <tr>
              <th className="px-3 py-2 font-medium">Κατάστημα</th>
              <th className="px-3 py-2 font-medium">Όλες</th>
              <th className="px-3 py-2 font-medium">Ολοκλ.</th>
              <th className="px-3 py-2 font-medium">Ακυρ.</th>
              <th className="px-3 py-2 font-medium">Προϊόντα</th>
              <th className="px-3 py-2 font-medium">Διανομή</th>
              <th className="px-3 py-2 font-medium">Σύνολο</th>
              <th className="px-3 py-2 font-medium">Προμ. οφειλ.</th>
              <th className="px-3 py-2 font-medium">Προμ. εξοφλ.</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-ink-soft">{trialLabel(r.trialEndsAt)}{r.trialOrders ? ` · ${r.trialOrders} σε δωρεάν περίοδο` : ""}</p>
                </td>
                <td className="px-3 py-2">{r.allOrders}</td>
                <td className="px-3 py-2">{r.completed}</td>
                <td className="px-3 py-2">{r.cancelled}</td>
                <td className="px-3 py-2">{formatEuro(r.subtotal)}</td>
                <td className="px-3 py-2">{formatEuro(r.deliveryFees)}</td>
                <td className="px-3 py-2 font-semibold">{formatEuro(r.total)}</td>
                <td className="px-3 py-2">{formatEuro(r.commissionDue)}</td>
                <td className="px-3 py-2">{formatEuro(r.commissionSettled)}</td>
                <td className="px-3 py-2">
                  {r.commissionDue > 0 && (
                    <ActionForm action={settleCommissionAction} confirm={`Σημείωση της προμήθειας ${formatEuro(r.commissionDue)} ως εξοφλημένης;`}>
                      <input type="hidden" name="businessId" value={r.id} />
                      <input type="hidden" name="month" value={range.key} />
                      <SubmitButton className="btn-ghost !px-2 !py-1 text-xs">Εξοφλήθηκε</SubmitButton>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line font-semibold">
            <tr>
              <td className="px-3 py-2">Σύνολο</td>
              <td />
              <td className="px-3 py-2">{t.completed}</td>
              <td colSpan={3} />
              <td className="px-3 py-2">{formatEuro(t.total)}</td>
              <td className="px-3 py-2">{formatEuro(t.due)}</td>
              <td className="px-3 py-2">{formatEuro(t.settled)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
