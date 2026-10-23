import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutForm, type LiveMenu } from "@/components/checkout-form";
import { getBusinessPage } from "@/server/catalog";

export const metadata: Metadata = { title: "Ολοκλήρωση παραγγελίας", robots: { index: false } };

export default async function CheckoutPage(props: PageProps<"/r/[slug]/checkout">) {
  const { slug } = await props.params;
  const data = await getBusinessPage(slug);
  if (!data) notFound();
  const b = data.business;
  const menu: LiveMenu = Object.fromEntries(
    data.sections.flatMap((s) =>
      s.products.map((p) => [
        p.id,
        {
          priceCents: p.priceCents,
          isAvailable: p.isAvailable,
          options: Object.fromEntries(
            p.groups.flatMap((g) => g.options.map((o) => [o.id, { priceDeltaCents: o.priceDeltaCents, isAvailable: o.isAvailable }])),
          ),
        },
      ]),
    ),
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Ολοκλήρωση παραγγελίας</h1>
      <p className="text-ink-soft">από {b.name}</p>
      <CheckoutForm
        business={{
          id: b.id,
          slug: b.slug,
          name: b.name,
          isOpen: data.isOpen,
          acceptsDelivery: data.acceptsDelivery,
          acceptsPickup: b.acceptsPickup,
          pickupMinOrderCents: b.pickupMinOrderCents,
          prepTimeMinutes: b.prepTimeMinutes,
          deliveryTimeMinutes: b.deliveryTimeMinutes,
          address: b.address,
        }}
        zones={data.zones.map((z) => ({ id: z.id, name: z.name, feeCents: z.feeCents, minOrderCents: z.minOrderCents }))}
        menu={menu}
      />
    </div>
  );
}
