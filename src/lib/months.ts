import { athensDate } from "./hours";

/** Parses "YYYY-MM" (defaults to the current Athens month) into [from, to) bounds. */
export function monthRange(input: string | undefined, now = new Date()) {
  let [y, m] = (input && /^\d{4}-\d{2}$/.test(input) ? input : "").split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) {
    [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit" })
      .format(now)
      .split("-")
      .map(Number);
  }
  const key = `${y}-${String(m).padStart(2, "0")}`;
  return { key, from: athensDate(y, m, 1), to: athensDate(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) };
}
