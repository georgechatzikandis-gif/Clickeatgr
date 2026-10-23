import type { OrderStatus } from "@/db/schema";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Νέα",
  accepted: "Αποδεκτή",
  preparing: "Ετοιμάζεται",
  ready: "Έτοιμη",
  out_for_delivery: "Σε διανομή",
  completed: "Ολοκληρώθηκε",
  rejected: "Απορρίφθηκε",
  cancelled: "Ακυρώθηκε",
};

export const OPEN_STATUSES: OrderStatus[] = ["pending", "accepted", "preparing", "ready", "out_for_delivery"];
export const FINAL_STATUSES: OrderStatus[] = ["completed", "rejected", "cancelled"];

/** Allowed status changes for a business. Pickup orders skip "out_for_delivery". */
export function allowedTransitions(from: OrderStatus, fulfillment: "delivery" | "pickup"): OrderStatus[] {
  switch (from) {
    case "pending":
      return ["accepted", "rejected"];
    case "accepted":
      return ["preparing", "ready", "cancelled"];
    case "preparing":
      return ["ready", "cancelled"];
    case "ready":
      return fulfillment === "delivery" ? ["out_for_delivery", "completed", "cancelled"] : ["completed", "cancelled"];
    case "out_for_delivery":
      return ["completed", "cancelled"];
    default:
      return [];
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus, fulfillment: "delivery" | "pickup"): boolean {
  return allowedTransitions(from, fulfillment).includes(to);
}
