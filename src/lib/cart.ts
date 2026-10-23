"use client";

import { useSyncExternalStore } from "react";

// The cart lives in the browser only. Prices here are for display; the server recalculates everything.
export type CartLine = {
  key: string;
  productId: string;
  name: string;
  optionIds: string[];
  optionLabels: string[];
  unitPriceCents: number;
  quantity: number;
  notes?: string;
};
export type Cart = { businessId: string; businessSlug: string; businessName: string; lines: CartLine[] };

const KEY = "clickeat.cart.v1";
const listeners = new Set<() => void>();
let cached: Cart | null | undefined;

function read(): Cart | null {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as Cart) : null;
  } catch {
    cached = null;
  }
  return cached;
}

function write(cart: Cart | null) {
  cached = cart && cart.lines.length ? cart : null;
  try {
    if (cached) localStorage.setItem(KEY, JSON.stringify(cached));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable (private mode): cart still works for this page view */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cached = undefined;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): Cart | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export const cartCount = (c: Cart | null) => c?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0;
export const cartSubtotal = (c: Cart | null) => c?.lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0) ?? 0;

/** Returns false (and changes nothing) if the cart holds items from another business. */
export function addToCart(
  business: { id: string; slug: string; name: string },
  line: Omit<CartLine, "key">,
  opts: { replaceOtherBusiness?: boolean } = {},
): boolean {
  const current = read();
  if (current && current.businessId !== business.id && !opts.replaceOtherBusiness) return false;
  const base: Cart =
    current && current.businessId === business.id
      ? current
      : { businessId: business.id, businessSlug: business.slug, businessName: business.name, lines: [] };
  const key = `${line.productId}|${[...line.optionIds].sort().join(",")}|${line.notes ?? ""}`;
  const existing = base.lines.find((l) => l.key === key);
  const lines = existing
    ? base.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l))
    : [...base.lines, { ...line, key }];
  write({ ...base, lines });
  return true;
}

export function setQuantity(key: string, quantity: number) {
  const c = read();
  if (!c) return;
  const lines =
    quantity <= 0
      ? c.lines.filter((l) => l.key !== key)
      : c.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, quantity) } : l));
  write({ ...c, lines });
}

export function clearCart() {
  write(null);
}

const noopSubscribe = () => () => {};
/** False during server rendering and hydration, true once browser storage can be read. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
