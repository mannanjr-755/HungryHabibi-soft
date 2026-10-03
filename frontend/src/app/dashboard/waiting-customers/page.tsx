import { DashboardShell } from "@/components/DashboardShell";
import { WaitingCustomersManager } from "@/components/WaitingCustomersManager";

export const metadata = {
  title: "Waiting Customers",
};

export default function WaitingCustomersPage() {
  return (
    <DashboardShell active="waiting-customers">
      <WaitingCustomersManager />
    </DashboardShell>
  );
}
