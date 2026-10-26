import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { daysSince, daysUntil, invoiceDueDate, money, decimal, statusClass } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { budgetTotals, monthKey, projectAttention, projectTotals, targetMargin } from "@/lib/totals";
import { getT } from "@/lib/i18n-server";
import type { TFunction } from "@/lib/i18n";

type ActionItem = {
  id: string;
  title: string;
  detail: string;
  amount?: string;
  href: string;
  tone: "maroon" | "amber" | "blue";
  rank: number;
};

type ProjectDashboardRow = {
  project: {
    id: string;
    name: string;
    clientName: string | null;
    status: string;
    budgetAmount: number;
    estimatedContractValue: number;
    invoices: { amount: number; isPaid: boolean; invoiceDate: Date; dueDate: Date | null }[];
  };
  totals: ReturnType<typeof projectTotals>;
};

const periodOptions = [
  { value: "this-month", labelKey: "dashboard.periodThisMonth" },
  { value: "last-month", labelKey: "dashboard.periodLastMonth" },
  { value: "this-year", labelKey: "dashboard.periodThisYear" },
  { value: "all", labelKey: "dashboard.periodAllTime" },
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
      labelKey: "dashboard.periodLastMonth",
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: thisMonthStart,
    };
  }

  if (period === "this-year") {
    return {
      labelKey: "dashboard.periodThisYear",
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear() + 1, 0, 1),
    };
  }

  if (period === "all") {
    return { labelKey: "dashboard.periodAllTime", start: null, end: null };
  }

  return { labelKey: "dashboard.periodThisMonth", start: thisMonthStart, end: nextMonthStart };
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
        <span className="truncate font-bold text-ink">{label}</span>
        <span className="shrink-0 font-bold text-ink">{detail}</span>
      </div>
      <div className="h-3 overflow-hidden rounded bg-[#e8eef0]">
        <div className={`h-full rounded ${color}`} style={{ width: `${Math.max(percent(value, total), value > 0 ? 3 : 0)}%` }} />
      </div>
    </div>
  );
}

function ProfitLossValue({ value, invoiced, t }: { value: number; invoiced?: number; t: TFunction }) {
  // With no invoice raised yet, a negative "profit" is unbilled cost, not a real
  // loss — say so instead of alarming with a red "Loss" figure.
  if (invoiced === 0 && value < 0) {
    return <span className="font-bold text-muted">{t("dashboard.notYetInvoiced", { cost: money(Math.abs(value)) })}</span>;
  }
  const isProfit = value >= 0;
  return (
    <span className={isProfit ? "font-bold text-[#285d59]" : "font-bold text-lab-burgundy"}>
      {isProfit ? `${t("dashboard.profit")} ` : `${t("dashboard.loss")} `}
      {money(Math.abs(value))}
    </span>
  );
}

function ProfitLossWithMargin({ value, margin, t }: { value: number; margin: number; t: TFunction }) {
  const isProfit = value >= 0;
  return (
    <span className={isProfit ? "font-bold text-[#285d59]" : "font-bold text-lab-burgundy"}>
      {isProfit ? `${t("dashboard.profit")} ` : `${t("dashboard.loss")} `}
      {money(Math.abs(value))}
      <span className="block text-base font-bold">
        {isProfit ? "+" : "-"}
        {decimal(Math.abs(margin))}%
      </span>
    </span>
  );
}

