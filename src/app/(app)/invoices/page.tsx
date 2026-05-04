import Link from "next/link";
import { markInvoicePaid, markInvoiceUnpaid } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { daysSince, daysUntil, invoiceAgeLabel, invoiceDueDate, money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

function dateInputValue(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function displayDate(value: Date) {
  return value.toLocaleDateString();
}

function invoiceState(invoice: { invoiceDate: Date; dueDate: Date | null; isPaid: boolean }) {
  if (invoice.isPaid) return { label: "Paid", className: "status status-active", rank: 4 };
  const dueIn = daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate));
  if (dueIn < 0) return { label: "Overdue", className: "status status-on-hold", rank: 1 };
  if (dueIn <= 7) return { label: "Due soon", className: "status status-not-started", rank: 2 };
  return { label: "Open", className: "status status-finished", rank: 3 };
}

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: { project: true },
    orderBy: [{ isPaid: "asc" }, { dueDate: "asc" }, { invoiceDate: "desc" }],
  });

  const rows = invoices
    .map((invoice) => ({
      invoice,
      dueDate: invoiceDueDate(invoice.invoiceDate, invoice.dueDate),
      state: invoiceState(invoice),
    }))
    .sort((a, b) => a.state.rank - b.state.rank || a.dueDate.getTime() - b.dueDate.getTime());

  const unpaidRows = rows.filter((row) => !row.invoice.isPaid);
  const overdueRows = unpaidRows.filter((row) => daysUntil(row.dueDate) < 0);
  const dueSoonRows = unpaidRows.filter((row) => {
    const dueIn = daysUntil(row.dueDate);
    return dueIn >= 0 && dueIn <= 7;
  });
  const paidRows = rows.filter((row) => row.invoice.isPaid);
  const unpaidTotal = unpaidRows.reduce((sum, row) => sum + row.invoice.amount, 0);
  const overdueTotal = overdueRows.reduce((sum, row) => sum + row.invoice.amount, 0);
  const dueSoonTotal = dueSoonRows.reduce((sum, row) => sum + row.invoice.amount, 0);
  const paidTotal = paidRows.reduce((sum, row) => sum + row.invoice.amount, 0);
  const oldestUnpaid = Math.max(...unpaidRows.map((row) => daysSince(row.invoice.invoiceDate)), 0);

  return (
    <>
      <PageTitle eyebrow="Cash collection" title="Invoice tracking">
        <Link href="/api/export/invoices" className="btn btn-secondary">Export invoices</Link>
      </PageTitle>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Unpaid total" value={money(unpaidTotal)} detail={oldestUnpaid ? `Oldest issued ${oldestUnpaid} days ago` : "No unpaid invoices"} tone={unpaidTotal > 0 ? "maroon" : "green"} />
        <StatCard label="Overdue" value={money(overdueTotal)} detail={`${overdueRows.length} invoices`} tone={overdueTotal > 0 ? "maroon" : "green"} />
        <StatCard label="Due next 7 days" value={money(dueSoonTotal)} detail={`${dueSoonRows.length} invoices`} tone={dueSoonTotal > 0 ? "blue" : "green"} />
        <StatCard label="Paid invoices" value={money(paidTotal)} detail={`${paidRows.length} paid`} tone="green" />
        <StatCard label="All invoices" value={invoices.length} detail={`${unpaidRows.length} unpaid`} tone="blue" />
      </section>

      <section className="panel mt-6 overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-[#e8eef0] p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#5b193f]">Receivables ledger</div>
            <h2 className="text-xl font-black">All invoices</h2>
          </div>
          <div className="text-sm font-bold text-[#6b7188]">Sorted by payment urgency</div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Project</th>
                <th>Invoice</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Age</th>
                <th>Amount</th>
                <th>Paid date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ invoice, dueDate, state }) => (
                <tr key={invoice.id}>
                  <td><span className={state.className}>{state.label}</span></td>
                  <td>
                    <Link href={`/projects/${invoice.projectId}`} className="font-black text-[#373455]">{invoice.project.name}</Link>
                    {invoice.project.clientName ? <div className="mt-1 text-xs font-bold text-[#6b7188]">{invoice.project.clientName}</div> : null}
                  </td>
                  <td>
                    <div className="font-bold">{invoice.invoiceNo || "No number"}</div>
                    <div className="mt-1 text-xs font-bold text-[#6b7188]">{invoice.monthCovered}</div>
                  </td>
                  <td>{displayDate(invoice.invoiceDate)}</td>
                  <td className={!invoice.isPaid && daysUntil(dueDate) < 0 ? "font-bold text-[#5b193f]" : "font-bold text-[#373455]"}>{displayDate(dueDate)}</td>
                  <td>{invoiceAgeLabel(invoice.invoiceDate, dueDate, invoice.isPaid)}</td>
                  <td className="font-black text-[#777da7]">{money(invoice.amount)}</td>
                  <td>{invoice.paidDate ? displayDate(invoice.paidDate) : "-"}</td>
                  <td>
                    {invoice.isPaid ? (
                      <form action={markInvoiceUnpaid}>
                        <input type="hidden" name="id" value={invoice.id} />
                        <input type="hidden" name="projectId" value={invoice.projectId} />
                        <button className="btn btn-small btn-secondary" type="submit">Mark unpaid</button>
                      </form>
                    ) : (
                      <form action={markInvoicePaid} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={invoice.id} />
                        <input type="hidden" name="projectId" value={invoice.projectId} />
                        <input className="w-32" name="paidDate" type="date" defaultValue={dateInputValue()} aria-label="Paid date" />
                        <button className="btn btn-small btn-save" type="submit">Mark paid</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!rows.length ? (
          <div className="p-5 text-sm font-bold text-[#6b7188]">No invoices have been created yet.</div>
        ) : null}
      </section>
    </>
  );
}
