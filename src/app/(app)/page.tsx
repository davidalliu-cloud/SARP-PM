import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { daysSince, money, decimal, statusClass, statusLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { monthKey, projectTotals } from "@/lib/totals";

const projectSections = [
  { title: "Not started", statuses: ["NOT_STARTED"], border: "border-[#687482]", bg: "bg-[#f7f9fb]" },
  { title: "Ongoing and on hold", statuses: ["ACTIVE", "ON_HOLD"], border: "border-[#285f8f]", bg: "bg-white" },
  { title: "Finished", statuses: ["FINISHED"], border: "border-[#5d8068]", bg: "bg-[#f4faf6]" },
];

export default async function DashboardPage() {
  const projects = await prisma.project.findMany({
    include: {
      dailyRecords: { include: { productItems: true, labourItems: true, expenseItems: true } },
      invoices: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = projects.map((project) => ({
    project,
    totals: projectTotals(project.dailyRecords, project.invoices),
  }));

  const activeProjects = projects.filter((project) => project.status === "ACTIVE").length;
  const totalCost = rows.reduce((sum, row) => sum + row.totals.totalCost, 0);
  const totalInvoiced = rows.reduce((sum, row) => sum + row.totals.invoiced, 0);
  const totalOutstanding = projects.reduce((sum, project) => sum + project.invoices.filter((invoice) => !invoice.isPaid).reduce((invoiceSum, invoice) => invoiceSum + invoice.amount, 0), 0);
  const oldestUnpaidDays = Math.max(...projects.flatMap((project) => project.invoices.filter((invoice) => !invoice.isPaid).map((invoice) => daysSince(invoice.invoiceDate))), 0);
  const profit = totalInvoiced - totalCost;
  const margin = totalInvoiced > 0 ? (profit / totalInvoiced) * 100 : 0;
  const maxProjectValue = Math.max(...rows.map((row) => Math.max(row.totals.totalCost, row.totals.invoiced, 1)), 1);

  const monthly = new Map<string, { cost: number; invoiced: number }>();
  projects.forEach((project) => {
    project.dailyRecords.forEach((record) => {
      const key = monthKey(record.date);
      const current = monthly.get(key) ?? { cost: 0, invoiced: 0 };
      current.cost += record.productItems.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0);
      current.cost += record.labourItems.reduce((sum, item) => sum + item.dailyWage, 0);
      current.cost += record.expenseItems.reduce((sum, item) => sum + item.amount, 0);
      monthly.set(key, current);
    });
    project.invoices.forEach((invoice) => {
      const current = monthly.get(invoice.monthCovered) ?? { cost: 0, invoiced: 0 };
      current.invoiced += invoice.amount;
      monthly.set(invoice.monthCovered, current);
    });
  });
  const monthlyRows = Array.from(monthly.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  const maxMonthly = Math.max(...monthlyRows.map(([, row]) => Math.max(row.cost, row.invoiced, 1)), 1);

  return (
    <>
      <PageTitle eyebrow="Control room" title="Profitability dashboard">
        <Link href="/projects/new" className="btn btn-primary">New project</Link>
      </PageTitle>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Active projects" value={activeProjects} tone="green" />
        <StatCard label="Total costs" value={money(totalCost)} />
        <StatCard label="Total invoiced" value={money(totalInvoiced)} tone="blue" />
        <StatCard label="Outstanding" value={money(totalOutstanding)} detail={oldestUnpaidDays ? `Oldest ${oldestUnpaidDays} days` : "No unpaid invoices"} tone={totalOutstanding > 0 ? "maroon" : "green"} />
        <StatCard label="Profit / loss" value={money(profit)} tone={profit >= 0 ? "green" : "maroon"} />
        <StatCard label="Profit margin" value={`${decimal(margin)}%`} tone="maroon" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Projects</h2>
            <Link href="/projects" className="text-sm font-black text-[#285f8f]">View all</Link>
          </div>
          <div className="grid gap-4">
            {projectSections.map((section) => {
              const sectionRows = rows.filter(({ project }) => section.statuses.includes(project.status));
              if (!sectionRows.length) return null;

              return (
                <div key={section.title} className={`overflow-hidden rounded-lg border border-l-4 ${section.border} ${section.bg}`}>
                  <div className="flex items-center justify-between border-b border-[#e8edf2] px-4 py-3">
                    <h3 className="font-black">{section.title}</h3>
                    <span className="text-xs font-black uppercase text-[#687482]">{sectionRows.length} projects</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Products</th>
                          <th>Labour</th>
                          <th>Expenses</th>
                          <th>Total cost</th>
                          <th>Invoiced</th>
                          <th>Outstanding</th>
                          <th>Profit/loss</th>
                          <th>Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionRows.map(({ project, totals }) => {
                          const outstanding = project.invoices.filter((invoice) => !invoice.isPaid).reduce((sum, invoice) => sum + invoice.amount, 0);
                          return (
                            <tr key={project.id}>
                              <td>
                                <Link href={`/projects/${project.id}`} className="font-black text-[#20262d]">{project.name}</Link>
                                <div className="mt-1"><span className={`status ${statusClass(project.status)}`}>{statusLabel(project.status)}</span></div>
                              </td>
                              <td>{money(totals.productCost)}</td>
                              <td>{money(totals.labourCost)}</td>
                              <td>{money(totals.expenseCost)}</td>
                              <td className="font-bold">{money(totals.totalCost)}</td>
                              <td>{money(totals.invoiced)}</td>
                              <td className={outstanding > 0 ? "font-bold text-[#7b2636]" : "font-bold text-[#315a3d]"}>{money(outstanding)}</td>
                              <td className={totals.profit >= 0 ? "font-bold text-[#315a3d]" : "font-bold text-[#7b2636]"}>{money(totals.profit)}</td>
                              <td>{decimal(totals.margin)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="panel p-4">
            <h2 className="mb-4 text-lg font-black">Cost vs invoiced</h2>
            <div className="space-y-4">
              {rows.map(({ project, totals }) => (
                <div key={project.id}>
                  <div className="mb-1 flex justify-between text-sm font-bold"><span>{project.name}</span><span>{money(totals.invoiced - totals.totalCost)}</span></div>
                  <div className="grid gap-1">
                    <div className="h-3 rounded bg-[#e8edf2]"><div className="h-3 rounded bg-[#7b2636]" style={{ width: `${(totals.totalCost / maxProjectValue) * 100}%` }} /></div>
                    <div className="h-3 rounded bg-[#e8edf2]"><div className="h-3 rounded bg-[#285f8f]" style={{ width: `${(totals.invoiced / maxProjectValue) * 100}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="mb-4 text-lg font-black">Monthly costs and invoicing</h2>
            <div className="grid grid-cols-6 items-end gap-3">
              {monthlyRows.map(([month, row]) => (
                <div key={month} className="grid gap-2 text-center">
                  <div className="flex h-32 items-end justify-center gap-1 border-b border-[#d8dee5]">
                    <div className="w-4 rounded-t bg-[#7b2636]" style={{ height: `${Math.max((row.cost / maxMonthly) * 100, 4)}%` }} />
                    <div className="w-4 rounded-t bg-[#285f8f]" style={{ height: `${Math.max((row.invoiced / maxMonthly) * 100, 4)}%` }} />
                  </div>
                  <div className="text-xs font-black text-[#687482]">{month}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="mb-4 text-lg font-black">Profit/loss by project</h2>
            <div className="space-y-3">
              {rows.map(({ project, totals }) => (
                <div key={project.id} className="grid grid-cols-[110px_1fr_90px] items-center gap-3 text-sm">
                  <div className="truncate font-bold">{project.name}</div>
                  <div className="h-3 rounded bg-[#e8edf2]">
                    <div
                      className={`h-3 rounded ${totals.profit >= 0 ? "bg-[#5d8068]" : "bg-[#7b2636]"}`}
                      style={{ width: `${Math.min(Math.abs(totals.margin), 100)}%` }}
                    />
                  </div>
                  <div className="text-right font-black">{money(totals.profit)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
