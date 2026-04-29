"use client";

import { useMemo, useState } from "react";
import { deleteInvoice, updateInvoice } from "@/app/actions";
import { daysSince, money } from "@/lib/format";

export type InvoiceRow = {
  id: string;
  projectId: string;
  invoiceDate: string;
  monthCovered: string;
  invoiceNo: string;
  amount: number;
  isPaid: boolean;
  paidDate: string;
  notes: string;
};

function dateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function InvoicesManager({ invoices }: { invoices: InvoiceRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredInvoices = useMemo(() => {
    if (!normalizedQuery) return invoices;
    return invoices.filter((invoice) => {
      return [
        invoice.invoiceNo,
        invoice.monthCovered,
        displayDate(invoice.invoiceDate),
        invoice.amount,
        invoice.isPaid ? "paid" : "unpaid",
        invoice.paidDate ? displayDate(invoice.paidDate) : "",
        invoice.notes,
      ].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [invoices, normalizedQuery]);

  if (!invoices.length) {
    return (
      <div className="rounded-lg border border-dashed border-[#c5cdd6] bg-[#f7f9fb] p-4 text-sm font-bold text-[#687482]">
        No invoices saved for this project yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label>
        Search invoices
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Invoice number, month, amount, or note" />
      </label>
      <div className="text-xs font-bold text-[#687482]">Showing {filteredInvoices.length} of {invoices.length} invoices</div>
      {filteredInvoices.map((invoice) => {
        const isEditing = editingId === invoice.id;

        return (
          <div key={invoice.id} className="rounded-lg border border-[#d8dee5] bg-white p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-black">{invoice.invoiceNo || "Invoice"}</div>
                <div className="mt-1 text-sm font-semibold text-[#687482]">
                  {invoice.monthCovered} / {displayDate(invoice.invoiceDate)}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={invoice.isPaid ? "status status-active" : "status status-on-hold"}>
                    {invoice.isPaid ? "Paid" : "Unpaid"}
                  </span>
                  <span className="status status-not-started">
                    Issued {daysSince(invoice.invoiceDate)} days ago
                  </span>
                  {invoice.isPaid && invoice.paidDate ? (
                    <span className="status status-finished">Paid {displayDate(invoice.paidDate)}</span>
                  ) : null}
                </div>
                {invoice.notes ? <div className="mt-2 text-sm text-[#46515d]">{invoice.notes}</div> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <div className="mr-1 font-black text-[#285f8f]">{money(invoice.amount)}</div>
                <button className="btn btn-small btn-edit" type="button" onClick={() => setEditingId(isEditing ? null : invoice.id)}>
                  {isEditing ? "Cancel" : "Edit"}
                </button>
                <form
                  action={deleteInvoice}
                  onSubmit={(event) => {
                    if (!window.confirm(`Delete invoice "${invoice.invoiceNo || displayDate(invoice.invoiceDate)}"? This cannot be undone.`)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={invoice.id} />
                  <input type="hidden" name="projectId" value={invoice.projectId} />
                  <button className="btn btn-small btn-delete" type="submit">Delete</button>
                </form>
              </div>
            </div>

            {isEditing ? (
              <form
                action={async (formData) => {
                  await updateInvoice(formData);
                  setEditingId(null);
                }}
                className="mt-4 grid gap-3 border-t border-[#e8edf2] pt-4 md:grid-cols-2"
              >
                <input type="hidden" name="id" value={invoice.id} />
                <input type="hidden" name="projectId" value={invoice.projectId} />
                <label>Invoice date<input name="invoiceDate" type="date" required defaultValue={dateInputValue(invoice.invoiceDate)} /></label>
                <label>Month covered<input name="monthCovered" type="month" required defaultValue={invoice.monthCovered} /></label>
                <label>Invoice number<input name="invoiceNo" defaultValue={invoice.invoiceNo} placeholder="Optional" /></label>
                <label>Amount invoiced<input name="amount" type="number" min="0" step="0.01" required defaultValue={invoice.amount} /></label>
                <label className="md:col-span-2">
                  Paid status
                  <span className="flex items-center gap-2 rounded-lg border border-[#d8dee5] bg-[#f7f9fb] px-3 py-2 text-sm font-bold text-[#46515d]">
                    <input className="size-4 w-auto" name="isPaid" type="checkbox" defaultChecked={invoice.isPaid} />
                    Invoice has been paid
                  </span>
                </label>
                <label>Paid date<input name="paidDate" type="date" defaultValue={invoice.paidDate ? dateInputValue(invoice.paidDate) : ""} /></label>
                <label className="md:col-span-2">Notes<textarea name="notes" rows={3} defaultValue={invoice.notes} placeholder="Optional invoice notes" /></label>
                <div className="flex gap-2 md:col-span-2">
                  <button className="btn btn-small btn-secondary" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                  <button className="btn btn-small btn-save" type="submit">Save invoice</button>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}
      {!filteredInvoices.length ? (
        <div className="rounded-lg border border-dashed border-[#c5cdd6] bg-[#f7f9fb] p-4 text-sm font-bold text-[#687482]">
          No invoices match your search.
        </div>
      ) : null}
    </div>
  );
}
