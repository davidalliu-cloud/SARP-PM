import { ReactNode } from "react";

export function StatCard({
  label,
  value,
  tone = "default",
  detail,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "maroon" | "blue" | "green";
  detail?: string;
}) {
  const colors = {
    default: "border-[#d8dee5]",
    maroon: "border-[#7b2636]",
    blue: "border-[#285f8f]",
    green: "border-[#5d8068]",
  };

  return (
    <div className={`panel border-t-4 p-4 ${colors[tone]}`}>
      <div className="text-xs font-black uppercase text-[#687482]">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-[#20262d]">{value}</div>
      {detail ? <div className="mt-1 text-sm font-semibold text-[#687482]">{detail}</div> : null}
    </div>
  );
}
