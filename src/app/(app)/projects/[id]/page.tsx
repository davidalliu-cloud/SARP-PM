import Link from "next/link";
import { notFound } from "next/navigation";
import { createInvoice, updateProjectStatus } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { dateInputValue, decimal, money, monthInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { projectTotals } from "@/lib/totals";
import { DailyRecordForm } from "./DailyRecordForm";
import { DailyRecordsManager } from "./DailyRecordsManager";
import { InvoicesManager } from "./InvoicesManager";

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
      },
    }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
    prisma.expenseType.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!project) notFound();

  const totals = projectTotals(project.dailyRecords, project.invoices);
  const outstandingInvoices = project.invoices.filter((invoice) => !invoice.isPaid).reduce((sum, invoice) => sum + invoice.amount, 0);
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
    isPaid: invoice.isPaid,
    paidDate: invoice.paidDate?.toISOString() || "",
    notes: invoice.notes || "",
  }));

  return (
    <>
      <PageTitle eyebrow={project.clientName || "Project"} title={project.name}>
        <div className="flex flex-wrap items-end gap-2">
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Product cost" value={money(totals.productCost)} />
        <StatCard label="Labour cost" value={money(totals.labourCost)} />
        <StatCard label="Expenses" value={money(totals.expenseCost)} />
        <StatCard label="Total cost" value={money(totals.totalCost)} tone="maroon" />
        <StatCard label="Invoiced" value={money(totals.invoiced)} tone="blue" />
        <StatCard label="Outstanding" value={money(outstandingInvoices)} tone={outstandingInvoices > 0 ? "maroon" : "green"} />
        <StatCard label="Profit margin" value={`${decimal(totals.margin)}%`} detail={money(totals.profit)} tone={totals.profit >= 0 ? "green" : "maroon"} />
      </section>

      <section className="mt-6 grid gap-5">
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <h2 className="mb-3 text-xl font-black">Add daily cost record</h2>
            {products.length && employees.length && expenseTypes.length ? (
              <DailyRecordForm projectId={project.id} products={products} employees={employees} expenseTypes={expenseTypes} />
            ) : (
              <div className="panel p-5 font-bold text-[#7b2636]">Add at least one product, employee, and expense option before entering daily costs.</div>
            )}
          </div>

          <div className="panel grid content-start gap-4 p-5">
            <div>
              <div className="text-xs font-black uppercase text-[#7b2636]">Billing</div>
              <h2 className="mt-1 text-xl font-black">Add invoice</h2>
            </div>
            <form action={createInvoice} className="grid gap-4">
              <input type="hidden" name="projectId" value={project.id} />
              <label>Invoice date<input name="invoiceDate" type="date" required defaultValue={dateInputValue()} /></label>
              <label>Month covered<input name="monthCovered" type="month" required defaultValue={monthInputValue()} /></label>
              <label>Invoice number<input name="invoiceNo" placeholder="Optional" /></label>
              <label>Amount invoiced<input name="amount" type="number" min="0" step="0.01" required placeholder="4200.00" /></label>
              <label>
                Paid status
                <span className="flex items-center gap-2 rounded-lg border border-[#d8dee5] bg-[#f7f9fb] px-3 py-2 text-sm font-bold text-[#46515d]">
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="panel p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase text-[#7b2636]">Site history</div>
                <h2 className="text-xl font-black">Daily records</h2>
              </div>
              <div className="text-sm font-bold text-[#687482]">{dailyRecords.length} records</div>
            </div>
            <DailyRecordsManager projectId={project.id} records={dailyRecords} products={products} employees={employees} expenseTypes={expenseTypes} />
          </div>

          <div className="panel p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase text-[#7b2636]">Billing history</div>
                <h2 className="text-xl font-black">Invoices</h2>
              </div>
              <div className="text-sm font-bold text-[#687482]">{money(totals.invoiced)} invoiced</div>
            </div>
            <InvoicesManager invoices={invoices} />
          </div>
        </div>
      </section>
    </>
  );
}
