"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = q.trim();
    if (!value) return;
    router.push(`/dashboard?q=${encodeURIComponent(value)}`);
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search orders, menu items, tables..."
        className="w-full rounded-full border border-transparent bg-[var(--bg-soft)] py-2.5 pl-10 pr-16 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-dim)] focus:border-[var(--primary)]/30 focus:bg-[var(--bg-card)] focus:ring-2 focus:ring-[var(--primary)]/15"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-dim)] sm:inline">
        ⌘ K
      </kbd>
    </form>
  );
}
