import Link from "next/link";
import type { BusinessCard as Card } from "@/server/catalog";
import { describeDay, localTime } from "@/lib/hours";
import { formatEuro } from "@/lib/money";

export function BusinessCard({ b }: { b: Card }) {
  const today = describeDay(b.hours, localTime(new Date()).weekday);
  return (
    <Link
      href={`/r/${b.slug}`}
      className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className={`relative bg-gradient-to-br from-brand-soft to-amber-100 ${b.coverImageId ? "aspect-[16/9]" : "aspect-[16/6]"}`}>
        {b.coverImageId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/img/${b.coverImageId}`} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl" aria-hidden>
            🍽️
          </div>
        )}
        {!b.isOpen && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/55">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">
              {b.temporarilyClosed ? "Προσωρινά κλειστό" : "Κλειστό τώρα"}
            </span>
          </div>
        )}
        {b.isDemo && (
          <span className="absolute left-2 top-2 rounded-md bg-ink px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            Δοκιμαστικό
          </span>
        )}
        {b.logoImageId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/img/${b.logoImageId}`}
            alt=""
            className="absolute -bottom-6 left-3 h-14 w-14 rounded-xl border-2 border-white bg-white object-cover shadow"
          />
        )}
      </div>
      <div className={`space-y-1 p-3.5 ${b.logoImageId ? "pt-7" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight group-hover:text-brand-dark">{b.name}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
              b.isOpen ? "bg-green-100 text-ok" : "bg-surface text-ink-soft"
            }`}
          >
            {b.isOpen ? "Ανοιχτό" : "Κλειστό"}
          </span>
        </div>
        <p className="text-sm text-ink-soft">{b.categoryNames.join(" · ") || "Φαγητό"}</p>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-ink-soft">
          <span>⏱ {b.prepTimeMinutes + (b.acceptsDelivery ? b.deliveryTimeMinutes : 0)}′</span>
          {b.acceptsDelivery && b.minDeliveryFeeCents !== null && (
            <span>🛵 {b.minDeliveryFeeCents === 0 ? "Δωρεάν" : `από ${formatEuro(b.minDeliveryFeeCents)}`}</span>
          )}
          {b.acceptsDelivery && !!b.minOrderCents && <span>Ελάχ. {formatEuro(b.minOrderCents)}</span>}
          {!b.acceptsDelivery && b.acceptsPickup && <span>🛍 Μόνο παραλαβή</span>}
        </p>
        <p className="text-xs text-ink-soft">Σήμερα: {today ?? "κλειστό"}</p>
      </div>
    </Link>
  );
}
