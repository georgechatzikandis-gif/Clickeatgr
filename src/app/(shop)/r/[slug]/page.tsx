import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuView } from "@/components/menu-view";
import { WEEKDAYS_EL, describeDay } from "@/lib/hours";
import { formatEuro } from "@/lib/money";
import { getBusinessPage } from "@/server/catalog";

export async function generateMetadata(props: PageProps<"/r/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await getBusinessPage(slug);
  return { title: data ? data.business.name : "Το κατάστημα δεν βρέθηκε" };
}

export default async function BusinessPage(props: PageProps<"/r/[slug]">) {
  const { slug } = await props.params;
  const data = await getBusinessPage(slug);
  if (!data) notFound();
  const { business: b, hours, zones, sections, isOpen, acceptsDelivery } = data;

  return (
    <div>
      <div className="relative h-36 bg-gradient-to-br from-brand-soft to-amber-100 sm:h-52">
        {b.coverImageId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/img/${b.coverImageId}`} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="mx-auto max-w-6xl px-4">
        <div className="relative z-10 -mt-10 flex items-end gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white text-3xl shadow">
            {b.logoImageId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/img/${b.logoImageId}`} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden>🍽️</span>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{b.name}</h1>
            {b.isDemo && (
              <p className="mt-1 inline-block rounded-md bg-ink px-2 py-0.5 text-xs font-bold text-white">
                ΔΟΚΙΜΑΣΤΙΚΟ ΚΑΤΑΣΤΗΜΑ – οι παραγγελίες δεν εκτελούνται
              </p>
            )}
            {b.description && <p className="mt-1 max-w-2xl text-ink-soft">{b.description}</p>}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${isOpen ? "bg-green-100 text-ok" : "bg-red-50 text-danger"}`}
          >
            {isOpen ? "Ανοιχτό τώρα" : b.temporarilyClosed ? "Προσωρινά κλειστό" : "Κλειστό τώρα"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-surface px-3 py-1">⏱ Προετοιμασία ~{b.prepTimeMinutes}′</span>
          {acceptsDelivery && (
            <span className="rounded-full bg-surface px-3 py-1">🛵 Διανομή ~{b.prepTimeMinutes + b.deliveryTimeMinutes}′</span>
          )}
          {b.acceptsPickup && <span className="rounded-full bg-surface px-3 py-1">🛍 Παραλαβή από το κατάστημα</span>}
          <span className="rounded-full bg-surface px-3 py-1">💶 Μετρητά</span>
        </div>

        <MenuView
          business={{ id: b.id, slug: b.slug, name: b.name }}
          sections={sections}
          canOrder={isOpen}
          delivery={{
            zones: zones.map((z) => ({ id: z.id, name: z.name, feeCents: z.feeCents, minOrderCents: z.minOrderCents })),
            acceptsDelivery,
            acceptsPickup: b.acceptsPickup,
            pickupMinOrderCents: b.pickupMinOrderCents,
          }}
        />

        <section className="mb-10 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <h2 className="font-semibold">Ωράριο</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <li key={d} className="flex justify-between gap-4">
                  <span>{WEEKDAYS_EL[d]}</span>
                  <span>{describeDay(hours, d) ?? "Κλειστό"}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            {acceptsDelivery && (
              <>
                <h2 className="font-semibold">Περιοχές διανομής</h2>
                <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                  {zones.map((z) => (
                    <li key={z.id} className="flex justify-between gap-4">
                      <span>{z.name}</span>
                      <span>
                        {z.feeCents ? formatEuro(z.feeCents) : "Δωρεάν"} · ελάχ. {formatEuro(z.minOrderCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h2 className="mt-4 font-semibold">Στοιχεία καταστήματος</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {[b.legalName, b.vatNumber && `ΑΦΜ ${b.vatNumber}`, b.address].filter(Boolean).join(" · ")}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
