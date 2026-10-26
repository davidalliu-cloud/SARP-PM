import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { getT } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { budgetTotals, projectTotals } from "@/lib/totals";
import { ProjectsTable } from "./ProjectsTable";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const t = await getT();
  const query = (params.q || "").trim().toLowerCase();
  const status = params.status || "ALL";
  const projects = await prisma.project.findMany({
    include: {
      dailyRecords: { include: { productItems: true, labourItems: true, expenseItems: true } },
      invoices: true,
    },
    orderBy: { startDate: "desc" },
  });
  const filteredProjects = projects.filter((project) => {
    const matchesSearch = !query ||
      project.name.toLowerCase().includes(query) ||
      (project.clientName || "").toLowerCase().includes(query);
    const matchesStatus = status === "ALL" || project.status === status;
    return matchesSearch && matchesStatus;
  });
  const projectRows = filteredProjects.map((project) => {
    const totals = projectTotals(project.dailyRecords, project.invoices);
    const budget = budgetTotals(project.budgetAmount, totals.totalCost);
    return {
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      startDate: project.startDate.toISOString(),
      status: project.status,
      budgetAmount: project.budgetAmount,
      estimatedContractValue: project.estimatedContractValue,
      estimatedProfitMargin: project.estimatedContractValue > 0 ? ((project.estimatedContractValue - project.budgetAmount) / project.estimatedContractValue) * 100 : 0,
      budgetRemaining: budget.budgetRemaining,
      budgetUsed: budget.budgetUsed,
      isOverBudget: budget.isOverBudget,
      totalCost: totals.totalCost,
      invoiced: totals.invoiced,
      profit: totals.profit,
      margin: totals.margin,
    };
  });

  return (
    <>
      <PageTitle eyebrow={t("projects.eyebrow")} title={t("projects.title")}>
        <Link href="/projects/new" className="btn btn-primary">{t("projects.newProject")}</Link>
      </PageTitle>
      {params.deleted ? (
        <div className="panel mb-5 border-[#c8decf] bg-[#eef7f1] p-4 font-bold text-[#285d59]">
          {t("projects.deleted")}
        </div>
      ) : null}
      <form className="panel mb-5 grid gap-3 p-4 md:grid-cols-[1fr_220px_auto] md:items-end">
        <label>
          {t("projects.searchProjects")}
          <input name="q" defaultValue={params.q || ""} placeholder={t("projects.searchPlaceholder")} />
        </label>
        <label>
          {t("projects.status")}
          <select name="status" defaultValue={status}>
            <option value="ALL">{t("projects.allStatuses")}</option>
            <option value="NOT_STARTED">{t("status.NOT_STARTED")}</option>
            <option value="ACTIVE">{t("status.ACTIVE")}</option>
            <option value="ON_HOLD">{t("status.ON_HOLD")}</option>
            <option value="FINISHED">{t("status.FINISHED")}</option>
          </select>
        </label>
        <button className="btn btn-small btn-save" type="submit">{t("projects.applyFilter")}</button>
        <div className="text-xs font-bold text-muted md:col-span-3">
          {t("projects.showing", { shown: filteredProjects.length, total: projects.length })}
        </div>
      </form>
      <ProjectsTable projects={projectRows} />
    </>
  );
}
