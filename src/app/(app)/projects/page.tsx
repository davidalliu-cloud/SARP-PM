import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { prisma } from "@/lib/prisma";
import { budgetTotals, projectTotals } from "@/lib/totals";
import { ProjectsTable } from "./ProjectsTable";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; q?: string; status?: string }>;
}) {
  const params = await searchParams;
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
      <PageTitle eyebrow="Portfolio" title="Projects">
        <Link href="/projects/new" className="btn btn-primary">New project</Link>
      </PageTitle>
      {params.deleted ? (
        <div className="panel mb-5 border-[#c8decf] bg-[#eef7f1] p-4 font-bold text-[#285d59]">
          Project deleted.
        </div>
      ) : null}
      <form className="panel mb-5 grid gap-3 p-4 md:grid-cols-[1fr_220px_auto] md:items-end">
        <label>
          Search projects
          <input name="q" defaultValue={params.q || ""} placeholder="Project or client name" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="ALL">All statuses</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="FINISHED">Finished</option>
          </select>
        </label>
        <button className="btn btn-small btn-save" type="submit">Apply filter</button>
        <div className="text-xs font-bold text-[#6b7188] md:col-span-3">
          Showing {filteredProjects.length} of {projects.length} projects
        </div>
      </form>
      <ProjectsTable projects={projectRows} />
    </>
  );
}
