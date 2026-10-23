import { parseEuroToCents } from "./money";

// Small helpers for reading FormData safely in server actions.
export class FormError extends Error {}

export function str(fd: FormData, key: string, max = 200, required = false): string {
  const v = String(fd.get(key) ?? "").trim();
  if (required && !v) throw new FormError("Συμπληρώστε όλα τα υποχρεωτικά πεδία.");
  if (v.length > max) throw new FormError(`Το πεδίο είναι πολύ μεγάλο (μέγιστο ${max} χαρακτήρες).`);
  return v;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function int(fd: FormData, key: string, min: number, max: number, fallback?: number): number {
  const raw = String(fd.get(key) ?? "").trim();
  if (!raw && fallback !== undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new FormError(`Μη έγκυρος αριθμός (${min}–${max}).`);
  return n;
}

export function money(fd: FormData, key: string, fallback?: number): number {
  const raw = String(fd.get(key) ?? "").trim();
  if (!raw && fallback !== undefined) return fallback;
  const c = parseEuroToCents(raw);
  if (c === null) throw new FormError("Μη έγκυρο ποσό. Χρησιμοποιήστε μορφή 12,50.");
  return c;
}

export function uuid(fd: FormData, key: string): string {
  const v = String(fd.get(key) ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw new FormError("Μη έγκυρο αίτημα.");
  return v;
}

export function file(fd: FormData, key: string): File | null {
  const f = fd.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}
