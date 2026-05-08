import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { daysSince, daysUntil, invoiceDueDate, money, decimal, statusClass, statusLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { budgetTotals, monthKey, projectTotals } from "@/lib/totals";

const projectSections = [
  { title: "Not started", statuses: ["NOT_STARTED"], border: "border-[#6b7188]", bg: "bg-[#f3f7f3]" },
  { title: "Ongoing and on hold", statuses: ["ACTIVE", "ON_HOLD"], border: "border-[#777da7]", bg: "bg-white" },
  { title: "Finished", statuses: ["FINISHED"], border: "border-[#bdc8d0]", bg: "bg-[#f7fbfa]" },
];

function percent(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function BarRow({
  label,
  value,
  total,
  detail,
  color = "bg-[#777da7]",
}: {
  label: string;
  value: number;
  total: number;
  detail: string;
  color?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-bold text-[#373455]">{label}</span>
        <span className="shrink-0 font-black text-[#373455]">{detail}</span>
      </div>
      <div className="h-3 overflow-hidden rounded bg-[#e8eef0]">
        <div className={`h-full rounded ${color}`} style={{ width: `${Math.max(percent(value, total), value > 0 ? 3 : 0)}%` }} />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const projects = await prisma.project.findMany({
    include: {
      dailyRecords: { include: { productItems: { include: { product: true } }, labourItems: true, expenseItems: true } },
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
  const totalBudget = projects.reduce((sum, project) => sum + project.budgetAmount, 0);
  const overBudgetProjects = rows.filter((row) => budgetTotals(row.project.budgetAmount, row.totals.totalCost).isOverBudget).length;
  const totalInvoiced = rows.reduce((sum, row) => sum + row.totals.invoiced, 0);
  const totalOutstanding = projects.reduce((sum, project) => sum + project.invoices.filter((invoice) => !invoice.isPaid).reduce((invoiceSum, invoice) => invoiceSum + invoice.amount, 0), 0);
  const unpaidInvoices = projects.flatMap((project) => project.invoices.filter((invoice) => !invoice.isPaid));
  const oldestUnpaidDays = Math.max(...unpaidInvoices.map((invoice) => daysSince(invoice.invoiceDate)), 0);
  const overdueInvoices = unpaidInvoices.filter((invoice) => daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate)) < 0);
  const overdueTotal = overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const profit = totalInvoiced - totalCost;
  const margin = totalInvoiced > 0 ? (profit / totalInvoiced) * 100 : 0;
  const maxProjectValue = Math.max(...rows.map((row) => Math.max(row.totals.totalCost, row.totals.invoiced, 1)), 1);
  const totalProductCost = rows.reduce((sum, row) => sum + row.totals.productCost, 0);
  const totalLabourCost = rows.reduce((sum, row) => sum + row.totals.labourCost, 0);
  const totalExpenseCost = rows.reduce((sum, row) => sum + row.totals.expenseCost, 0);
  const totalCompletedArea = projects.reduce((sum, project) => sum + project.dailyRecords.reduce((recordSum, record) => recordSum + record.completedAreaM2, 0), 0);
  const costBreakdown = [
    { label: "Products", value: totalProductCost, color: "bg-[#5b193f]" },
    { label: "Labour", value: totalLabourCost, color: "bg-[#777da7]" },
    { label: "Expenses", value: totalExpenseCost, color: "bg-[#285d59]" },
  ];
  const materialUsage = new Map<string, { name: string; unit: string; quantity: number; cost: number }>();
  const expenseBreakdown = new Map<string, number>();
  let internalLabourCost = 0;
  let externalLabourCost = 0;

  const monthly = new Map<string, { cost: number; invoiced: number }>();
  projects.forEach((project) => {
    project.dailyRecords.forEach((record) => {
      const key = monthKey(record.date);
      const current = monthly.get(key) ?? { cost: 0, invoiced: 0 };
      current.cost += record.productItems.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0);
      current.cost += record.labourItems.reduce((sum, item) => sum + item.dailyWage, 0);
      current.cost += record.expenseItems.reduce((sum, item) => sum + item.amount, 0);
      monthly.set(key, current);

      record.productItems.forEach((item) => {
        const currentMaterial = materialUsage.get(item.productId) ?? { name: item.product.name, unit: item.product.unit, quantity: 0, cost: 0 };
        currentMaterial.quantity += item.quantity;
        currentMaterial.cost += item.quantity * item.costPerUnit;
        materialUsage.set(item.productId, currentMaterial);
      });
      record.labourItems.forEach((item) => {
        if (item.employeeId) internalLabourCost += item.dailyWage;
        else externalLabourCost += item.dailyWage;
      });
      record.expenseItems.forEach((item) => {
        expenseBreakdown.set(item.category, (expenseBreakdown.get(item.category) ?? 0) + item.amount);
      });
    });
    project.invoices.forEach((invoice) => {
      const current = monthly.get(invoice.monthCovered) ?? { cost: 0, invoiced: 0 };
      current.invoiced += invoice.amount;
      monthly.set(invoice.monthCovered, current);
    });
  });
  const monthlyRows = Array.from(monthly.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  const maxMonthly = Math.max(...monthlyRows.map(([, row]) => Math.max(row.cost, row.invoiced, 1)), 1);
  const topMaterials = Array.from(materialUsage.values()).sort((a, b) => b.cost - a.cost).slice(0, 6);
  const maxMaterialCost = Math.max(...topMaterials.map((item) => item.cost), 1);
  const expenseRows = Array.from(expenseBreakdown.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  const maxExpenseCost = Math.max(...expenseRows.map((item) => item.value), 1);
  const mostExpensiveProjects = [...rows].sort((a, b) => b.totals.totalCost - a.totals.totalCost).slice(0, 5);
  const projectM2Rows = rows
    .map((row) => {
      const completedArea = row.project.dailyRecords.reduce((sum, record) => sum + record.completedAreaM2, 0);
      return {
        project: row.project,
        totals: row.totals,
        completedArea,
        totalCostPerM2: completedArea > 0 ? row.totals.totalCost / completedArea : 0,
        profitPerM2: completedArea > 0 ? row.totals.profit / completedArea : 0,
      };
    })
    .filter((row) => row.completedArea > 0)
    .sort((a, b) => b.totalCostPerM2 - a.totalCostPerM2)
    .slice(0, 5);
  const maxProjectCostPerM2 = Math.max(...projectM2Rows.map((row) => row.totalCostPerM2), 1);

  return (
    <>
      <PageTitle eyebrow="Control room" title="Profitability dashboard">
        <Link href="/projects/new" className="btn btn-primary">New project</Link>
      </PageTitle>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <StatCard label="Active projects" value={activeProjects} tone="green" />
        <StatCard label="Total budget" value={money(totalBudget)} detail={overBudgetProjects ? `${overBudgetProjects} over budget` : "No overruns"} tone={overBudgetProjects ? "maroon" : "blue"} />
        <StatCard label="Total costs" value={money(totalCost)} />
        <StatCard label="Average cost / m2" value={totalCompletedArea > 0 ? money(totalCost / totalCompletedArea) : "-"} detail={totalCompletedArea > 0 ? `${decimal(totalCompletedArea, 1)} m2 completed` : "Enter daily completed m2"} tone={totalCompletedArea > 0 ? "blue" : "default"} />
        <StatCard label="Total invoiced" value={money(totalInvoiced)} tone="blue" />
        <StatCard label="Outstanding" value={money(totalOutstanding)} detail={oldestUnpaidDays ? `Oldest issued ${oldestUnpaidDays} days ago` : "No unpaid invoices"} tone={totalOutstanding > 0 ? "maroon" : "green"} />
        <StatCard label="Overdue invoices" value={money(overdueTotal)} detail={`${overdueInvoices.length} overdue`} tone={overdueTotal > 0 ? "maroon" : "green"} />
        <StatCard label="Profit / loss" value={money(profit)} tone={profit >= 0 ? "green" : "maroon"} />
        <StatCard label="Profit margin" value={`${decimal(margin)}%`} tone="maroon" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr] 2xl:grid-cols-[0.9fr_1.1fr_1fr]">
        <div className="panel p-4">
          <h2 className="mb-4 text-lg font-black">Cost breakdown</h2>
          <div className="mb-4 flex h-6 overflow-hidden rounded bg-[#e8eef0]">
            {costBreakdown.map((item) => (
              <div key={item.label} className={item.color} style={{ width: `${percent(item.value, totalCost)}%` }} />
            ))}
          </div>
          <div className="grid gap-3">
            {costBreakdown.map((item) => (
              <BarRow key={item.label} label={item.label} value={item.value} total={totalCost} detail={`${money(item.value)} / ${decimal(percent(item.value, totalCost))}%`} color={item.color} />
            ))}
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="mb-4 text-lg font-black">Most material used</h2>
          <div className="grid gap-3">
            {topMaterials.map((item) => (
              <BarRow
                key={`${item.name}-${item.unit}`}
                label={item.name}
                value={item.cost}
                total={maxMaterialCost}
                detail={`${decimal(item.quantity, 2)} ${item.unit} / ${money(item.cost)}`}
                color="bg-[#5b193f]"
              />
            ))}
            {!topMaterials.length ? <div className="rounded-lg border border-dashed border-[#c5cdd6] p-4 text-sm font-bold text-[#6b7188]">No product usage recorded yet.</div> : null}
          </div>
        </div>

        <div className="panel p-4 xl:col-span-2 2xl:col-span-1">
          <h2 className="mb-4 text-lg font-black">Labour split</h2>
          <div className="mb-4 flex h-6 overflow-hidden rounded bg-[#e8eef0]">
            <div className="bg-[#777da7]" style={{ width: `${percent(internalLabourCost, totalLabourCost)}%` }} />
            <div className="bg-[#285d59]" style={{ width: `${percent(externalLabourCost, totalLabourCost)}%` }} />
          </div>
          <div className="grid gap-3">
            <BarRow label="Employees" value={internalLabourCost} total={totalLabourCost} detail={`${money(internalLabourCost)} / ${decimal(percent(internalLabourCost, totalLabourCost))}%`} color="bg-[#777da7]" />
            <BarRow label="External m2 teams" value={externalLabourCost} total={totalLabourCost} detail={`${money(externalLabourCost)} / ${decimal(percent(externalLabourCost, totalLabourCost))}%`} color="bg-[#285d59]" />
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="mb-4 text-lg font-black">Expense categories</h2>
          <div className="grid gap-3">
            {expenseRows.map((item) => (
              <BarRow key={item.label} label={item.label} value={item.value} total={maxExpenseCost} detail={money(item.value)} color="bg-[#285d59]" />
            ))}
            {!expenseRows.length ? <div className="rounded-lg border border-dashed border-[#c5cdd6] p-4 text-sm font-bold text-[#6b7188]">No extra expenses recorded yet.</div> : null}
          </div>
        </div>

        <div className="panel p-4 xl:col-span-1 2xl:col-span-2">
          <h2 className="mb-4 text-lg font-black">Highest cost projects</h2>
          <div className="grid gap-3">
            {mostExpensiveProjects.map(({ project, totals }) => (
              <BarRow key={project.id} label={project.name} value={totals.totalCost} total={Math.max(...mostExpensiveProjects.map((row) => row.totals.totalCost), 1)} detail={money(totals.totalCost)} color={totals.profit >= 0 ? "bg-[#777da7]" : "bg-[#5b193f]"} />
            ))}
            {!mostExpensiveProjects.length ? <div className="rounded-lg border border-dashed border-[#c5cdd6] p-4 text-sm font-bold text-[#6b7188]">No project costs recorded yet.</div> : null}
          </div>
        </div>

        <div className="panel p-4 xl:col-span-2 2xl:col-span-3">
          <h2 className="mb-4 text-lg font-black">Cost per m2 by project</h2>
          <div className="grid gap-3">
            {projectM2Rows.map((row) => (
              <BarRow
                key={row.project.id}
                label={row.project.name}
                value={row.totalCostPerM2}
                total={maxProjectCostPerM2}
                detail={`${money(row.totalCostPerM2)} cost / m2, ${money(row.profitPerM2)} profit / m2`}
                color={row.profitPerM2 >= 0 ? "bg-[#777da7]" : "bg-[#5b193f]"}
              />
            ))}
            {!projectM2Rows.length ? <div className="rounded-lg border border-dashed border-[#c5cdd6] p-4 text-sm font-bold text-[#6b7188]">Add completed m2 to daily records to compare project rates.</div> : null}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Projects</h2>
            <Link href="/projects" className="text-sm font-black text-[#777da7]">View all</Link>
          </div>
          <div className="grid gap-4">
            {projectSections.map((section) => {
              const sectionRows = rows.filter(({ project }) => section.statuses.includes(project.status));
              if (!sectionRows.length) return null;

              return (
                <div key={section.title} className={`overflow-hidden rounded-lg border border-l-4 ${section.border} ${section.bg}`}>
                  <div className="flex items-center justify-between border-b border-[#e8eef0] px-4 py-3">
                    <h3 className="font-black">{section.title}</h3>
                    <span className="text-xs font-black uppercase text-[#6b7188]">{sectionRows.length} projects</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Products</th>
                          <th>Labour</th>
                          <th>Expenses</th>
                          <th>Budget</th>
                          <th>Total cost</th>
                          <th>Budget left</th>
                          <th>Invoiced</th>
                          <th>Outstanding</th>
                          <th>Profit/loss</th>
                          <th>Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionRows.map(({ project, totals }) => {
                          const outstanding = project.invoices.filter((invoice) => !invoice.isPaid).reduce((sum, invoice) => sum + invoice.amount, 0);
                          const budget = budgetTotals(project.budgetAmount, totals.totalCost);
                          return (
                            <tr key={project.id}>
                              <td>
                                <Link href={`/projects/${project.id}`} className="font-black text-[#373455]">{project.name}</Link>
                                <div className="mt-1"><span className={`status ${statusClass(project.status)}`}>{statusLabel(project.status)}</span></div>
                              </td>
                              <td>{money(totals.productCost)}</td>
                              <td>{money(totals.labourCost)}</td>
                              <td>{money(totals.expenseCost)}</td>
                              <td>{project.budgetAmount > 0 ? money(project.budgetAmount) : "-"}</td>
                              <td className="font-bold">{money(totals.totalCost)}</td>
                              <td className={budget.isOverBudget ? "font-bold text-[#5b193f]" : "font-bold text-[#285d59]"}>
                                {project.budgetAmount > 0 ? money(budget.budgetRemaining) : "-"}
                              </td>
                              <td>{money(totals.invoiced)}</td>
                              <td className={outstanding > 0 ? "font-bold text-[#5b193f]" : "font-bold text-[#285d59]"}>{money(outstanding)}</td>
                              <td className={totals.profit >= 0 ? "font-bold text-[#285d59]" : "font-bold text-[#5b193f]"}>{money(totals.profit)}</td>
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
                    <div className="h-3 rounded bg-[#e8eef0]"><div className="h-3 rounded bg-[#5b193f]" style={{ width: `${(totals.totalCost / maxProjectValue) * 100}%` }} /></div>
                    <div className="h-3 rounded bg-[#e8eef0]"><div className="h-3 rounded bg-[#777da7]" style={{ width: `${(totals.invoiced / maxProjectValue) * 100}%` }} /></div>
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
                  <div className="flex h-32 items-end justify-center gap-1 border-b border-[#d7e1e5]">
                    <div className="w-4 rounded-t bg-[#5b193f]" style={{ height: `${Math.max((row.cost / maxMonthly) * 100, 4)}%` }} />
                    <div className="w-4 rounded-t bg-[#777da7]" style={{ height: `${Math.max((row.invoiced / maxMonthly) * 100, 4)}%` }} />
                  </div>
                  <div className="text-xs font-black text-[#6b7188]">{month}</div>
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
                  <div className="h-3 rounded bg-[#e8eef0]">
                    <div
                      className={`h-3 rounded ${totals.profit >= 0 ? "bg-[#777da7]" : "bg-[#5b193f]"}`}
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
