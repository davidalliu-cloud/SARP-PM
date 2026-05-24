import Link from "next/link";
import { notFound } from "next/navigation";
import { createInvoice, updateProjectBudget, updateProjectStatus } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { addDays, dateInputValue, daysUntil, decimal, invoiceDueDate, money, monthInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { budgetTotals, projectTotals } from "@/lib/totals";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { DailyRecordForm } from "./DailyRecordForm";
import { DailyRecordsManager } from "./DailyRecordsManager";
import { InvoicesManager } from "./InvoicesManager";

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
  if (tone === "green") return { label: "Performing well", className: "status status-active", text: "Costs, budget, and margin are in a healthy position." };
  if (tone === "amber") return { label: "At risk", className: "status status-risk", text: "This project needs attention before it becomes underperforming." };
  if (tone === "maroon") return { label: "Underperforming", className: "status status-on-hold", text: "Budget, recovery, or margin has moved into a problem area." };
  return { label: "Tracking", className: "status status-finished", text: "Not enough pressure signals yet to classify this project." };
}

function guidanceToneClass(tone: GuidanceItem["tone"]) {
  if (tone === "maroon") return "border-[#5b193f] bg-[#fff8fa]";
  if (tone === "amber") return "border-[#c28a2c] bg-[#fffaf0]";
  if (tone === "green") return "border-[#285d59] bg-[#f7fbfa]";
  return "border-[#777da7] bg-[#f7f8fc]";
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
      employeeName: item.employee?.name || item.employeeName || "Former employee",
      externalTeamName: item.externalTeamName || "External team",
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
        name: item.employee?.name || item.employeeName || "Former employee",
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
      title: "Keep the control rhythm",
      text: "Continue daily cost capture, weekly review of budget used, and quick invoice follow-up. Strong projects stay strong when small variances are caught early.",
      tone: "green",
    });
  }

  if (budget.isOverBudget || budget.budgetUsed >= 85) {
    guidanceItems.push({
      title: budget.isOverBudget ? "Recover the budget position" : "Protect the remaining budget",
      text: budget.isOverBudget
        ? `Costs are ${money(Math.abs(budget.budgetRemaining))} over budget. Freeze non-essential purchases, confirm remaining scope, and separate any client-driven changes so they can be priced or claimed.`
        : `${decimal(budget.budgetUsed)}% of the budget is already used. Review the remaining work before approving more material, overtime, or subcontract labour.`,
      tone: budget.isOverBudget ? "maroon" : "amber",
    });
  }

  if (totals.invoiced > 0 && calculatedTargetMargin > 0 && totals.margin < calculatedTargetMargin) {
    guidanceItems.push({
      title: "Close the margin gap",
      text: `Actual margin is ${decimal(totals.margin)}% versus a target of ${decimal(calculatedTargetMargin)}%. Focus first on ${largestCostGroup.label}, because it is currently the largest cost group on this project.`,
      tone: totals.margin < 0 ? "maroon" : "amber",
    });
  }

  if (totals.totalCost > 0 && totals.invoiced < totals.totalCost) {
    guidanceItems.push({
      title: "Improve cost recovery",
      text: `Invoices currently recover ${decimal((totals.invoiced / totals.totalCost) * 100)}% of recorded cost. Check whether completed work, variations, and monthly quantities have been invoiced fully.`,
      tone: totals.invoiced / totals.totalCost < 0.8 ? "maroon" : "amber",
    });
  }

  if (overdueInvoices.length) {
    guidanceItems.push({
      title: "Escalate overdue payment",
      text: `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? " is" : "s are"} overdue. Confirm receipt with the client, agree a payment date, and avoid carrying additional unfunded work without management approval.`,
      tone: "maroon",
    });
  } else if (outstandingInvoices > 0) {
    guidanceItems.push({
      title: "Protect cash flow",
      text: `${money(outstandingInvoices)} is still unpaid. Follow up before it becomes overdue and keep proof of submitted invoices, site records, and approvals attached to the project.`,
      tone: "amber",
    });
  }

  if (totals.productCost > totals.totalCost * 0.45 && productUsageSummary[0]) {
    guidanceItems.push({
      title: "Control material consumption",
      text: `${productUsageSummary[0].name} is the highest material cost. Compare actual quantity against expected usage, check waste, and confirm site stock before ordering more.`,
      tone: "blue",
    });
  }

  if (totals.labourCost > totals.totalCost * 0.45) {
    guidanceItems.push({
      title: "Review productivity",
      text: "Labour is taking the largest share of cost. Check daily output, crew size, waiting time, rework, and whether external m2 teams would be more efficient for repetitive areas.",
      tone: "blue",
    });
  }

  if (totals.expenseCost > totals.totalCost * 0.15 && expenseSummary[0]) {
    guidanceItems.push({
      title: "Tighten indirect expenses",
      text: `${expenseSummary[0].category} is the highest expense category. Review whether it belongs to project cost, variation work, or avoidable site support spend.`,
      tone: "blue",
    });
  }

  if (!guidanceItems.length) {
    guidanceItems.push({
      title: "Add planning data",
      text: "Add budget and contract value, then keep daily costs and invoices up to date. The app will give stronger guidance once it has enough project control data.",
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
    dueDate: invoice.dueDate?.toISOString() || addDays(invoice.invoiceDate, 30).toISOString(),
    isPaid: invoice.isPaid,
    paidDate: invoice.paidDate?.toISOString() || "",
    notes: invoice.notes || "",
  }));

  return (
    <>
      <PageTitle eyebrow={project.clientName || "Project"} title={project.name}>
        <div className="flex flex-wrap items-end gap-2">
          <form action={updateProjectBudget} className="flex items-end gap-2">
            <input type="hidden" name="id" value={project.id} />
            <label className="min-w-44">
              Budget
              <input name="budgetAmount" type="number" min="0" step="0.01" defaultValue={project.budgetAmount} />
            </label>
            <label className="min-w-44">
              Contract value
              <input name="estimatedContractValue" type="number" min="0" step="0.01" defaultValue={project.estimatedContractValue} />
            </label>
            <button className="btn btn-small btn-save mb-0.5" type="submit">Save plan</button>
          </form>
          <form action={updateProjectStatus} className="flex items-end gap-2">
            <input type="hidden" name="id" value={project.id} />
            <label className="min-w-40">
              Status
              <select name="status" defaultValue={project.status}>
                <option value="NOT_STARTED">Not Started</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="FINISHED">Finished</option>
              </select>
            </label>
            <button className="btn btn-small btn-save mb-0.5" type="submit">Save status</button>
          </form>
          <Link href={`/projects/${project.id}/monthly`} className="btn btn-secondary">Monthly report</Link>
        </div>
      </PageTitle>

      <nav className="sticky top-0 z-10 mb-5 overflow-x-auto border-y border-[#d7e1e5] bg-[#f3f7f3]/95 py-3 backdrop-blur">
        <div className="flex min-w-max gap-2">
          <a href="#overview" className="btn btn-small btn-secondary">Overview</a>
          <a href="#daily-entry" className="btn btn-small btn-secondary">Daily entry</a>
          <a href="#attachments" className="btn btn-small btn-secondary">Attachments</a>
          <a href="#daily-records" className="btn btn-small btn-secondary">Daily records</a>
          <a href="#invoices" className="btn btn-small btn-secondary">Invoices</a>
          <a href="#cost-summary" className="btn btn-small btn-secondary">Cost summary</a>
        </div>
      </nav>

      <section id="overview" className={`scroll-mt-24 mb-4 rounded-lg border border-l-4 bg-white p-4 ${projectTone === "maroon" ? "border-l-[#5b193f]" : projectTone === "amber" ? "border-l-[#c28a2c]" : projectTone === "green" ? "border-l-[#285d59]" : "border-l-[#777da7]"}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#6b7188]">Project performance</div>
            <div className="mt-1 font-black text-[#373455]">{summary.text}</div>
          </div>
          <span className={summary.className}>{summary.label}</span>
        </div>
      </section>

      <section className="panel mb-4 p-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#5b193f]">Recovery guidance</div>
            <h2 className="text-xl font-black">Recommended actions</h2>
          </div>
          <span className={summary.className}>{summary.label}</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {guidanceItems.slice(0, 6).map((item) => (
            <div key={item.title} className={`rounded-lg border-l-4 p-3 ${guidanceToneClass(item.tone)}`}>
              <div className="text-sm font-black text-[#373455]">{item.title}</div>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#6b7188]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-9">
        <StatCard label="Budget" value={project.budgetAmount > 0 ? money(project.budgetAmount) : "Not set"} detail={project.budgetAmount > 0 ? `${decimal(budget.budgetUsed)}% used` : "Set a budget for risk colours"} tone={budgetTone} />
        <StatCard label="Contract value" value={project.estimatedContractValue > 0 ? money(project.estimatedContractValue) : "Not set"} detail={estimatedProfit > 0 ? `${money(estimatedProfit)} target profit` : "Add expected contract value"} tone={planningTone} />
        <StatCard label="Target margin" value={calculatedTargetMargin ? `${decimal(calculatedTargetMargin)}%` : "Not set"} detail={actualVsTargetMargin ? `${actualVsTargetMargin >= 0 ? "+" : ""}${decimal(actualVsTargetMargin)}% vs actual` : "Calculated from budget and contract value"} tone={actualVsTargetMargin < 0 ? "amber" : planningTone} />
        <StatCard label="Cost allowance" value={estimatedCostAllowance > 0 ? money(estimatedCostAllowance) : "-"} detail={project.budgetAmount > 0 && estimatedCostAllowance > 0 ? `${money(estimatedCostAllowance - totals.totalCost)} left vs actual cost` : "Contract value less target profit"} tone={estimatedCostAllowance > 0 && totals.totalCost > estimatedCostAllowance ? "maroon" : planningTone} />
        <StatCard label="Product cost" value={money(totals.productCost)} detail={project.budgetAmount > 0 ? "Part of budget pressure" : undefined} tone={costTone} />
        <StatCard label="Labour cost" value={money(totals.labourCost)} detail={project.budgetAmount > 0 ? "Part of budget pressure" : undefined} tone={costTone} />
        <StatCard label="Expenses" value={money(totals.expenseCost)} detail={project.budgetAmount > 0 ? "Part of budget pressure" : undefined} tone={costTone} />
        <StatCard label="Total cost" value={money(totals.totalCost)} detail={project.budgetAmount > 0 ? `${decimal(budget.budgetUsed)}% of budget` : "No budget set"} tone={costTone} />
        <StatCard label="Budget left" value={project.budgetAmount > 0 ? money(budget.budgetRemaining) : "-"} detail={budget.isOverBudget ? "Over budget" : budget.budgetUsed >= 85 ? "Budget risk" : undefined} tone={budgetTone} />
        <StatCard label="Invoiced" value={money(totals.invoiced)} detail={totals.totalCost > 0 ? `${decimal((totals.invoiced / totals.totalCost) * 100)}% cost recovery` : "No costs yet"} tone={invoiceTone} />
        <StatCard label="Outstanding" value={money(outstandingInvoices)} detail={overdueInvoices.length ? `${overdueInvoices.length} overdue` : outstandingInvoices > 0 ? "Awaiting payment" : "Fully paid"} tone={overdueInvoices.length ? "maroon" : outstandingInvoices > 0 ? "amber" : "green"} />
        <StatCard label="Profit margin" value={`${decimal(totals.margin)}%`} detail={money(totals.profit)} tone={marginTone} />
      </section>

      <section className="mt-6 grid gap-5">
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div id="daily-entry" className="scroll-mt-24">
            <h2 className="mb-3 text-xl font-black">Add daily cost record</h2>
            {products.length && employees.length && expenseTypes.length ? (
              <DailyRecordForm projectId={project.id} products={productsWithLatestCosts} employees={employees} expenseTypes={expenseTypes} />
            ) : (
              <div className="panel p-5 font-bold text-[#5b193f]">Add at least one product, employee, and expense option before entering daily costs.</div>
            )}
          </div>

          <div className="panel grid content-start gap-4 p-5">
            <div>
              <div className="text-xs font-black uppercase text-[#5b193f]">Billing</div>
              <h2 className="mt-1 text-xl font-black">Add invoice</h2>
            </div>
            <form action={createInvoice} className="grid gap-4">
              <input type="hidden" name="projectId" value={project.id} />
              <label>Invoice date<input name="invoiceDate" type="date" required defaultValue={dateInputValue()} /></label>
              <label>Month covered<input name="monthCovered" type="month" required defaultValue={monthInputValue()} /></label>
              <label>Invoice number<input name="invoiceNo" placeholder="Optional" /></label>
              <label>Amount invoiced<input name="amount" type="number" min="0" step="0.01" required placeholder="4200.00" /></label>
              <label>Due date<input name="dueDate" type="date" required defaultValue={dateInputValue(addDays(new Date(), 30))} /></label>
              <label>
                Paid status
                <span className="flex items-center gap-2 rounded-lg border border-[#d7e1e5] bg-[#f3f7f3] px-3 py-2 text-sm font-bold text-[#373455]">
                  <input className="size-4 w-auto" name="isPaid" type="checkbox" />
                  Invoice has been paid
                </span>
              </label>
              <label>Paid date<input name="paidDate" type="date" defaultValue={dateInputValue()} /></label>
              <label>Notes<textarea name="notes" rows={3} placeholder="Optional invoice notes" /></label>
              <button className="btn btn-small btn-save justify-self-start" type="submit">Save invoice</button>
            </form>
          </div>
        </div>

        <div id="attachments" className="scroll-mt-24">
          <AttachmentsPanel
            projectId={project.id}
            attachments={project.attachments}
            dailyRecords={project.dailyRecords.map((record) => ({ id: record.id, date: record.date }))}
            invoices={project.invoices.map((invoice) => ({ id: invoice.id, invoiceNo: invoice.invoiceNo, monthCovered: invoice.monthCovered }))}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div id="daily-records" className="panel scroll-mt-24 p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase text-[#5b193f]">Site history</div>
                <h2 className="text-xl font-black">Daily records</h2>
              </div>
              <div className="text-sm font-bold text-[#6b7188]">{dailyRecords.length} records</div>
            </div>
            <DailyRecordsManager projectId={project.id} records={dailyRecords} products={productsWithLatestCosts} employees={employees} expenseTypes={expenseTypes} />
          </div>

          <div id="invoices" className="panel scroll-mt-24 p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase text-[#5b193f]">Billing history</div>
                <h2 className="text-xl font-black">Invoices</h2>
              </div>
              <div className="text-sm font-bold text-[#6b7188]">{money(totals.invoiced)} invoiced</div>
            </div>
            <InvoicesManager invoices={invoices} />
          </div>
        </div>
      </section>

      <section id="cost-summary" className="mt-6 grid scroll-mt-24 gap-5">
        <div className="panel p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase text-[#5b193f]">Project cost summary</div>
              <h2 className="text-xl font-black">Product quantities and costs</h2>
            </div>
            <div className="text-sm font-bold text-[#6b7188]">{productUsageSummary.length} products / {money(totals.productCost)}</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Total quantity</th>
                  <th>Associated cost</th>
                  <th>% of total cost</th>
                  <th>Average cost</th>
                </tr>
              </thead>
              <tbody>
                {productUsageSummary.map((item) => (
                  <tr key={item.id}>
                    <td className="font-black text-[#373455]">{item.name}</td>
                    <td>{decimal(item.quantity, 2)} {item.unit}</td>
                    <td className="font-bold">{money(item.cost)}</td>
                    <td>{decimal(totals.totalCost > 0 ? (item.cost / totals.totalCost) * 100 : 0)}%</td>
                    <td>{item.quantity > 0 ? `${money(item.cost / item.quantity)} / ${item.unit}` : "-"}</td>
                  </tr>
                ))}
                {productUsageSummary.length ? (
                  <tr className="bg-[#f3f7f3] font-black">
                    <td>Total products</td>
                    <td>-</td>
                    <td>{money(totals.productCost)}</td>
                    <td>{decimal(totals.totalCost > 0 ? (totals.productCost / totals.totalCost) * 100 : 0)}%</td>
                    <td>-</td>
                  </tr>
                ) : (
                  <tr><td colSpan={5} className="py-8 text-center font-bold text-[#6b7188]">No product usage recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="panel p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase text-[#5b193f]">Project cost summary</div>
                <h2 className="text-xl font-black">Employee labour</h2>
              </div>
              <div className="text-sm font-bold text-[#6b7188]">{employeeLabourSummary.reduce((sum, item) => sum + item.manDays, 0)} man-days / {money(employeeLabourSummary.reduce((sum, item) => sum + item.cost, 0))}</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Man-days</th>
                    <th>Associated cost</th>
                    <th>% of total cost</th>
                    <th>Average / day</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeLabourSummary.map((item) => (
                    <tr key={item.id}>
                      <td className="font-black text-[#373455]">{item.name}</td>
                      <td>{decimal(item.manDays, 1)}</td>
                      <td className="font-bold">{money(item.cost)}</td>
                      <td>{decimal(totals.totalCost > 0 ? (item.cost / totals.totalCost) * 100 : 0)}%</td>
                      <td>{item.manDays > 0 ? money(item.cost / item.manDays) : "-"}</td>
                    </tr>
                  ))}
                  {employeeLabourSummary.length ? (
                    <tr className="bg-[#f3f7f3] font-black">
                      <td>Total employee labour</td>
                      <td>{decimal(employeeLabourSummary.reduce((sum, item) => sum + item.manDays, 0), 1)}</td>
                      <td>{money(employeeLabourSummary.reduce((sum, item) => sum + item.cost, 0))}</td>
                      <td>{decimal(totals.totalCost > 0 ? (employeeLabourSummary.reduce((sum, item) => sum + item.cost, 0) / totals.totalCost) * 100 : 0)}%</td>
                      <td>-</td>
                    </tr>
                  ) : (
                    <tr><td colSpan={5} className="py-8 text-center font-bold text-[#6b7188]">No employee labour recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase text-[#5b193f]">Project cost summary</div>
                <h2 className="text-xl font-black">Expenses</h2>
              </div>
              <div className="text-sm font-bold text-[#6b7188]">{expenseSummary.length} categories / {money(totals.expenseCost)}</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Expense type</th>
                    <th>Entries</th>
                    <th>Associated cost</th>
                    <th>% of total cost</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseSummary.map((item) => (
                    <tr key={item.category}>
                      <td className="font-black text-[#373455]">{item.category}</td>
                      <td>{item.entries}</td>
                      <td className="font-bold">{money(item.cost)}</td>
                      <td>{decimal(totals.totalCost > 0 ? (item.cost / totals.totalCost) * 100 : 0)}%</td>
                    </tr>
                  ))}
                  {expenseSummary.length ? (
                    <tr className="bg-[#f3f7f3] font-black">
                      <td>Total expenses</td>
                      <td>{expenseSummary.reduce((sum, item) => sum + item.entries, 0)}</td>
                      <td>{money(totals.expenseCost)}</td>
                      <td>{decimal(totals.totalCost > 0 ? (totals.expenseCost / totals.totalCost) * 100 : 0)}%</td>
                    </tr>
                  ) : (
                    <tr><td colSpan={4} className="py-8 text-center font-bold text-[#6b7188]">No expenses recorded yet.</td></tr>
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
                <div className="text-xs font-black uppercase text-[#5b193f]">Project cost summary</div>
                <h2 className="text-xl font-black">External m2 teams</h2>
              </div>
              <div className="text-sm font-bold text-[#6b7188]">{money(externalTeamSummary.reduce((sum, item) => sum + item.cost, 0))}</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Days</th>
                    <th>Total m2</th>
                    <th>Associated cost</th>
                    <th>% of total cost</th>
                    <th>Average / m2</th>
                  </tr>
                </thead>
                <tbody>
                  {externalTeamSummary.map((item) => (
                    <tr key={item.name}>
                      <td className="font-black text-[#373455]">{item.name}</td>
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
    </>
  );
}
