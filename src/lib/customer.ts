"use client";

import type { CartLine } from "./cart";

// Customer convenience data stored ONLY on the customer's own device (never on our servers).
const PROFILE_KEY = "clickeat.customer.v1";
const ORDERS_KEY = "clickeat.orders.v1";
const MAX_ORDERS = 10;

export type CustomerProfile = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  addressDetails: string;
};

export type RecentOrder = {
  id: string;
  token: string;
  reference: string;
  businessId: string;
  businessSlug: string;
  businessName: string;
  totalCents: number;
  createdAt: string;
  lines: CartLine[];
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export const loadProfile = () => read<CustomerProfile>(PROFILE_KEY);
export const saveProfile = (p: CustomerProfile | null) => write(PROFILE_KEY, p);

export const loadRecentOrders = () => read<RecentOrder[]>(ORDERS_KEY) ?? [];
export function rememberOrder(o: RecentOrder) {
  write(ORDERS_KEY, [o, ...loadRecentOrders().filter((x) => x.id !== o.id)].slice(0, MAX_ORDERS));
}
export const forgetOrders = () => write(ORDERS_KEY, null);
