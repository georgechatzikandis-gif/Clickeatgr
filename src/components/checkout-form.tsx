"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { placeOrderAction } from "@/app/actions/order";
import { clearCart, setQuantity, useCart, useHydrated, type CartLine } from "@/lib/cart";
import { loadProfile, rememberOrder, saveProfile } from "@/lib/customer";
import { formatEuro } from "@/lib/money";
import { QtyControl } from "./menu-view";

type Business = {
  id: string;
  slug: string;
  name: string;
  isOpen: boolean;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  pickupMinOrderCents: number;
  prepTimeMinutes: number;
  deliveryTimeMinutes: number;
  address: string;
};
type Zone = { id: string; name: string; feeCents: number; minOrderCents: number };
/** Current prices and availability from the database, keyed by product id. */
export type LiveMenu = Record<
  string,
  { priceCents: number; isAvailable: boolean; options: Record<string, { priceDeltaCents: number; isAvailable: boolean }> }
>;
type Props = { business: Business; zones: Zone[]; menu: LiveMenu };
type LiveLine = CartLine & { unavailable: boolean; priceChanged: boolean };

/** Re-prices browser cart lines with the live menu, so the customer never sees outdated prices. */
function refreshLines(lines: CartLine[], menu: LiveMenu): LiveLine[] {
  return lines.map((l) => {
    const p = menu[l.productId];
    const ok = !!p && p.isAvailable && l.optionIds.every((id) => p.options[id]?.isAvailable);
    if (!ok) return { ...l, unavailable: true, priceChanged: false };
    const unit = p.priceCents + l.optionIds.reduce((s, id) => s + p.options[id].priceDeltaCents, 0);
    return { ...l, unitPriceCents: unit, unavailable: false, priceChanged: unit !== l.unitPriceCents };
  });
}

export function CheckoutForm(props: Props) {
  const cart = useCart();
  const hydrated = useHydrated();
  const lines = cart?.businessId === props.business.id ? cart.lines : [];
  if (!hydrated) return <div className="card mt-6 h-64 animate-pulse bg-surface" aria-busy="true" />;
  if (!lines.length) {
    return (
      <div className="card mt-6 p-8 text-center">
        <p className="text-4xl" aria-hidden>🛒</p>
        <p className="mt-2 font-semibold">Το καλάθι σας είναι άδειο</p>
        <Link href={`/r/${props.business.slug}`} className="btn-primary mt-4">
          Επιστροφή στον κατάλογο
        </Link>
      </div>
    );
  }
  // Rendered only in the browser, so saved details can be read when the form is created.
  return <CheckoutInner {...props} lines={refreshLines(lines, props.menu)} />;
}

