import type { Metadata } from "next";
import { saveCategoryAction, saveRegionAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { requireAdminPage } from "@/server/auth";
import { listAllCategories, listAllRegions } from "@/server/admin-data";

export const metadata: Metadata = { title: "Κατηγορίες & περιοχές" };

export default async function CategoriesPage() {
  await requireAdminPage();
  const [cats, regions] = await Promise.all([listAllCategories(), listAllRegions()]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-4">
        <h1 className="text-lg font-bold">Κατηγορίες φαγητού</h1>
        <p className="text-xs text-ink-soft">Εμφανίζονται στην αρχική σελίδα ως φίλτρα.</p>
        <ul className="mt-3 space-y-2">
          {cats.map((c) => (
            <li key={c.id}>
              <ActionForm action={saveCategoryAction} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="id" value={c.id} />
                <input name="icon" defaultValue={c.icon} className="input !w-14 !py-1.5 text-center" aria-label="Εικονίδιο" />
                <input name="name" defaultValue={c.name} className="input !py-1.5 min-w-32 flex-1" aria-label="Όνομα" />
                <input name="sortOrder" type="number" defaultValue={c.sortOrder} className="input !w-16 !py-1.5" aria-label="Σειρά" />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={c.active} /> Ενεργή</label>
                <SubmitButton className="btn-ghost !px-2.5 !py-1.5 text-xs">OK</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={saveCategoryAction} className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3 text-sm" resetOnSuccess>
          <input name="icon" placeholder="🍔" className="input !w-14 !py-1.5 text-center" aria-label="Εικονίδιο" />
          <input name="name" required placeholder="Νέα κατηγορία" className="input !py-1.5 min-w-32 flex-1" aria-label="Όνομα" />
          <input name="sortOrder" type="number" defaultValue={cats.length} className="input !w-16 !py-1.5" aria-label="Σειρά" />
          <SubmitButton className="btn-dark !py-1.5">Προσθήκη</SubmitButton>
        </ActionForm>
      </section>
      <section className="card p-4">
        <h2 className="text-lg font-bold">Περιοχές εξυπηρέτησης</h2>
        <p className="text-xs text-ink-soft">
          Νησιά / πόλεις. Σήμερα η αρχική σελίδα δείχνει τη Ρόδο. Νέες περιοχές δημιουργούνται ανενεργές, για μελλοντική επέκταση στα Δωδεκάνησα.
        </p>
        <ul className="mt-3 space-y-2">
          {regions.map((r) => (
            <li key={r.id}>
              <ActionForm action={saveRegionAction} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="id" value={r.id} />
                <input name="name" defaultValue={r.name} className="input !py-1.5 min-w-32 flex-1" aria-label="Όνομα" />
                <input name="sortOrder" type="number" defaultValue={r.sortOrder} className="input !w-16 !py-1.5" aria-label="Σειρά" />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={r.active} /> Ενεργή</label>
                <SubmitButton className="btn-ghost !px-2.5 !py-1.5 text-xs">OK</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={saveRegionAction} className="mt-3 flex gap-2 border-t border-line pt-3 text-sm" resetOnSuccess>
          <input name="name" required placeholder="π.χ. Κως" className="input !py-1.5 flex-1" aria-label="Νέα περιοχή" />
          <SubmitButton className="btn-dark !py-1.5">Προσθήκη</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
