"use client";

import "./globals.css";

// Last-resort error page when even the root layout fails.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="el">
      <body className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="text-5xl" aria-hidden>😕</p>
          <h1 className="mt-3 text-xl font-bold">Κάτι πήγε στραβά</h1>
          <p className="mt-1 text-ink-soft">Δοκιμάστε ξανά σε λίγο.</p>
          <button type="button" className="btn-primary mt-6" onClick={() => retry()}>
            Δοκιμή ξανά
          </button>
        </div>
      </body>
    </html>
  );
}
