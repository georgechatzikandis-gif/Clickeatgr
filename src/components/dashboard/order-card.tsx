"use client";

import { useState, useTransition } from "react";
import { delayOrderAction, setOrderStatusAction } from "@/app/actions/business";
import type { OrderStatus } from "@/db/schema";
import { formatAthens } from "@/lib/hours";
import { formatEuro } from "@/lib/money";
import { ETA_CHOICES, STATUS_LABELS, allowedTransitions } from "@/lib/order-status";
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

export function OrderCard({
  order: o,
  now,
  actions = true,
  suggestedMinutes,
}: {
  order: OrderWithItems;
  now: number;
  actions?: boolean;
  /** Usual time for this business (prep, plus delivery for delivery orders); highlighted when accepting. */
  suggestedMinutes?: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isNew = o.status === "pending";
  const minutesAgo = Math.max(0, Math.round((now - new Date(o.createdAt).getTime()) / 60000));

  const suggested =
    suggestedMinutes === undefined
      ? undefined
      : ETA_CHOICES.reduce((best, m) => (Math.abs(m - suggestedMinutes) < Math.abs(best - suggestedMinutes) ? m : best));
  const etaMinutesLeft = o.estimatedAt ? Math.round((new Date(o.estimatedAt).getTime() - now) / 60000) : null;

  const delay = (minutes: number) => {
    setError(null);
    start(async () => {
      const res = await delayOrderAction(o.id, minutes);
      if (res?.error) setError(res.error);
    });
  };

  const change = (to: OrderStatus, estimatedMinutes?: number) => {
    let note: string | undefined;
    if (to === "rejected" || to === "cancelled") {
      const r = window.prompt(to === "rejected" ? "Αιτία απόρριψης (θα τη δει ο πελάτης):" : "Αιτία ακύρωσης:");
      if (r === null) return;
      note = r;
    }
    setError(null);
    start(async () => {
      const res = await setOrderStatusAction(o.id, to, note, estimatedMinutes);
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
          {/* Relative times depend on the clock, which differs slightly between server and browser. */}
          <p className="text-xs text-ink-soft" suppressHydrationWarning>
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
        {o.estimatedAt && !["completed", "rejected", "cancelled"].includes(o.status) && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-50 p-2.5">
            <p>
              ⏱ {o.fulfillment === "delivery" ? "Παράδοση" : "Έτοιμη"} έως{" "}
              <strong>{formatAthens(new Date(o.estimatedAt), { timeStyle: "short" })}</strong>
              <span suppressHydrationWarning className={`ml-1 ${etaMinutesLeft !== null && etaMinutesLeft < 0 ? "font-semibold text-danger" : "text-ink-soft"}`}>
                {etaMinutesLeft !== null && etaMinutesLeft >= 0 ? `(σε ${etaMinutesLeft}′)` : `(καθυστέρηση ${-(etaMinutesLeft ?? 0)}′)`}
              </span>
            </p>
            {actions && (
              <button type="button" disabled={pending} onClick={() => delay(10)} className="btn-ghost !px-2.5 !py-1 text-xs">
                +10′
              </button>
            )}
          </div>
        )}
        {actions && isNew && (
          <div>
            <p className="mb-1.5 font-semibold">Αποδοχή — έτοιμη σε:</p>
            <div className="grid grid-cols-3 gap-2">
              {ETA_CHOICES.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={pending}
                  onClick={() => change("accepted", m)}
                  className={m === suggested ? "btn-primary !py-3 text-base" : "btn-dark !py-3 text-base"}
                  aria-label={`Αποδοχή, έτοιμη σε ${m} λεπτά`}
                >
                  {m}′
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              {o.fulfillment === "delivery" ? "Χρόνος μέχρι να φτάσει στον πελάτη." : "Χρόνος μέχρι να είναι έτοιμη για παραλαβή."}{" "}
              Ο πελάτης βλέπει αμέσως την ώρα.
            </p>
          </div>
        )}
        {actions && (
          <div className="flex flex-wrap gap-2">
            {allowedTransitions(o.status, o.fulfillment)
              .filter((to) => to !== "accepted")
              .map((to) => (
              <button
                key={to}
                type="button"
                disabled={pending}
                onClick={() => change(to)}
                className={to === "rejected" || to === "cancelled" ? "btn-ghost !px-3 text-danger" : "btn-dark flex-1"}
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
