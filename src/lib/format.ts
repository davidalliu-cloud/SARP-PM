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
