import { SiteFooter, SiteHeader } from "@/components/site-chrome";

// Menus, prices and opening status change constantly, so always render fresh.
export const dynamic = "force-dynamic";

export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
