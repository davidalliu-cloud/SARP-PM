"use client";

import Link from "next/link";
import { useState } from "react";
import { updateProjectBasics } from "@/app/actions";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { decimal, formatDate, money, statusClass } from "@/lib/format";
import { useT } from "@/components/LanguageProvider";

type ProjectRow = {
  id: string;
  name: string;
  clientName: string | null;
  startDate: string;
  status: string;
  budgetAmount: number;
  estimatedContractValue: number;
  estimatedProfitMargin: number;
  budgetRemaining: number;
  budgetUsed: number;
  isOverBudget: boolean;
  totalCost: number;
  invoiced: number;
  profit: number;
  margin: number;
};

type SortKey = "name" | "budgetAmount" | "estimatedContractValue" | "totalCost" | "invoiced" | "profit";

const sortColumns: { key: SortKey; labelKey: string }[] = [
  { key: "name", labelKey: "projects.colProject" },
  { key: "budgetAmount", labelKey: "projects.colBudget" },
  { key: "estimatedContractValue", labelKey: "projects.colContract" },
  { key: "totalCost", labelKey: "projects.colCost" },
  { key: "invoiced", labelKey: "projects.colInvoiced" },
  { key: "profit", labelKey: "projects.colProfitMargin" },
];

export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function profitClass(project: ProjectRow) {
    if (project.profit < 0 || project.margin < 0) return "text-lab-burgundy";
    if (!project.invoiced) return "text-muted";
    if (project.estimatedProfitMargin > 0 && project.margin >= project.estimatedProfitMargin) return "text-[#285d59]";
    if (project.estimatedProfitMargin > 0) return "text-[#c28a2c]";
    return "text-[#285d59]";
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "asc");
    }
  }

  const sortedProjects = [...projects].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
    return (a[sortKey] - b[sortKey]) * dir;
  });

  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            {sortColumns.map((col) => (
              <th key={col.key}>
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className="inline-flex items-center gap-1 font-bold uppercase tracking-wide hover:text-lab-burgundy"
                  title={t("projects.sortBy", { label: t(col.labelKey) })}
                >
                  {t(col.labelKey)}
                  {sortKey === col.key ? <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span> : null}
                </button>
              </th>
            ))}
            <th>{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {sortedProjects.map((project) => {
            const isEditing = editingId === project.id;
            const formId = `project-${project.id}`;

            return (
              <tr key={project.id}>
                <td>
                  {isEditing ? (
                    <form id={formId} action={updateProjectBasics}>
                      <input type="hidden" name="id" value={project.id} />
                      <input name="name" defaultValue={project.name} required aria-label={`Project name for ${project.name}`} />
                      <input form={formId} name="clientName" defaultValue={project.clientName || ""} placeholder={t("projects.clientNamePlaceholder")} aria-label={`Client name for ${project.name}`} />
                    </form>
                  ) : (
                    <div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="group inline-flex max-w-72 items-center gap-2 rounded-md px-2 py-1 -ml-2 font-bold text-ink transition hover:bg-[#f4e8eb] hover:text-lab-burgundy focus-visible:bg-[#f4e8eb] focus-visible:text-lab-burgundy"
                      >
                        <span className="truncate underline-offset-4 group-hover:underline group-focus-visible:underline">{project.name}</span>
                        <span className="rounded border border-[#d7e1e5] bg-white px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-lab-burgundy opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
                          {t("projects.open")}
                        </span>
                      </Link>
                      <div className="mt-1 text-xs font-bold text-muted">
                        {project.clientName || t("projects.noClient")} / {t("projects.start", { date: formatDate(project.startDate) })}
                      </div>
                    </div>
                  )}
                </td>
                <td><span className={`status ${statusClass(project.status)}`}>{t(`status.${project.status}`)}</span></td>
                <td>
                  {isEditing ? (
                    <input className="h-9 py-1.5" form={formId} name="budgetAmount" type="number" min="0" step="0.01" defaultValue={project.budgetAmount} aria-label={`Budget for ${project.name}`} />
                  ) : (
                    <div className={project.isOverBudget ? "font-bold text-lab-burgundy" : "font-bold text-ink"}>
                      {project.budgetAmount > 0 ? money(project.budgetAmount) : "-"}
                      {project.budgetAmount > 0 ? (
                        <div className="mt-1 text-xs font-bold text-muted">
                          {t("projects.budgetUsedLeft", { pct: decimal(project.budgetUsed), amount: money(project.budgetRemaining) })}
                        </div>
                      ) : null}
                    </div>
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input className="h-9 py-1.5" form={formId} name="estimatedContractValue" type="number" min="0" step="0.01" defaultValue={project.estimatedContractValue} aria-label={`Contract value for ${project.name}`} />
                  ) : (
                    <div className="font-bold text-ink">
                      {project.estimatedContractValue > 0 ? money(project.estimatedContractValue) : "-"}
                      {project.estimatedProfitMargin ? <div className="mt-1 text-xs font-bold text-muted">{t("projects.target", { pct: decimal(project.estimatedProfitMargin) })}</div> : null}
                    </div>
                  )}
                </td>
                <td className="font-bold">{money(project.totalCost)}</td>
                <td>{money(project.invoiced)}</td>
                <td className={`font-bold ${profitClass(project)}`}>
                  {money(project.profit)}
                  <div className="mt-1 text-xs font-bold text-muted">
                    {project.estimatedProfitMargin
                      ? t("projects.actualTarget", { actual: decimal(project.margin), target: decimal(project.estimatedProfitMargin) })
                      : t("projects.actual", { pct: decimal(project.margin) })}
                  </div>
                </td>
                <td>
                  <div className="grid w-24 gap-2">
                    <button className="btn btn-small btn-edit w-full justify-center" type="button" onClick={() => setEditingId(isEditing ? null : project.id)}>
                      {isEditing ? t("common.cancel") : t("common.edit")}
                    </button>
                    {isEditing ? (
                      <button form={formId} className="btn btn-small btn-save w-full justify-center" type="submit" onClick={() => setEditingId(null)}>{t("common.save")}</button>
                    ) : null}
                    <DeleteProjectButton id={project.id} name={project.name} />
                  </div>
                </td>
              </tr>
            );
          })}
          {!projects.length ? (
            <tr><td colSpan={8} className="py-8 text-center font-bold text-muted">{t("projects.noMatch")}</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
