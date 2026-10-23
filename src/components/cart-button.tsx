"use client";

import Link from "next/link";
import { cartCount, cartSubtotal, useCart } from "@/lib/cart";
import { formatEuro } from "@/lib/money";

export function CartButton() {
  const cart = useCart();
  const count = cartCount(cart);
  if (!cart || !count) return null;
  return (
    <Link
      href={`/r/${cart.businessSlug}/checkout`}
      className="btn-dark !rounded-full !px-3.5 !py-2 text-sm"
      aria-label={`Καλάθι: ${count} προϊόντα`}
    >
      <span aria-hidden>🛒</span>
      <span>{count}</span>
      <span className="hidden sm:inline">· {formatEuro(cartSubtotal(cart))}</span>
    </Link>
  );
}
