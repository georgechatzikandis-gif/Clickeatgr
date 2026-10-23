import Image from "next/image";
import Link from "next/link";

export function Logo({ href = "/", className = "h-7 w-auto" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2" aria-label="ClickEat – αρχική σελίδα">
      <Image src="/icon.png" alt="" width={36} height={36} className="h-9 w-9" priority />
      <Image src="/logo-wordmark.png" alt="ClickEat" width={432} height={96} className={className} priority />
    </Link>
  );
}
