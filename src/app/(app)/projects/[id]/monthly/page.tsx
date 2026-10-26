import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { decimal, formatDate, formatNumber, money, monthInputValue } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { monthKey, projectTotals, recordExpenseCost, recordLabourCost, recordProductCost, recordTotal } from "@/lib/totals";

export default async function MonthlyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const t = await getT();
  const selected = query.month && query.year ? `${query.year}-${query.month.padStart(2, "0")}` : monthInputValue();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      dailyRecords: {
        include: {
          productItems: { include: { product: true } },
          labourItems: { include: { employee: true } },
          expenseItems: true,
        },
        orderBy: { date: "asc" },
      },
      invoices: { orderBy: { invoiceDate: "asc" } },
    },
  });

  if (!project) notFound();

  const [selectedYear, selectedMonth] = selected.split("-");
  const records = project.dailyRecords.filter((record) => monthKey(record.date) === selected);
  const invoices = project.invoices.filter((invoice) => invoice.monthCovered === selected);
  const totals = projectTotals(records, invoices);
  const completedAreaM2 = records.reduce((sum, record) => sum + record.completedAreaM2, 0);

  return (
    <>
      <PageTitle eyebrow={t("pd.monthly.eyebrow")} title={project.name}>
        <div className="flex flex-wrap gap-2">
          <Link href={`/api/projects/${project.id}/monthly/export?month=${selected}`} className="btn btn-small btn-save">{t("pd.monthly.downloadCsv")}</Link>
          <Link href={`/projects/${project.id}`} className="btn btn-small btn-secondary">{t("pd.attach.backToProject")}</Link>
        </div>
      </PageTitle>

      <form className="panel mb-5 grid gap-4 p-4 md:grid-cols-[160px_160px_auto] md:items-end">
        <label>
          {t("pd.monthly.month")}
          <select name="month" defaultValue={selectedMonth}>
            {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </label>
        <label>
          {t("pd.monthly.year")}
          <input name="year" type="number" min="2020" max="2100" defaultValue={selectedYear} />
        </label>
        <button className="btn btn-primary" type="submit">{t("pd.monthly.loadReport")}</button>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <StatCard label={t("pd.monthly.productCost")} value={money(totals.productCost)} />
        <StatCard label={t("pd.monthly.labourCost")} value={money(totals.labourCost)} />
        <StatCard label={t("pd.monthly.expenses")} value={money(totals.expenseCost)} />
        <StatCard label={t("pd.monthly.totalCost")} value={money(totals.totalCost)} tone="maroon" />
        <StatCard label={t("pd.monthly.invoiced")} value={money(totals.invoiced)} tone="blue" />
        <StatCard label={t("pd.monthly.profitLoss")} value={money(totals.profit)} tone={totals.profit >= 0 ? "green" : "maroon"} />
        <StatCard label={t("pd.monthly.margin")} value={`${decimal(totals.margin)}%`} />
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label={t("pd.monthly.completedArea")} value={completedAreaM2 > 0 ? `${decimal(completedAreaM2, 1)} m2` : "-"} tone={completedAreaM2 > 0 ? "green" : "default"} />
        <StatCard label={t("pd.monthly.productCostPerM2")} value={completedAreaM2 > 0 ? money(totals.productCost / completedAreaM2) : "-"} tone="blue" />
        <StatCard label={t("pd.monthly.labourCostPerM2")} value={completedAreaM2 > 0 ? money(totals.labourCost / completedAreaM2) : "-"} tone="blue" />
        <StatCard label={t("pd.monthly.totalCostPerM2")} value={completedAreaM2 > 0 ? money(totals.totalCost / completedAreaM2) : "-"} tone="maroon" />
        <StatCard label={t("pd.monthly.profitPerM2")} value={completedAreaM2 > 0 ? money(totals.profit / completedAreaM2) : "-"} tone={totals.profit >= 0 ? "green" : "maroon"} />
      </section>

      <section className="panel mt-5 p-4">
        <h2 className="mb-3 text-xl font-bold">{t("pd.monthly.dailyBreakdown", { month: selected })}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("pd.monthly.colDate")}</th>
                <th>{t("pd.monthly.colArea")}</th>
                <th>{t("pd.monthly.colProducts")}</th>
                <th>{t("pd.monthly.colEmployees")}</th>
                <th>{t("pd.monthly.colExpenses")}</th>
                <th>{t("pd.monthly.colProductCost")}</th>
                <th>{t("pd.monthly.colLabourCost")}</th>
                <th>{t("pd.monthly.colExpenseCost")}</th>
                <th>{t("pd.monthly.colTotalCost")}</th>
                <th>{t("pd.monthly.colNotes")}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="font-bold">{formatDate(record.date)}</td>
                  <td>{record.completedAreaM2 > 0 ? `${formatNumber(record.completedAreaM2)} m2` : "-"}</td>
                  <td>{record.productItems.map((item) => `${item.product.name}: ${item.quantity} ${item.product.unit}`).join(", ") || "-"}</td>
                  <td>{record.labourItems.map((item) => item.employee?.name || item.employeeName || (item.externalTeamName ? `${item.externalTeamName} (${item.squareMeters || 0} m2)` : t("pd.monthly.formerEmployee"))).join(", ") || "-"}</td>
                  <td>{record.expenseItems.map((item) => `${item.category}${item.description ? `: ${item.description}` : ""}`).join(", ") || "-"}</td>
                  <td>{money(recordProductCost(record))}</td>
                  <td>{money(recordLabourCost(record))}</td>
                  <td>{money(recordExpenseCost(record))}</td>
                  <td className="font-bold">{money(recordTotal(record))}</td>
                  <td>{record.notes || "-"}</td>
                </tr>
              ))}
              {!records.length ? (
                <tr><td colSpan={10} className="py-8 text-center font-bold text-muted">{t("pd.monthly.noRecords")}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
