import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { daysSince, daysUntil, decimal, invoiceDueDate, money } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { InvoicesTable } from "./InvoicesTable";

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
  const overdueShareOfOutstanding = unpaidTotal > 0 ? (overdueTotal / unpaidTotal) * 100 : 0;

  const tableRows = rows.map(({ invoice, dueDate, state }) => ({
    id: invoice.id,
    projectId: invoice.projectId,
    projectName: invoice.project.name,
    clientName: invoice.project.clientName,
    invoiceNo: invoice.invoiceNo,
    monthCovered: invoice.monthCovered,
    invoiceDate: invoice.invoiceDate.toISOString(),
    dueDate: dueDate.toISOString(),
    amount: invoice.amount,
    isPaid: invoice.isPaid,
    paidDate: invoice.paidDate ? invoice.paidDate.toISOString() : null,
    stateLabel: state.label,
    stateClassName: state.className,
    stateRank: state.rank,
  }));

  return (
    <>
      <PageTitle eyebrow="Cash collection" title="Invoice tracking">
        <Link href="/api/export/invoices" className="btn btn-secondary">Export invoices</Link>
      </PageTitle>

      {overdueTotal > 0 ? (
        <section className="mb-6 rounded-xl border-l-4 border-lab-burgundy bg-[#fff8fa] p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-lab-burgundy">Collections alert</div>
              <div className="mt-1 font-bold text-ink">
                {money(overdueTotal)} overdue across {overdueRows.length} invoice{overdueRows.length === 1 ? "" : "s"} —{" "}
                {decimal(overdueShareOfOutstanding)}% of everything outstanding is already overdue.
              </div>
            </div>
            <span className="status status-on-hold">Oldest {oldestUnpaid} days unpaid</span>
          </div>
        </section>
      ) : null}

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
            <div className="text-xs font-bold uppercase text-lab-burgundy">Receivables ledger</div>
            <h2 className="text-xl font-bold">All invoices</h2>
          </div>
          <div className="text-sm font-bold text-muted">Click a column to sort</div>
        </div>
        <InvoicesTable rows={tableRows} />
      </section>
    </>
  );
}
