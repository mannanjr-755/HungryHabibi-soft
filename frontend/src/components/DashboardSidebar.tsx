"use client";

import Image from "next/image";
import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingBag,
  Table2,
  UtensilsCrossed,
  Tags,
  Users,
  BarChart3,
  Package,
  Footprints,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "orders"
  | "tables"
  | "menu"
  | "walking-customer"
  | "waiting-customers"
  | "categories"
  | "customers"
  | "staff"
  | "reports"
  | "inventory"
  | "payments"
  | "profile"
  | "orders-link"
  | "kitchen";

const nav: { href: string; label: string; icon: LucideIcon; key: string; badgeKey?: "orders" }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, key: "orders" },
  {
    href: "/dashboard/walking-customer",
    label: "Orders",
    icon: ShoppingBag,
    key: "walking-customer",
    badgeKey: "orders",
  },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed, key: "menu" },
  { href: "/dashboard/tables", label: "Tables", icon: Table2, key: "tables" },
  {
    href: "/dashboard/waiting-customers",
    label: "Waiting",
    icon: Footprints,
    key: "waiting-customers",
  },
  { href: "/dashboard/categories", label: "Categories", icon: Tags, key: "categories" },
  { href: "/dashboard/customers", label: "Customers", icon: Users, key: "customers" },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, key: "reports" },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package, key: "inventory" },
  { href: "/dashboard/profile", label: "Settings", icon: Settings, key: "profile" },
];

function isNavActive(active: NavKey, key: string) {
  if (active === "orders" || active === "orders-link" || active === "kitchen") {
    return key === "orders";
  }
  return key === active;
}

export function DashboardSidebar({
  active,
  restaurantName,
  orderBadge = 0,
}: {
  active: NavKey;
  restaurantName: string;
  orderBadge?: number;
}) {
  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] lg:flex">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-[var(--primary)] shadow-[var(--shadow-sm)]">
          <Image
            src="/logo.png"
            alt="Hungry Habibi"
            width={40}
            height={40}
            className="h-full w-full object-cover"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-[var(--text)]">
            Hungry Habibi
          </p>
          <p className="truncate text-[11px] text-[var(--text-muted)]">Kitchen & POS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav.map((item) => {
          const isActive = isNavActive(active, item.key);
          const Icon = item.icon;
          const badge = item.badgeKey === "orders" && orderBadge > 0 ? orderBadge : 0;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2.25 : 1.75} />
              <span className="truncate">{item.label}</span>
              {badge > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[10px] font-bold text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] shadow-[var(--shadow-sm)]">
          <div className="relative h-20 w-full bg-[var(--primary-soft)]">
            <Image
              src="/logo.png"
              alt=""
              fill
              className="object-cover opacity-90"
              sizes="220px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
          </div>
          <div className="space-y-1 p-3">
            <p className="truncate text-sm font-semibold text-[var(--text)]">{restaurantName}</p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">Restaurant · Pakistan</p>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
              <span className="text-[11px] font-medium text-[var(--success)]">Online</span>
              <span className="text-[11px] text-[var(--text-dim)]">· Live</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function DashboardMobileNav({
  active,
  orderBadge = 0,
}: {
  active: NavKey;
  orderBadge?: number;
}) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 lg:hidden">
      {nav.map((item) => {
        const badge = item.badgeKey === "orders" && orderBadge > 0 ? orderBadge : 0;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`relative shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              isNavActive(active, item.key)
                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {item.label}
            {badge > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-white">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
