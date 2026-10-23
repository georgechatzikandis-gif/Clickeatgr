import Link from "next/link";
import { ProductForm } from "@/components/dashboard/product-form";
import { requireBusinessPage } from "@/server/auth";
import { getMenuForEditing } from "@/server/business-data";

export default async function NewProductPage() {
  const user = await requireBusinessPage();
  const { categories } = await getMenuForEditing(user.businessId);
  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/menu" className="text-sm text-ink-soft hover:underline">← Κατάλογος</Link>
      <h1 className="mb-3 mt-1 text-xl font-bold">Νέο προϊόν</h1>
      <ProductForm categories={categories} />
      <p className="mt-2 text-sm text-ink-soft">Μετά τη δημιουργία μπορείτε να προσθέσετε επιλογές (μέγεθος, υλικά, έξτρα).</p>
    </div>
  );
}
