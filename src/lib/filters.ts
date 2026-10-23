import { orderStatus, type OrderStatus } from "@/db/schema";
import { athensDate } from "./hours";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...&page=N (dates in Athens time, `to` inclusive). */
export function parseOrderFilters(sp: SP) {
  const parseDay = (s?: string) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
    const [y, m, d] = s.split("-").map(Number);
    return { y, m, d };
  };
  const from = parseDay(one(sp.from));
  const to = parseDay(one(sp.to));
  const status = one(sp.status);
  const page = Math.max(1, Math.min(1000, Number(one(sp.page)) || 1));
  return {
    raw: { from: one(sp.from) ?? "", to: one(sp.to) ?? "", status: status ?? "", business: one(sp.business) ?? "" },
    from: from ? athensDate(from.y, from.m, from.d) : undefined,
    to: to ? athensDate(to.y, to.m, to.d + 1) : undefined,
    status: orderStatus.enumValues.includes(status as OrderStatus) ? (status as OrderStatus) : undefined,
    business: one(sp.business),
    page,
  };
}
