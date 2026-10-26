import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { getT } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";

const exportCards = [
  { titleKey: "exports.projectsTitle", descKey: "exports.projectsDesc", href: "/api/export/projects", countKey: "projects" as const },
  { titleKey: "exports.dailyTitle", descKey: "exports.dailyDesc", href: "/api/export/daily-records", countKey: "dailyRecords" as const },
  { titleKey: "exports.invoicesTitle", descKey: "exports.invoicesDesc", href: "/api/export/invoices", countKey: "invoices" as const },
  { titleKey: "exports.productsTitle", descKey: "exports.productsDesc", href: "/api/export/products", countKey: "products" as const },
  { titleKey: "exports.employeesTitle", descKey: "exports.employeesDesc", href: "/api/export/employees", countKey: "employees" as const },
  { titleKey: "exports.attachmentsTitle", descKey: "exports.attachmentsDesc", href: "/api/export/attachments", countKey: "attachments" as const },
];

export default async function ExportsPage() {
  const [projects, dailyRecords, invoices, products, employees, attachments] = await Promise.all([
    prisma.project.count(),
    prisma.dailyRecord.count(),
    prisma.invoice.count(),
    prisma.product.count(),
    prisma.employee.count(),
    prisma.attachment.count(),
  ]);
  const counts = { projects, dailyRecords, invoices, products, employees, attachments };
  const t = await getT();

  return (
    <>
      <PageTitle eyebrow={t("exports.eyebrow")} title={t("exports.title")} />

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {exportCards.map((card) => (
          <div key={card.href} className="panel grid gap-4 p-5">
            <div>
              <div className="text-xs font-bold uppercase text-lab-burgundy">{t("exports.rows", { count: counts[card.countKey] })}</div>
              <h2 className="mt-1 text-xl font-bold">{t(card.titleKey)}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">{t(card.descKey)}</p>
            </div>
            <Link href={card.href} className="btn btn-small btn-save justify-self-start">
              {t("exports.downloadCsv")}
            </Link>
          </div>
        ))}
      </section>
    </>
  );
}
