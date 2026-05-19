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

type ActionItem = {
  id: string;
  title: string;
  detail: string;
  amount?: string;
  href: string;
  tone: "maroon" | "amber" | "blue";
  rank: number;
};

const periodOptions = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
  { value: "all", label: "All time" },
];

function percent(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function getPeriodRange(period: string) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (period === "last-month") {
    return {
      label: "Last month",
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: thisMonthStart,
    };
  }

  if (period === "this-year") {
    return {
      label: "This year",
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear() + 1, 0, 1),
    };
  }

  if (period === "all") {
    return { label: "All time", start: null, end: null };
  }

  return { label: "This month", start: thisMonthStart, end: nextMonthStart };
}

function isInPeriod(date: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return true;
  return date >= start && date < end;
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

function ProfitLossValue({ value }: { value: number }) {
  const isProfit = value >= 0;
  return (
    <span className={isProfit ? "font-black text-[#285d59]" : "font-black text-[#5b193f]"}>
      {isProfit ? "Profit " : "Loss "}
      {money(Math.abs(value))}
    </span>
  );
}

function ProfitLossWithMargin({ value, margin }: { value: number; margin: number }) {
  const isProfit = value >= 0;
  return (
    <span className={isProfit ? "font-black text-[#285d59]" : "font-black text-[#5b193f]"}>
      {isProfit ? "Profit " : "Loss "}
      {money(Math.abs(value))}
      <span className="block text-base font-black">
        {isProfit ? "+" : "-"}
        {decimal(Math.abs(margin))}%
      </span>
    </span>
  );
}

function ActionRequiredCard({ item }: { item: ActionItem }) {
  const toneClasses = {
    maroon: "border-[#5b193f] bg-[#fff8fa] text-[#5b193f]",
    amber: "border-[#c28a2c] bg-[#fffaf0] text-[#7a4b00]",
    blue: "border-[#777da7] bg-[#f7f8fc] text-[#373455]",
  };

  return (
    <Link href={item.href} className={`block rounded-lg border-l-4 p-3 transition hover:-translate-y-0.5 hover:shadow-md ${toneClasses[item.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black">{item.title}</div>
          <div className="mt-1 text-xs font-bold text-[#6b7188]">{item.detail}</div>
        </div>
        {item.amount ? <div className="shrink-0 text-sm font-black">{item.amount}</div> : null}
      </div>
    </Link>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const selectedPeriod = periodOptions.some((option) => option.value === params.period) ? params.period || "this-month" : "this-month";
  const periodRange = getPeriodRange(selectedPeriod);

  const projects = await prisma.project.findMany({
    include: {
      dailyRecords: { include: { productItems: { include: { product: true } }, labourItems: true, expenseItems: true } },
      invoices: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const allRows = projects.map((project) => ({
    project,
    totals: projectTotals(project.dailyRecords, project.invoices),
  }));
  const rows = projects.map((project) => {
    const periodDailyRecords = project.dailyRecords.filter((record) => isInPeriod(record.date, periodRange.start, periodRange.end));
    const periodInvoices = project.invoices.filter((invoice) => isInPeriod(invoice.invoiceDate, periodRange.start, periodRange.end));
    return {
      project,
      dailyRecords: periodDailyRecords,
      invoices: periodInvoices,
      totals: projectTotals(periodDailyRecords, periodInvoices),
    };
  });

  const activeProjects = projects.filter((project) => project.status === "ACTIVE").length;
  const totalCost = rows.reduce((sum, row) => sum + row.totals.totalCost, 0);
  const totalBudget = projects.reduce((sum, project) => sum + project.budgetAmount, 0);
  const overBudgetProjects = allRows.filter((row) => budgetTotals(row.project.budgetAmount, row.totals.totalCost).isOverBudget).length;
  const totalInvoiced = rows.reduce((sum, row) => sum + row.totals.invoiced, 0);
  const totalOutstanding = projects.reduce((sum, project) => sum + project.invoices.filter((invoice) => !invoice.isPaid).reduce((invoiceSum, invoice) => invoiceSum + invoice.amount, 0), 0);
  const unpaidInvoices = projects.flatMap((project) => project.invoices.filter((invoice) => !invoice.isPaid));
  const oldestUnpaidDays = Math.max(...unpaidInvoices.map((invoice) => daysSince(invoice.invoiceDate)), 0);
  const overdueInvoices = unpaidInvoices.filter((invoice) => daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate)) < 0);
  const overdueTotal = overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const profit = totalInvoiced - totalCost;
  const margin = totalInvoiced > 0 ? (profit / totalInvoiced) * 100 : 0;
  const actionItems: ActionItem[] = [
    ...projects.flatMap((project) =>
      project.invoices
        .filter((invoice) => !invoice.isPaid && daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate)) < 0)
        .map((invoice) => ({
          id: `invoice-${invoice.id}`,
          title: `${project.name}: invoice overdue`,
          detail: `${invoice.invoiceNo ? `Invoice ${invoice.invoiceNo}` : "Invoice"} is ${Math.abs(daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate)))} days overdue`,
          amount: money(invoice.amount),
          href: `/projects/${project.id}`,
          tone: "maroon" as const,
          rank: 1,
        }))
    ),
    ...allRows
      .filter((row) => budgetTotals(row.project.budgetAmount, row.totals.totalCost).isOverBudget)
      .map((row) => ({
        id: `budget-${row.project.id}`,
        title: `${row.project.name}: over budget`,
        detail: `Budget exceeded by ${money(Math.abs(budgetTotals(row.project.budgetAmount, row.totals.totalCost).budgetRemaining))}`,
        amount: `${decimal(budgetTotals(row.project.budgetAmount, row.totals.totalCost).budgetUsed)}% used`,
        href: `/projects/${row.project.id}`,
        tone: "maroon" as const,
        rank: 2,
      })),
    ...allRows
      .filter((row) => row.totals.invoiced > 0 && row.totals.margin < 10 && row.project.status !== "FINISHED")
      .map((row) => ({
        id: `margin-${row.project.id}`,
        title: `${row.project.name}: low margin`,
        detail: row.totals.profit >= 0 ? `Current margin is ${decimal(row.totals.margin)}%` : `Current loss is ${money(Math.abs(row.totals.profit))}`,
        amount: `${decimal(row.totals.margin)}%`,
        href: `/projects/${row.project.id}`,
        tone: row.totals.profit >= 0 ? ("amber" as const) : ("maroon" as const),
        rank: row.totals.profit >= 0 ? 3 : 2,
      })),
    ...allRows
      .filter((row) => row.project.status === "ACTIVE" && row.totals.totalCost > 0 && row.totals.invoiced === 0)
      .map((row) => ({
        id: `uninvoiced-${row.project.id}`,
        title: `${row.project.name}: costs not invoiced`,
        detail: "Project has recorded costs but no invoice yet",
        amount: money(row.totals.totalCost),
        href: `/projects/${row.project.id}`,
        tone: "amber" as const,
        rank: 4,
      })),
    ...allRows
      .filter((row) => ["ACTIVE", "ON_HOLD"].includes(row.project.status) && row.project.budgetAmount <= 0)
      .map((row) => ({
        id: `missing-budget-${row.project.id}`,
        title: `${row.project.name}: budget missing`,
        detail: "Add a project budget to track overruns properly",
        href: `/projects/${row.project.id}`,
        tone: "blue" as const,
        rank: 5,
      })),
  ].sort((a, b) => a.rank - b.rank);
  const visibleActionItems = actionItems.slice(0, 8);
  const maxProjectValue = Math.max(...rows.map((row) => Math.max(row.totals.totalCost, row.totals.invoiced, 1)), 1);
  const totalProductCost = rows.reduce((sum, row) => sum + row.totals.productCost, 0);
  const totalLabourCost = rows.reduce((sum, row) => sum + row.totals.labourCost, 0);
  const totalExpenseCost = rows.reduce((sum, row) => sum + row.totals.expenseCost, 0);
  const totalCompletedArea = rows.reduce((sum, row) => sum + row.dailyRecords.reduce((recordSum, record) => recordSum + record.completedAreaM2, 0), 0);
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
  rows.forEach(({ dailyRecords, invoices }) => {
    dailyRecords.forEach((record) => {
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
    invoices.forEach((invoice) => {
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
      const completedArea = row.dailyRecords.reduce((sum, record) => sum + record.completedAreaM2, 0);
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

      <section className="panel mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#5b193f]">Dashboard period</div>
            <h2 className="mt-1 text-lg font-black text-[#373455]">{periodRange.label}</h2>
            <p className="mt-1 text-sm font-semibold text-[#6b7188]">
              Cost, invoicing, profit, and analytics are filtered by this period. Open invoice warnings stay visible at all times.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((option) => (
              <Link
                key={option.value}
                href={`/?period=${option.value}`}
                className={`btn btn-small ${selectedPeriod === option.value ? "btn-primary" : "btn-secondary"}`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <StatCard label="Active projects" value={activeProjects} tone="green" />
        <StatCard label="Total budget" value={money(totalBudget)} detail={overBudgetProjects ? `${overBudgetProjects} over budget` : "No overruns"} tone={overBudgetProjects ? "maroon" : "blue"} />
        <StatCard label="Total costs" value={money(totalCost)} />
        <StatCard label="Total invoiced" value={money(totalInvoiced)} tone="blue" />
        <StatCard label="Outstanding" value={money(totalOutstanding)} detail={oldestUnpaidDays ? `Oldest issued ${oldestUnpaidDays} days ago` : "No unpaid invoices"} tone={totalOutstanding > 0 ? "maroon" : "green"} />
        <StatCard label="Overdue invoices" value={money(overdueTotal)} detail={`${overdueInvoices.length} overdue`} tone={overdueTotal > 0 ? "maroon" : "green"} />
        <StatCard label={profit >= 0 ? "Profit" : "Loss"} value={<ProfitLossWithMargin value={profit} margin={margin} />} detail={profit >= 0 ? "Company result is positive" : "Company result is negative"} tone={profit >= 0 ? "green" : "maroon"} />
      </section>

      <section className="panel mt-6 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Action required</h2>
            <p className="mt-1 text-sm font-semibold text-[#6b7188]">Items that need attention first.</p>
          </div>
          {actionItems.length > visibleActionItems.length ? (
            <span className="status status-risk">{actionItems.length - visibleActionItems.length} more</span>
          ) : null}
        </div>
        {visibleActionItems.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleActionItems.map((item) => <ActionRequiredCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#c5cdd6] bg-[#f7fbfa] p-4 text-sm font-bold text-[#285d59]">
            No urgent issues right now. Projects, invoices, and budgets are not showing immediate pressure.
          </div>
        )}
      </section>

      <details className="panel mt-6 p-4">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Detailed analytics</h2>
              <p className="mt-1 text-sm font-semibold text-[#6b7188]">Open when you want cost breakdowns, product usage, labour split, and chart views.</p>
            </div>
            <span className="btn btn-secondary btn-small">Show analytics</span>
          </div>
        </summary>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr] 2xl:grid-cols-[0.9fr_1.1fr_1fr]">
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

          {projectM2Rows.length ? (
            <div className="panel p-4 xl:col-span-2 2xl:col-span-3">
              <h2 className="mb-4 text-lg font-black">Cost per m2 by project</h2>
              <div className="mb-4">
                <StatCard label="Average cost / m2" value={totalCompletedArea > 0 ? money(totalCost / totalCompletedArea) : "-"} detail={`${decimal(totalCompletedArea, 1)} m2 completed`} tone="blue" />
              </div>
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
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="panel p-4">
            <h2 className="mb-4 text-lg font-black">Cost vs invoiced</h2>
            <div className="space-y-4">
              {rows.map(({ project, totals }) => (
                <div key={project.id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm font-bold"><span className="truncate">{project.name}</span><ProfitLossValue value={totals.invoiced - totals.totalCost} /></div>
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
                  <div className="text-right"><ProfitLossValue value={totals.profit} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </details>

      <section className="mt-6">
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
                          <th>Profit / loss</th>
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
                              <td><ProfitLossValue value={totals.profit} /></td>
                              <td className={totals.margin >= 0 ? "font-bold text-[#285d59]" : "font-bold text-[#5b193f]"}>{decimal(totals.margin)}%</td>
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
      </section>
    </>
  );
}
