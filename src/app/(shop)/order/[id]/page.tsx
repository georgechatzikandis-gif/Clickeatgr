import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatEuro } from "@/lib/money";
import { FINAL_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import { getOrderForCustomer } from "@/server/public-orders";

export const metadata: Metadata = { title: "Η παραγγελία σας", robots: { index: false } };

const STEPS = ["pending", "accepted", "preparing", "ready", "out_for_delivery", "completed"] as const;
const CUSTOMER_TEXT: Record<string, string> = {
  pending: "Η παραγγελία στάλθηκε. Περιμένουμε επιβεβαίωση από το κατάστημα.",
  accepted: "Το κατάστημα αποδέχτηκε την παραγγελία σας.",
  preparing: "Η παραγγελία σας ετοιμάζεται.",
  ready: "Η παραγγελία σας είναι έτοιμη.",
  out_for_delivery: "Η παραγγελία σας είναι καθ' οδόν!",
  completed: "Η παραγγελία ολοκληρώθηκε. Καλή όρεξη!",
  rejected: "Δυστυχώς το κατάστημα δεν μπόρεσε να δεχτεί την παραγγελία.",
  cancelled: "Η παραγγελία ακυρώθηκε.",
};

export default async function OrderPage(props: PageProps<"/order/[id]">) {
  const { id } = await props.params;
  const { t } = await props.searchParams;
  const data = await getOrderForCustomer(id, typeof t === "string" ? t : undefined);
  if (!data) notFound();
  const { order: o, items } = data;
  const final = FINAL_STATUSES.includes(o.status);
  const steps = STEPS.filter((s) => o.fulfillment === "delivery" || s !== "out_for_delivery");
  const currentIdx = steps.indexOf(o.status as (typeof STEPS)[number]);
  const failed = o.status === "rejected" || o.status === "cancelled";

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <AutoRefresh seconds={15} enabled={!final} />
      <div className="text-center">
        <p className="text-5xl" aria-hidden>{failed ? "😔" : o.status === "completed" ? "🎉" : "✅"}</p>
        <h1 className="mt-2 text-2xl font-extrabold">{failed ? STATUS_LABELS[o.status] : "Ευχαριστούμε για την παραγγελία!"}</h1>
        <p className="mt-1 text-ink-soft">Αριθμός παραγγελίας</p>
        <p className="font-mono text-3xl font-bold tracking-wider" data-testid="order-reference">{o.reference}</p>
      </div>

      <div className="card mt-6 p-4" aria-live="polite">
        <p className="font-semibold">{CUSTOMER_TEXT[o.status]}</p>
        {o.rejectionReason && <p className="mt-1 text-sm text-ink-soft">Αιτία: {o.rejectionReason}</p>}
        {!failed && (
          <ol className="mt-4 flex gap-1">
            {steps.map((s, i) => (
              <li key={s} className="flex-1">
                <div className={`h-1.5 rounded-full ${i <= currentIdx ? "bg-brand" : "bg-line"}`} />
                <p className={`mt-1 text-[11px] leading-tight ${i === currentIdx ? "font-semibold" : "text-ink-soft"}`}>{STATUS_LABELS[s]}</p>
              </li>
            ))}
          </ol>
        )}
        {!final && <p className="mt-3 text-xs text-ink-soft">Η σελίδα ενημερώνεται αυτόματα. Κρατήστε τη σελίδα ανοιχτή ή αποθηκεύστε τον σύνδεσμο.</p>}
      </div>

      <div className="card mt-4 p-4 text-sm">
        <h2 className="font-bold">{data.businessName}</h2>
        {data.businessPhone && (
          <p className="mt-0.5">
            Τηλέφωνο καταστήματος: <a className="font-semibold underline" href={`tel:${data.businessPhone}`}>{data.businessPhone}</a>
          </p>
        )}
        <ul className="mt-3 divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>
                {i.quantity}× {i.productName}
                {i.selectedOptions.length > 0 && (
                  <span className="block text-xs text-ink-soft">{i.selectedOptions.map((x) => x.name).join(", ")}</span>
                )}
              </span>
              <span className="shrink-0">{formatEuro(i.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t border-line pt-2">
          <div className="flex justify-between"><dt>Υποσύνολο</dt><dd>{formatEuro(o.subtotalCents)}</dd></div>
          {o.fulfillment === "delivery" && (
            <div className="flex justify-between"><dt>Διανομή</dt><dd>{o.deliveryFeeCents ? formatEuro(o.deliveryFeeCents) : "Δωρεάν"}</dd></div>
          )}
          <div className="flex justify-between text-base font-bold"><dt>Σύνολο</dt><dd>{formatEuro(o.totalCents)}</dd></div>
          <div className="flex justify-between text-ink-soft">
            <dt>Πληρωμή</dt>
            <dd>{o.paymentMethod === "cash_on_delivery" ? "Μετρητά κατά την παράδοση" : "Στο κατάστημα κατά την παραλαβή"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-ink-soft">
          {o.fulfillment === "delivery"
            ? `🛵 ${o.address}${o.addressDetails ? ` (${o.addressDetails})` : ""} – ${o.deliveryZoneName}`
            : `🛍 Παραλαβή από το κατάστημα${data.businessAddress ? `: ${data.businessAddress}` : ""}`}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          Καταχωρίστηκε: {o.createdAt.toLocaleString("el-GR", { timeZone: "Europe/Athens", dateStyle: "short", timeStyle: "short" })}
        </p>
      </div>
      <div className="mt-6 text-center">
        <Link href="/" className="btn-ghost">Αρχική σελίδα</Link>
      </div>
    </div>
  );
}
