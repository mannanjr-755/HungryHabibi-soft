import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { DashboardHome } from "@/components/DashboardHome";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Dashboard",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;
  let newOrderCount = 0;
  let preparingCount = 0;
  if (session?.user.restaurantId) {
    newOrderCount = await prisma.order.count({
      where: { restaurantId: session.user.restaurantId, status: "NEW" },
    });
    preparingCount = await prisma.order.count({
      where: { restaurantId: session.user.restaurantId, status: "PREPARING" },
    });
  }

  const restaurantName = session?.user.restaurantName || "Hungry Habibi";

  return (
    <DashboardShell
      active="orders"
      newOrderCount={newOrderCount}
      preparingCount={preparingCount}
    >
      <DashboardHome restaurantName={restaurantName} initialQuery={params.q ?? ""} />
    </DashboardShell>
  );
}
