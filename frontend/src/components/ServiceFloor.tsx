"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/utils";

type OrderCard = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  tableNumber: number | null;
  createdAt: string;
  preorder?: boolean;
  items: { name: string; quantity: number }[];
};

type WaitCard = {
  id: string;
  tableNumber: number | null;
  guest: string;
  status: string;
  position: number;
  joinedAt: string;
  estimateText?: string;
};

type TableCard = {
  id: string;
  tableNumber: number;
  guest: string;
  lifecycle: string;
  since: string;
  orderNumber: string | null;
  estimateText?: string;
  preorder?: boolean;
};

type RequestCard = {
  id: string;
  type: string;
  message: string;
  tableNumber: number;
  orderId: string | null;
  orderNumber: string | null;
  createdAt: string;
};

type Floor = {
  waitlist: WaitCard[];
  activeTables: TableCard[];
  newOrders: OrderCard[];
  preparing: OrderCard[];
  ready: OrderCard[];
  serviceRequests: RequestCard[];
  billRequests: RequestCard[];
};

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ServiceFloor() {
  const [floor, setFloor] = useState<Floor | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/floor", { cache: "no-store" });
    if (!res.ok) return;
    setFloor(await res.json());
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 3000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  async function act(action: string, id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/floor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update.");
        return;
      }
      setFloor(data);
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h1 className="font-display text-2xl text-[var(--text)]">Service floor</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Waitlist, tables, orders, and service requests update live.
        </p>
      </div>
      {error && (
        <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title="Waitlist" count={floor?.waitlist.length ?? 0}>
          {(floor?.waitlist ?? []).map((entry) => (
            <article key={entry.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--text)]">
                    Table #{entry.tableNumber ?? "—"}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">{entry.guest}</p>
                </div>
                <Badge tone={entry.status === "CALLED" ? "gold" : "muted"}>{entry.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-[var(--text-dim)]">
                Joined {clock(entry.joinedAt)} · Position {entry.position}
                {entry.estimateText ? ` · ${entry.estimateText}` : ""}
              </p>
              <div className="mt-3 flex gap-2">
                {entry.status !== "CALLED" && entry.status !== "READY" && (
                  <Action disabled={busyId === entry.id} onClick={() => void act("call", entry.id)}>
                    Call
                  </Action>
                )}
                <Action disabled={busyId === entry.id} onClick={() => void act("seat", entry.id)}>
                  Seat
                </Action>
                <Ghost disabled={busyId === entry.id} onClick={() => void act("cancel-wait", entry.id)}>
                  Cancel
                </Ghost>
              </div>
            </article>
          ))}
        </Panel>

        <Panel title="Active tables" count={floor?.activeTables.length ?? 0}>
          {(floor?.activeTables ?? []).map((table) => (
            <article key={table.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">Table #{table.tableNumber}</p>
                  <p className="text-sm text-[var(--text-muted)]">{table.guest}</p>
                </div>
                <Badge tone={table.lifecycle === "READY" || table.lifecycle === "SERVE REQUEST" ? "green" : "muted"}>
                  {table.lifecycle === "BILL" ? "BILLING" : table.lifecycle === "SERVE REQUEST" ? "SERVICE REQUEST" : table.lifecycle}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-[var(--text-dim)]">
                Since {clock(table.since)}
                {table.orderNumber ? ` · ${table.orderNumber}` : ""}
                {table.estimateText ? ` · Free ${table.estimateText}` : ""}
                {table.preorder ? " · Pre-order" : ""}
              </p>
            </article>
          ))}
        </Panel>

        <Panel title="New orders" count={floor?.newOrders.length ?? 0} urgent>
          {(floor?.newOrders ?? []).map((order) => (
            <OrderCardView
              key={order.id}
              order={order}
              busy={busyId === order.id}
              actionLabel="Accept order"
              onAction={() => void act("accept", order.id)}
            />
          ))}
        </Panel>

        <Panel title="Preparing" count={floor?.preparing.length ?? 0}>
          {(floor?.preparing ?? []).map((order) => (
            <OrderCardView
              key={order.id}
              order={order}
              busy={busyId === order.id}
              actionLabel="Mark ready"
              onAction={() => void act("ready", order.id)}
            />
          ))}
        </Panel>

        <Panel title="Ready" count={floor?.ready.length ?? 0} highlight>
          {(floor?.ready ?? []).map((order) => (
            <OrderCardView
              key={order.id}
              order={order}
              busy={busyId === order.id}
              actionLabel="Serve"
              onAction={() => void act("serve", order.id)}
            />
          ))}
        </Panel>

        <Panel title="Service requests" count={floor?.serviceRequests.length ?? 0} highlight>
          {(floor?.serviceRequests ?? []).map((request) => (
            <article key={request.id} className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold-bright)]">
                {request.type === "SERVE" ? "Service request" : "Call staff"}
              </p>
              <p className="mt-1 font-semibold">Table #{request.tableNumber}</p>
              {request.orderNumber && (
                <p className="text-sm text-[var(--text-muted)]">Order {request.orderNumber}</p>
              )}
              <p className="mt-1 text-sm text-[var(--text)]">{request.message}</p>
              <p className="mt-1 text-xs text-[var(--text-dim)]">{clock(request.createdAt)}</p>
              <Action
                disabled={busyId === request.id}
                onClick={() =>
                  void act(request.type === "SERVE" && request.orderId ? "serve" : "ack", request.orderId && request.type === "SERVE" ? request.orderId : request.id)
                }
              >
                {request.type === "SERVE" ? "Serve now" : "Done"}
              </Action>
            </article>
          ))}
        </Panel>

        <Panel title="Bill requests" count={floor?.billRequests.length ?? 0} urgent>
          {(floor?.billRequests ?? []).map((request) => (
            <article key={request.id} className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-red-200">Bill request</p>
              <p className="mt-1 font-semibold">Table #{request.tableNumber}</p>
              <p className="mt-1 text-sm">{request.message}</p>
              <p className="mt-1 text-xs text-[var(--text-dim)]">{clock(request.createdAt)}</p>
              <Action disabled={busyId === request.id} onClick={() => void act("complete-bill", request.id)}>
                Complete bill
              </Action>
            </article>
          ))}
        </Panel>
      </div>
    </section>
  );
}

