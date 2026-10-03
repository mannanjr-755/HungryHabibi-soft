"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Users } from "lucide-react";
import { toast } from "@/components/ToastProvider";
import { BRAND_SLUG, tableMenuUrl, waitingCustomerMenuUrl } from "@/lib/brand";

type TableRow = {
  id: string;
  tableNumber: number;
  uniqueCode: string;
  active: boolean;
  status?: string;
  menuUrl?: string;
  activeOrder?: { id: string; orderNumber: string; status: string; customerName: string } | null;
  reservation?: {
    id: string;
    customerName: string;
    waitingNumber: number;
    status: string;
    tableStatus: string;
  } | null;
};

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-[var(--success)]/15 text-[var(--success)]",
  RESERVED: "bg-[var(--info)]/15 text-[var(--info)]",
  OCCUPIED: "bg-[var(--orange)]/15 text-[var(--orange)]",
  WAITING: "bg-[var(--gold)]/20 text-[var(--gold-bright)]",
};

export function TablesManager() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [slug, setSlug] = useState(BRAND_SLUG);
  const [waitingUrl, setWaitingUrl] = useState(waitingCustomerMenuUrl());
  const [tableNumber, setTableNumber] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/tables");
    const data = await res.json();
    setTables(data.tables ?? []);
    setSlug(data.slug ?? BRAND_SLUG);
    setWaitingUrl(data.waitingCustomerUrl ?? waitingCustomerMenuUrl(data.slug ?? BRAND_SLUG));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/dashboard/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber: Number(tableNumber) }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not create table.");
      return;
    }
    toast.success(`Table ${data.table.tableNumber} created.`);
    setTableNumber("");
    load();
  }

  function openMenu(n: number) {
    return tables.find((t) => t.tableNumber === n)?.menuUrl || tableMenuUrl(n, slug);
  }

  return (
    <div>
      <h1 className="font-display text-2xl tracking-tight text-[var(--text)] sm:text-3xl">
        Tables
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Open each table&apos;s Hungry Habibi menu for NFC cards and QR codes. Waiting customers use a
        separate menu without a table number.
      </p>

      <a
        href={waitingUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-6 flex flex-col gap-3 rounded-2xl border border-[var(--gold)]/40 bg-gradient-to-br from-[var(--gold)]/15 to-[var(--bg-card)] p-5 shadow-[var(--shadow)] transition hover:border-[var(--gold)] sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gold)]/20 text-[var(--gold-bright)]">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg text-[var(--gold-bright)]">Waiting Customer</p>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              Open the waitlist menu — no table number assigned.
            </p>
            <p className="mt-2 break-all font-mono text-[11px] text-[var(--text-dim)]">{waitingUrl}</p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[#101820]">
          Open Menu
          <ExternalLink className="h-4 w-4" />
        </span>
      </a>

      <form onSubmit={createTable} className="mt-6 flex flex-wrap gap-2">
        <input
          type="number"
          min={1}
          required
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          placeholder="Table number"
          className="w-40 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--gold)]"
        />
        <button
          type="submit"
          className="rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[#101820]"
        >
          Create table
        </button>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((t) => {
          const status = t.status || "AVAILABLE";
          const url = openMenu(t.tableNumber);
          return (
            <article
              key={t.id}
              className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xl text-[var(--text)]">Table {t.tableNumber}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--text-dim)]">{t.uniqueCode}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    STATUS_STYLES[status] || STATUS_STYLES.AVAILABLE
                  }`}
                >
                  {status.replace(/_/g, " ")}
                </span>
              </div>

              {t.activeOrder && (
                <p className="mt-3 rounded-lg bg-[var(--bg-soft)] px-2.5 py-2 text-xs text-[var(--text-muted)]">
                  Active: {t.activeOrder.orderNumber} · {t.activeOrder.customerName}
                </p>
              )}
              {t.reservation && (
                <p className="mt-2 rounded-lg bg-[var(--gold)]/10 px-2.5 py-2 text-xs text-[var(--gold-bright)]">
                  Waiting #{t.reservation.waitingNumber} · {t.reservation.customerName}
                </p>
              )}

              <p className="mt-3 break-all font-mono text-[10px] leading-relaxed text-[var(--text-dim)]">
                {url}
              </p>

              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-[var(--gold)]/10 px-3 py-2.5 text-sm font-semibold text-[var(--gold-bright)] transition hover:bg-[var(--gold)]/20"
              >
                Open Menu
                <ExternalLink className="h-4 w-4" />
              </a>
            </article>
          );
        })}
      </div>

      {tables.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-dim)]">
          No tables yet. Create table 1 to get started.
        </p>
      )}
    </div>
  );
}
