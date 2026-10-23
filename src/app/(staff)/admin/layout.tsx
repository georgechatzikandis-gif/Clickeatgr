import { StaffShell } from "@/components/staff-shell";
import { requireAdminPage } from "@/server/auth";
import { getPlatformSettings } from "@/server/settings";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdminPage();
  const settings = await getPlatformSettings();
  return (
    <StaffShell
      title="Διαχείριση ClickEat"
      subtitle={user.email}
      banner={
        <div className={`px-4 py-1.5 text-center text-xs font-medium ${settings.commissionEnabled ? "bg-amber-50 text-brand-dark" : "bg-green-50 text-ok"}`}>
          {settings.commissionEnabled
            ? `Προμήθεια ενεργή (${settings.defaultCommissionRateBps / 100}% προεπιλογή) — εκτός από καταστήματα σε δωρεάν περίοδο`
            : "Δωρεάν περίοδος: προμήθεια 0% για όλα τα καταστήματα"}
        </div>
      }
      links={[
        { href: "/admin", label: "Επισκόπηση" },
        { href: "/admin/orders", label: "Παραγγελίες" },
        { href: "/admin/businesses", label: "Καταστήματα" },
        { href: "/admin/reports", label: "Αναφορές" },
        { href: "/admin/categories", label: "Κατηγορίες & περιοχές" },
        { href: "/admin/settings", label: "Ρυθμίσεις" },
      ]}
    >
      {children}
    </StaffShell>
  );
}
