import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "./logo";
import { StaffNav } from "./staff-nav";

export function StaffShell({
  title,
  subtitle,
  links,
  banner,
  children,
}: {
  title: string;
  subtitle?: string;
  links: { href: string; label: string }[];
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Logo href={links[0].href} className="hidden h-5 w-auto sm:block" />
            <div className="min-w-0 border-l border-line pl-3">
              <p className="truncate font-bold leading-tight">{title}</p>
              {subtitle && <p className="truncate text-xs text-ink-soft">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden text-sm text-ink-soft hover:text-ink sm:inline" target="_blank">
              Δημόσια σελίδα ↗
            </Link>
            <form action={logoutAction}>
              <button className="btn-ghost !px-3 !py-1.5 text-sm">Αποσύνδεση</button>
            </form>
          </div>
        </div>
        <StaffNav links={links} />
      </header>
      {banner}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
    </>
  );
}
