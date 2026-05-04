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

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, products, employees, expenseTypes] = await Promise.all([
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
  const projectTone: PerformanceTone = budgetTone === "maroon" || marginTone === "maroon" || invoiceTone === "maroon" ? "maroon" : budgetTone === "amber" || marginTone === "amber" || invoiceTone === "amber" ? "amber" : totals.totalCost > 0 ? "green" : "default";
  const summary = performanceSummary(projectTone);
  const dailyRecords = project.dailyRecords.map((record) => ({
    id: record.id,
    projectId: record.projectId,
    date: record.date.toISOString(),
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
            <button className="btn btn-small btn-save mb-0.5" type="submit">Save budget</button>
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

      <section className={`mb-4 rounded-lg border border-l-4 bg-white p-4 ${projectTone === "maroon" ? "border-l-[#5b193f]" : projectTone === "amber" ? "border-l-[#c28a2c]" : projectTone === "green" ? "border-l-[#285d59]" : "border-l-[#777da7]"}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#6b7188]">Project performance</div>
            <div className="mt-1 font-black text-[#373455]">{summary.text}</div>
          </div>
          <span className={summary.className}>{summary.label}</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-9">
        <StatCard label="Budget" value={project.budgetAmount > 0 ? money(project.budgetAmount) : "Not set"} detail={project.budgetAmount > 0 ? `${decimal(budget.budgetUsed)}% used` : "Set a budget for risk colours"} tone={budgetTone} />
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
          <div>
            <h2 className="mb-3 text-xl font-black">Add daily cost record</h2>
            {products.length && employees.length && expenseTypes.length ? (
              <DailyRecordForm projectId={project.id} products={products} employees={employees} expenseTypes={expenseTypes} />
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

        <AttachmentsPanel
          projectId={project.id}
          attachments={project.attachments}
          dailyRecords={project.dailyRecords.map((record) => ({ id: record.id, date: record.date }))}
          invoices={project.invoices.map((invoice) => ({ id: invoice.id, invoiceNo: invoice.invoiceNo, monthCovered: invoice.monthCovered }))}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="panel p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase text-[#5b193f]">Site history</div>
                <h2 className="text-xl font-black">Daily records</h2>
              </div>
              <div className="text-sm font-bold text-[#6b7188]">{dailyRecords.length} records</div>
            </div>
            <DailyRecordsManager projectId={project.id} records={dailyRecords} products={products} employees={employees} expenseTypes={expenseTypes} />
          </div>

          <div className="panel p-4">
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
    </>
  );
}
