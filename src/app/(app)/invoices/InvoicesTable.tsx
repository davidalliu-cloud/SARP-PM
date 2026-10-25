"use client";

import Link from "next/link";
import { useState } from "react";
import { markInvoicePaid, markInvoiceUnpaid } from "@/app/actions";
import { daysUntil, formatDate, invoiceAgeLabel, money } from "@/lib/format";

export type InvoiceLedgerRow = {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string | null;
  invoiceNo: string | null;
  monthCovered: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  isPaid: boolean;
  paidDate: string | null;
  stateLabel: string;
  stateClassName: string;
  stateRank: number;
};

type SortKey = "state" | "project" | "invoiceDate" | "dueDate" | "amount";

const sortColumns: { key: SortKey; label: string }[] = [
  { key: "state", label: "Status" },
  { key: "project", label: "Project" },
  { key: "invoiceDate", label: "Issued" },
  { key: "dueDate", label: "Due" },
  { key: "amount", label: "Amount" },
];

function dateInputValue(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

export function InvoicesTable({ rows }: { rows: InvoiceLedgerRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("state");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "state") return (a.stateRank - b.stateRank) * dir;
    if (sortKey === "project") return a.projectName.localeCompare(b.projectName) * dir;
    if (sortKey === "invoiceDate") return (new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime()) * dir;
    if (sortKey === "dueDate") return (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) * dir;
    return (a.amount - b.amount) * dir;
  });

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {sortColumns.map((col) => (
              <th key={col.key}>
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className="inline-flex items-center gap-1 font-bold uppercase tracking-wide hover:text-lab-burgundy"
                  title={`Sort by ${col.label}`}
                >
                  {col.label}
                  {sortKey === col.key ? <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span> : null}
                </button>
              </th>
            ))}
            <th>Age</th>
            <th>Paid date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.id}>
              <td><span className={row.stateClassName}>{row.stateLabel}</span></td>
              <td>
                <Link href={`/projects/${row.projectId}`} className="font-bold text-ink">{row.projectName}</Link>
                {row.clientName ? <div className="mt-1 text-xs font-bold text-muted">{row.clientName}</div> : null}
              </td>
              <td>
                <div className="font-bold">{row.invoiceNo || "No number"}</div>
                <div className="mt-1 text-xs font-bold text-muted">{row.monthCovered}</div>
              </td>
              <td>{formatDate(row.invoiceDate)}</td>
              <td className={!row.isPaid && daysUntil(row.dueDate) < 0 ? "font-bold text-lab-burgundy" : "font-bold text-ink"}>{formatDate(row.dueDate)}</td>
              <td>{invoiceAgeLabel(row.invoiceDate, row.dueDate, row.isPaid)}</td>
              <td className="font-bold text-[#777da7]">{money(row.amount)}</td>
              <td>{row.paidDate ? formatDate(row.paidDate) : "-"}</td>
              <td>
                {row.isPaid ? (
                  <form action={markInvoiceUnpaid}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="projectId" value={row.projectId} />
                    <button className="btn btn-small btn-secondary" type="submit">Mark unpaid</button>
                  </form>
                ) : (
                  <form action={markInvoicePaid} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="projectId" value={row.projectId} />
                    <input className="w-32" name="paidDate" type="date" defaultValue={dateInputValue()} aria-label="Paid date" />
                    <button className="btn btn-small btn-save" type="submit">Mark paid</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sortedRows.length ? (
        <div className="p-5 text-sm font-bold text-muted">No invoices have been created yet.</div>
      ) : null}
    </div>
  );
}
