import { StaffShell } from "@/components/staff-shell";
import { TemporaryCloseToggle } from "@/components/dashboard/temporary-close";
import { requireBusinessPage } from "@/server/auth";
import { getBusinessSettings } from "@/server/business-data";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireBusinessPage();
  const { business: b } = await getBusinessSettings(user.businessId);
  const banner =
    b.status !== "active" ? (
      <div className="bg-red-50 px-4 py-2 text-center text-sm font-medium text-danger">
        Ο λογαριασμός του καταστήματος είναι {b.status === "suspended" ? "σε αναστολή" : "ανενεργός"} — δεν εμφανίζεται στους πελάτες. Επικοινωνήστε με το ClickEat.
      </div>
    ) : (
      <TemporaryCloseToggle closed={b.temporarilyClosed} />
    );
  return (
    <StaffShell
      title={b.name}
      subtitle={user.email}
      banner={banner}
      links={[
        { href: "/dashboard", label: "Παραγγελίες" },
        { href: "/dashboard/history", label: "Ιστορικό" },
        { href: "/dashboard/menu", label: "Κατάλογος" },
        { href: "/dashboard/settings", label: "Ρυθμίσεις" },
      ]}
    >
      {children}
    </StaffShell>
  );
}
