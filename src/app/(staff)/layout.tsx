import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function StaffLayout({ children }: LayoutProps<"/">) {
  return <div className="flex min-h-full flex-1 flex-col bg-surface">{children}</div>;
}
