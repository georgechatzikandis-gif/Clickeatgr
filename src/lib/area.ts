"use client";

import { useSyncExternalStore } from "react";

// The customer's delivery choice per shop (delivery to a zone, or pickup), remembered on this device
// so the menu page can show fees and the minimum order, and checkout starts with the same choice.
export type AreaChoice = { fulfillment: "delivery" | "pickup"; zoneId: string | null };
type Store = Record<string, AreaChoice>;

const KEY = "clickeat.area.v1";
const listeners = new Set<() => void>();
let cached: Store | undefined;

function read(): Store {
  if (cached) return cached;
  try {
    cached = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    cached = {};
  }
  return cached;
}

export function setAreaChoice(businessId: string, choice: AreaChoice) {
  cached = { ...read(), [businessId]: choice };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    /* storage unavailable: the choice still works for this page view */
  }
  listeners.forEach((l) => l());
}

export function getAreaChoice(businessId: string): AreaChoice | null {
  return read()[businessId] ?? null;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The saved choice for a shop, or null (also null during server rendering). */
export function useAreaChoice(businessId: string): AreaChoice | null {
  return useSyncExternalStore(
    subscribe,
    () => read()[businessId] ?? null,
    () => null,
  );
}
