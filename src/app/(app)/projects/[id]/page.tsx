import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProjectBudget, updateProjectStatus } from "@/app/actions";
import { Modal } from "@/components/Modal";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { addDays, daysUntil, decimal, invoiceDueDate, money } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { budgetTotals, projectTotals } from "@/lib/totals";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { DailyRecordsManager } from "./DailyRecordsManager";
import { ExpenseRecordForm } from "./ExpenseRecordForm";
import { InvoiceForm } from "./InvoiceForm";
import { InvoicesManager } from "./InvoicesManager";
import { LabourRecordForm } from "./LabourRecordForm";
import { MaterialsRecordForm } from "./MaterialsRecordForm";

type PerformanceTone = "default" | "maroon" | "blue" | "green" | "amber";

type GuidanceItem = {
  title: string;
  text: string;
  tone: "maroon" | "amber" | "blue" | "green";
};

function budgetPressureTone(budgetAmount: number, budgetUsed: number, isOverBudget: boolean): PerformanceTone {
  if (budgetAmount <= 0) return "default";
  if (isOverBudget) return "maroon";
  if (budgetUsed >= 85) return "amber";
  if (budgetUsed <= 65) return "green";
  return "blue";
}

function profitTone(margin: number, profit: number): PerformanceTone {
  if (profit < 0 || margin < 0) return "maroon";
  if (margin < 10) return "amber";
  if (margin >= 20) return "green";
  return "blue";
}

function recoveryTone(invoiced: number, totalCost: number): PerformanceTone {
  if (totalCost <= 0) return "default";
  const recovery = (invoiced / totalCost) * 100;
  if (recovery < 80) return "maroon";
  if (recovery < 100) return "amber";
  return "green";
}

function performanceSummary(tone: PerformanceTone) {
  if (tone === "green") return { key: "green", className: "status status-active" };
  if (tone === "amber") return { key: "amber", className: "status status-risk" };
  if (tone === "maroon") return { key: "maroon", className: "status status-on-hold" };
  return { key: "default", className: "status status-finished" };
}

