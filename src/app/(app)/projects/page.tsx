import Link from "next/link";
import { updateProjectBasics } from "@/app/actions";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { PageTitle } from "@/components/PageTitle";
import { money, decimal, statusClass, statusLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { projectTotals } from "@/lib/totals";

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

  return (
    <>
      <PageTitle eyebrow="Portfolio" title="Projects">
        <Link href="/projects/new" className="btn btn-primary">New project</Link>
      </PageTitle>
      {params.deleted ? (
        <div className="panel mb-5 border-[#c8decf] bg-[#eef7f1] p-4 font-bold text-[#315a3d]">
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
        <div className="text-xs font-bold text-[#687482] md:col-span-3">
          Showing {filteredProjects.length} of {projects.length} projects
        </div>
      </form>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th>Start date</th>
              <th>Status</th>
              <th>Total cost</th>
              <th>Invoiced</th>
              <th>Profit/loss</th>
              <th>Margin</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project) => {
              const totals = projectTotals(project.dailyRecords, project.invoices);
              return (
                <tr key={project.id}>
                  <td>
                    <form id={`project-${project.id}`} action={updateProjectBasics}>
                      <input type="hidden" name="id" value={project.id} />
                      <input name="name" defaultValue={project.name} required aria-label={`Project name for ${project.name}`} />
                    </form>
                    <Link href={`/projects/${project.id}`} className="mt-1 inline-block text-xs font-black text-[#285f8f]">Open project</Link>
                  </td>
                  <td>
                    <input form={`project-${project.id}`} name="clientName" defaultValue={project.clientName || ""} placeholder="Client name" aria-label={`Client name for ${project.name}`} />
                  </td>
                  <td>{project.startDate.toLocaleDateString()}</td>
                  <td><span className={`status ${statusClass(project.status)}`}>{statusLabel(project.status)}</span></td>
                  <td>{money(totals.totalCost)}</td>
                  <td>{money(totals.invoiced)}</td>
                  <td className={totals.profit >= 0 ? "font-bold text-[#315a3d]" : "font-bold text-[#7b2636]"}>{money(totals.profit)}</td>
                  <td>{decimal(totals.margin)}%</td>
                  <td>
                    <div className="flex flex-nowrap gap-2">
                      <button form={`project-${project.id}`} className="btn btn-small btn-save" type="submit">Save</button>
                      <DeleteProjectButton id={project.id} name={project.name} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filteredProjects.length ? (
              <tr><td colSpan={9} className="py-8 text-center font-bold text-[#687482]">No projects match this filter.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
