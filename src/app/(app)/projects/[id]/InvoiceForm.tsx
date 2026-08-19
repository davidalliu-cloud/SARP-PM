"use client";

import { useTransition } from "react";
import { createInvoice } from "@/app/actions";
import { useModalClose } from "@/components/Modal";
import { addDays, dateInputValue, monthInputValue } from "@/lib/format";

export function InvoiceForm({ projectId, defaultClientName }: { projectId: string; defaultClientName?: string }) {
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
        <label>Invoice date<input name="invoiceDate" type="date" required defaultValue={dateInputValue()} /></label>
        <label>Month covered<input name="monthCovered" type="month" required defaultValue={monthInputValue()} /></label>
        <label>Invoice number<input name="invoiceNo" placeholder="Optional" /></label>
        <label>Amount invoiced<input name="amount" type="number" min="0" step="0.01" required placeholder="4200.00" /></label>
        <label>Due date<input name="dueDate" type="date" required defaultValue={dateInputValue(addDays(new Date(), 30))} /></label>
        <label>Paid date<input name="paidDate" type="date" defaultValue={dateInputValue()} /></label>
        <label>Client<input name="clientName" placeholder={defaultClientName || "Project's default client"} defaultValue={defaultClientName || ""} /></label>
      </div>
      <details className="rounded-lg border border-line bg-[#fafafa] p-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Original currency / VAT (optional — only if the invoice wasn&apos;t issued net EUR)
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label>Original amount (gross)<input name="sourceAmount" type="number" min="0" step="0.01" placeholder="e.g. 719224.80" /></label>
          <label>Original currency<input name="sourceCurrency" placeholder="e.g. ALL, USD" /></label>
          <label>VAT rate applied<input name="vatRate" type="number" min="0" max="1" step="0.01" placeholder="0.20 = 20%" /></label>
        </div>
        <p className="mt-2 text-xs text-muted">
          &quot;Amount invoiced&quot; above must always be the net-of-VAT EUR figure used for profit calculations. These fields just keep an audit trail of the original source amount.
        </p>
      </details>
      <label>
        Paid status
        <span className="flex items-center gap-2 rounded-lg border border-line bg-[#fafafa] px-3 py-2 text-sm font-semibold text-ink">
          <input className="size-4 w-auto" name="isPaid" type="checkbox" />
          Invoice has been paid
        </span>
      </label>
      <label>Notes<textarea name="notes" rows={3} placeholder="Optional invoice notes" /></label>
      <button className="btn btn-primary justify-self-start" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save invoice"}
      </button>
    </form>
  );
}
