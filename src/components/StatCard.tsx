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
    default: "border-[#bdc8d0]",
    maroon: "border-[#5b193f]",
    blue: "border-[#777da7]",
    green: "border-[#e6f8f6]",
  };

  return (
    <div className={`panel border-t-4 p-4 ${colors[tone]}`}>
      <div className="text-xs font-black uppercase text-[#6b7188]">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-[#373455]">{value}</div>
      {detail ? <div className="mt-1 text-sm font-semibold text-[#6b7188]">{detail}</div> : null}
    </div>
  );
}
