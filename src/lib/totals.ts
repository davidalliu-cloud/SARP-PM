import type { DailyRecord, ExpenseItem, Invoice, LabourEntryItem, ProductUsageItem } from "@prisma/client";

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

export function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}
