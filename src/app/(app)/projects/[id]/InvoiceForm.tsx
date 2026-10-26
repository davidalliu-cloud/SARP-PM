"use client";

import { useTransition } from "react";
import { createInvoice } from "@/app/actions";
import { useT } from "@/components/LanguageProvider";
import { useModalClose } from "@/components/Modal";
import { addDays, dateInputValue, monthInputValue } from "@/lib/format";

export function InvoiceForm({ projectId, defaultClientName }: { projectId: string; defaultClientName?: string }) {
  const t = useT();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await createInvoice(formData);
          close();
        })
      }
      className="grid gap-4"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label>{t("pd.invoice.invoiceDate")}<input name="invoiceDate" type="date" required defaultValue={dateInputValue()} /></label>
        <label>{t("pd.invoice.monthCovered")}<input name="monthCovered" type="month" required defaultValue={monthInputValue()} /></label>
        <label>{t("pd.invoice.invoiceNumber")}<input name="invoiceNo" placeholder={t("common.optional")} /></label>
        <label>{t("pd.invoiceForm.amountInvoiced")}<input name="amount" type="number" min="0" step="0.01" required placeholder="4200.00" /></label>
        <label>{t("pd.invoice.dueDate")}<input name="dueDate" type="date" required defaultValue={dateInputValue(addDays(new Date(), 30))} /></label>
        <label>{t("pd.invoice.paidDate")}<input name="paidDate" type="date" defaultValue={dateInputValue()} /></label>
        <label>{t("pd.invoice.client")}<input name="clientName" placeholder={defaultClientName || t("pd.invoice.clientPlaceholder")} defaultValue={defaultClientName || ""} /></label>
      </div>
      <details className="rounded-lg border border-line bg-[#fafafa] p-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          {t("pd.invoiceForm.summary")}
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label>{t("pd.invoice.originalAmount")}<input name="sourceAmount" type="number" min="0" step="0.01" placeholder="e.g. 719224.80" /></label>
          <label>{t("pd.invoice.originalCurrency")}<input name="sourceCurrency" placeholder={t("pd.invoiceForm.originalCurrencyPlaceholder")} /></label>
          <label>{t("pd.invoice.vatRate")}<input name="vatRate" type="number" min="0" max="1" step="0.01" placeholder={t("pd.invoice.vatPlaceholder")} /></label>
        </div>
        <p className="mt-2 text-xs text-muted">
          {t("pd.invoiceForm.auditNote")}
        </p>
      </details>
      <label>
        {t("pd.invoice.paidStatus")}
        <span className="flex items-center gap-2 rounded-lg border border-line bg-[#fafafa] px-3 py-2 text-sm font-semibold text-ink">
          <input className="size-4 w-auto" name="isPaid" type="checkbox" />
          {t("pd.invoice.paidCheckbox")}
        </span>
      </label>
      <label>{t("common.notes")}<textarea name="notes" rows={3} placeholder={t("pd.invoice.notesPlaceholder")} /></label>
      <button className="btn btn-primary justify-self-start" type="submit" disabled={pending}>
        {pending ? t("pd.invoiceForm.saving") : t("pd.invoice.saveInvoice")}
      </button>
    </form>
  );
}
