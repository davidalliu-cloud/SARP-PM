import type { DailyRecord, ExpenseItem, Invoice, LabourEntryItem, ProductUsageItem } from "@prisma/client";
import { daysUntil, invoiceDueDate } from "@/lib/format";

export type RecordWithItems = DailyRecord & {
  productItems: ProductUsageItem[];
  labourItems: LabourEntryItem[];
  expenseItems: ExpenseItem[];
};

export function recordProductCost(record: RecordWithItems) {
  return record.productItems.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0);
}

export function recordLabourCost(record: RecordWithItems) {
  return record.labourItems.reduce((sum, item) => sum + item.dailyWage, 0);
}

export function recordExpenseCost(record: RecordWithItems) {
  return record.expenseItems.reduce((sum, item) => sum + item.amount, 0);
}

export function recordTotal(record: RecordWithItems) {
  return recordProductCost(record) + recordLabourCost(record) + recordExpenseCost(record);
}

export function projectTotals(records: RecordWithItems[], invoices: Invoice[]) {
  const productCost = records.reduce((sum, record) => sum + recordProductCost(record), 0);
  const labourCost = records.reduce((sum, record) => sum + recordLabourCost(record), 0);
  const expenseCost = records.reduce((sum, record) => sum + recordExpenseCost(record), 0);
  const totalCost = productCost + labourCost + expenseCost;
  const invoiced = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const profit = invoiced - totalCost;
  const margin = invoiced > 0 ? (profit / invoiced) * 100 : 0;

  return { productCost, labourCost, expenseCost, totalCost, invoiced, profit, margin };
}

export function budgetTotals(budgetAmount: number, totalCost: number) {
  const budget = Number.isFinite(budgetAmount) ? budgetAmount : 0;
  const budgetRemaining = budget - totalCost;
  const budgetUsed = budget > 0 ? (totalCost / budget) * 100 : 0;
  const isOverBudget = budget > 0 && totalCost > budget;

  return { budget, budgetRemaining, budgetUsed, isOverBudget };
}

export function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

export function targetMargin(budgetAmount: number, contractValue: number) {
  return contractValue > 0 ? ((contractValue - budgetAmount) / contractValue) * 100 : 0;
}

export type AttentionProject = {
  budgetAmount: number;
  estimatedContractValue: number;
  invoices: { amount: number; isPaid: boolean; invoiceDate: Date; dueDate: Date | null }[];
};

export type AttentionLevel = "critical" | "risk" | "ok" | "neutral";

// Whole-project (to-date) health signal shared by the dashboard table and the
// sidebar project list, so both agree on what "needs attention" means.
export function projectAttention(project: AttentionProject, totals: ReturnType<typeof projectTotals>) {
  const budget = budgetTotals(project.budgetAmount, totals.totalCost);
  const target = targetMargin(project.budgetAmount, project.estimatedContractValue);
  const unbilled = totals.totalCost - totals.invoiced;
  const costRecovery = totals.totalCost > 0 ? totals.invoiced / totals.totalCost : 1;
  const unpaid = project.invoices.filter((invoice) => !invoice.isPaid);
  const hasOverdue = unpaid.some((invoice) => daysUntil(invoiceDueDate(invoice.invoiceDate, invoice.dueDate)) < 0);

  if (budget.isOverBudget) {
    return { label: "Over budget", labelKey: "attention.overBudget", className: "status status-on-hold", rank: 1, level: "critical" as AttentionLevel };
  }
  if (totals.invoiced > 0 && target > 0 && costRecovery >= 0.85 && totals.margin < target) {
    return { label: "Below target margin", labelKey: "attention.belowTargetMargin", className: "status status-risk", rank: 2, level: "risk" as AttentionLevel };
  }
  if (hasOverdue) {
    return { label: "Payment overdue", labelKey: "attention.paymentOverdue", className: "status status-on-hold", rank: 3, level: "critical" as AttentionLevel };
  }
  if (unbilled > 0 && costRecovery < 0.85 && totals.totalCost > 0) {
    return { label: "Unbilled work", labelKey: "attention.unbilledWork", className: "status status-risk", rank: 4, level: "risk" as AttentionLevel };
  }
  if (project.budgetAmount <= 0) {
    return { label: "No budget set", labelKey: "attention.noBudgetSet", className: "status status-finished", rank: 5, level: "neutral" as AttentionLevel };
  }
  return { label: "On track", labelKey: "attention.onTrack", className: "status status-active", rank: 6, level: "ok" as AttentionLevel };
}