function CheckoutInner({ business, zones, lines }: Props & { lines: LiveLine[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // One key per checkout: retries after a network error can never create a second order.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<"form" | "review">("form");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved] = useState(loadProfile);
  const [remember, setRemember] = useState(true);
  const [f, setF] = useState({
    fulfillment: (business.acceptsDelivery ? "delivery" : "pickup") as "delivery" | "pickup",
    deliveryZoneId: zones[0]?.id ?? "",
    customerName: saved?.customerName ?? "",
    customerPhone: saved?.customerPhone ?? "",
    customerEmail: saved?.customerEmail ?? "",
    address: saved?.address ?? "",
    addressDetails: saved?.addressDetails ?? "",
    notes: "",
    acceptTerms: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const unavailable = lines.filter((l) => l.unavailable);
  const priceChanged = lines.some((l) => l.priceChanged);
  const orderable = lines.filter((l) => !l.unavailable);

  const zone = zones.find((z) => z.id === f.deliveryZoneId);
  const subtotal = orderable.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const deliveryFee = f.fulfillment === "delivery" ? (zone?.feeCents ?? 0) : 0;
  const minOrder = f.fulfillment === "delivery" ? (zone?.minOrderCents ?? 0) : business.pickupMinOrderCents;
  const belowMin = subtotal < minOrder;
  const total = subtotal + deliveryFee;
  const payment = f.fulfillment === "delivery" ? "Μετρητά κατά την παράδοση" : "Πληρωμή στο κατάστημα κατά την παραλαβή";

  const validateLocally = () => {
    const e: Record<string, string> = {};
    if (f.customerName.trim().length < 2) e.customerName = "Συμπληρώστε το ονοματεπώνυμό σας.";
    if (f.customerPhone.replace(/\D/g, "").length < 10) e.customerPhone = "Συμπληρώστε έγκυρο τηλέφωνο.";
    if (f.fulfillment === "delivery") {
      if (!f.deliveryZoneId) e.deliveryZoneId = "Επιλέξτε περιοχή.";
      if (f.address.trim().length < 5) e.address = "Συμπληρώστε τη διεύθυνση.";
    }
    if (!f.acceptTerms) e.acceptTerms = "Πρέπει να αποδεχτείτε τους όρους.";
    setFieldErrors(e);
    return !Object.keys(e).length;
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await placeOrderAction({
          idempotencyKey,
          businessId: business.id,
          fulfillment: f.fulfillment,
          deliveryZoneId: f.fulfillment === "delivery" ? f.deliveryZoneId : undefined,
          customerName: f.customerName,
          customerPhone: f.customerPhone,
          customerEmail: f.customerEmail,
          address: f.address,
          addressDetails: f.addressDetails,
          notes: f.notes,
          acceptTerms: f.acceptTerms as true,
          lines: orderable.map((l) => ({ productId: l.productId, quantity: l.quantity, optionIds: l.optionIds, notes: l.notes })),
        });
        if (res.ok) {
          saveProfile(
            remember
              ? { customerName: f.customerName, customerPhone: f.customerPhone, customerEmail: f.customerEmail, address: f.address, addressDetails: f.addressDetails }
              : null,
          );
          rememberOrder({
            id: res.orderId,
            token: res.token,
            reference: res.reference,
            businessId: business.id,
            businessSlug: business.slug,
            businessName: business.name,
            totalCents: res.totalCents,
            createdAt: new Date().toISOString(),
            lines: orderable.map((l) => ({
              key: l.key,
              productId: l.productId,
              name: l.name,
              optionIds: l.optionIds,
              optionLabels: l.optionLabels,
              unitPriceCents: l.unitPriceCents,
              quantity: l.quantity,
              notes: l.notes,
            })),
          });
          clearCart();
          router.replace(`/order/${res.orderId}?t=${encodeURIComponent(res.token)}`);
          return;
        }
        setError(res.error);
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
          setStep("form");
        }
      } catch {
        setError("Πρόβλημα σύνδεσης. Ελέγξτε το ίντερνετ και πατήστε ξανά «Επιβεβαίωση» — η παραγγελία δεν θα καταχωριστεί δύο φορές.");
      }
    });
  };

  const err = (k: string) =>
    fieldErrors[k] ? (
      <p className="mt-1 text-sm text-danger" role="alert">
        {fieldErrors[k]}
      </p>
    ) : null;

  const summary = (
    <div className="card p-4">
      <h2 className="font-bold">Η παραγγελία σας</h2>
      <ul className="mt-2 divide-y divide-line">
        {lines.map((l) => (
          <li key={l.key} className={`py-2.5 text-sm ${l.unavailable ? "opacity-60" : ""}`}>
            <div className="flex justify-between gap-3">
              <span className="font-medium">
                {step === "review" && `${l.quantity}× `}
                {l.name}
              </span>
              <span className="shrink-0">{formatEuro(l.unitPriceCents * l.quantity)}</span>
            </div>
            {l.optionLabels.length > 0 && <p className="text-xs text-ink-soft">{l.optionLabels.join(", ")}</p>}
            {l.notes && <p className="text-xs italic text-ink-soft">«{l.notes}»</p>}
            {l.unavailable && <p className="text-xs font-semibold text-danger">Δεν είναι πλέον διαθέσιμο</p>}
            {step === "form" && <QtyControl value={l.quantity} onChange={(q) => setQuantity(l.key, q)} />}
          </li>
        ))}
      </ul>
      <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between">
          <dt>Υποσύνολο</dt>
          <dd>{formatEuro(subtotal)}</dd>
        </div>
        {f.fulfillment === "delivery" && (
          <div className="flex justify-between">
            <dt>Κόστος διανομής</dt>
            <dd>{deliveryFee ? formatEuro(deliveryFee) : "Δωρεάν"}</dd>
          </div>
        )}
        <div className="flex justify-between pt-1 text-base font-bold">
          <dt>Σύνολο</dt>
          <dd>{formatEuro(total)}</dd>
        </div>
        <div className="flex justify-between text-ink-soft">
          <dt>Πληρωμή</dt>
          <dd className="text-right">{payment}</dd>
        </div>
      </dl>
      {priceChanged && (
        <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-brand-dark">Ορισμένες τιμές άλλαξαν από το κατάστημα και ενημερώθηκαν.</p>
      )}
      {unavailable.length > 0 && (
        <div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-danger">
          <p>{unavailable.length === 1 ? "Ένα προϊόν δεν είναι πλέον διαθέσιμο." : `${unavailable.length} προϊόντα δεν είναι πλέον διαθέσιμα.`}</p>
          <button type="button" className="mt-1 font-semibold underline" onClick={() => unavailable.forEach((l) => setQuantity(l.key, 0))}>
            Αφαίρεση από το καλάθι
          </button>
        </div>
      )}
      {belowMin && (
        <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-brand-dark">
          Η ελάχιστη παραγγελία είναι {formatEuro(minOrder)}. Προσθέστε ακόμη {formatEuro(minOrder - subtotal)}.
        </p>
      )}
    </div>
  );

  if (step === "review") {
    return (
      <div className="mt-6 space-y-4">
        {summary}
        <div className="card space-y-1 p-4 text-sm">
          <h2 className="mb-1 font-bold">Στοιχεία</h2>
          <p>
            <strong>{f.customerName}</strong> · {f.customerPhone}
            {f.customerEmail && ` · ${f.customerEmail}`}
          </p>
          {f.fulfillment === "delivery" ? (
            <p>
              🛵 Διανομή: {f.address}
              {f.addressDetails && ` (${f.addressDetails})`} – {zone?.name}
            </p>
          ) : (
            <p>🛍 Παραλαβή από το κατάστημα{business.address && `: ${business.address}`}</p>
          )}
          {f.notes && <p>📝 {f.notes}</p>}
          <p className="text-ink-soft">
            Εκτιμώμενος χρόνος: ~
            {business.prepTimeMinutes + (f.fulfillment === "delivery" ? business.deliveryTimeMinutes : 0)} λεπτά από την αποδοχή.
          </p>
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" className="btn-ghost" onClick={() => setStep("form")} disabled={pending}>
            ← Αλλαγές
          </button>
          <button type="button" className="btn-primary flex-1 !py-3.5 text-base" onClick={submit} disabled={pending || !business.isOpen}>
            {pending ? "Αποστολή…" : `Επιβεβαίωση παραγγελίας · ${formatEuro(total)}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="mt-6 grid gap-6 md:grid-cols-[1fr_340px]"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (validateLocally() && !belowMin && !unavailable.length) setStep("review");
      }}
    >
      <div className="space-y-6">
        {!business.isOpen && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-danger" role="alert">
            Το κατάστημα είναι κλειστό αυτή τη στιγμή και δεν δέχεται παραγγελίες.
          </p>
        )}
        <fieldset>
          <legend className="mb-2 font-bold">Τρόπος παραλαβής</legend>
          <div className="grid grid-cols-2 gap-2">
            {business.acceptsDelivery && (
              <label className={`card cursor-pointer p-3 text-center ${f.fulfillment === "delivery" ? "!border-brand ring-2 ring-brand/30" : ""}`}>
                <input type="radio" name="fulfillment" className="sr-only" checked={f.fulfillment === "delivery"} onChange={() => set("fulfillment", "delivery")} />
                <span className="block text-xl" aria-hidden>🛵</span>
                <span className="font-semibold">Διανομή</span>
              </label>
            )}
            {business.acceptsPickup && (
              <label className={`card cursor-pointer p-3 text-center ${f.fulfillment === "pickup" ? "!border-brand ring-2 ring-brand/30" : ""}`}>
                <input type="radio" name="fulfillment" className="sr-only" checked={f.fulfillment === "pickup"} onChange={() => set("fulfillment", "pickup")} />
                <span className="block text-xl" aria-hidden>🛍</span>
                <span className="font-semibold">Παραλαβή</span>
              </label>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 font-bold">Στοιχεία επικοινωνίας</legend>
          <div>
            <label className="label" htmlFor="name">Ονοματεπώνυμο *</label>
            <input id="name" className="input" autoComplete="name" maxLength={80} value={f.customerName} onChange={(e) => set("customerName", e.target.value)} />
            {err("customerName")}
          </div>
          <div>
            <label className="label" htmlFor="phone">Κινητό τηλέφωνο *</label>
            <input id="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="69xxxxxxxx" value={f.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} />
            {err("customerPhone")}
          </div>
          <div>
            <label className="label" htmlFor="email">Email (προαιρετικό)</label>
            <input id="email" className="input" type="email" autoComplete="email" value={f.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} />
            {err("customerEmail")}
          </div>
        </fieldset>

        {f.fulfillment === "delivery" && (
          <fieldset className="space-y-3">
            <legend className="mb-2 font-bold">Διεύθυνση παράδοσης</legend>
            <div>
              <label className="label" htmlFor="zone">Περιοχή *</label>
              <select id="zone" className="input" value={f.deliveryZoneId} onChange={(e) => set("deliveryZoneId", e.target.value)}>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} — διανομή {z.feeCents ? formatEuro(z.feeCents) : "δωρεάν"}, ελάχ. {formatEuro(z.minOrderCents)}
                  </option>
                ))}
              </select>
              {err("deliveryZoneId")}
            </div>
            <div>
              <label className="label" htmlFor="address">Οδός και αριθμός *</label>
              <input id="address" className="input" autoComplete="street-address" maxLength={200} value={f.address} onChange={(e) => set("address", e.target.value)} />
              {err("address")}
            </div>
            <div>
              <label className="label" htmlFor="address2">Όροφος, κουδούνι, ξενοδοχείο / δωμάτιο</label>
              <input id="address2" className="input" maxLength={200} value={f.addressDetails} onChange={(e) => set("addressDetails", e.target.value)} />
            </div>
          </fieldset>
        )}

        <div>
          <label className="label" htmlFor="notes">Σχόλια παραγγελίας</label>
          <textarea id="notes" className="input" rows={2} maxLength={500} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        <div className="rounded-xl bg-surface p-3 text-sm">
          <strong>Πληρωμή:</strong> {payment}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-amber-500" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Να θυμάται αυτή η συσκευή τα στοιχεία μου για την επόμενη παραγγελία (αποθηκεύονται μόνο στη συσκευή σας).</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-amber-500" checked={f.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} />
          <span>
            Αποδέχομαι τους <Link href="/terms" target="_blank" className="underline">όρους χρήσης</Link> και έχω διαβάσει την{" "}
            <Link href="/privacy" target="_blank" className="underline">πολιτική απορρήτου</Link>. Τα στοιχεία μου θα σταλούν στο κατάστημα για την εκτέλεση της παραγγελίας.
          </span>
        </label>
        {err("acceptTerms")}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-danger" role="alert">{error}</p>}
      </div>

      <div className="space-y-3 md:sticky md:top-20 md:self-start">
        {summary}
        <button type="submit" className="btn-primary w-full !py-3.5 text-base" disabled={belowMin || !business.isOpen || unavailable.length > 0}>
          Έλεγχος παραγγελίας
        </button>
        <Link href={`/r/${business.slug}`} className="block text-center text-sm text-ink-soft underline">
          Προσθήκη κι άλλων προϊόντων
        </Link>
      </div>
    </form>
  );
}
