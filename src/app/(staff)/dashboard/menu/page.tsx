import type { Metadata } from "next";
import Link from "next/link";
import {
  deleteMenuCategoryAction,
  saveMenuCategoryAction,
  toggleProductAction,
} from "@/app/actions/business";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { formatEuro } from "@/lib/money";
import { requireBusinessPage } from "@/server/auth";
import { getMenuForEditing } from "@/server/business-data";

export const metadata: Metadata = { title: "Κατάλογος" };

export default async function MenuPage() {
  const user = await requireBusinessPage();
  const { categories, products } = await getMenuForEditing(user.businessId);
  const groups = [
    ...categories.map((c) => ({ cat: c, items: products.filter((p) => p.menuCategoryId === c.id) })),
    { cat: null, items: products.filter((p) => !p.menuCategoryId || !categories.some((c) => c.id === p.menuCategoryId)) },
  ].filter((g) => g.cat || g.items.length);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">Κατάλογος</h1>
          <Link href="/dashboard/menu/new" className="btn-primary">+ Νέο προϊόν</Link>
        </div>
        {!products.length && (
          <p className="card mb-4 p-6 text-center text-ink-soft">
            Δεν υπάρχουν προϊόντα. Ξεκινήστε δημιουργώντας κατηγορίες (π.χ. «Τυλιχτά», «Ποτά») και μετά προσθέστε προϊόντα.
          </p>
        )}
        {groups.map(({ cat, items }) => (
          <section key={cat?.id ?? "none"} className="mb-6">
            <h2 className="mb-2 font-bold">
              {cat?.name ?? "Χωρίς κατηγορία"} {cat && !cat.active && <span className="text-sm font-normal text-danger">(κρυφή)</span>}
            </h2>
            {items.length ? (
              <ul className="card divide-y divide-line">
                {items.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    {p.imageId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/img/${p.imageId}`} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface text-ink-soft" aria-hidden>🍽️</div>
                    )}
                    <Link href={`/dashboard/menu/${p.id}`} className="min-w-0 flex-1 hover:underline">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-sm text-ink-soft">{formatEuro(p.priceCents)}</p>
                    </Link>
                    <ActionForm action={toggleProductAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="isAvailable" value={p.isAvailable ? "false" : "true"} />
                      <SubmitButton className={`btn !px-3 !py-1.5 text-xs ${p.isAvailable ? "bg-green-100 text-ok" : "bg-red-100 text-danger"}`}>
                        {p.isAvailable ? "Διαθέσιμο" : "Μη διαθέσιμο"}
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">Κανένα προϊόν σε αυτή την κατηγορία.</p>
            )}
          </section>
        ))}
      </div>

      <aside className="space-y-4">
        <div className="card p-4">
          <h2 className="font-bold">Νέα κατηγορία</h2>
          <ActionForm action={saveMenuCategoryAction} className="mt-2 flex gap-2" resetOnSuccess>
            <input name="name" className="input" placeholder="π.χ. Ποτά" required maxLength={60} aria-label="Όνομα κατηγορίας" />
            <input type="hidden" name="sortOrder" value={categories.length} />
            <SubmitButton>Προσθήκη</SubmitButton>
          </ActionForm>
        </div>
        {categories.length > 0 && (
          <div className="card p-4">
            <h2 className="font-bold">Κατηγορίες</h2>
            <p className="text-xs text-ink-soft">Η σειρά καθορίζει τη θέση στον κατάλογο (μικρότερο = πρώτο).</p>
            <ul className="mt-2 space-y-3">
              {categories.map((c) => (
                <li key={c.id} className="rounded-xl border border-line p-2">
                  <ActionForm action={saveMenuCategoryAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="name" defaultValue={c.name} className="input !py-1.5 flex-1" aria-label="Όνομα" maxLength={60} />
                    <input name="sortOrder" defaultValue={c.sortOrder} type="number" min={0} max={999} className="input !w-16 !py-1.5" aria-label="Σειρά" />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="active" defaultChecked={c.active} /> Ορατή
                    </label>
                    <SubmitButton className="btn-ghost !px-2.5 !py-1.5 text-xs">Αποθήκευση</SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteMenuCategoryAction} confirm="Διαγραφή κατηγορίας; Τα προϊόντα της θα μείνουν χωρίς κατηγορία." className="mt-1">
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-xs text-danger underline">Διαγραφή</button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
