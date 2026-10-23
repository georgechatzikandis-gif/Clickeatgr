import { describe, expect, it } from "vitest";
import { isOpenAt, localTime } from "@/lib/hours";

// 2026-10-23 is a Friday. Athens is UTC+3 until 25 Oct 2026 (EEST).
const athens = (iso: string) => new Date(iso + "+03:00");

describe("opening hours (Europe/Athens)", () => {
  const hours = [{ weekday: 5, opensAt: "12:00", closesAt: "23:00" }];
  it("uses Athens local time", () => {
    expect(localTime(new Date("2026-10-23T09:30:00Z"))).toEqual({ weekday: 5, minutes: 12 * 60 + 30 });
  });
  it("is open inside a range and closed outside", () => {
    expect(isOpenAt(hours, athens("2026-10-23T12:00:00"))).toBe(true);
    expect(isOpenAt(hours, athens("2026-10-23T22:59:00"))).toBe(true);
    expect(isOpenAt(hours, athens("2026-10-23T23:00:00"))).toBe(false);
    expect(isOpenAt(hours, athens("2026-10-23T11:59:00"))).toBe(false);
    expect(isOpenAt(hours, athens("2026-10-24T13:00:00"))).toBe(false); // Saturday
  });
  it("handles ranges past midnight", () => {
    const late = [{ weekday: 5, opensAt: "18:00", closesAt: "02:00" }];
    expect(isOpenAt(late, athens("2026-10-23T23:30:00"))).toBe(true);
    expect(isOpenAt(late, athens("2026-10-24T01:59:00"))).toBe(true);
    expect(isOpenAt(late, athens("2026-10-24T02:00:00"))).toBe(false);
    expect(isOpenAt(late, athens("2026-10-23T01:00:00"))).toBe(false); // Friday early morning belongs to Thursday
  });
  it("treats 00:00–00:00 as open all day", () => {
    const allDay = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt: "00:00", closesAt: "00:00" }));
    expect(isOpenAt(allDay, athens("2026-10-23T03:00:00"))).toBe(true);
  });
  it("has no hours => closed", () => {
    expect(isOpenAt([], new Date())).toBe(false);
  });
});

import { athensDate, athensStartOfDay } from "@/lib/hours";
describe("Athens day boundaries", () => {
  it("computes midnight in summer and winter time", () => {
    expect(athensDate(2026, 7, 1).toISOString()).toBe("2026-06-30T21:00:00.000Z");
    expect(athensDate(2026, 12, 1).toISOString()).toBe("2026-11-30T22:00:00.000Z");
    expect(athensStartOfDay(new Date("2026-10-23T22:30:00Z")).toISOString()).toBe("2026-10-23T21:00:00.000Z");
  });
});
