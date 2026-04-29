import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { prisma } from "@/lib/prisma";

const exportCards = [
  {
    title: "Projects summary",
    description: "Project totals with costs, invoicing, profit, and margin.",
    href: "/api/export/projects",
    countKey: "projects" as const,
  },
  {
    title: "Daily records",
    description: "All site records with product, labour, expense, and daily totals.",
    href: "/api/export/daily-records",
    countKey: "dailyRecords" as const,
  },
  {
    title: "Invoices",
    description: "All project invoices with month covered and invoice amount.",
    href: "/api/export/invoices",
    countKey: "invoices" as const,
  },
  {
    title: "Products",
    description: "Master product list with unit and default cost.",
    href: "/api/export/products",
    countKey: "products" as const,
  },
  {
    title: "Employees",
    description: "Employee list with role and default daily wage.",
    href: "/api/export/employees",
    countKey: "employees" as const,
  },
];

export default async function ExportsPage() {
  const [projects, dailyRecords, invoices, products, employees] = await Promise.all([
    prisma.project.count(),
    prisma.dailyRecord.count(),
    prisma.invoice.count(),
    prisma.product.count(),
    prisma.employee.count(),
  ]);
  const counts = { projects, dailyRecords, invoices, products, employees };

  return (
    <>
      <PageTitle eyebrow="Admin tools" title="Exports" />

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {exportCards.map((card) => (
          <div key={card.href} className="panel grid gap-4 p-5">
            <div>
              <div className="text-xs font-black uppercase text-[#5b193f]">{counts[card.countKey]} rows</div>
              <h2 className="mt-1 text-xl font-black">{card.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7188]">{card.description}</p>
            </div>
            <Link href={card.href} className="btn btn-small btn-save justify-self-start">
              Download CSV
            </Link>
          </div>
        ))}
      </section>
    </>
  );
}
