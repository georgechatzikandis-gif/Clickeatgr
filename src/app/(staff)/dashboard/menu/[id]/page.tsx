import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addOptionAction,
  addOptionGroupAction,
  deleteOptionGroupAction,
  deleteProductAction,
  updateOptionAction,
} from "@/app/actions/business";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ProductForm } from "@/components/dashboard/product-form";
import { centsToInput } from "@/lib/money";
import { requireBusinessPage } from "@/server/auth";
import { getMenuForEditing, getProductForEditing } from "@/server/business-data";

export default async function EditProductPage(props: PageProps<"/dashboard/menu/[id]">) {
  const user = await requireBusinessPage();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [data, menu] = await Promise.all([getProductForEditing(user.businessId, id), getMenuForEditing(user.businessId)]);
  if (!data) notFound();
  const { product, groups } = data;
  const created = (await props.searchParams).created;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/menu" className="text-sm text-ink-soft hover:underline">← Κατάλογος</Link>
        <h1 className="mt-1 text-xl font-bold">{product.name}</h1>
        {created && <p className="mt-1 rounded-lg bg-green-50 p-2 text-sm text-ok">Το προϊόν δημιουργήθηκε. Μπορείτε να προσθέσετε επιλογές παρακάτω.</p>}
      </div>
      <ProductForm product={product} categories={menu.categories} />

      <section>
        <h2 className="text-lg font-bold">Επιλογές</h2>
        <p className="text-sm text-ink-soft">
          Ομάδες επιλογών, π.χ. «Μέγεθος» (υποχρεωτικό, 1 επιλογή) ή «Έξτρα υλικά» (προαιρετικό, έως 5).
        </p>
        <div className="mt-3 space-y-4">
          {groups.map((g) => (
            <div key={g.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="text-xs text-ink-soft">
                    {g.minSelect > 0 ? `Υποχρεωτικό (τουλάχιστον ${g.minSelect})` : "Προαιρετικό"} · έως {g.maxSelect}
                  </p>
                </div>
                <ActionForm action={deleteOptionGroupAction} confirm={`Διαγραφή της ομάδας «${g.name}»;`}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="text-xs text-danger underline">Διαγραφή ομάδας</button>
                </ActionForm>
              </div>
              <ul className="mt-3 space-y-2">
                {g.options.map((o) => (
                  <li key={o.id}>
                    <ActionForm action={updateOptionAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={o.id} />
                      <input name="name" defaultValue={o.name} maxLength={60} className="input !py-1.5 min-w-32 flex-1" aria-label="Όνομα επιλογής" />
                      <input name="price" defaultValue={centsToInput(o.priceDeltaCents)} inputMode="decimal" className="input !w-20 !py-1.5" aria-label="Επιπλέον τιμή €" />
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" name="isAvailable" defaultChecked={o.isAvailable} /> Διαθέσιμο
                      </label>
                      <SubmitButton className="btn-ghost !px-2.5 !py-1.5 text-xs">Αποθήκευση</SubmitButton>
                      <button name="delete" value="1" className="text-xs text-danger underline">Διαγραφή</button>
                    </ActionForm>
                  </li>
                ))}
              </ul>
              <ActionForm action={addOptionAction} className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3" resetOnSuccess>
                <input type="hidden" name="groupId" value={g.id} />
                <input type="hidden" name="sortOrder" value={g.options.length} />
                <input name="name" required maxLength={60} placeholder="Νέα επιλογή" className="input !py-1.5 min-w-32 flex-1" aria-label="Νέα επιλογή" />
                <input name="price" placeholder="+0,00" inputMode="decimal" className="input !w-20 !py-1.5" aria-label="Επιπλέον τιμή €" />
                <SubmitButton className="btn-dark !px-3 !py-1.5 text-sm">+ Προσθήκη</SubmitButton>
              </ActionForm>
            </div>
          ))}
        </div>
        <ActionForm action={addOptionGroupAction} className="card mt-4 grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end" resetOnSuccess>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="sortOrder" value={groups.length} />
          <div>
            <label className="label" htmlFor="g-name">Νέα ομάδα επιλογών</label>
            <input id="g-name" name="name" required maxLength={60} placeholder="π.χ. Μέγεθος" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="g-min">Ελάχ.</label>
            <input id="g-min" name="minSelect" type="number" min={0} max={20} defaultValue={0} className="input !w-20" />
          </div>
          <div>
            <label className="label" htmlFor="g-max">Μέγ.</label>
            <input id="g-max" name="maxSelect" type="number" min={1} max={20} defaultValue={1} className="input !w-20" />
          </div>
          <SubmitButton>Προσθήκη</SubmitButton>
        </ActionForm>
      </section>

      <ActionForm action={deleteProductAction} confirm="Οριστική αφαίρεση του προϊόντος από τον κατάλογο;" className="border-t border-line pt-4">
        <input type="hidden" name="id" value={product.id} />
        <button className="btn-danger">Διαγραφή προϊόντος</button>
      </ActionForm>
    </div>
  );
}
