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
