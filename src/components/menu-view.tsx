"use client";

import { useEffect, useMemo, useState } from "react";
import { addToCart, cartCount, cartSubtotal, useCart } from "@/lib/cart";
import { formatEuro } from "@/lib/money";
import type { PublicMenuProduct } from "@/server/catalog";
import { AreaPicker, CartPanel, MinimumOrderStatus, useOrderTerms, type DeliveryInfo } from "./cart-panel";

type Business = { id: string; slug: string; name: string };
type Section = { id: string; name: string; products: PublicMenuProduct[] };

export function MenuView({
  business,
  sections,
  canOrder,
  delivery,
}: {
  business: Business;
  sections: Section[];
  canOrder: boolean;
  delivery: DeliveryInfo;
}) {
  const [selected, setSelected] = useState<PublicMenuProduct | null>(null);
  const [q, setQ] = useState("");
  const cart = useCart();
  const shown = useMemo(() => {
    const nq = normalize(q.trim());
    if (!nq) return sections;
    // While searching, show one flat list of matches (without the duplicated "Popular" section).
    const seen = new Set<string>();
    const matches = sections
      .filter((s) => s.id !== "popular")
      .flatMap((s) => s.products)
      .filter((p) => !seen.has(p.id) && seen.add(p.id) && normalize(`${p.name} ${p.description}`).includes(nq));
    return [{ id: "search", name: `Αποτελέσματα για «${q.trim()}»`, products: matches }];
  }, [q, sections]);
  const ownCart = cart?.businessId === business.id ? cart : null;
  const count = cartCount(ownCart);

  if (!sections.length) {
    return (
      <div className="card my-8 p-8 text-center text-ink-soft">
        Το κατάστημα δεν έχει ακόμη προσθέσει προϊόντα στον κατάλογο.
      </div>
    );
  }

  return (
    <div className="mt-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
      <div>
        {!canOrder && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-danger" role="status">
            Το κατάστημα δεν δέχεται παραγγελίες αυτή τη στιγμή. Μπορείτε να δείτε τον κατάλογο.
          </div>
        )}
        <div className="mb-3 lg:hidden">
          <AreaPicker business={business} info={delivery} />
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση στον κατάλογο…"
          aria-label="Αναζήτηση στον κατάλογο"
          className="input mb-2"
        />
        <nav
          className="sticky top-16 z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-line bg-white px-4 py-2 [scrollbar-width:none]"
          aria-label="Κατηγορίες καταλόγου"
        >
          {shown.map((s) => (
            <a key={s.id} href={`#sec-${s.id}`} className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-sm font-medium hover:bg-brand-soft">
              {s.name}
            </a>
          ))}
        </nav>
        {shown[0]?.id === "search" && !shown[0].products.length && (
          <p className="py-6 text-center text-ink-soft">Δεν βρέθηκαν προϊόντα.</p>
        )}
        {shown.map((s) => (
          <section key={s.id} id={`sec-${s.id}`} className="scroll-mt-32 pt-6">
            <h2 className="text-lg font-bold">{s.name}</h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {s.products.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={!p.isAvailable}
                    onClick={() => setSelected(p)}
                    className="card flex w-full gap-3 p-3 text-left transition enabled:hover:border-brand disabled:opacity-60"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{p.name}</h3>
                      {p.description && <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{p.description}</p>}
                      <p className="mt-1.5 font-semibold">
                        {p.groups.some((g) => g.options.some((o) => o.priceDeltaCents > 0)) && (
                          <span className="font-normal text-ink-soft">από </span>
                        )}
                        {formatEuro(p.priceCents)}
                      </p>
                      {!p.isAvailable && <p className="mt-1 text-xs font-semibold text-danger">Μη διαθέσιμο</p>}
                    </div>
                    {p.imageId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/img/${p.imageId}`} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="hidden lg:block">
        <div className="card sticky top-20 mt-6 p-4">
          <h2 className="mb-3 font-bold">Το καλάθι σας</h2>
          <CartPanel business={business} info={delivery} canOrder={canOrder} />
        </div>
      </aside>

      {count > 0 && (
        <MobileCartBar business={business} info={delivery} canOrder={canOrder} count={count} subtotal={cartSubtotal(ownCart)} />
      )}
      {count > 0 && <div className="h-28 lg:hidden" />}

      {selected && (
        <ProductDialog
          product={selected}
          business={business}
          canOrder={canOrder}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/** Mobile: a bottom bar with the minimum-order status; tapping it opens the full cart as a sheet. */
function MobileCartBar({
  business,
  info,
  canOrder,
  count,
  subtotal,
}: {
  business: Business;
  info: DeliveryInfo;
  canOrder: boolean;
  count: number;
  subtotal: number;
}) {
  const [open, setOpen] = useState(false);
  const { deliveryFee } = useOrderTerms(business, info);
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 space-y-2 border-t border-line bg-white p-3 lg:hidden">
        <MinimumOrderStatus business={business} info={info} />
        <button type="button" className="btn-primary w-full !py-3" onClick={() => setOpen(true)}>
          Καλάθι ({count}) · {formatEuro(subtotal + deliveryFee)}
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Το καλάθι σας"
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Το καλάθι σας</h2>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)} aria-label="Κλείσιμο καλαθιού">
                ✕
              </button>
            </div>
            <CartPanel business={business} info={info} canOrder={canOrder} />
          </div>
        </div>
      )}
    </>
  );
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function QtyControl({ value, onChange }: { value: number; onChange: (q: number) => void }) {
  return (
    <div className="mt-1 inline-flex items-center rounded-full border border-line">
      <button type="button" className="h-8 w-8 rounded-full text-lg hover:bg-surface" onClick={() => onChange(value - 1)} aria-label="Μείωση ποσότητας">
        −
      </button>
      <span className="w-7 text-center text-sm font-semibold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="h-8 w-8 rounded-full text-lg hover:bg-surface disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={value >= 50}
        aria-label="Αύξηση ποσότητας"
      >
        +
      </button>
    </div>
  );
}

function ProductDialog({
  product,
  business,
  canOrder,
  onClose,
}: {
  product: PublicMenuProduct;
  business: Business;
  canOrder: boolean;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      product.groups.map((g) => {
        // Pre-select the first available option of required single-choice groups.
        const first = g.options.find((o) => o.isAvailable);
        return [g.id, g.minSelect === 1 && g.maxSelect === 1 && first ? [first.id] : []];
      }),
    ),
  );
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const toggle = (groupId: string, optionId: string, max: number) => {
    setPicked((prev) => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optionId)) return { ...prev, [groupId]: cur.filter((x) => x !== optionId) };
      if (max === 1) return { ...prev, [groupId]: [optionId] };
      if (cur.length >= max) return prev;
      return { ...prev, [groupId]: [...cur, optionId] };
    });
  };

  const chosen = product.groups.flatMap((g) => g.options.filter((o) => picked[g.id]?.includes(o.id)));
  const unit = product.priceCents + chosen.reduce((s, o) => s + o.priceDeltaCents, 0);
  const missing = product.groups.find((g) => (picked[g.id]?.length ?? 0) < g.minSelect);

  const add = () => {
    if (missing) {
      setError(`Επιλέξτε «${missing.name}».`);
      return;
    }
    const line = {
      productId: product.id,
      name: product.name,
      optionIds: chosen.map((o) => o.id),
      optionLabels: chosen.map((o) => o.name),
      unitPriceCents: unit,
      quantity: qty,
      notes: notes.trim() || undefined,
    };
    if (!addToCart(business, line)) {
      if (!window.confirm("Το καλάθι σας περιέχει προϊόντα από άλλο κατάστημα. Να αδειάσει και να προστεθεί αυτό το προϊόν;")) return;
      addToCart(business, line, { replaceOtherBusiness: true });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto">
          {product.imageId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/img/${product.imageId}`} alt="" className="aspect-[16/10] w-full object-cover" />
          )}
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id="product-title" className="text-xl font-bold">
                {product.name}
              </h2>
              <button type="button" onClick={onClose} className="-mr-2 -mt-1 rounded-full p-2 text-xl leading-none hover:bg-surface" aria-label="Κλείσιμο">
                ✕
              </button>
            </div>
            {product.description && <p className="mt-1 text-ink-soft">{product.description}</p>}
            <p className="mt-2 text-xs text-ink-soft">
              <strong>Αλλεργιογόνα:</strong> {product.allergens || "Ρωτήστε το κατάστημα"}
            </p>

            {product.groups.map((g) => (
              <fieldset key={g.id} className="mt-5">
                <legend className="flex w-full items-center justify-between">
                  <span className="font-semibold">{g.name}</span>
                  <span className="text-xs text-ink-soft">
                    {g.minSelect > 0 ? "Υποχρεωτικό" : "Προαιρετικό"}
                    {g.maxSelect > 1 ? ` · έως ${g.maxSelect}` : ""}
                  </span>
                </legend>
                <div className="mt-2 divide-y divide-line rounded-xl border border-line">
                  {g.options.map((o) => {
                    const checked = picked[g.id]?.includes(o.id) ?? false;
                    return (
                      <label
                        key={o.id}
                        className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${!o.isAvailable ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        <input
                          type={g.maxSelect === 1 ? "radio" : "checkbox"}
                          name={g.id}
                          checked={checked}
                          disabled={!o.isAvailable}
                          onChange={() => toggle(g.id, o.id, g.maxSelect)}
                          className="h-4 w-4 accent-amber-500"
                        />
                        <span className="flex-1">{o.name}</span>
                        {o.priceDeltaCents > 0 && <span className="text-sm text-ink-soft">+{formatEuro(o.priceDeltaCents)}</span>}
                        {!o.isAvailable && <span className="text-xs text-danger">Εξαντλήθηκε</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <label className="label mt-5" htmlFor="item-notes">
              Σχόλια για το προϊόν
            </label>
            <textarea
              id="item-notes"
              className="input"
              rows={2}
              maxLength={200}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="π.χ. καλοψημένο"
            />
          </div>
        </div>
        <div className="border-t border-line p-4">
          {error && (
            <p className="mb-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <QtyControl value={qty} onChange={(q) => setQty(Math.max(1, q))} />
            <button type="button" className="btn-primary flex-1 !py-3" onClick={add} disabled={!canOrder}>
              {canOrder ? `Προσθήκη · ${formatEuro(unit * qty)}` : "Κλειστό τώρα"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
