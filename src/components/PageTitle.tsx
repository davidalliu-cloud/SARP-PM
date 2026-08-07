import { ReactNode } from "react";

export function PageTitle({
  eyebrow = "SARP workflow",
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 border-b border-line pb-6 md:flex-row md:items-end">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">
          {eyebrow}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-ink md:text-4xl">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}
