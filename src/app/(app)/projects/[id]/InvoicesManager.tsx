"use client";

import { useMemo, useState } from "react";
import { deleteInvoice, markInvoicePaid, markInvoiceUnpaid, updateInvoice } from "@/app/actions";
import { useT } from "@/components/LanguageProvider";
import type { TFunction } from "@/lib/i18n";
import { daysSince, daysUntil, formatDate, invoiceAgeLabel, invoiceDueDate, money } from "@/lib/format";

export type InvoiceRow = {
  id: string;
  projectId: string;
  invoiceDate: string;
  monthCovered: string;
  invoiceNo: string;
  amount: number;
  sourceAmount: number | null;
  sourceCurrency: string;
  vatRate: number | null;
  dueDate: string;
  isPaid: boolean;
  paidDate: string;
  clientName: string;
  notes: string;
};

function dateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return formatDate(value);
}

function invoiceStatusClass(invoice: InvoiceRow) {
  if (invoice.isPaid) return "status status-active";
  const dueIn = daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate));
  if (dueIn < 0) return "status status-on-hold";
  if (dueIn <= 7) return "status status-not-started";
  return "status status-finished";
}

function invoiceStatusLabel(invoice: InvoiceRow, t: TFunction) {
  if (invoice.isPaid) return t("pd.invoice.statePaid");
  const dueIn = daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate));
  if (dueIn < 0) return t("pd.invoice.stateOverdue");
  if (dueIn <= 7) return t("pd.invoice.stateDueSoon");
  return t("pd.invoice.stateOpen");
}

