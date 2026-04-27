import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { csvResponse, csvRows } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { projectTotals, recordExpenseCost, recordLabourCost, recordProductCost, recordTotal } from "@/lib/totals";

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  await requireUser();
  const { type } = await params;

  if (type === "projects") {
    const projects = await prisma.project.findMany({
      include: {
        dailyRecords: { include: { productItems: true, labourItems: true, expenseItems: true } },
        invoices: true,
      },
      orderBy: { name: "asc" },
    });

    const body = csvRows(
      ["Project", "Client", "Start date", "Status", "Product cost", "Labour cost", "Expenses", "Total cost", "Invoiced", "Profit/loss", "Margin %"],
      projects.map((project) => {
        const totals = projectTotals(project.dailyRecords, project.invoices);
        return [
          project.name,
          project.clientName || "",
          project.startDate,
          project.status,
          totals.productCost,
          totals.labourCost,
          totals.expenseCost,
          totals.totalCost,
          totals.invoiced,
          totals.profit,
          totals.margin,
        ];
      }),
    );
    return csvResponse(`sarp-projects-${todayStamp()}.csv`, body);
  }

  if (type === "products") {
    const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
    const body = csvRows(
      ["Product", "Unit", "Default cost per unit"],
      products.map((product) => [product.name, product.unit, product.defaultCostPerUnit]),
    );
    return csvResponse(`sarp-products-${todayStamp()}.csv`, body);
  }

  if (type === "employees") {
    const employees = await prisma.employee.findMany({ orderBy: { name: "asc" } });
    const body = csvRows(
      ["Employee", "Role", "Default daily wage"],
      employees.map((employee) => [employee.name, employee.role || "", employee.defaultDailyWage]),
    );
    return csvResponse(`sarp-employees-${todayStamp()}.csv`, body);
  }

  if (type === "daily-records") {
    const records = await prisma.dailyRecord.findMany({
      include: {
        project: true,
        productItems: { include: { product: true } },
        labourItems: { include: { employee: true } },
        expenseItems: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    const body = csvRows(
      ["Project", "Date", "Products", "Labour", "Expenses", "Product cost", "Labour cost", "Expense cost", "Daily total", "Notes"],
      records.map((record) => [
        record.project.name,
        record.date,
        record.productItems.map((item) => `${item.product.name} (${item.quantity} ${item.product.unit} x ${item.costPerUnit})`).join("; "),
        record.labourItems.map((item) => item.employee?.name || item.employeeName || `${item.externalTeamName || "External team"} (${item.squareMeters || 0} m2 x ${item.ratePerSquareMeter || 0})`).join("; "),
        record.expenseItems.map((item) => `${item.category}${item.description ? `: ${item.description}` : ""} (${item.amount})`).join("; "),
        recordProductCost(record),
        recordLabourCost(record),
        recordExpenseCost(record),
        recordTotal(record),
        record.notes || "",
      ]),
    );
    return csvResponse(`sarp-daily-records-${todayStamp()}.csv`, body);
  }

  if (type === "invoices") {
    const invoices = await prisma.invoice.findMany({
      include: { project: true },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    });
    const body = csvRows(
      ["Project", "Invoice date", "Month covered", "Invoice number", "Amount", "Notes"],
      invoices.map((invoice) => [
        invoice.project.name,
        invoice.invoiceDate,
        invoice.monthCovered,
        invoice.invoiceNo || "",
        invoice.amount,
        invoice.notes || "",
      ]),
    );
    return csvResponse(`sarp-invoices-${todayStamp()}.csv`, body);
  }

  return new Response("Unknown export type", { status: 404 });
}
