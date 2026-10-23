import { monthRange } from "@/lib/months";
import { businessReport } from "@/server/admin-data";
import { getCurrentUser } from "@/server/auth";

const euros = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("Forbidden", { status: 403 });
  const range = monthRange(new URL(req.url).searchParams.get("month") ?? undefined);
  const rows = await businessReport(range.from, range.to);
  const header = ["Κατάστημα", "Παραγγελίες", "Ολοκληρωμένες", "Ακυρωμένες", "Προϊόντα €", "Διανομή €", "Σύνολο €", "Σε δωρεάν περίοδο", "Προμήθεια οφειλόμενη €", "Προμήθεια εξοφλημένη €"];
  const lines = rows.map((r) =>
    [r.name, r.allOrders, r.completed, r.cancelled, euros(r.subtotal), euros(r.deliveryFees), euros(r.total), r.trialOrders, euros(r.commissionDue), euros(r.commissionSettled)]
      .map(cell)
      .join(";"),
  );
  // BOM + semicolons so Greek Excel opens it correctly.
  const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clickeat-${range.key}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
