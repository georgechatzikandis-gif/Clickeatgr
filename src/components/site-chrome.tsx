import Link from "next/link";
import { CartButton } from "./cart-button";
import { Logo } from "./logo";

export function SiteHeader({ regionName = "Ρόδος" }: { regionName?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Logo className="hidden h-6 w-auto min-[380px]:block" />
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-sm font-medium">
            <span aria-hidden>📍</span> {regionName}
          </span>
          <CartButton />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} ClickEat · Ρόδος</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/terms" className="hover:text-ink">Όροι χρήσης</Link>
          <Link href="/privacy" className="hover:text-ink">Απόρρητο</Link>
          <Link href="/login" className="hover:text-ink">Για επιχειρήσεις</Link>
        </nav>
      </div>
    </footer>
  );
}
