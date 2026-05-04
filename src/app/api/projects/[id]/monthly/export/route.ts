import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { csvResponse, csvRows } from "@/lib/csv";
import { daysSince, daysUntil, invoiceDueDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { monthKey, projectTotals, recordExpenseCost, recordLabourCost, recordProductCost, recordTotal } from "@/lib/totals";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const selected = request.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);

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

  if (!project) return new Response("Project not found", { status: 404 });

  const records = project.dailyRecords.filter((record) => monthKey(record.date) === selected);
  const invoices = project.invoices.filter((invoice) => invoice.monthCovered === selected);
  const totals = projectTotals(records, invoices);
  const outstanding = invoices.filter((invoice) => !invoice.isPaid).reduce((sum, invoice) => sum + invoice.amount, 0);

  const summary = csvRows(
    ["Project", "Month", "Product cost", "Labour cost", "Expenses", "Total cost", "Invoiced", "Outstanding", "Profit/loss", "Margin %"],
    [[project.name, selected, totals.productCost, totals.labourCost, totals.expenseCost, totals.totalCost, totals.invoiced, outstanding, totals.profit, totals.margin]],
  );

  const daily = csvRows(
    ["Date", "Products", "Labour", "Expenses", "Product cost", "Labour cost", "Expense cost", "Daily total", "Notes"],
    records.map((record) => [
      record.date,
      record.productItems.map((item) => `${item.product.name}: ${item.quantity} ${item.product.unit}`).join("; "),
      record.labourItems.map((item) => item.employee?.name || item.employeeName || `${item.externalTeamName || "External team"} (${item.squareMeters || 0} m2)`).join("; "),
      record.expenseItems.map((item) => `${item.category}${item.description ? `: ${item.description}` : ""}`).join("; "),
      recordProductCost(record),
      recordLabourCost(record),
      recordExpenseCost(record),
      recordTotal(record),
      record.notes || "",
    ]),
  );

  const invoiceRows = csvRows(
    ["Invoice date", "Days since issued", "Due date", "Days overdue", "Month covered", "Invoice number", "Amount", "Paid status", "Paid date", "Notes"],
    invoices.map((invoice) => [
      invoice.invoiceDate,
      daysSince(invoice.invoiceDate),
      invoiceDueDate(invoice.invoiceDate, invoice.dueDate),
      invoice.isPaid ? 0 : Math.max(0, -daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate))),
      invoice.monthCovered,
      invoice.invoiceNo || "",
      invoice.amount,
      invoice.isPaid ? "Paid" : "Unpaid",
      invoice.paidDate || "",
      invoice.notes || "",
    ]),
  );

  const filename = `${project.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(^-|-$)/g, "") || "project"}-${selected}-report.csv`;
  return csvResponse(filename, `${summary}\n\nDaily breakdown\n${daily}\n\nInvoices\n${invoiceRows}`);
}
