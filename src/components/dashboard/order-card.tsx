"use client";

import { useState, useTransition } from "react";
import { setOrderStatusAction } from "@/app/actions/business";
import type { OrderStatus } from "@/db/schema";
import { formatAthens } from "@/lib/hours";
import { formatEuro } from "@/lib/money";
import { STATUS_LABELS, allowedTransitions } from "@/lib/order-status";
import type { OrderWithItems } from "@/server/business-data";

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-brand text-ink",
  accepted: "bg-blue-100 text-blue-900",
  preparing: "bg-indigo-100 text-indigo-900",
  ready: "bg-teal-100 text-teal-900",
  out_for_delivery: "bg-purple-100 text-purple-900",
  completed: "bg-green-100 text-ok",
  rejected: "bg-red-100 text-danger",
  cancelled: "bg-red-100 text-danger",
};

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  accepted: "✓ Αποδοχή",
  preparing: "Ετοιμάζεται",
  ready: "Έτοιμη",
  out_for_delivery: "Σε διανομή",
  completed: "Ολοκληρώθηκε",
  rejected: "Απόρριψη",
  cancelled: "Ακύρωση",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function OrderCard({ order: o, now, actions = true }: { order: OrderWithItems; now: number; actions?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isNew = o.status === "pending";
  const minutesAgo = Math.max(0, Math.round((now - new Date(o.createdAt).getTime()) / 60000));

  const change = (to: OrderStatus) => {
    let note: string | undefined;
    if (to === "rejected" || to === "cancelled") {
      const r = window.prompt(to === "rejected" ? "Αιτία απόρριψης (θα τη δει ο πελάτης):" : "Αιτία ακύρωσης:");
      if (r === null) return;
      note = r;
    }
    setError(null);
    start(async () => {
      const res = await setOrderStatusAction(o.id, to, note);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <article
      className={`card overflow-hidden ${isNew ? "border-2 !border-brand shadow-lg shadow-amber-200/60" : ""}`}
      data-testid="order-card"
      aria-busy={pending}
    >
      <header className={`flex items-center justify-between gap-2 px-4 py-2.5 ${isNew ? "bg-brand-soft" : "bg-surface"}`}>
        <div>
          <p className="font-mono text-lg font-bold">{o.reference}</p>
          <p className="text-xs text-ink-soft">
            {formatAthens(new Date(o.createdAt), { timeStyle: "short" })} · πριν {minutesAgo}′
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={o.status} />
          <span className="text-xs font-semibold">{o.fulfillment === "delivery" ? "🛵 Διανομή" : "🛍 Παραλαβή"}</span>
        </div>
      </header>
      <div className="space-y-3 p-4 text-sm">
        <ul className="space-y-1.5">
          {o.items.map((i) => (
            <li key={i.id}>
              <div className="flex justify-between gap-2">
                <span>
                  <strong className="text-base">{i.quantity}×</strong> {i.productName}
                </span>
                <span className="shrink-0 text-ink-soft">{formatEuro(i.lineTotalCents)}</span>
              </div>
              {i.selectedOptions.length > 0 && (
                <p className="pl-6 text-ink-soft">{i.selectedOptions.map((x) => x.name).join(", ")}</p>
              )}
              {i.notes && <p className="pl-6 font-medium text-brand-dark">📝 {i.notes}</p>}
            </li>
          ))}
        </ul>
        {o.notes && <p className="rounded-lg bg-amber-50 p-2 font-medium">📝 {o.notes}</p>}
        <div className="flex justify-between border-t border-line pt-2 font-bold">
          <span>Σύνολο ({o.paymentMethod === "cash_on_delivery" ? "μετρητά στην παράδοση" : "πληρωμή στο κατάστημα"})</span>
          <span>{formatEuro(o.totalCents)}</span>
        </div>
        <div className="rounded-lg bg-surface p-2.5">
          <p className="font-semibold">{o.customerName}</p>
          <a href={`tel:${o.customerPhone}`} className="font-medium underline">
            {o.customerPhone}
          </a>
          {o.fulfillment === "delivery" && (
            <p className="mt-1">
              {o.address}
              {o.addressDetails && <span className="block text-ink-soft">{o.addressDetails}</span>}
              <span className="block text-xs text-ink-soft">Περιοχή: {o.deliveryZoneName} · διανομή {formatEuro(o.deliveryFeeCents)}</span>
            </p>
          )}
        </div>
        {o.rejectionReason && <p className="text-danger">Αιτία: {o.rejectionReason}</p>}
        {error && (
          <p className="text-danger" role="alert">
            {error}
          </p>
        )}
        {actions && (
          <div className="flex flex-wrap gap-2">
            {allowedTransitions(o.status, o.fulfillment).map((to) => (
              <button
                key={to}
                type="button"
                disabled={pending}
                onClick={() => change(to)}
                className={
                  to === "rejected" || to === "cancelled"
                    ? "btn-ghost !px-3 text-danger"
                    : to === "accepted"
                      ? "btn-primary flex-1 !py-3 text-base"
                      : "btn-dark flex-1"
                }
              >
                {ACTION_LABELS[to]}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
