"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "@/components/ToastProvider";
import { formatMoney } from "@/lib/utils";

type WaitingRow = {
  id: string;
  customerName: string;
  customerPhone: string;
  peopleCount: number;
  waitingNumber: number;
  tableRequirement: string | null;
  notes: string | null;
  status: string;
  tableStatus: string;
  reservedAt: string | null;
  assignedAt: string | null;
  createdAt: string;
  waitingMinutes: number;
  assignedTable: { id: string; tableNumber: number; status: string } | null;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    orderSource: string;
    createdAt: string;
    items: { id: string; itemName: string; quantity: number; subtotal: number }[];
  } | null;
};

type TableOpt = { id: string; tableNumber: number; status: string };

export function WaitingCustomersManager() {
  const [rows, setRows] = useState<WaitingRow[]>([]);
  const [tables, setTables] = useState<TableOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/waiting-customers");
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to load waiting customers");
      setLoading(false);
      return;
    }
    setRows(data.waitingCustomers ?? []);
    setTables(data.tables ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    const interval = setInterval(load, 15000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [load]);

  async function assign(waitingCustomerId: string, action: "RESERVED" | "SEATED") {
    const tableId = selectedTable[waitingCustomerId];
    if (!tableId) {
      toast.error("Select a table first");
      return;
    }
    setAssigningId(waitingCustomerId);
    const res = await fetch("/api/dashboard/waiting-customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waitingCustomerId, tableId, action }),
    });
    const data = await res.json();
    setAssigningId(null);
    if (!res.ok) {
      toast.error(data.error || "Could not assign table");
      return;
    }
    toast.success(action === "SEATED" ? "Customer seated" : "Table reserved");
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl tracking-tight text-[var(--text)] sm:text-3xl">
        Waiting Customers
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Live waitlist from the Hungry Habibi waiting-customer menu. Assign tables when ready.
      </p>

      {loading && (
        <p className="mt-8 text-center text-sm text-[var(--text-dim)]">Loading waitlist…</p>
      )}

      <div className="mt-6 space-y-4">
        {rows.map((w) => (
          <article
            key={w.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow)] sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-xl text-[var(--gold-bright)]">
                  Waiting #{w.waitingNumber}
                </p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">{w.customerName}</p>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">{w.customerPhone}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--gold)]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--gold-bright)]">
                  {w.status.replace(/_/g, " ")}
                </span>
                <span className="rounded-full bg-[var(--bg-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  {w.tableStatus.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-[var(--text-dim)]">People</dt>
                <dd className="font-medium text-[var(--text)]">{w.peopleCount}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-dim)]">Order</dt>
                <dd className="font-medium text-[var(--text)]">
                  {w.order ? `#${w.order.orderNumber}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-dim)]">Amount</dt>
                <dd className="font-medium text-[var(--gold-bright)]">
                  {w.order ? formatMoney(w.order.total) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-dim)]">Wait time</dt>
                <dd className="font-medium text-[var(--text)]">{w.waitingMinutes} min</dd>
              </div>
              <div>
                <dt className="text-[var(--text-dim)]">Order time</dt>
                <dd className="font-medium text-[var(--text)]">
                  {format(new Date(w.createdAt), "HH:mm")}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-dim)]">Table</dt>
                <dd className="font-medium text-[var(--text)]">
                  {w.assignedTable
                    ? `B-${String(w.assignedTable.tableNumber).padStart(4, "0")} (T${w.assignedTable.tableNumber})`
                    : "Not assigned"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-dim)]">Reserved</dt>
                <dd className="font-medium text-[var(--text)]">
                  {w.reservedAt ? format(new Date(w.reservedAt), "HH:mm") : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-dim)]">Assigned</dt>
                <dd className="font-medium text-[var(--text)]">
                  {w.assignedAt ? format(new Date(w.assignedAt), "HH:mm") : "—"}
                </dd>
              </div>
            </dl>

            {(w.tableRequirement || w.notes) && (
              <div className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
                {w.tableRequirement && <p>Requirement: {w.tableRequirement}</p>}
                {w.notes && <p>Notes: {w.notes}</p>}
              </div>
            )}

            {w.order && w.order.items.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--text)]">
                {w.order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span>
                      {item.quantity}× {item.itemName}
                    </span>
                    <span className="tabular-nums text-[var(--text-muted)]">
                      {formatMoney(item.subtotal)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {w.status !== "SEATED" && w.status !== "CANCELLED" && w.status !== "COMPLETED" && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
                <select
                  value={selectedTable[w.id] || w.assignedTable?.id || ""}
                  onChange={(e) =>
                    setSelectedTable((prev) => ({ ...prev, [w.id]: e.target.value }))
                  }
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--gold)]"
                >
                  <option value="">Select table…</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.tableNumber} ({t.status})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={assigningId === w.id}
                  onClick={() => assign(w.id, "RESERVED")}
                  className="rounded-xl bg-[var(--info)]/20 px-3 py-2 text-sm font-semibold text-[var(--info)] disabled:opacity-50"
                >
                  Reserve table
                </button>
                <button
                  type="button"
                  disabled={assigningId === w.id}
                  onClick={() => assign(w.id, "SEATED")}
                  className="rounded-xl bg-[var(--gold)] px-3 py-2 text-sm font-semibold text-[#101820] disabled:opacity-50"
                >
                  Seat customer
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {!loading && rows.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-dim)]">
          No waiting customers yet. Orders from the waiting-customer menu will appear here.
        </p>
      )}
    </div>
  );
}
