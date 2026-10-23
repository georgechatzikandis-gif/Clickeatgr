import Link from "next/link";
import { formatAthens } from "@/lib/hours";
import { formatEuro } from "@/lib/money";
import type { OrderWithItems } from "@/server/business-data";
import { StatusBadge } from "./order-card";

/** Compact list of orders with expandable details (history pages). */
export function OrderTable({ orders, businessNames }: { orders: OrderWithItems[]; businessNames?: Map<string, string> }) {
  if (!orders.length) return <p className="card p-6 text-center text-ink-soft">Δεν βρέθηκαν παραγγελίες.</p>;
  return (
    <ul className="card divide-y divide-line">
      {orders.map((o) => (
        <li key={o.id}>
          <details className="group">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
              <span className="font-mono font-bold">{o.reference}</span>
              <span className="text-sm text-ink-soft">{formatAthens(new Date(o.createdAt))}</span>
              {businessNames && <span className="text-sm font-medium">{businessNames.get(o.businessId)}</span>}
              <StatusBadge status={o.status} />
              <span className="text-sm">{o.fulfillment === "delivery" ? "🛵" : "🛍"}</span>
              <span className="ml-auto font-semibold">{formatEuro(o.totalCents)}</span>
            </summary>
            <div className="grid gap-3 bg-surface/60 px-4 py-3 text-sm sm:grid-cols-2">
              <ul>
                {o.items.map((i) => (
                  <li key={i.id}>
                    {i.quantity}× {i.productName}
                    {i.selectedOptions.length > 0 && <span className="text-ink-soft"> ({i.selectedOptions.map((x) => x.name).join(", ")})</span>} —{" "}
                    {formatEuro(i.lineTotalCents)}
                  </li>
                ))}
                {o.notes && <li className="mt-1">📝 {o.notes}</li>}
              </ul>
              <div className="space-y-0.5">
                {o.anonymizedAt ? (
                  <p className="text-ink-soft">Τα στοιχεία πελάτη έχουν ανωνυμοποιηθεί.</p>
                ) : (
                  <>
                    <p>
                      {o.customerName} · <Link href={`tel:${o.customerPhone}`}>{o.customerPhone}</Link>
                    </p>
                    {o.address && (
                      <p>
                        {o.address} {o.addressDetails && `(${o.addressDetails})`} – {o.deliveryZoneName}
                      </p>
                    )}
                  </>
                )}
                <p>
                  Υποσύνολο {formatEuro(o.subtotalCents)} · Διανομή {formatEuro(o.deliveryFeeCents)}
                </p>
                <p className="text-ink-soft">
                  Προμήθεια: {o.isTrial ? "0% (δωρεάν περίοδος)" : `${o.commissionRateBps / 100}% = ${formatEuro(o.commissionCents)}`}
                </p>
                {o.rejectionReason && <p className="text-danger">Αιτία: {o.rejectionReason}</p>}
              </div>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
