"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cartCount, replaceCart, useCart, useHydrated } from "@/lib/cart";
import { forgetOrders, loadRecentOrders, type RecentOrder } from "@/lib/customer";
import { formatEuro } from "@/lib/money";

/** "Your orders" strip with status links and one-tap "order again" (data from this device only). */
export function RecentOrders() {
  return useHydrated() ? <RecentOrdersInner /> : null;
}

function RecentOrdersInner() {
  const router = useRouter();
  const cart = useCart();
  const [orders, setOrders] = useState(loadRecentOrders);
  if (!orders.length) return null;

  const again = (o: RecentOrder) => {
    if (cart && cartCount(cart) > 0 && !window.confirm("Το τρέχον καλάθι σας θα αντικατασταθεί. Συνέχεια;")) return;
    replaceCart({ businessId: o.businessId, businessSlug: o.businessSlug, businessName: o.businessName, lines: o.lines });
    // Checkout re-checks prices and availability against the live menu.
    router.push(`/r/${o.businessSlug}/checkout`);
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-4" aria-labelledby="recent-orders">
      <div className="flex items-baseline justify-between">
        <h2 id="recent-orders" className="font-bold">Οι παραγγελίες σας</h2>
        <button
          type="button"
          className="text-xs text-ink-soft underline"
          onClick={() => {
            forgetOrders();
            setOrders([]);
          }}
        >
          Διαγραφή
        </button>
      </div>
      <ul className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {orders.slice(0, 6).map((o) => (
          <li key={o.id} className="card w-64 shrink-0 p-3 text-sm">
            <p className="truncate font-semibold">{o.businessName}</p>
            <p className="truncate text-ink-soft">
              {o.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {o.reference} · {new Date(o.createdAt).toLocaleDateString("el-GR")} · {formatEuro(o.totalCents)}
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn-primary flex-1 !py-1.5 text-sm" onClick={() => again(o)}>
                Ξανά
              </button>
              <Link href={`/order/${o.id}?t=${encodeURIComponent(o.token)}`} className="btn-ghost !py-1.5 text-sm">
                Κατάσταση
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
