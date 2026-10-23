"use client";

/** Copies Monday's opening hours (both ranges) to every other day in the hours form. */
export function CopyHoursButton() {
  const copy = (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.form;
    if (!form) return;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";
    for (const day of [0, 2, 3, 4, 5, 6]) {
      for (const n of [0, 1]) {
        for (const part of ["open", "close"]) {
          const el = form.elements.namedItem(`h${day}_${n}_${part}`) as HTMLInputElement | null;
          if (el) el.value = get(`h1_${n}_${part}`);
        }
      }
    }
  };
  return (
    <button type="button" onClick={copy} className="btn-ghost !px-3 !py-1.5 text-sm">
      Ίδιο ωράριο με τη Δευτέρα σε όλες τις μέρες
    </button>
  );
}