function ActionRequiredCard({ item }: { item: ActionItem }) {
  const toneClasses = {
    maroon: "border-lab-burgundy bg-[#fff8fa] text-lab-burgundy",
    amber: "border-[#c28a2c] bg-[#fffaf0] text-[#7a4b00]",
    blue: "border-[#777da7] bg-[#f7f8fc] text-ink",
  };

  return (
    <Link href={item.href} className={`block rounded-lg border-l-4 p-3 transition hover:-translate-y-0.5 hover:shadow-md ${toneClasses[item.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{item.title}</div>
          <div className="mt-1 text-xs font-bold text-muted">{item.detail}</div>
        </div>
        {item.amount ? <div className="shrink-0 text-sm font-bold">{item.amount}</div> : null}
      </div>
    </Link>
  );
}

function ProjectDashboardTable({
  rows,
  emptyText,
  t,
}: {
  rows: ProjectDashboardRow[];
  emptyText: string;
  t: TFunction;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t("dashboard.colProject")}</th>
            <th>{t("dashboard.colAttention")}</th>
            <th>{t("dashboard.colBudgetUsed")}</th>
            <th>{t("dashboard.colCostToDate")}</th>
            <th>{t("dashboard.colInvoiced")}</th>
            <th>{t("dashboard.colUnbilled")}</th>
            <th>{t("dashboard.colMarginVsTarget")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const totals = row.totals; // whole-project (to date)
            const budget = budgetTotals(row.project.budgetAmount, totals.totalCost);
            const target = targetMargin(row.project.budgetAmount, row.project.estimatedContractValue);
            const attention = projectAttention(row.project, totals);
            const unbilled = totals.totalCost - totals.invoiced;
            const unpaid = row.project.invoices.filter((invoice) => !invoice.isPaid);
            const outstanding = unpaid.reduce((sum, invoice) => sum + invoice.amount, 0);
            const overdueAmount = unpaid
              .filter((invoice) => daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate)) < 0)
              .reduce((sum, invoice) => sum + invoice.amount, 0);
            const marginTone = totals.invoiced <= 0
              ? "text-muted"
              : totals.margin < 0
                ? "text-lab-burgundy"
                : target > 0 && totals.margin < target
                  ? "text-[#c28a2c]"
                  : "text-[#285d59]";

            return (
              <tr key={row.project.id}>
                <td>
                  <Link href={`/projects/${row.project.id}`} className="font-bold text-ink hover:text-lab-burgundy hover:underline">
                    {row.project.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`status ${statusClass(row.project.status)}`}>{t(`status.${row.project.status}`)}</span>
                    {row.project.clientName ? <span className="text-xs font-bold text-muted">{row.project.clientName}</span> : null}
                  </div>
                </td>
                <td><span className={attention.className}>{t(attention.labelKey)}</span></td>
                <td className="font-bold">
                  {row.project.budgetAmount > 0 ? (
                    <>
                      <span className={budget.isOverBudget ? "text-lab-burgundy" : "text-[#285d59]"}>{decimal(budget.budgetUsed)}%</span>
                      <div className="mt-1 text-xs font-bold text-muted">
                        {budget.isOverBudget
                          ? t("dashboard.overBy", { amount: money(Math.abs(budget.budgetRemaining)) })
                          : t("dashboard.left", { amount: money(budget.budgetRemaining) })}
                      </div>
                    </>
                  ) : (
                    <span className="font-semibold text-muted">{t("dashboard.notSet")}</span>
                  )}
                </td>
                <td className="font-bold">{money(totals.totalCost)}</td>
                <td>
                  {money(totals.invoiced)}
                  {overdueAmount > 0 ? (
                    <div className="mt-1 text-xs font-bold text-lab-burgundy">{t("dashboard.overdueAmount", { amount: money(overdueAmount) })}</div>
                  ) : outstanding > 0 ? (
                    <div className="mt-1 text-xs font-bold text-muted">{t("dashboard.openAmount", { amount: money(outstanding) })}</div>
                  ) : null}
                </td>
                <td className="font-bold">
                  {Math.abs(unbilled) < 1 ? (
                    <span className="text-muted">-</span>
                  ) : unbilled > 0 ? (
                    <>
                      <span className="text-[#c28a2c]">{money(unbilled)}</span>
                      <div className="mt-1 text-xs font-bold text-muted">{t("dashboard.toInvoice")}</div>
                    </>
                  ) : (
                    <>
                      <span className="text-[#285d59]">{money(Math.abs(unbilled))}</span>
                      <div className="mt-1 text-xs font-bold text-muted">{t("dashboard.billedAhead")}</div>
                    </>
                  )}
                </td>
                <td className={`font-bold ${marginTone}`}>
                  {totals.invoiced > 0 ? `${decimal(totals.margin)}%` : "-"}
                  <div className="mt-1 text-xs font-bold text-muted">{target > 0 ? t("dashboard.target", { pct: decimal(target) }) : t("dashboard.noTarget")}</div>
                </td>
              </tr>
            );
          })}
          {!rows.length ? (
            <tr>
              <td colSpan={7} className="py-8 text-center font-bold text-muted">{emptyText}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const t = await getT();
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
  // Whole-project (to-date) health for the Active projects table — independent
  // of the period filter above, so cost/invoiced/margin reflect the real project.
  const activeProjectRows = allRows
    .filter((row) => row.project.status === "ACTIVE")
    .sort((a, b) => {
      const aAttention = projectAttention(a.project, a.totals);
      const bAttention = projectAttention(b.project, b.totals);
      return aAttention.rank - bAttention.rank || b.totals.totalCost - a.totals.totalCost;
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
  // Split cost between projects that have at least one invoice (a real profit/loss
  // signal) and projects with cost but zero invoices ever raised (sync/invoicing
  // backlog, not a trading loss) — blending the two makes the headline profit
  // number look far worse than the business actually is.
  const realizedRows = rows.filter((row) => row.totals.invoiced > 0);
  const neverInvoicedRows = rows.filter((row) => row.totals.invoiced === 0 && row.totals.totalCost > 0);
  const realizedCost = realizedRows.reduce((sum, row) => sum + row.totals.totalCost, 0);
  const realizedProfit = totalInvoiced - realizedCost;
  const realizedMargin = totalInvoiced > 0 ? (realizedProfit / totalInvoiced) * 100 : 0;
  const unbilledCostExposure = neverInvoicedRows.reduce((sum, row) => sum + row.totals.totalCost, 0);
  const actionItems: ActionItem[] = [
    ...projects.flatMap((project) =>
      project.invoices
        .filter((invoice) => !invoice.isPaid && daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate)) < 0)
        .map((invoice) => ({
          id: `invoice-${invoice.id}`,
          title: t("dashboard.action.invoiceOverdueTitle", { project: project.name }),
          detail: invoice.invoiceNo
            ? t("dashboard.action.invoiceOverdueDetailNo", { no: invoice.invoiceNo, days: Math.abs(daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate))) })
            : t("dashboard.action.invoiceOverdueDetail", { days: Math.abs(daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate))) }),
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
        title: t("dashboard.action.overBudgetTitle", { project: row.project.name }),
        detail: t("dashboard.action.overBudgetDetail", { amount: money(Math.abs(budgetTotals(row.project.budgetAmount, row.totals.totalCost).budgetRemaining)) }),
        amount: t("dashboard.action.overBudgetAmount", { pct: decimal(budgetTotals(row.project.budgetAmount, row.totals.totalCost).budgetUsed) }),
        href: `/projects/${row.project.id}`,
        tone: "maroon" as const,
        rank: 2,
      })),
    ...allRows
      .filter((row) => row.totals.invoiced > 0 && row.totals.margin < 10 && row.project.status !== "FINISHED")
      .map((row) => ({
        id: `margin-${row.project.id}`,
        title: t("dashboard.action.lowMarginTitle", { project: row.project.name }),
        detail: row.totals.profit >= 0
          ? t("dashboard.action.lowMarginDetail", { pct: decimal(row.totals.margin) })
          : t("dashboard.action.lowMarginLossDetail", { amount: money(Math.abs(row.totals.profit)) }),
        amount: `${decimal(row.totals.margin)}%`,
        href: `/projects/${row.project.id}`,
        tone: row.totals.profit >= 0 ? ("amber" as const) : ("maroon" as const),
        rank: row.totals.profit >= 0 ? 3 : 2,
      })),
    ...allRows
      .filter((row) => row.project.status === "ACTIVE" && row.totals.totalCost > 0 && row.totals.invoiced === 0)
      .map((row) => ({
        id: `uninvoiced-${row.project.id}`,
        title: t("dashboard.action.costsNotInvoicedTitle", { project: row.project.name }),
        detail: t("dashboard.action.costsNotInvoicedDetail"),
        amount: money(row.totals.totalCost),
        href: `/projects/${row.project.id}`,
        tone: "amber" as const,
        rank: 4,
      })),
    ...allRows
      .filter((row) => ["ACTIVE", "ON_HOLD"].includes(row.project.status) && row.project.budgetAmount <= 0)
      .map((row) => ({
        id: `missing-budget-${row.project.id}`,
        title: t("dashboard.action.budgetMissingTitle", { project: row.project.name }),
        detail: t("dashboard.action.budgetMissingDetail"),
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
    { label: t("nav.products"), value: totalProductCost, color: "bg-lab-burgundy" },
    { label: t("dashboard.labourSplit"), value: totalLabourCost, color: "bg-[#777da7]" },
    { label: t("nav.expenses"), value: totalExpenseCost, color: "bg-[#285d59]" },
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
      <PageTitle eyebrow={t("dashboard.eyebrow")} title={t("dashboard.title")}>
        <Link href="/projects/new" className="btn btn-primary">{t("dashboard.newProject")}</Link>
      </PageTitle>

      <section className="panel mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase text-lab-burgundy">{t("dashboard.periodLabel")}</div>
            <h2 className="mt-1 text-lg font-bold text-ink">{t(periodRange.labelKey)}</h2>
            <p className="mt-1 text-sm font-semibold text-muted">
              {t("dashboard.periodHint")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((option) => (
              <Link
                key={option.value}
                href={`/?period=${option.value}`}
                className={`btn btn-small ${selectedPeriod === option.value ? "btn-primary" : "btn-secondary"}`}
              >
                {t(option.labelKey)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-9">
        <StatCard label={t("dashboard.activeProjects")} value={activeProjects} tone="green" />
        <StatCard label={t("dashboard.totalBudget")} value={money(totalBudget)} detail={overBudgetProjects ? t("dashboard.overBudgetCount", { count: overBudgetProjects }) : t("dashboard.noOverruns")} tone={overBudgetProjects ? "maroon" : "blue"} />
        <StatCard label={t("dashboard.totalCosts")} value={money(totalCost)} />
        <StatCard label={t("dashboard.totalInvoiced")} value={money(totalInvoiced)} tone="blue" />
        <StatCard label={t("dashboard.outstanding")} value={money(totalOutstanding)} detail={oldestUnpaidDays ? t("dashboard.oldestIssued", { days: oldestUnpaidDays }) : t("dashboard.noUnpaid")} tone={totalOutstanding > 0 ? "maroon" : "green"} />
        <StatCard label={t("dashboard.overdueInvoices")} value={money(overdueTotal)} detail={t("dashboard.overdueCount", { count: overdueInvoices.length })} tone={overdueTotal > 0 ? "maroon" : "green"} />
        <StatCard
          label={realizedProfit >= 0 ? t("dashboard.realizedProfit") : t("dashboard.realizedLoss")}
          value={<ProfitLossWithMargin value={realizedProfit} margin={realizedMargin} t={t} />}
          detail={realizedRows.length === 1 ? t("dashboard.onlyProjectWithInvoice", { count: realizedRows.length }) : t("dashboard.onlyProjectsWithInvoice", { count: realizedRows.length })}
          tone={realizedProfit >= 0 ? "green" : "maroon"}
        />
        <StatCard
          label={t("dashboard.unbilledExposure")}
          value={money(unbilledCostExposure)}
          detail={neverInvoicedRows.length ? (neverInvoicedRows.length === 1 ? t("dashboard.projectWithCostNoInvoice", { count: neverInvoicedRows.length }) : t("dashboard.projectsWithCostNoInvoice", { count: neverInvoicedRows.length })) : t("dashboard.everyProjectInvoiced")}
          tone={unbilledCostExposure > 0 ? "amber" : "green"}
        />
      </section>
      {unbilledCostExposure > 0 ? (
        <p className="mt-2 text-xs font-semibold text-muted">
          {t("dashboard.unbilledNote")}
        </p>
      ) : null}

      {overdueTotal > 0 ? (
        <section className="mt-6 rounded-xl border-l-4 border-lab-burgundy bg-[#fff8fa] p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-lab-burgundy">{t("dashboard.collectionsAlert")}</div>
              <div className="mt-1 font-bold text-ink">
                {t("dashboard.overdueSummary", {
                  amount: money(overdueTotal),
                  count: overdueInvoices.length,
                  pct: decimal(totalOutstanding > 0 ? (overdueTotal / totalOutstanding) * 100 : 0),
                })}
              </div>
            </div>
            <Link href="/invoices" className="btn btn-small btn-secondary">{t("dashboard.openInvoiceLedger")}</Link>
          </div>
        </section>
      ) : null}

      <section className="panel mt-6 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{t("dashboard.actionRequired")}</h2>
            <p className="mt-1 text-sm font-semibold text-muted">{t("dashboard.actionRequiredHint")}</p>
          </div>
          {actionItems.length > visibleActionItems.length ? (
            <span className="status status-risk">{t("dashboard.moreItems", { count: actionItems.length - visibleActionItems.length })}</span>
          ) : null}
        </div>
        {visibleActionItems.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleActionItems.map((item) => <ActionRequiredCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#c5cdd6] bg-[#f7fbfa] p-4 text-sm font-bold text-[#285d59]">
            {t("dashboard.noUrgent")}
          </div>
        )}
      </section>

      <details className="panel mt-6 p-4" open>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{t("dashboard.detailedAnalytics")}</h2>
              <p className="mt-1 text-sm font-semibold text-muted">{t("dashboard.detailedAnalyticsHint")}</p>
            </div>
            <span className="btn btn-secondary btn-small">{t("dashboard.hideAnalytics")}</span>
          </div>
        </summary>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr] 2xl:grid-cols-[0.9fr_1.1fr_1fr]">
          <div className="panel p-4">
            <h2 className="mb-4 text-lg font-bold">{t("dashboard.costBreakdown")}</h2>
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
            <h2 className="mb-4 text-lg font-bold">{t("dashboard.mostMaterialUsed")}</h2>
            <div className="grid gap-3">
              {topMaterials.map((item) => (
                <BarRow
                  key={`${item.name}-${item.unit}`}
                  label={item.name}
                  value={item.cost}
                  total={maxMaterialCost}
                  detail={`${decimal(item.quantity, 2)} ${item.unit} / ${money(item.cost)}`}
                  color="bg-lab-burgundy"
                />
              ))}
              {!topMaterials.length ? <div className="rounded-lg border border-dashed border-[#c5cdd6] p-4 text-sm font-bold text-muted">{t("dashboard.noProductUsage")}</div> : null}
            </div>
          </div>

          <div className="panel p-4 xl:col-span-2 2xl:col-span-1">
            <h2 className="mb-4 text-lg font-bold">{t("dashboard.labourSplit")}</h2>
            <div className="mb-4 flex h-6 overflow-hidden rounded bg-[#e8eef0]">
              <div className="bg-[#777da7]" style={{ width: `${percent(internalLabourCost, totalLabourCost)}%` }} />
              <div className="bg-[#285d59]" style={{ width: `${percent(externalLabourCost, totalLabourCost)}%` }} />
            </div>
            <div className="grid gap-3">
              <BarRow label={t("dashboard.employeesLabour")} value={internalLabourCost} total={totalLabourCost} detail={`${money(internalLabourCost)} / ${decimal(percent(internalLabourCost, totalLabourCost))}%`} color="bg-[#777da7]" />
              <BarRow label={t("dashboard.externalTeams")} value={externalLabourCost} total={totalLabourCost} detail={`${money(externalLabourCost)} / ${decimal(percent(externalLabourCost, totalLabourCost))}%`} color="bg-[#285d59]" />
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="mb-4 text-lg font-bold">{t("dashboard.expenseCategories")}</h2>
            <div className="grid gap-3">
              {expenseRows.map((item) => (
                <BarRow key={item.label} label={item.label} value={item.value} total={maxExpenseCost} detail={money(item.value)} color="bg-[#285d59]" />
              ))}
              {!expenseRows.length ? <div className="rounded-lg border border-dashed border-[#c5cdd6] p-4 text-sm font-bold text-muted">{t("dashboard.noExtraExpenses")}</div> : null}
            </div>
          </div>

          <div className="panel p-4 xl:col-span-1 2xl:col-span-2">
            <h2 className="mb-4 text-lg font-bold">{t("dashboard.highestCostProjects")}</h2>
            <div className="grid gap-3">
              {mostExpensiveProjects.map(({ project, totals }) => (
                <BarRow
                  key={project.id}
                  label={project.name}
                  value={totals.totalCost}
                  total={Math.max(...mostExpensiveProjects.map((row) => row.totals.totalCost), 1)}
                  detail={totals.invoiced === 0 ? `${money(totals.totalCost)} · not yet invoiced` : money(totals.totalCost)}
                  color={totals.invoiced === 0 ? "bg-[#c5cdd6]" : totals.profit >= 0 ? "bg-[#777da7]" : "bg-lab-burgundy"}
                />
              ))}
              {!mostExpensiveProjects.length ? <div className="rounded-lg border border-dashed border-[#c5cdd6] p-4 text-sm font-bold text-muted">{t("dashboard.noProjectCosts")}</div> : null}
            </div>
          </div>

          {projectM2Rows.length ? (
            <div className="panel p-4 xl:col-span-2 2xl:col-span-3">
              <h2 className="mb-4 text-lg font-bold">{t("dashboard.costPerM2")}</h2>
              <div className="mb-4">
                <StatCard label={t("dashboard.averageCostPerM2")} value={totalCompletedArea > 0 ? money(totalCost / totalCompletedArea) : "-"} detail={t("dashboard.m2Completed", { area: decimal(totalCompletedArea, 1) })} tone="blue" />
              </div>
              <div className="grid gap-3">
                {projectM2Rows.map((row) => (
                  <BarRow
                    key={row.project.id}
                    label={row.project.name}
                    value={row.totalCostPerM2}
                    total={maxProjectCostPerM2}
                    detail={row.totals.invoiced === 0 ? `${money(row.totalCostPerM2)} cost / m2 · not yet invoiced` : `${money(row.totalCostPerM2)} cost / m2, ${money(row.profitPerM2)} profit / m2`}
                    color={row.totals.invoiced === 0 ? "bg-[#c5cdd6]" : row.profitPerM2 >= 0 ? "bg-[#777da7]" : "bg-lab-burgundy"}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="panel p-4">
            <h2 className="mb-4 text-lg font-bold">{t("dashboard.costVsInvoiced")}</h2>
            <div className="space-y-4">
              {rows.map(({ project, totals }) => (
                <div key={project.id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm font-bold"><span className="truncate">{project.name}</span><ProfitLossValue value={totals.invoiced - totals.totalCost} invoiced={totals.invoiced} t={t} /></div>
                  <div className="grid gap-1">
                    <div className="h-3 rounded bg-[#e8eef0]"><div className="h-3 rounded bg-lab-burgundy" style={{ width: `${(totals.totalCost / maxProjectValue) * 100}%` }} /></div>
                    <div className="h-3 rounded bg-[#e8eef0]"><div className="h-3 rounded bg-[#777da7]" style={{ width: `${(totals.invoiced / maxProjectValue) * 100}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="mb-4 text-lg font-bold">{t("dashboard.monthlyCosts")}</h2>
            <div className="grid grid-cols-6 items-end gap-3">
              {monthlyRows.map(([month, row]) => (
                <div key={month} className="grid gap-2 text-center">
                  <div className="flex h-32 items-end justify-center gap-1 border-b border-[#d7e1e5]">
                    <div className="w-4 rounded-t bg-lab-burgundy" style={{ height: `${Math.max((row.cost / maxMonthly) * 100, 4)}%` }} />
                    <div className="w-4 rounded-t bg-[#777da7]" style={{ height: `${Math.max((row.invoiced / maxMonthly) * 100, 4)}%` }} />
                  </div>
                  <div className="text-xs font-bold text-muted">{month}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="mb-4 text-lg font-bold">{t("dashboard.profitLossByProject")}</h2>
            <div className="space-y-3">
              {rows.map(({ project, totals }) => (
                <div key={project.id} className="grid grid-cols-[110px_1fr_90px] items-center gap-3 text-sm">
                  <div className="truncate font-bold">{project.name}</div>
                  <div className="h-3 rounded bg-[#e8eef0]">
                    <div
                      className={`h-3 rounded ${totals.invoiced === 0 ? "bg-[#c5cdd6]" : totals.profit >= 0 ? "bg-[#777da7]" : "bg-lab-burgundy"}`}
                      style={{ width: `${Math.min(Math.abs(totals.margin), 100)}%` }}
                    />
                  </div>
                  <div className="text-right"><ProfitLossValue value={totals.profit} invoiced={totals.invoiced} t={t} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </details>

      <section className="mt-6">
        <div className="panel p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-lab-burgundy">{t("dashboard.currentWork")}</div>
              <h2 className="text-lg font-bold">{t("dashboard.activeProjects")}</h2>
              <p className="mt-1 text-sm font-semibold text-muted">{t("dashboard.activeProjectsHint")}</p>
            </div>
            <Link href="/projects" className="text-sm font-bold text-[#777da7]">{t("dashboard.viewAll")}</Link>
          </div>
          <ProjectDashboardTable
            rows={activeProjectRows}
            emptyText={t("dashboard.emptyActive")}
            t={t}
          />
        </div>
      </section>
    </>
  );
}
