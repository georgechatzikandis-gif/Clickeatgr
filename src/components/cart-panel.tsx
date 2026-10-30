"use client";

import Link from "next/link";
import { useId } from "react";
import { setAreaChoice, useAreaChoice } from "@/lib/area";
import { cartSubtotal, setQuantity, useCart } from "@/lib/cart";
import { formatEuro } from "@/lib/money";
import { QtyControl } from "./menu-view";

export type DeliveryInfo = {
  zones: { id: string; name: string; feeCents: number; minOrderCents: number }[];
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  pickupMinOrderCents: number;
};
type Business = { id: string; slug: string; name: string };

/** Resolves the customer's current choice (with sensible defaults) and the resulting fee and minimum. */
export function useOrderTerms(business: Business, info: DeliveryInfo) {
  const saved = useAreaChoice(business.id);
  const fulfillment: "delivery" | "pickup" =
    saved?.fulfillment === "pickup" && info.acceptsPickup
      ? "pickup"
      : info.acceptsDelivery
        ? "delivery"
        : "pickup";
  const zone = fulfillment === "delivery" ? info.zones.find((z) => z.id === saved?.zoneId) : undefined;
  const cart = useCart();
  const ownCart = cart?.businessId === business.id ? cart : null;
  const subtotal = cartSubtotal(ownCart);
  const deliveryFee = zone?.feeCents ?? 0;
  const minOrder = fulfillment === "pickup" ? info.pickupMinOrderCents : (zone?.minOrderCents ?? null);
  const missing = minOrder === null ? null : Math.max(0, minOrder - subtotal);
  return { fulfillment, zone, ownCart, subtotal, deliveryFee, minOrder, missing, needsZone: fulfillment === "delivery" && !zone };
}

/** "Delivery to <area> / Pickup" picker shown on the menu page. */
export function AreaPicker({ business, info, compact = false }: { business: Business; info: DeliveryInfo; compact?: boolean }) {
  const { fulfillment, zone } = useOrderTerms(business, info);
  const choose = (f: "delivery" | "pickup", zoneId: string | null) => setAreaChoice(business.id, { fulfillment: f, zoneId });
  const value = fulfillment === "pickup" ? "pickup" : (zone?.id ?? "");
  // The picker appears more than once on the page (top of the menu, cart sidebar, mobile sheet).
  const id = useId();
  return (
    <div className={compact ? "" : "card p-3"}>
      <label htmlFor={id} className="label">
        📍 {info.acceptsDelivery ? "Πού θα το παραδώσουμε;" : "Τρόπος παραλαβής"}
      </label>
      <select
        id={id}
        className={`input ${!value ? "!border-brand ring-2 ring-brand/30" : ""}`}
        value={value}
        onChange={(e) => (e.target.value === "pickup" ? choose("pickup", null) : choose("delivery", e.target.value || null))}
      >
        {info.acceptsDelivery && <option value="">— Επιλέξτε περιοχή —</option>}
        {info.acceptsDelivery &&
          info.zones.map((z) => (
            <option key={z.id} value={z.id}>
              🛵 {z.name} · διανομή {z.feeCents ? formatEuro(z.feeCents) : "δωρεάν"} · ελάχ. {formatEuro(z.minOrderCents)}
            </option>
          ))}
        {info.acceptsPickup && (
          <option value="pickup">
            🛍 Παραλαβή από το κατάστημα{info.pickupMinOrderCents ? ` · ελάχ. ${formatEuro(info.pickupMinOrderCents)}` : ""}
          </option>
        )}
      </select>
      {info.acceptsDelivery && !info.zones.length && <p className="mt-1 text-xs text-ink-soft">Το κατάστημα δεν έχει ορίσει περιοχές διανομής.</p>}
    </div>
  );
}

/** Progress towards the minimum order, or a prompt to pick an area. */
export function MinimumOrderStatus({ business, info }: { business: Business; info: DeliveryInfo }) {
  const { needsZone, minOrder, missing, subtotal } = useOrderTerms(business, info);
  if (needsZone) return <p className="text-sm font-medium text-brand-dark">Επιλέξτε περιοχή για να δείτε κόστος διανομής και ελάχιστη παραγγελία.</p>;
  if (!minOrder) return null;
  const pct = Math.min(100, Math.round((subtotal / minOrder) * 100));
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`h-full rounded-full ${missing ? "bg-brand" : "bg-ok"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`mt-1 text-sm ${missing ? "text-brand-dark" : "text-ok"}`} role="status">
        {missing ? `Λείπουν ${formatEuro(missing)} για την ελάχιστη παραγγελία (${formatEuro(minOrder)})` : "✓ Συμπληρώθηκε η ελάχιστη παραγγελία"}
      </p>
    </div>
  );
}

/** Cart contents, fees, minimum-order status and the button to continue to checkout. */
export function CartPanel({ business, info, canOrder }: { business: Business; info: DeliveryInfo; canOrder: boolean }) {
  const terms = useOrderTerms(business, info);
  const { ownCart, subtotal, deliveryFee, fulfillment, missing, needsZone } = terms;
  const blocked = !canOrder || needsZone || (missing ?? 0) > 0;
  return (
    <div className="space-y-3">
      <AreaPicker business={business} info={info} compact />
      {ownCart ? (
        <>
          <ul className="divide-y divide-line">
            {ownCart.lines.map((l) => (
              <li key={l.key} className="py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{l.name}</span>
                  <span>{formatEuro(l.unitPriceCents * l.quantity)}</span>
                </div>
                {l.optionLabels.length > 0 && <p className="text-xs text-ink-soft">{l.optionLabels.join(", ")}</p>}
                <QtyControl value={l.quantity} onChange={(q) => setQuantity(l.key, q)} />
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <dt>Υποσύνολο</dt>
              <dd>{formatEuro(subtotal)}</dd>
            </div>
            {fulfillment === "delivery" && !needsZone && (
              <div className="flex justify-between">
                <dt>Διανομή</dt>
                <dd>{deliveryFee ? formatEuro(deliveryFee) : "Δωρεάν"}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <dt>Σύνολο</dt>
              <dd>{formatEuro(subtotal + deliveryFee)}</dd>
            </div>
          </dl>
          <MinimumOrderStatus business={business} info={info} />
          {blocked ? (
            <button type="button" disabled className="btn-primary w-full !py-3">
              {!canOrder ? "Κλειστό τώρα" : needsZone ? "Επιλέξτε περιοχή" : `Λείπουν ${formatEuro(missing ?? 0)}`}
            </button>
          ) : (
            <Link href={`/r/${business.slug}/checkout`} className="btn-primary w-full !py-3">
              Συνέχεια στο ταμείο · {formatEuro(subtotal + deliveryFee)}
            </Link>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-soft">Το καλάθι είναι άδειο. Επιλέξτε προϊόντα από τον κατάλογο.</p>
      )}
    </div>
  );
}
