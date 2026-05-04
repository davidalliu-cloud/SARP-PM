export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function decimal(value: number, digits = 1) {
  if (!Number.isFinite(value)) return "0.0";
  return value.toFixed(digits);
}

export function dateInputValue(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

export function monthInputValue(value = new Date()) {
  return value.toISOString().slice(0, 7);
}

export function daysSince(date: Date | string, now = new Date()) {
  const start = new Date(date);
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((nowDay - startDay) / 86_400_000));
}

export function addDays(date: Date | string, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function daysUntil(date: Date | string, now = new Date()) {
  const target = new Date(date);
  const targetDay = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((targetDay - nowDay) / 86_400_000);
}

export function invoiceDueDate(invoiceDate: Date | string, dueDate?: Date | string | null) {
  return dueDate ? new Date(dueDate) : addDays(invoiceDate, 30);
}

export function invoiceAgeLabel(invoiceDate: Date | string, dueDate?: Date | string | null, isPaid = false) {
  const issuedDays = daysSince(invoiceDate);
  if (isPaid) return `Issued ${issuedDays} days ago`;

  const remaining = daysUntil(invoiceDueDate(invoiceDate, dueDate));
  if (remaining < 0) return `${Math.abs(remaining)} days overdue`;
  if (remaining === 0) return "Due today";
  return `Due in ${remaining} days`;
}

export function statusLabel(status: string) {
  if (status === "NOT_STARTED") return "Not Started";
  if (status === "ON_HOLD") return "On Hold";
  if (status === "FINISHED" || status === "COMPLETED") return "Finished";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function statusClass(status: string) {
  if (status === "NOT_STARTED") return "status-not-started";
  if (status === "ACTIVE") return "status-active";
  if (status === "FINISHED" || status === "COMPLETED") return "status-finished";
  return "status-on-hold";
}
