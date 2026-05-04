"use client";

import { useMemo, useState } from "react";
import { deleteInvoice, markInvoicePaid, markInvoiceUnpaid, updateInvoice } from "@/app/actions";
import { daysSince, daysUntil, invoiceAgeLabel, invoiceDueDate, money } from "@/lib/format";

export type InvoiceRow = {
  id: string;
  projectId: string;
  invoiceDate: string;
  monthCovered: string;
  invoiceNo: string;
  amount: number;
  dueDate: string;
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

function invoiceStatusClass(invoice: InvoiceRow) {
  if (invoice.isPaid) return "status status-active";
  const dueIn = daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate));
  if (dueIn < 0) return "status status-on-hold";
  if (dueIn <= 7) return "status status-not-started";
  return "status status-finished";
}

function invoiceStatusLabel(invoice: InvoiceRow) {
  if (invoice.isPaid) return "Paid";
  const dueIn = daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate));
  if (dueIn < 0) return "Overdue";
  if (dueIn <= 7) return "Due soon";
  return "Open";
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
        displayDate(invoice.dueDate),
        invoice.amount,
        invoiceStatusLabel(invoice),
        invoice.paidDate ? displayDate(invoice.paidDate) : "",
        invoice.notes,
      ].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [invoices, normalizedQuery]);

  if (!invoices.length) {
    return (
      <div className="rounded-lg border border-dashed border-[#c5cdd6] bg-[#f3f7f3] p-4 text-sm font-bold text-[#6b7188]">
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
      <div className="text-xs font-bold text-[#6b7188]">Showing {filteredInvoices.length} of {invoices.length} invoices</div>
      {filteredInvoices.map((invoice) => {
        const isEditing = editingId === invoice.id;

        return (
          <div key={invoice.id} className="rounded-lg border border-[#d7e1e5] bg-white p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-black">{invoice.invoiceNo || "Invoice"}</div>
                <div className="mt-1 text-sm font-semibold text-[#6b7188]">
                  {invoice.monthCovered} / Issued {displayDate(invoice.invoiceDate)} / Due {displayDate(invoice.dueDate)}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={invoiceStatusClass(invoice)}>{invoiceStatusLabel(invoice)}</span>
                  <span className="status status-not-started">
                    {invoiceAgeLabel(invoice.invoiceDate, invoice.dueDate, invoice.isPaid)}
                  </span>
                  <span className="status status-finished">
                    Issued {daysSince(invoice.invoiceDate)} days ago
                  </span>
                  {invoice.isPaid && invoice.paidDate ? (
                    <span className="status status-finished">Paid {displayDate(invoice.paidDate)}</span>
                  ) : null}
                </div>
                {invoice.notes ? <div className="mt-2 text-sm text-[#373455]">{invoice.notes}</div> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <div className="mr-1 font-black text-[#777da7]">{money(invoice.amount)}</div>
                {invoice.isPaid ? (
                  <form action={markInvoiceUnpaid}>
                    <input type="hidden" name="id" value={invoice.id} />
                    <input type="hidden" name="projectId" value={invoice.projectId} />
                    <button className="btn btn-small btn-secondary" type="submit">Mark unpaid</button>
                  </form>
                ) : (
                  <form action={markInvoicePaid} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={invoice.id} />
                    <input type="hidden" name="projectId" value={invoice.projectId} />
                    <input className="w-32" name="paidDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} aria-label="Paid date" />
                    <button className="btn btn-small btn-save" type="submit">Mark paid</button>
                  </form>
                )}
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
                className="mt-4 grid gap-3 border-t border-[#e8eef0] pt-4 md:grid-cols-2"
              >
                <input type="hidden" name="id" value={invoice.id} />
                <input type="hidden" name="projectId" value={invoice.projectId} />
                <label>Invoice date<input name="invoiceDate" type="date" required defaultValue={dateInputValue(invoice.invoiceDate)} /></label>
                <label>Month covered<input name="monthCovered" type="month" required defaultValue={invoice.monthCovered} /></label>
                <label>Invoice number<input name="invoiceNo" defaultValue={invoice.invoiceNo} placeholder="Optional" /></label>
                <label>Amount invoiced<input name="amount" type="number" min="0" step="0.01" required defaultValue={invoice.amount} /></label>
                <label>Due date<input name="dueDate" type="date" required defaultValue={dateInputValue(invoice.dueDate)} /></label>
                <label className="md:col-span-2">
                  Paid status
                  <span className="flex items-center gap-2 rounded-lg border border-[#d7e1e5] bg-[#f3f7f3] px-3 py-2 text-sm font-bold text-[#373455]">
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
        <div className="rounded-lg border border-dashed border-[#c5cdd6] bg-[#f3f7f3] p-4 text-sm font-bold text-[#6b7188]">
          No invoices match your search.
        </div>
      ) : null}
    </div>
  );
}
