"use server";

import { placeOrderSchema, type PlaceOrderInput } from "@/lib/validation";
import { OrderError, placeOrder } from "@/server/orders";
import { rateLimit } from "@/server/rate-limit";
import { clientIpHash } from "@/server/request";

export type PlaceOrderResult =
  | { ok: true; orderId: string; token: string; reference: string; totalCents: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Ελέγξτε τα στοιχεία της φόρμας.", fieldErrors };
  }

  const ip = await clientIpHash();
  if (!(await rateLimit(`order:${ip}`, 8, 600))) {
    return { ok: false, error: "Πάρα πολλές παραγγελίες σε σύντομο χρόνο. Δοκιμάστε ξανά σε λίγα λεπτά." };
  }

  try {
    const order = await placeOrder(parsed.data);
    return { ok: true, orderId: order.id, token: order.accessToken, reference: order.reference, totalCents: order.totalCents };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.message };
    console.error("placeOrder failed", e);
    return { ok: false, error: "Κάτι πήγε στραβά. Η παραγγελία δεν καταχωρίστηκε — δοκιμάστε ξανά." };
  }
}
