import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "greek"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "ClickEat – Παραγγελία φαγητού στη Ρόδο", template: "%s · ClickEat" },
  description: "Παράγγειλε φαγητό και καφέ από τα καταστήματα της Ρόδου. Γρήγορα, απλά, με πληρωμή κατά την παράδοση.",
};

export const viewport: Viewport = { themeColor: "#17202b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="el" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
