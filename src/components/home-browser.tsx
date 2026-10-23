"use client";

import { useMemo, useState } from "react";
import type { BusinessCard as Card } from "@/server/catalog";
import { BusinessCard } from "./business-card";

type Category = { slug: string; name: string; icon: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function HomeBrowser({ businesses, categories }: { businesses: Card[]; categories: Category[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [mode, setMode] = useState<"all" | "delivery" | "pickup">("all");

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    return businesses.filter(
      (b) =>
        (!cat || b.categorySlugs.includes(cat)) &&
        (!openOnly || b.isOpen) &&
        (mode === "all" || (mode === "delivery" ? b.acceptsDelivery : b.acceptsPickup)) &&
        (!nq || norm(`${b.name} ${b.description} ${b.categoryNames.join(" ")} ${b.productNames}`).includes(nq)),
    );
  }, [businesses, q, cat, openOnly, mode]);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
      active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40"
    }`;

  return (
    <>
      <section className="bg-gradient-to-b from-brand-soft to-white">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-8 sm:pt-12">
          <h1 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Πεινάς; Παράγγειλε από τα αγαπημένα σου μαγαζιά στη Ρόδο.
          </h1>
          <p className="mt-2 text-ink-soft">Πληρωμή με μετρητά κατά την παράδοση ή την παραλαβή.</p>
          <div className="relative mt-5 max-w-xl">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden>
              🔍
            </span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Αναζήτηση καταστήματος ή φαγητού…"
              aria-label="Αναζήτηση"
              className="input !rounded-2xl !py-3.5 pl-10 shadow-sm"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none]" role="toolbar" aria-label="Κατηγορίες">
          <button className={chip(cat === null)} onClick={() => setCat(null)}>
            Όλα
          </button>
          {categories.map((c) => (
            <button key={c.slug} className={chip(cat === c.slug)} onClick={() => setCat(cat === c.slug ? null : c.slug)}>
              <span aria-hidden>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="accent-amber-500" />
            Ανοιχτά τώρα
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            className="rounded-full border border-line bg-white px-3 py-1.5"
            aria-label="Τρόπος παραλαβής"
          >
            <option value="all">Διανομή & παραλαβή</option>
            <option value="delivery">Μόνο διανομή</option>
            <option value="pickup">Μόνο παραλαβή</option>
          </select>
          <span className="ml-auto text-ink-soft">{filtered.length} καταστήματα</span>
        </div>

        <section className="grid gap-4 py-5 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          {filtered.map((b) => (
            <BusinessCard key={b.id} b={b} />
          ))}
        </section>
        {!filtered.length && (
          <div className="card mb-10 p-8 text-center">
            <p className="text-4xl" aria-hidden>
              🍽️
            </p>
            <p className="mt-2 font-semibold">
              {businesses.length ? "Δεν βρέθηκαν καταστήματα" : "Σύντομα κοντά σας"}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {businesses.length
                ? "Δοκιμάστε άλλη αναζήτηση ή αφαιρέστε φίλτρα."
                : "Τα πρώτα καταστήματα της Ρόδου έρχονται σύντομα στο ClickEat."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
