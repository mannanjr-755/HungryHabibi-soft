"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  Filter,
  MoreVertical,
  Play,
  ShoppingBag,
  Table2,
  UtensilsCrossed,
  BarChart3,
} from "lucide-react";
import { toast } from "@/components/ToastProvider";
import { formatMoney, STATUS_LABELS, type OrderStatus } from "@/lib/utils";

type OrderItem = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  selectedOptions?: string | null;
};

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  status: string;
  orderType: string;
  orderSource?: string;
  total: number;
  createdAt: string;
  table: { tableNumber: number } | null;
  waitingCustomer?: { waitingNumber: number } | null;
  items: OrderItem[];
};

type StatusFilter = "ALL" | "NEW" | "PREPARING" | "READY" | "COMPLETED";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "All Orders" },
  { key: "NEW", label: "New" },
  { key: "PREPARING", label: "Preparing" },
  { key: "READY", label: "Ready" },
  { key: "COMPLETED", label: "Completed" },
];

const TIMELINE = ["NEW", "PREPARING", "READY", "COMPLETED"] as const;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function statusStyle(status: string) {
  switch (status) {
    case "NEW":
    case "ACCEPTED":
      return { pill: "bg-blue-50 text-blue-700", dot: "bg-blue-500", label: "New" };
    case "PREPARING":
      return { pill: "bg-amber-50 text-amber-700", dot: "bg-amber-500", label: "Preparing" };
    case "READY":
      return { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", label: "Ready" };
    case "SERVED":
      return { pill: "bg-sky-50 text-sky-700", dot: "bg-sky-500", label: "Served" };
    case "COMPLETED":
    case "REPORTED":
      return { pill: "bg-violet-50 text-violet-700", dot: "bg-violet-500", label: "Completed" };
    default:
      return {
        pill: "bg-slate-100 text-slate-600",
        dot: "bg-slate-400",
        label: STATUS_LABELS[status as OrderStatus] ?? status,
      };
  }
}

function Sparkline({ color }: { color: string }) {
  return (
    <svg className="sparkline" viewBox="0 0 72 28" fill="none" aria-hidden>
      <path
        d="M1 22 C10 20, 14 8, 22 12 C30 16, 34 6, 42 10 C50 14, 56 4, 71 8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M1 22 C10 20, 14 8, 22 12 C30 16, 34 6, 42 10 C50 14, 56 4, 71 8 L71 28 L1 28 Z"
        fill={color}
        opacity="0.12"
      />
    </svg>
  );
}

function parseOptions(raw?: string | null) {
  if (!raw) return "";
  try {
    const o = JSON.parse(raw) as { variant?: string; addOns?: { name: string }[]; specialInstructions?: string };
    const parts = [
      o.variant,
      ...(o.addOns?.map((a) => a.name) ?? []),
      o.specialInstructions,
    ].filter(Boolean);
    return parts.join(" · ");
  } catch {
    return "";
  }
}

export function DashboardHome({
  restaurantName,
  initialQuery = "",
}: {
  restaurantName: string;
  initialQuery?: string;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [search] = useState(initialQuery);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/orders", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.orders ?? []) as Order[];
      setOrders(list);
      setSelectedId((prev) => {
        if (prev && list.some((o) => o.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    const clock = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  const todayOrders = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return orders.filter(
      (o) => new Date(o.createdAt) >= start && o.status !== "REPORTED"
    );
  }, [orders]);

  const stats = useMemo(() => {
    const preparing = todayOrders.filter((o) =>
      ["NEW", "ACCEPTED", "PREPARING"].includes(o.status)
    ).length;
    const ready = todayOrders.filter((o) => o.status === "READY").length;
    const completed = todayOrders.filter((o) =>
      ["SERVED", "COMPLETED"].includes(o.status)
    ).length;
    const revenue = todayOrders.reduce((s, o) => s + o.total, 0);
    const avg = todayOrders.length ? revenue / todayOrders.length : 0;
    return {
      total: todayOrders.length,
      preparing,
      ready,
      completed,
      revenue,
      avg,
    };
  }, [todayOrders]);

  const topItems = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of todayOrders) {
      for (const item of o.items) {
        map.set(item.itemName, (map.get(item.itemName) ?? 0) + item.quantity);
      }
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [todayOrders]);

  const maxTop = topItems[0]?.count || 1;

  const filtered = useMemo(() => {
    let list = todayOrders;
    if (filter === "NEW") list = list.filter((o) => o.status === "NEW" || o.status === "ACCEPTED");
    else if (filter === "PREPARING") list = list.filter((o) => o.status === "PREPARING");
    else if (filter === "READY") list = list.filter((o) => o.status === "READY" || o.status === "SERVED");
    else if (filter === "COMPLETED") list = list.filter((o) => o.status === "COMPLETED");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          String(o.table?.tableNumber ?? "").includes(q) ||
          o.items.some((i) => i.itemName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [todayOrders, filter, search]);

  const selected = orders.find((o) => o.id === selectedId) ?? filtered[0] ?? null;

  async function advanceStatus(order: Order) {
    setUpdatingId(order.id);
    try {
      let body: Record<string, unknown> = { orderId: order.id, advance: true };
      if (order.status === "NEW" || order.status === "ACCEPTED") {
        body = { orderId: order.id, status: "PREPARING" };
      } else if (order.status === "PREPARING") {
        body = { orderId: order.id, status: "READY" };
      } else if (order.status === "READY") {
        body = { orderId: order.id, status: "SERVED" };
      } else if (order.status === "SERVED") {
        body = { orderId: order.id, status: "COMPLETED" };
      } else {
        return;
      }
      const res = await fetch("/api/dashboard/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("Could not update order status");
        return;
      }
      const data = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
      toast.success(`Order ${order.orderNumber} updated`);
    } finally {
      setUpdatingId(null);
    }
  }

  function nextActionLabel(status: string) {
    if (status === "NEW" || status === "ACCEPTED") return "Accept & Prepare";
    if (status === "PREPARING") return "Mark as Ready";
    if (status === "READY") return "Mark as Served";
    if (status === "SERVED") return "Complete Order";
    return null;
  }

  function tableLabel(o: Order) {
    if (o.orderSource === "WAITING_CUSTOMER") {
      return `W#${o.waitingCustomer?.waitingNumber ?? "—"}`;
    }
    if (o.customerName === "Walking Customer") return "Walk";
    if (o.table) return String(o.table.tableNumber).padStart(2, "0");
    return "—";
  }

  function itemsSummary(o: Order) {
    const names = o.items.map((i) => i.itemName);
    if (names.length === 0) return "No items";
    if (names.length === 1) return names[0];
    return `${names[0]} + ${names.length - 1} more`;
  }

  const taxRate = 0.1;
  const selectedSubtotal = selected?.items.reduce((s, i) => s + i.subtotal, 0) ?? 0;
  const selectedTax = selected ? selected.total - selectedSubtotal || selected.total * taxRate : 0;

  return (
    <div className="animate-fade-up space-y-5">
      {/* Hero row */}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.55fr_1fr]">
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-[28px]">
            {greeting()}, {restaurantName} ☕
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Here&apos;s what&apos;s happening with your café today.
          </p>
        </div>

        <div className="card-surface flex items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">
              {format(now, "EEE, d MMM yyyy")}
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-[var(--text)]">
              {format(now, "hh:mm a")}
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <Clock3 className="h-5 w-5" />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[#f3e9d8] to-[#faf6ef] shadow-[var(--shadow-sm)]">
          <div className="relative z-10 flex h-full min-h-[88px] items-center justify-between gap-3 p-4">
            <div>
              <p className="text-base font-bold text-[#3d2e1a]">Fresh Flavors · Better Days</p>
              <p className="mt-0.5 text-xs text-[#7a6a55]">Good food · Great vibes</p>
            </div>
            <img
              src="/logo.png"
              alt=""
              className="h-16 w-16 rounded-2xl object-cover shadow-md"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Orders",
            value: stats.total,
            hint: "Today",
            color: "#1e6bff",
            iconBg: "bg-blue-50 text-blue-600",
            Icon: ShoppingBag,
          },
          {
            label: "Preparing",
            value: stats.preparing,
            hint: "In Kitchen",
            color: "#f59e0b",
            iconBg: "bg-amber-50 text-amber-600",
            Icon: UtensilsCrossed,
          },
          {
            label: "Ready",
            value: stats.ready,
            hint: "Waiting for Pickup",
            color: "#10b981",
            iconBg: "bg-emerald-50 text-emerald-600",
            Icon: Check,
          },
          {
            label: "Completed",
            value: stats.completed,
            hint: "Today's Served",
            color: "#8b5cf6",
            iconBg: "bg-violet-50 text-violet-600",
            Icon: ClipboardList,
          },
        ].map((card) => (
          <div key={card.label} className="card-surface flex items-start justify-between gap-3 p-4">
            <div>
              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg}`}>
                <card.Icon className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-[var(--text-muted)]">{card.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{card.value}</p>
              <p className="mt-1 text-[11px] font-medium text-[var(--success)]">{card.hint}</p>
            </div>
            <Sparkline color={card.color} />
          </div>
        ))}
      </div>

      {/* Orders + detail */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card-surface overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
            <h2 className="text-base font-bold text-[var(--text)]">Recent Orders</h2>
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === f.key
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "bg-[var(--bg-soft)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)]"
              aria-label="Filter"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--text-dim)]">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-3 py-3 font-semibold">Table</th>
                  <th className="px-3 py-3 font-semibold">Items</th>
                  <th className="px-3 py-3 font-semibold">Total</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-dim)]">
                      Loading orders…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-dim)]">
                      No orders for this filter yet.
                    </td>
                  </tr>
                )}
                {filtered.map((order) => {
                  const st = statusStyle(order.status);
                  const active = selected?.id === order.id;
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className={`cursor-pointer border-b border-[var(--border)]/70 transition hover:bg-[var(--bg-soft)] ${
                        active ? "bg-[var(--primary-soft)]/50" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5 font-semibold text-[var(--text)]">
                        #{order.orderNumber.replace(/^.*-/, "") || order.orderNumber}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-[var(--primary-soft)] px-2 py-1 text-xs font-bold text-[var(--primary)]">
                          {tableLabel(order)}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex -space-x-1.5">
                            {order.items.slice(0, 2).map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border-2 border-white bg-[var(--bg-soft)] text-[10px] font-bold text-[var(--text-muted)]"
                                title={item.itemName}
                              >
                                {item.itemName.slice(0, 1)}
                              </span>
                            ))}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--text)]">{itemsSummary(order)}</p>
                            <p className="text-[11px] text-[var(--text-dim)]">
                              {order.items.reduce((s, i) => s + i.quantity, 0)} items
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 font-semibold tabular-nums text-[var(--text)]">
                        {formatMoney(order.total)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`status-pill ${st.pill}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 tabular-nums text-[var(--text-muted)]">
                        {format(new Date(order.createdAt), "hh:mm a")}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(order.id);
                            }}
                            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--bg-soft)]"
                            aria-label="More"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Order detail panel */}
        <aside className="card-surface flex min-h-[420px] flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <ClipboardList className="h-8 w-8 text-[var(--text-dim)]" />
              <p className="text-sm font-medium text-[var(--text-muted)]">Select an order</p>
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--border)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold text-[var(--text)]">Order #{selected.orderNumber}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-soft)] px-2 py-1 font-medium">
                        <Table2 className="h-3 w-3" />
                        Table {tableLabel(selected)}
                      </span>
                      <span>{format(new Date(selected.createdAt), "hh:mm a")}</span>
                      <span>{selected.items.length} items</span>
                    </div>
                  </div>
                  <span className={`status-pill ${statusStyle(selected.status).pill}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusStyle(selected.status).dot}`} />
                    {statusStyle(selected.status).label}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {selected.items.map((item) => {
                  const opts = parseOptions(item.selectedOptions);
                  return (
                    <div
                      key={item.id}
                      className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/60 p-3"
                    >
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-bold text-[var(--primary)] shadow-sm">
                        {item.itemName.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">{item.itemName}</p>
                        {opts && <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{opts}</p>}
                        <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                          {formatMoney(item.unitPrice)} × {item.quantity}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-[var(--text)]">
                        {formatMoney(item.subtotal)}
                      </p>
                    </div>
                  );
                })}

                <div className="space-y-1.5 border-t border-[var(--border)] pt-3 text-sm">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatMoney(selectedSubtotal || selected.total)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Tax (est.)</span>
                    <span className="tabular-nums">{formatMoney(Math.max(0, selectedTax))}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-[var(--text)]">
                    <span>Total</span>
                    <span className="tabular-nums text-[var(--primary)]">{formatMoney(selected.total)}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
                    Order Status
                  </p>
                  <ol className="space-y-3">
                    {TIMELINE.map((step, idx) => {
                      const orderIdx = TIMELINE.indexOf(
                        selected.status === "ACCEPTED"
                          ? "NEW"
                          : selected.status === "SERVED"
                            ? "READY"
                            : selected.status === "REPORTED"
                              ? "COMPLETED"
                              : (selected.status as (typeof TIMELINE)[number])
                      );
                      const done = orderIdx > idx || selected.status === "COMPLETED" || selected.status === "REPORTED";
                      const current =
                        (selected.status === "NEW" || selected.status === "ACCEPTED"
                          ? "NEW"
                          : selected.status === "SERVED"
                            ? "READY"
                            : selected.status) === step;
                      return (
                        <li key={step} className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                              done || current
                                ? current && !done
                                  ? "bg-amber-500 text-white"
                                  : "bg-emerald-500 text-white"
                                : "bg-[var(--bg-soft)] text-[var(--text-dim)]"
                            }`}
                          >
                            {done && !current ? <Check className="h-3 w-3" /> : idx + 1}
                          </span>
                          <div>
                            <p className={`text-sm font-semibold ${current ? "text-amber-600" : "text-[var(--text)]"}`}>
                              {STATUS_LABELS[step]}
                            </p>
                            {current && (
                              <p className="text-[11px] font-medium text-amber-600">In Progress</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>

              <div className="space-y-2 border-t border-[var(--border)] p-4">
                {nextActionLabel(selected.status) && (
                  <button
                    type="button"
                    disabled={updatingId === selected.id}
                    onClick={() => advanceStatus(selected)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:opacity-60"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    {updatingId === selected.id ? "Updating…" : nextActionLabel(selected.status)}
                  </button>
                )}
                <Link
                  href="/dashboard"
                  className="inline-flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--primary)]"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedId(selected.id);
                  }}
                >
                  <Eye className="h-4 w-4" />
                  View Order Details
                </Link>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Bottom widgets */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card-surface p-4">
          <h3 className="text-sm font-bold text-[var(--text)]">Quick Actions</h3>
          <div className="mt-3 space-y-2">
            {[
              { href: "/dashboard/menu", label: "View Menu", Icon: UtensilsCrossed },
              { href: "/dashboard/tables", label: "Manage Tables", Icon: Table2 },
              { href: "/dashboard/reports", label: "View Reports", Icon: BarChart3 },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/50 px-3 py-3 transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/40"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <a.Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-semibold text-[var(--text)]">{a.label}</span>
                <ChevronRight className="h-4 w-4 text-[var(--text-dim)]" />
              </Link>
            ))}
          </div>
        </section>

        <section className="card-surface p-4">
          <h3 className="text-sm font-bold text-[var(--text)]">Today&apos;s Overview</h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Total Orders", value: String(stats.total), tip: "Today" },
              { label: "Revenue", value: formatMoney(stats.revenue), tip: "Gross" },
              { label: "Avg. Order", value: formatMoney(stats.avg), tip: "Basket" },
            ].map((row) => (
              <div key={row.label}>
                <p className="text-[11px] text-[var(--text-muted)]">{row.label}</p>
                <p className="mt-1 text-base font-bold tabular-nums text-[var(--text)] sm:text-lg">
                  {row.value}
                </p>
                <p className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-[var(--success)]">
                  <ArrowUpRight className="h-3 w-3" />
                  {row.tip}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card-surface p-4">
          <h3 className="text-sm font-bold text-[var(--text)]">Top Selling Items</h3>
          <ol className="mt-3 space-y-3">
            {topItems.length === 0 && (
              <li className="text-sm text-[var(--text-dim)]">No sales yet today.</li>
            )}
            {topItems.map((item, i) => (
              <li key={item.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
                  {i + 1}
                </span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-soft)] text-xs font-bold text-[var(--text-muted)]">
                  {item.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text)]">{item.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{item.count} orders</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${Math.max(12, (item.count / maxTop) * 100)}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
