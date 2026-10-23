export const TIME_ZONE = "Europe/Athens";
export const WEEKDAYS_EL = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

export type HoursRange = { weekday: number; opensAt: string; closesAt: string };

/** Minutes since midnight for "HH:MM" or "HH:MM:SS". */
export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Local weekday (0=Sunday) and minutes since midnight in Europe/Athens. */
export function localTime(date: Date, timeZone = TIME_ZONE): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/**
 * True if `date` falls inside any range. A range whose closing time is not after its
 * opening time runs past midnight (e.g. Fri 18:00 → 02:00 covers Saturday 00:00–02:00).
 */
export function isOpenAt(hours: HoursRange[], date: Date, timeZone = TIME_ZONE): boolean {
  const { weekday, minutes } = localTime(date, timeZone);
  const yesterday = (weekday + 6) % 7;
  return hours.some((h) => {
    const open = toMinutes(h.opensAt);
    const close = toMinutes(h.closesAt);
    const overnight = close <= open;
    if (h.weekday === weekday) {
      return overnight ? minutes >= open : minutes >= open && minutes < close;
    }
    if (overnight && h.weekday === yesterday) return minutes < close;
    return false;
  });
}

/** "12:00–23:00, 18:00–02:00" for one weekday, or null if closed all day. */
export function describeDay(hours: HoursRange[], weekday: number): string | null {
  const ranges = hours
    .filter((h) => h.weekday === weekday)
    .sort((a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt))
    .map((h) =>
      toMinutes(h.opensAt) === 0 && toMinutes(h.closesAt) === 0
        ? "24ωρο"
        : `${h.opensAt.slice(0, 5)}–${h.closesAt.slice(0, 5)}`,
    );
  return ranges.length ? ranges.join(", ") : null;
}
