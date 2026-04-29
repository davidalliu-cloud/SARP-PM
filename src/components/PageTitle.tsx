import { ReactNode } from "react";

export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="border-l-4 border-[#5b193f] pl-4">
        {eyebrow ? <div className="text-xs font-black uppercase text-[#7b1e7a]">{eyebrow}</div> : null}
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[#373455] md:text-3xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