export function InvoicesManager({ invoices }: { invoices: InvoiceRow[] }) {
  const t = useT();
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
        invoiceStatusLabel(invoice, t),
        invoice.paidDate ? displayDate(invoice.paidDate) : "",
        invoice.clientName,
        invoice.notes,
      ].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [invoices, normalizedQuery]);

  if (!invoices.length) {
    return (
      <div className="rounded-lg border border-dashed border-[#c5cdd6] bg-[#f1f3f5] p-4 text-sm font-bold text-muted">
        {t("pd.invoice.emptyNone")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label>
        {t("pd.invoice.searchLabel")}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("pd.invoice.searchPlaceholder")} />
      </label>
      <div className="text-xs font-bold text-muted">{t("pd.invoice.showing", { shown: filteredInvoices.length, total: invoices.length })}</div>
      {filteredInvoices.map((invoice) => {
        const isEditing = editingId === invoice.id;

        return (
          <div key={invoice.id} className="rounded-lg border border-[#d7e1e5] bg-white p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-bold">{invoice.invoiceNo || t("pd.invoice.fallback")}{invoice.clientName ? ` — ${invoice.clientName}` : ""}</div>
                <div className="mt-1 text-sm font-semibold text-muted">
                  {t("pd.invoice.issuedDueLine", { month: invoice.monthCovered, issued: displayDate(invoice.invoiceDate), due: displayDate(invoice.dueDate) })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={invoiceStatusClass(invoice)}>{invoiceStatusLabel(invoice, t)}</span>
                  <span className="status status-not-started">
                    {invoiceAgeLabel(invoice.invoiceDate, invoice.dueDate, invoice.isPaid)}
                  </span>
                  <span className="status status-finished">
                    {t("pd.invoice.issuedDaysAgo", { days: daysSince(invoice.invoiceDate) })}
                  </span>
                  {invoice.isPaid && invoice.paidDate ? (
                    <span className="status status-finished">{t("pd.invoice.paidOn", { date: displayDate(invoice.paidDate) })}</span>
                  ) : null}
                  {invoice.sourceCurrency ? (
                    <span className="status status-not-started" title={t("pd.invoice.origTitle")}>
                      {t("pd.invoice.original", { amount: invoice.sourceAmount != null ? invoice.sourceAmount.toLocaleString() : "", currency: invoice.sourceCurrency })}
                      {invoice.vatRate != null ? t("pd.invoice.vatSuffix", { pct: Math.round(invoice.vatRate * 100) }) : ""}
                    </span>
                  ) : null}
                </div>
                {invoice.notes ? <div className="mt-2 text-sm text-ink">{invoice.notes}</div> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <div className="mr-1 font-bold text-[#777da7]">{money(invoice.amount)}</div>
                {invoice.isPaid ? (
                  <form action={markInvoiceUnpaid}>
                    <input type="hidden" name="id" value={invoice.id} />
                    <input type="hidden" name="projectId" value={invoice.projectId} />
                    <button className="btn btn-small btn-secondary" type="submit">{t("pd.invoice.markUnpaid")}</button>
                  </form>
                ) : (
                  <form action={markInvoicePaid} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={invoice.id} />
                    <input type="hidden" name="projectId" value={invoice.projectId} />
                    <input className="w-32" name="paidDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} aria-label={t("pd.invoice.paidDateAria")} />
                    <button className="btn btn-small btn-save" type="submit">{t("pd.invoice.markPaid")}</button>
                  </form>
                )}
                <button className="btn btn-small btn-edit" type="button" onClick={() => setEditingId(isEditing ? null : invoice.id)}>
                  {isEditing ? t("common.cancel") : t("common.edit")}
                </button>
                <form
                  action={deleteInvoice}
                  onSubmit={(event) => {
                    if (!window.confirm(t("pd.invoice.confirmDelete", { label: invoice.invoiceNo || displayDate(invoice.invoiceDate) }))) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={invoice.id} />
                  <input type="hidden" name="projectId" value={invoice.projectId} />
                  <button className="btn btn-small btn-delete" type="submit">{t("common.delete")}</button>
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
                <label>{t("pd.invoice.invoiceDate")}<input name="invoiceDate" type="date" required defaultValue={dateInputValue(invoice.invoiceDate)} /></label>
                <label>{t("pd.invoice.monthCovered")}<input name="monthCovered" type="month" required defaultValue={invoice.monthCovered} /></label>
                <label>{t("pd.invoice.invoiceNumber")}<input name="invoiceNo" defaultValue={invoice.invoiceNo} placeholder={t("common.optional")} /></label>
                <label>{t("pd.invoice.amountNet")}<input name="amount" type="number" min="0" step="0.01" required defaultValue={invoice.amount} /></label>
                <label>{t("pd.invoice.dueDate")}<input name="dueDate" type="date" required defaultValue={dateInputValue(invoice.dueDate)} /></label>
                <label>{t("pd.invoice.client")}<input name="clientName" defaultValue={invoice.clientName} placeholder={t("pd.invoice.clientPlaceholder")} /></label>
                <label>{t("pd.invoice.originalAmount")}<input name="sourceAmount" type="number" min="0" step="0.01" defaultValue={invoice.sourceAmount ?? ""} placeholder={t("common.optional")} /></label>
                <label>{t("pd.invoice.originalCurrency")}<input name="sourceCurrency" defaultValue={invoice.sourceCurrency} placeholder={t("pd.invoice.originalCurrencyPlaceholder")} /></label>
                <label>{t("pd.invoice.vatRate")}<input name="vatRate" type="number" min="0" max="1" step="0.01" defaultValue={invoice.vatRate ?? ""} placeholder={t("pd.invoice.vatPlaceholder")} /></label>
                <label className="md:col-span-2">
                  {t("pd.invoice.paidStatus")}
                  <span className="flex items-center gap-2 rounded-lg border border-[#d7e1e5] bg-[#f1f3f5] px-3 py-2 text-sm font-bold text-ink">
                    <input className="size-4 w-auto" name="isPaid" type="checkbox" defaultChecked={invoice.isPaid} />
                    {t("pd.invoice.paidCheckbox")}
                  </span>
                </label>
                <label>{t("pd.invoice.paidDate")}<input name="paidDate" type="date" defaultValue={invoice.paidDate ? dateInputValue(invoice.paidDate) : ""} /></label>
                <label className="md:col-span-2">{t("common.notes")}<textarea name="notes" rows={3} defaultValue={invoice.notes} placeholder={t("pd.invoice.notesPlaceholder")} /></label>
                <div className="flex gap-2 md:col-span-2">
                  <button className="btn btn-small btn-secondary" type="button" onClick={() => setEditingId(null)}>{t("common.cancel")}</button>
                  <button className="btn btn-small btn-save" type="submit">{t("pd.invoice.saveInvoice")}</button>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}
      {!filteredInvoices.length ? (
        <div className="rounded-lg border border-dashed border-[#c5cdd6] bg-[#f1f3f5] p-4 text-sm font-bold text-muted">
          {t("pd.invoice.noMatch")}
        </div>
      ) : null}
    </div>
  );
}
