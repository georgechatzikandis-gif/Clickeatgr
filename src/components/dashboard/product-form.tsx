"use client";

import { saveProductAction } from "@/app/actions/business";
import { centsToInput } from "@/lib/money";
import { ActionForm, SubmitButton } from "../action-form";
import { ImageInput } from "../image-input";

type Product = {
  id: string;
  name: string;
  description: string;
  allergens: string;
  priceCents: number;
  menuCategoryId: string | null;
  sortOrder: number;
  isAvailable: boolean;
  imageId: string | null;
};

export function ProductForm({ product, categories }: { product?: Product; categories: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveProductAction} className="card space-y-3 p-4">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div>
        <label className="label" htmlFor="p-name">Όνομα *</label>
        <input id="p-name" name="name" required maxLength={100} defaultValue={product?.name} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="p-desc">Περιγραφή</label>
        <textarea id="p-desc" name="description" rows={2} maxLength={500} defaultValue={product?.description} className="input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="p-price">Τιμή (€) *</label>
          <input id="p-price" name="price" required inputMode="decimal" placeholder="3,50" defaultValue={product ? centsToInput(product.priceCents) : ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="p-cat">Κατηγορία</label>
          <select id="p-cat" name="menuCategoryId" defaultValue={product?.menuCategoryId ?? ""} className="input">
            <option value="">— Χωρίς —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-sort">Σειρά</label>
          <input id="p-sort" name="sortOrder" type="number" min={0} max={999} defaultValue={product?.sortOrder ?? 0} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="p-all">Αλλεργιογόνα</label>
        <input id="p-all" name="allergens" maxLength={200} placeholder="π.χ. Γλουτένη, γάλα, αυγό" defaultValue={product?.allergens} className="input" />
        <p className="mt-1 text-xs text-ink-soft">Υποχρεωτική πληροφόρηση για πώληση τροφίμων από απόσταση (Καν. ΕΕ 1169/2011).</p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        {product?.imageId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/img/${product.imageId}`} alt="" className="h-20 w-20 rounded-xl object-cover" />
        )}
        <div className="flex-1">
          <ImageInput label={product?.imageId ? "Αλλαγή εικόνας" : "Εικόνα"} />
        </div>
        {product?.imageId && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="removeImage" /> Αφαίρεση εικόνας
          </label>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="isAvailable" defaultChecked={product?.isAvailable ?? true} className="h-4 w-4 accent-amber-500" /> Διαθέσιμο για παραγγελία
      </label>
      <SubmitButton>{product ? "Αποθήκευση" : "Δημιουργία προϊόντος"}</SubmitButton>
    </ActionForm>
  );
}
