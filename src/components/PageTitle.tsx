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
      <div>
        {eyebrow ? <div className="text-xs font-black uppercase text-[#7b2636]">{eyebrow}</div> : null}
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[#20262d] md:text-3xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
