"use client";

import Link from "next/link";

// Shown instead of a page when something fails on the server (e.g. the database is unreachable).
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>😕</p>
      <h1 className="mt-3 text-xl font-bold">Κάτι πήγε στραβά</h1>
      <p className="mt-1 text-ink-soft">
        Η σελίδα δεν φόρτωσε. Δοκιμάστε ξανά σε λίγο. Αν είχατε στείλει παραγγελία, ελέγξτε τη σελίδα της
        παραγγελίας.
      </p>
      <div className="mt-6 flex gap-2">
        <button type="button" className="btn-primary" onClick={() => retry()}>
          Δοκιμή ξανά
        </button>
        <Link href="/" className="btn-ghost">
          Αρχική
        </Link>
      </div>
      {digest && <p className="mt-6 font-mono text-xs text-ink-soft">Κωδικός σφάλματος: {digest}</p>}
    </div>
  );
}
