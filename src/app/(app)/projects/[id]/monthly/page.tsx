import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { decimal, money, monthInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { monthKey, projectTotals, recordExpenseCost, recordLabourCost, recordProductCost, recordTotal } from "@/lib/totals";

export default async function MonthlyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const selected = query.month && query.year ? `${query.year}-${query.month.padStart(2, "0")}` : monthInputValue();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      dailyRecords: {
        include: {
          productItems: { include: { product: true } },
          labourItems: { include: { employee: true } },
          expenseItems: true,
        },
        orderBy: { date: "asc" },
      },
      invoices: { orderBy: { invoiceDate: "asc" } },
    },
  });

  if (!project) notFound();

  const [selectedYear, selectedMonth] = selected.split("-");
  const records = project.dailyRecords.filter((record) => monthKey(record.date) === selected);
  const invoices = project.invoices.filter((invoice) => invoice.monthCovered === selected);
  const totals = projectTotals(records, invoices);

  return (
    <>
      <PageTitle eyebrow="Monthly report" title={project.name}>
        <Link href={`/projects/${project.id}`} className="btn btn-secondary">Back to project</Link>
      </PageTitle>

      <form className="panel mb-5 grid gap-4 p-4 md:grid-cols-[160px_160px_auto] md:items-end">
        <label>
          Month
          <select name="month" defaultValue={selectedMonth}>
            {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </label>
        <label>
          Year
          <input name="year" type="number" min="2020" max="2100" defaultValue={selectedYear} />
        </label>
        <button className="btn btn-primary" type="submit">Load report</button>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <StatCard label="Product cost" value={money(totals.productCost)} />
        <StatCard label="Labour cost" value={money(totals.labourCost)} />
        <StatCard label="Expenses" value={money(totals.expenseCost)} />
        <StatCard label="Total cost" value={money(totals.totalCost)} tone="maroon" />
        <StatCard label="Invoiced" value={money(totals.invoiced)} tone="blue" />
        <StatCard label="Profit/loss" value={money(totals.profit)} tone={totals.profit >= 0 ? "green" : "maroon"} />
        <StatCard label="Margin" value={`${decimal(totals.margin)}%`} />
      </section>

      <section className="panel mt-5 p-4">
        <h2 className="mb-3 text-xl font-black">Daily breakdown for {selected}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Products</th>
                <th>Employees</th>
                <th>Expenses</th>
                <th>Product cost</th>
                <th>Labour cost</th>
                <th>Expense cost</th>
                <th>Total cost</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="font-bold">{record.date.toLocaleDateString()}</td>
                  <td>{record.productItems.map((item) => `${item.product.name}: ${item.quantity} ${item.product.unit}`).join(", ") || "-"}</td>
                  <td>{record.labourItems.map((item) => item.employee?.name || item.employeeName || (item.externalTeamName ? `${item.externalTeamName} (${item.squareMeters || 0} m2)` : "Former employee")).join(", ") || "-"}</td>
                  <td>{record.expenseItems.map((item) => `${item.category}${item.description ? `: ${item.description}` : ""}`).join(", ") || "-"}</td>
                  <td>{money(recordProductCost(record))}</td>
                  <td>{money(recordLabourCost(record))}</td>
                  <td>{money(recordExpenseCost(record))}</td>
                  <td className="font-black">{money(recordTotal(record))}</td>
                  <td>{record.notes || "-"}</td>
                </tr>
              ))}
              {!records.length ? (
                <tr><td colSpan={9} className="py-8 text-center font-bold text-[#687482]">No daily records for this month.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