function guidanceToneClass(tone: GuidanceItem["tone"]) {
  if (tone === "maroon") return "border-lab-burgundy bg-[#fff8fa]";
  if (tone === "amber") return "border-[#c28a2c] bg-[#fffaf0]";
  if (tone === "green") return "border-[#285d59] bg-[#f7fbfa]";
  return "border-[#777da7] bg-[#f7f8fc]";
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getT();
  const [project, products, employees, expenseTypes, productUsageHistory] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        dailyRecords: {
          include: {
            productItems: { include: { product: true } },
            labourItems: { include: { employee: true } },
            expenseItems: true,
          },
          orderBy: { date: "desc" },
        },
        invoices: { orderBy: { invoiceDate: "desc" } },
        attachments: {
          select: {
            id: true,
            category: true,
            label: true,
            fileName: true,
            contentType: true,
            size: true,
            createdAt: true,
            dailyRecord: { select: { date: true } },
            invoice: { select: { invoiceNo: true, monthCovered: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
    prisma.expenseType.findMany({ orderBy: { name: "asc" } }),
    prisma.productUsageItem.findMany({
      include: { dailyRecord: { select: { date: true, createdAt: true } } },
    }),
  ]);

  if (!project) notFound();

  // Looked up separately so the page still works before the offer tables exist.
  const offer = await prisma.offer.findUnique({ where: { projectId: id }, select: { id: true, code: true } }).catch(() => null);

  const totals = projectTotals(project.dailyRecords, project.invoices);
  const budget = budgetTotals(project.budgetAmount, totals.totalCost);
  const unpaidInvoices = project.invoices.filter((invoice) => !invoice.isPaid);
  const outstandingInvoices = unpaidInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const overdueInvoices = unpaidInvoices.filter((invoice) => daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate)) < 0);
  const budgetTone = budgetPressureTone(project.budgetAmount, budget.budgetUsed, budget.isOverBudget);
  const costTone = budgetTone === "default" ? "blue" : budgetTone;
  const invoiceTone = recoveryTone(totals.invoiced, totals.totalCost);
  const marginTone = profitTone(totals.margin, totals.profit);
  const calculatedTargetMargin = project.estimatedContractValue > 0 ? ((project.estimatedContractValue - project.budgetAmount) / project.estimatedContractValue) * 100 : 0;
  const estimatedProfit = project.estimatedContractValue > 0 ? project.estimatedContractValue - project.budgetAmount : 0;
  const estimatedCostAllowance = project.estimatedContractValue > 0 ? project.estimatedContractValue - estimatedProfit : 0;
  const actualVsTargetMargin = totals.invoiced > 0 && calculatedTargetMargin > 0 ? totals.margin - calculatedTargetMargin : 0;
  const planningTone: PerformanceTone = project.estimatedContractValue <= 0 ? "default" : totals.profit < estimatedProfit * 0.85 && totals.invoiced > 0 ? "amber" : "green";
  const projectTone: PerformanceTone = budgetTone === "maroon" || marginTone === "maroon" || invoiceTone === "maroon" ? "maroon" : budgetTone === "amber" || marginTone === "amber" || invoiceTone === "amber" ? "amber" : totals.totalCost > 0 ? "green" : "default";
  const summary = performanceSummary(projectTone);
  const latestProductCosts = new Map<string, number>();
  productUsageHistory
    .sort((a, b) => b.dailyRecord.date.getTime() - a.dailyRecord.date.getTime() || b.dailyRecord.createdAt.getTime() - a.dailyRecord.createdAt.getTime())
    .forEach((item) => {
      if (!latestProductCosts.has(item.productId)) {
        latestProductCosts.set(item.productId, item.costPerUnit);
      }
    });
  const productsWithLatestCosts = products.map((product) => ({
    ...product,
    lastCostPerUnit: latestProductCosts.get(product.id) ?? null,
  }));
  const dailyRecords = project.dailyRecords.map((record) => ({
    id: record.id,
    projectId: record.projectId,
    date: record.date.toISOString(),
    completedAreaM2: record.completedAreaM2,
    clientName: record.clientName || "",
    notes: record.notes || "",
    productItems: record.productItems.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      unit: item.product.unit,
      quantity: item.quantity,
      costPerUnit: item.costPerUnit,
    })),
    labourItems: record.labourItems.map((item) => ({
      id: item.id,
      labourType: item.employeeId ? "employee" as const : "external" as const,
      employeeId: item.employeeId || "",
      employeeName: item.employee?.name || item.employeeName || t("pd.monthly.formerEmployee"),
      externalTeamName: item.externalTeamName || t("pd.daily.externalTeam"),
      ratePerSquareMeter: item.ratePerSquareMeter || 0,
      squareMeters: item.squareMeters || 0,
      dailyWage: item.dailyWage,
    })),
    expenseItems: record.expenseItems.map((item) => ({
      id: item.id,
      expenseTypeId: item.expenseTypeId || "",
      category: item.category,
      description: item.description || "",
      amount: item.amount,
    })),
  }));
  const productUsageSummary = Array.from(project.dailyRecords.reduce((map, record) => {
    record.productItems.forEach((item) => {
      const current = map.get(item.productId) ?? {
        id: item.productId,
        name: item.product.name,
        unit: item.product.unit,
        quantity: 0,
        cost: 0,
      };
      current.quantity += item.quantity;
      current.cost += item.quantity * item.costPerUnit;
      map.set(item.productId, current);
    });
    return map;
  }, new Map<string, { id: string; name: string; unit: string; quantity: number; cost: number }>()).values())
    .sort((a, b) => b.cost - a.cost);
  const employeeLabourSummary = Array.from(project.dailyRecords.reduce((map, record) => {
    record.labourItems.forEach((item) => {
      if (!item.employeeId && !item.employeeName) return;
      const key = item.employeeId || item.employeeName || item.id;
      const current = map.get(key) ?? {
        id: key,
        name: item.employee?.name || item.employeeName || t("pd.monthly.formerEmployee"),
        manDays: 0,
        cost: 0,
      };
      current.manDays += 1;
      current.cost += item.dailyWage;
      map.set(key, current);
    });
    return map;
  }, new Map<string, { id: string; name: string; manDays: number; cost: number }>()).values())
    .sort((a, b) => b.cost - a.cost);
  const externalTeamSummary = Array.from(project.dailyRecords.reduce((map, record) => {
    record.labourItems.forEach((item) => {
      if (!item.externalTeamName) return;
      const current = map.get(item.externalTeamName) ?? {
        name: item.externalTeamName,
        days: 0,
        squareMeters: 0,
        cost: 0,
      };
      current.days += 1;
      current.squareMeters += item.squareMeters || 0;
      current.cost += item.dailyWage;
      map.set(item.externalTeamName, current);
    });
    return map;
  }, new Map<string, { name: string; days: number; squareMeters: number; cost: number }>()).values())
    .sort((a, b) => b.cost - a.cost);
  const expenseSummary = Array.from(project.dailyRecords.reduce((map, record) => {
    record.expenseItems.forEach((item) => {
      const current = map.get(item.category) ?? {
        category: item.category,
        entries: 0,
        cost: 0,
      };
      current.entries += 1;
      current.cost += item.amount;
      map.set(item.category, current);
    });
    return map;
  }, new Map<string, { category: string; entries: number; cost: number }>()).values())
    .sort((a, b) => b.cost - a.cost);
  const largestCostGroup = [
    { label: "products", value: totals.productCost },
    { label: "labour", value: totals.labourCost },
    { label: "expenses", value: totals.expenseCost },
  ].sort((a, b) => b.value - a.value)[0];
  const guidanceItems: GuidanceItem[] = [];

  if (projectTone === "green") {
    guidanceItems.push({
      title: t("pd.guidance.keepRhythmTitle"),
      text: t("pd.guidance.keepRhythmText"),
      tone: "green",
    });
  }

  if (budget.isOverBudget || budget.budgetUsed >= 85) {
    guidanceItems.push({
      title: budget.isOverBudget ? t("pd.guidance.recoverBudgetTitle") : t("pd.guidance.protectBudgetTitle"),
      text: budget.isOverBudget
        ? t("pd.guidance.recoverBudgetText", { amount: money(Math.abs(budget.budgetRemaining)) })
        : t("pd.guidance.protectBudgetText", { pct: decimal(budget.budgetUsed) }),
      tone: budget.isOverBudget ? "maroon" : "amber",
    });
  }

  if (totals.invoiced > 0 && calculatedTargetMargin > 0 && totals.margin < calculatedTargetMargin) {
    guidanceItems.push({
      title: t("pd.guidance.marginGapTitle"),
      text: t("pd.guidance.marginGapText", { actual: decimal(totals.margin), target: decimal(calculatedTargetMargin), group: t(`pd.costGroup.${largestCostGroup.label}`) }),
      tone: totals.margin < 0 ? "maroon" : "amber",
    });
  }

  if (totals.totalCost > 0 && totals.invoiced < totals.totalCost) {
    guidanceItems.push({
      title: t("pd.guidance.costRecoveryTitle"),
      text: t("pd.guidance.costRecoveryText", { pct: decimal((totals.invoiced / totals.totalCost) * 100) }),
      tone: totals.invoiced / totals.totalCost < 0.8 ? "maroon" : "amber",
    });
  }

  if (overdueInvoices.length) {
    guidanceItems.push({
      title: t("pd.guidance.overdueTitle"),
      text: overdueInvoices.length === 1
        ? t("pd.guidance.overdueTextOne", { count: overdueInvoices.length })
        : t("pd.guidance.overdueTextMany", { count: overdueInvoices.length }),
      tone: "maroon",
    });
  } else if (outstandingInvoices > 0) {
    guidanceItems.push({
      title: t("pd.guidance.cashFlowTitle"),
      text: t("pd.guidance.cashFlowText", { amount: money(outstandingInvoices) }),
      tone: "amber",
    });
  }

  if (totals.productCost > totals.totalCost * 0.45 && productUsageSummary[0]) {
    guidanceItems.push({
      title: t("pd.guidance.materialTitle"),
      text: t("pd.guidance.materialText", { name: productUsageSummary[0].name }),
      tone: "blue",
    });
  }

  if (totals.labourCost > totals.totalCost * 0.45) {
    guidanceItems.push({
      title: t("pd.guidance.productivityTitle"),
      text: t("pd.guidance.productivityText"),
      tone: "blue",
    });
  }

  if (totals.expenseCost > totals.totalCost * 0.15 && expenseSummary[0]) {
    guidanceItems.push({
      title: t("pd.guidance.expensesTitle"),
      text: t("pd.guidance.expensesText", { category: expenseSummary[0].category }),
      tone: "blue",
    });
  }

  if (!guidanceItems.length) {
    guidanceItems.push({
      title: t("pd.guidance.planningTitle"),
      text: t("pd.guidance.planningText"),
      tone: "blue",
    });
  }

  const invoices = project.invoices.map((invoice) => ({
    id: invoice.id,
    projectId: invoice.projectId,
    invoiceDate: invoice.invoiceDate.toISOString(),
    monthCovered: invoice.monthCovered,
    invoiceNo: invoice.invoiceNo || "",
    amount: invoice.amount,
    sourceAmount: invoice.sourceAmount ?? null,
    sourceCurrency: invoice.sourceCurrency || "",
    vatRate: invoice.vatRate ?? null,
    dueDate: invoice.dueDate?.toISOString() || addDays(invoice.invoiceDate, 30).toISOString(),
    isPaid: invoice.isPaid,
    paidDate: invoice.paidDate?.toISOString() || "",
    clientName: invoice.clientName || "",
    notes: invoice.notes || "",
  }));

  const otherClients = Array.from(new Set([
    ...dailyRecords.map((record) => record.clientName).filter(Boolean),
    ...invoices.map((invoice) => invoice.clientName).filter(Boolean),
  ])).filter((name) => name !== project.clientName);
  const projectClientName = project.clientName || t("pd.projectFallback");
  const projectEyebrow = otherClients.length
    ? t("pd.alsoBilling", { client: projectClientName, others: otherClients.join(", ") })
    : projectClientName;

  return (
    <>
      <PageTitle eyebrow={projectEyebrow} title={project.name}>
        <div className="flex flex-wrap items-end gap-2">
          <form action={updateProjectBudget} className="flex items-end gap-2">
            <input type="hidden" name="id" value={project.id} />
            <label className="min-w-44">
              {t("pd.budget")}
              <input name="budgetAmount" type="number" min="0" step="0.01" defaultValue={project.budgetAmount} />
            </label>
            <label className="min-w-44">
              {t("pd.contractValue")}
              <input name="estimatedContractValue" type="number" min="0" step="0.01" defaultValue={project.estimatedContractValue} />
            </label>
            <button className="btn btn-small btn-save mb-0.5" type="submit">{t("pd.savePlan")}</button>
          </form>
          <form action={updateProjectStatus} className="flex items-end gap-2">
            <input type="hidden" name="id" value={project.id} />
            <label className="min-w-40">
              {t("common.status")}
              <select name="status" defaultValue={project.status}>
                <option value="NOT_STARTED">{t("status.NOT_STARTED")}</option>
                <option value="ACTIVE">{t("status.ACTIVE")}</option>
                <option value="ON_HOLD">{t("status.ON_HOLD")}</option>
                <option value="FINISHED">{t("status.FINISHED")}</option>
              </select>
            </label>
            <button className="btn btn-small btn-save mb-0.5" type="submit">{t("pd.saveStatus")}</button>
          </form>
          <Link href={`/projects/${project.id}/monthly`} className="btn btn-secondary">{t("pd.monthlyReport")}</Link>
          {offer ? <Link href={`/offers/${offer.id}`} className="btn btn-secondary">{t("pd.offer", { code: offer.code })}</Link> : null}
        </div>
      </PageTitle>

      {/* Action bar — data entry lives in pop-up windows so the page stays readable. */}
      <section className="mb-6 flex flex-wrap items-center gap-2 border-b border-line pb-6">
        {products.length ? (
          <Modal
            triggerLabel={t("pd.addMaterials")}
            triggerClassName="btn btn-primary"
            eyebrow={t("pd.dailyCostRecord")}
            title={t("pd.addMaterialsTitle")}
            description={t("pd.addMaterialsDesc")}
            size="xl"
          >
            <MaterialsRecordForm projectId={project.id} products={productsWithLatestCosts} defaultClientName={project.clientName || undefined} />
          </Modal>
        ) : (
          <span className="btn btn-primary cursor-not-allowed opacity-60" title={t("pd.addMaterialsDisabled")}>
            {t("pd.addMaterials")}
          </span>
        )}
        {employees.length ? (
          <Modal
            triggerLabel={t("pd.addLabour")}
            triggerClassName="btn btn-primary"
            eyebrow={t("pd.dailyCostRecord")}
            title={t("pd.addLabourTitle")}
            description={t("pd.addLabourDesc")}
            size="xl"
          >
            <LabourRecordForm projectId={project.id} employees={employees} defaultClientName={project.clientName || undefined} />
          </Modal>
        ) : (
          <span className="btn btn-primary cursor-not-allowed opacity-60" title={t("pd.addLabourDisabled")}>
            {t("pd.addLabour")}
          </span>
        )}
        {expenseTypes.length ? (
          <Modal
            triggerLabel={t("pd.addExpense")}
            triggerClassName="btn btn-primary"
            eyebrow={t("pd.dailyCostRecord")}
            title={t("pd.addExpenseTitle")}
            description={t("pd.addExpenseDesc")}
            size="lg"
          >
            <ExpenseRecordForm projectId={project.id} expenseTypes={expenseTypes} defaultClientName={project.clientName || undefined} />
          </Modal>
        ) : (
          <span className="btn btn-primary cursor-not-allowed opacity-60" title={t("pd.addExpenseDisabled")}>
            {t("pd.addExpense")}
          </span>
        )}
        <Modal
          triggerLabel={t("pd.addInvoice")}
          triggerClassName="btn btn-secondary"
          eyebrow={t("pd.billing")}
          title={t("pd.addInvoiceTitle")}
          description={t("pd.addInvoiceDesc")}
          size="lg"
        >
          <InvoiceForm projectId={project.id} defaultClientName={project.clientName || undefined} />
        </Modal>
        <Link href={`/projects/${project.id}/attachments`} className="btn btn-secondary">{t("pd.attachments")}</Link>
        <Link href={`/projects/${project.id}/monthly`} className="btn btn-secondary">{t("pd.monthlyReport")}</Link>
      </section>

      <section className={`mb-6 rounded-xl border border-l-4 bg-white p-4 ${projectTone === "maroon" ? "border-l-lab-burgundy" : projectTone === "amber" ? "border-l-[#c28a2c]" : projectTone === "green" ? "border-l-[#285d59]" : "border-l-[#777da7]"}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{t("pd.performanceEyebrow")}</div>
            <div className="mt-1 font-bold text-ink">{t(`pd.performance.${summary.key}.text`)}</div>
          </div>
          <span className={summary.className}>{t(`pd.performance.${summary.key}.label`)}</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-9">
        <StatCard label={t("pd.budget")} value={project.budgetAmount > 0 ? money(project.budgetAmount) : t("pd.notSet")} detail={project.budgetAmount > 0 ? t("pd.stat.budgetUsed", { pct: decimal(budget.budgetUsed) }) : t("pd.stat.budgetSetHint")} tone={budgetTone} />
        <StatCard label={t("pd.contractValue")} value={project.estimatedContractValue > 0 ? money(project.estimatedContractValue) : t("pd.notSet")} detail={estimatedProfit > 0 ? t("pd.stat.targetProfit", { amount: money(estimatedProfit) }) : t("pd.stat.contractHint")} tone={planningTone} />
        <StatCard label={t("pd.stat.targetMargin")} value={calculatedTargetMargin ? `${decimal(calculatedTargetMargin)}%` : t("pd.notSet")} detail={actualVsTargetMargin ? t("pd.stat.vsActual", { delta: `${actualVsTargetMargin >= 0 ? "+" : ""}${decimal(actualVsTargetMargin)}` }) : t("pd.stat.targetMarginHint")} tone={actualVsTargetMargin < 0 ? "amber" : planningTone} />
        <StatCard label={t("pd.stat.costAllowance")} value={estimatedCostAllowance > 0 ? money(estimatedCostAllowance) : "-"} detail={project.budgetAmount > 0 && estimatedCostAllowance > 0 ? t("pd.stat.leftVsActual", { amount: money(estimatedCostAllowance - totals.totalCost) }) : t("pd.stat.costAllowanceHint")} tone={estimatedCostAllowance > 0 && totals.totalCost > estimatedCostAllowance ? "maroon" : planningTone} />
        <StatCard label={t("pd.stat.productCost")} value={money(totals.productCost)} detail={project.budgetAmount > 0 ? t("pd.stat.budgetPressure") : undefined} tone={costTone} />
        <StatCard label={t("pd.stat.labourCost")} value={money(totals.labourCost)} detail={project.budgetAmount > 0 ? t("pd.stat.budgetPressure") : undefined} tone={costTone} />
        <StatCard label={t("pd.stat.expenses")} value={money(totals.expenseCost)} detail={project.budgetAmount > 0 ? t("pd.stat.budgetPressure") : undefined} tone={costTone} />
        <StatCard label={t("pd.stat.totalCost")} value={money(totals.totalCost)} detail={project.budgetAmount > 0 ? t("pd.stat.pctOfBudget", { pct: decimal(budget.budgetUsed) }) : t("pd.stat.noBudget")} tone={costTone} />
        <StatCard label={t("pd.stat.budgetLeft")} value={project.budgetAmount > 0 ? money(budget.budgetRemaining) : "-"} detail={budget.isOverBudget ? t("pd.stat.overBudget") : budget.budgetUsed >= 85 ? t("pd.stat.budgetRisk") : undefined} tone={budgetTone} />
        <StatCard label={t("pd.stat.invoiced")} value={money(totals.invoiced)} detail={totals.totalCost > 0 ? t("pd.stat.costRecovery", { pct: decimal((totals.invoiced / totals.totalCost) * 100) }) : t("pd.stat.noCosts")} tone={invoiceTone} />
        <StatCard label={t("pd.stat.outstanding")} value={money(outstandingInvoices)} detail={overdueInvoices.length ? t("pd.stat.overdueCount", { count: overdueInvoices.length }) : outstandingInvoices > 0 ? t("pd.stat.awaitingPayment") : t("pd.stat.fullyPaid")} tone={overdueInvoices.length ? "maroon" : outstandingInvoices > 0 ? "amber" : "green"} />
        <StatCard label={t("pd.stat.profitMargin")} value={`${decimal(totals.margin)}%`} detail={money(totals.profit)} tone={marginTone} />
      </section>

      <section className="mt-8 grid gap-5">
        <div className="panel p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lab-burgundy">{t("pd.siteHistory")}</div>
              <h2 className="text-xl font-bold text-ink">{t("pd.materialsLabourEntries")}</h2>
            </div>
            <div className="text-sm font-semibold text-muted">{t("pd.dailyRecordsCount", { count: dailyRecords.length })}</div>
          </div>
          <DailyRecordsManager projectId={project.id} records={dailyRecords} products={productsWithLatestCosts} employees={employees} expenseTypes={expenseTypes} />
        </div>
      </section>

      <section className="mt-8 grid gap-5">
        <div className="panel p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-lab-burgundy">{t("pd.costSummary")}</div>
              <h2 className="text-xl font-bold">{t("pd.productQuantitiesCosts")}</h2>
            </div>
            <div className="text-sm font-bold text-muted">{t("pd.productsSummaryCount", { count: productUsageSummary.length, amount: money(totals.productCost) })}</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("pd.colProduct")}</th>
                  <th>{t("pd.colTotalQuantity")}</th>
                  <th>{t("pd.colAssociatedCost")}</th>
                  <th>{t("pd.colPctOfTotal")}</th>
                  <th>{t("pd.colAverageCost")}</th>
                </tr>
              </thead>
              <tbody>
                {productUsageSummary.map((item) => (
                  <tr key={item.id}>
                    <td className="font-bold text-ink">{item.name}</td>
                    <td>{decimal(item.quantity, 2)} {item.unit}</td>
                    <td className="font-bold">{money(item.cost)}</td>
                    <td>{decimal(totals.totalCost > 0 ? (item.cost / totals.totalCost) * 100 : 0)}%</td>
                    <td>{item.quantity > 0 ? `${money(item.cost / item.quantity)} / ${item.unit}` : "-"}</td>
                  </tr>
                ))}
                {productUsageSummary.length ? (
                  <tr className="bg-[#f1f3f5] font-bold">
                    <td>{t("pd.totalProducts")}</td>
                    <td>-</td>
                    <td>{money(totals.productCost)}</td>
                    <td>{decimal(totals.totalCost > 0 ? (totals.productCost / totals.totalCost) * 100 : 0)}%</td>
                    <td>-</td>
                  </tr>
                ) : (
                  <tr><td colSpan={5} className="py-8 text-center font-bold text-muted">{t("pd.noProductUsage")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="panel p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-lab-burgundy">{t("pd.costSummary")}</div>
                <h2 className="text-xl font-bold">{t("pd.employeeLabour")}</h2>
              </div>
              <div className="text-sm font-bold text-muted">{t("pd.manDaysSummary", { days: employeeLabourSummary.reduce((sum, item) => sum + item.manDays, 0), amount: money(employeeLabourSummary.reduce((sum, item) => sum + item.cost, 0)) })}</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("pd.colEmployee")}</th>
                    <th>{t("pd.colManDays")}</th>
                    <th>{t("pd.colAssociatedCost")}</th>
                    <th>{t("pd.colPctOfTotal")}</th>
                    <th>{t("pd.colAveragePerDay")}</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeLabourSummary.map((item) => (
                    <tr key={item.id}>
                      <td className="font-bold text-ink">{item.name}</td>
                      <td>{decimal(item.manDays, 1)}</td>
                      <td className="font-bold">{money(item.cost)}</td>
                      <td>{decimal(totals.totalCost > 0 ? (item.cost / totals.totalCost) * 100 : 0)}%</td>
                      <td>{item.manDays > 0 ? money(item.cost / item.manDays) : "-"}</td>
                    </tr>
                  ))}
                  {employeeLabourSummary.length ? (
                    <tr className="bg-[#f1f3f5] font-bold">
                      <td>{t("pd.totalEmployeeLabour")}</td>
                      <td>{decimal(employeeLabourSummary.reduce((sum, item) => sum + item.manDays, 0), 1)}</td>
                      <td>{money(employeeLabourSummary.reduce((sum, item) => sum + item.cost, 0))}</td>
                      <td>{decimal(totals.totalCost > 0 ? (employeeLabourSummary.reduce((sum, item) => sum + item.cost, 0) / totals.totalCost) * 100 : 0)}%</td>
                      <td>-</td>
                    </tr>
                  ) : (
                    <tr><td colSpan={5} className="py-8 text-center font-bold text-muted">{t("pd.noEmployeeLabour")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-lab-burgundy">{t("pd.costSummary")}</div>
                <h2 className="text-xl font-bold">{t("pd.expensesTitle")}</h2>
              </div>
              <div className="text-sm font-bold text-muted">{t("pd.categoriesSummary", { count: expenseSummary.length, amount: money(totals.expenseCost) })}</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("pd.colExpenseType")}</th>
                    <th>{t("pd.colEntries")}</th>
                    <th>{t("pd.colAssociatedCost")}</th>
                    <th>{t("pd.colPctOfTotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseSummary.map((item) => (
                    <tr key={item.category}>
                      <td className="font-bold text-ink">{item.category}</td>
                      <td>{item.entries}</td>
                      <td className="font-bold">{money(item.cost)}</td>
                      <td>{decimal(totals.totalCost > 0 ? (item.cost / totals.totalCost) * 100 : 0)}%</td>
                    </tr>
                  ))}
                  {expenseSummary.length ? (
                    <tr className="bg-[#f1f3f5] font-bold">
                      <td>{t("pd.totalExpenses")}</td>
                      <td>{expenseSummary.reduce((sum, item) => sum + item.entries, 0)}</td>
                      <td>{money(totals.expenseCost)}</td>
                      <td>{decimal(totals.totalCost > 0 ? (totals.expenseCost / totals.totalCost) * 100 : 0)}%</td>
                    </tr>
                  ) : (
                    <tr><td colSpan={4} className="py-8 text-center font-bold text-muted">{t("pd.noExpenses")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {externalTeamSummary.length ? (
          <div className="panel p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-lab-burgundy">{t("pd.costSummary")}</div>
                <h2 className="text-xl font-bold">{t("pd.externalTeams")}</h2>
              </div>
              <div className="text-sm font-bold text-muted">{money(externalTeamSummary.reduce((sum, item) => sum + item.cost, 0))}</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("pd.colTeam")}</th>
                    <th>{t("pd.colDays")}</th>
                    <th>{t("pd.colTotalM2")}</th>
                    <th>{t("pd.colAssociatedCost")}</th>
                    <th>{t("pd.colPctOfTotal")}</th>
                    <th>{t("pd.colAveragePerM2")}</th>
                  </tr>
                </thead>
                <tbody>
                  {externalTeamSummary.map((item) => (
                    <tr key={item.name}>
                      <td className="font-bold text-ink">{item.name}</td>
                      <td>{decimal(item.days, 1)}</td>
                      <td>{decimal(item.squareMeters, 2)} m2</td>
                      <td className="font-bold">{money(item.cost)}</td>
                      <td>{decimal(totals.totalCost > 0 ? (item.cost / totals.totalCost) * 100 : 0)}%</td>
                      <td>{item.squareMeters > 0 ? `${money(item.cost / item.squareMeters)} / m2` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-8 grid gap-5">
        <div className="panel p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lab-burgundy">{t("pd.billingHistory")}</div>
              <h2 className="text-xl font-bold text-ink">{t("pd.invoicesTitle")}</h2>
            </div>
            <div className="text-sm font-semibold text-muted">{t("pd.invoicedAmount", { amount: money(totals.invoiced) })}</div>
          </div>
          <InvoicesManager invoices={invoices} />
        </div>

        <AttachmentsPanel
          projectId={project.id}
          attachments={project.attachments}
          dailyRecords={project.dailyRecords.map((record) => ({ id: record.id, date: record.date }))}
          invoices={project.invoices.map((invoice) => ({ id: invoice.id, invoiceNo: invoice.invoiceNo, monthCovered: invoice.monthCovered }))}
        />

        <div className="panel p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lab-burgundy">{t("pd.recoveryGuidance")}</div>
              <h2 className="text-xl font-bold text-ink">{t("pd.recommendedActions")}</h2>
            </div>
            <span className={summary.className}>{t(`pd.performance.${summary.key}.label`)}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {guidanceItems.slice(0, 6).map((item) => (
              <div key={item.title} className={`rounded-lg border-l-4 p-3 ${guidanceToneClass(item.tone)}`}>
                <div className="text-sm font-bold text-ink">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
