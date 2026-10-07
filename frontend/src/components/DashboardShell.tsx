import { auth, signOut } from "@/lib/auth";
import { TableRequestsPanel } from "@/components/TableRequestsPanel";
import {
  DashboardMobileNav,
  DashboardSidebar,
  type NavKey,
} from "@/components/DashboardSidebar";
import { DashboardSearch } from "@/components/DashboardSearch";

export type { NavKey };

export async function DashboardShell({
  children,
  active,
  newOrderCount = 0,
  preparingCount = 0,
}: {
  children: React.ReactNode;
  active: NavKey;
  newOrderCount?: number;
  preparingCount?: number;
}) {
  const session = await auth();
  const userName = session?.user.name || "Admin";
  const roleLabel = session?.user.role === "ADMIN" ? "Owner" : "Staff";
  const restaurantName = session?.user.restaurantName || "Hungry Habibi";
  void preparingCount;

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <DashboardSidebar
        active={active}
        restaurantName={restaurantName}
        orderBadge={newOrderCount}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-elevated)]/85 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <img
              src="/logo.png"
              alt="Hungry Habibi"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />
            <span className="truncate text-sm font-bold text-[var(--text)]">{restaurantName}</span>
          </div>

          <div className="mx-auto hidden w-full max-w-xl flex-1 md:block">
            <DashboardSearch />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <TableRequestsPanel className="shrink-0" />
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary)]">
                {userName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-[var(--text)]">{restaurantName}</p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">{roleLabel}</p>
              </div>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-xl border border-[var(--border)] px-2.5 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--primary)]/30 hover:text-[var(--primary)]"
              >
                Log out
              </button>
            </form>
          </div>
        </header>

        <div className="border-b border-[var(--border)] px-4 py-2 md:hidden">
          <DashboardSearch />
        </div>

        <DashboardMobileNav active={active} orderBadge={newOrderCount} />

        <main className="flex-1 overflow-x-hidden p-4 sm:p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