function OrderCardView({
  order,
  busy,
  actionLabel,
  onAction,
}: {
  order: OrderCard;
  busy: boolean;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
            {order.status === "NEW" ? "New order" : order.status === "READY" ? "Ready order" : order.status}
          </p>
          <p className="mt-1 font-semibold">Table #{order.tableNumber ?? "—"}</p>
          <p className="text-sm text-[var(--text-muted)]">
            Order {order.orderNumber}
            {order.preorder ? " · Pre-order" : ""}
          </p>
        </div>
        <span className="text-xs text-[var(--text-dim)]">{clock(order.createdAt)}</span>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={`${order.id}-${item.name}`}>
            {item.quantity}× {item.name}
          </li>
        ))}
      </ul>
      <p className="mt-2 font-semibold text-[var(--gold-bright)]">{formatMoney(order.total)}</p>
      <Action disabled={busy} onClick={onAction}>
        {actionLabel}
      </Action>
    </article>
  );
}

function Panel({
  title,
  count,
  children,
  urgent,
  highlight,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  urgent?: boolean;
  highlight?: boolean;
}) {
  const items = Array.isArray(children) ? children : [children];
  const empty = items.filter(Boolean).length === 0;
  return (
    <section
      className={`rounded-2xl border p-3 ${
        highlight
          ? "border-emerald-500/40 bg-emerald-500/5"
          : urgent
            ? "border-red-500/30 bg-[var(--bg-elevated)]"
            : "border-[var(--border)] bg-[var(--bg-elevated)]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">{title}</h2>
        <span className="rounded-full bg-[var(--bg-soft)] px-2 py-0.5 text-[10px] text-[var(--text-dim)]">
          {count}
        </span>
      </div>
      <div className="space-y-2">
        {empty ? <p className="py-4 text-center text-xs text-[var(--text-dim)]">Nothing here</p> : children}
      </div>
    </section>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "gold" | "green" | "muted" }) {
  const cls =
    tone === "green"
      ? "bg-emerald-500/15 text-emerald-300"
      : tone === "gold"
        ? "bg-[var(--gold)]/15 text-[var(--gold-bright)]"
        : "bg-[var(--bg-soft)] text-[var(--text-muted)]";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${cls}`}>{children}</span>;
}

function Action({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mt-3 w-full rounded-lg bg-[var(--gold)] py-2 text-xs font-bold uppercase tracking-wide text-[#0c0b09] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Ghost({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mt-3 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
