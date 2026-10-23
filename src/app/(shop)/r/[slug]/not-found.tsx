import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>🔎</p>
      <h1 className="mt-3 text-xl font-bold">Το κατάστημα δεν βρέθηκε</h1>
      <p className="mt-1 text-ink-soft">Ίσως δεν είναι πλέον διαθέσιμο στο ClickEat.</p>
      <Link href="/" className="btn-primary mt-6">Δείτε όλα τα καταστήματα</Link>
    </div>
  );
}
