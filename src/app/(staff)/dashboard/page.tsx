import type { Metadata } from "next";
import { OrdersBoard } from "@/components/dashboard/orders-board";
import { athensStartOfDay } from "@/lib/hours";
import { requireBusinessPage } from "@/server/auth";
import { listActiveOrders, todayStats } from "@/server/business-data";

export const metadata: Metadata = { title: "Παραγγελίες" };

export default async function OrdersPage() {
  const user = await requireBusinessPage();
  const [orders, today] = await Promise.all([
    listActiveOrders(user.businessId),
    todayStats(user.businessId, athensStartOfDay()),
  ]);
  return <OrdersBoard orders={orders} today={today} />;
}
