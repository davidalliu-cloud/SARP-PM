import { ReactNode } from "react";

export function StatCard({
  label,
  value,
  tone = "default",
  detail,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "maroon" | "blue" | "green" | "amber";
  detail?: string;
}) {
  const dot = {
    default: "bg-lab-steel",
    maroon: "bg-lab-burgundy",
    blue: "bg-lab-blue",
    green: "bg-lab-green",
    amber: "bg-lab-gold",
  }[tone];

  return (
    <div className="card-elevated rounded-xl border border-line bg-white p-5">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          {label}
        </span>
      </div>
      <div className="mt-4 text-3xl font-bold tracking-[-0.02em] text-ink">{value}</div>
      {detail ? (
        <div className="mt-2 text-xs uppercase tracking-[0.1em] text-muted">{detail}</div>
      ) : null}
    </div>
  );
}
