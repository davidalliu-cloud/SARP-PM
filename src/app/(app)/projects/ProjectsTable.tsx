"use client";

import Link from "next/link";
import { useState } from "react";
import { updateProjectBasics } from "@/app/actions";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { decimal, money, statusClass, statusLabel } from "@/lib/format";

type ProjectRow = {
  id: string;
  name: string;
  clientName: string | null;
  startDate: string;
  status: string;
  budgetAmount: number;
  budgetRemaining: number;
  budgetUsed: number;
  isOverBudget: boolean;
  totalCost: number;
  invoiced: number;
  profit: number;
  margin: number;
};

export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Client</th>
            <th>Start date</th>
            <th>Status</th>
            <th>Budget</th>
            <th>Total cost</th>
            <th>Budget left</th>
            <th>Invoiced</th>
            <th>Profit/loss</th>
            <th>Margin</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const isEditing = editingId === project.id;
            const formId = `project-${project.id}`;

            return (
              <tr key={project.id}>
                <td>
                  {isEditing ? (
                    <form id={formId} action={updateProjectBasics}>
                      <input type="hidden" name="id" value={project.id} />
                      <input name="name" defaultValue={project.name} required aria-label={`Project name for ${project.name}`} />
                    </form>
                  ) : (
                    <Link href={`/projects/${project.id}`} className="font-black text-[#373455] underline-offset-4 hover:text-[#5b193f] hover:underline">
                      {project.name}
                    </Link>
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input form={formId} name="clientName" defaultValue={project.clientName || ""} placeholder="Client name" aria-label={`Client name for ${project.name}`} />
                  ) : (
                    <span className="font-semibold text-[#373455]">{project.clientName || "-"}</span>
                  )}
                </td>
                <td>{new Date(project.startDate).toLocaleDateString()}</td>
                <td><span className={`status ${statusClass(project.status)}`}>{statusLabel(project.status)}</span></td>
                <td>
                  {isEditing ? (
                    <input className="h-9 py-1.5" form={formId} name="budgetAmount" type="number" min="0" step="0.01" defaultValue={project.budgetAmount} aria-label={`Budget for ${project.name}`} />
                  ) : (
                    project.budgetAmount > 0 ? money(project.budgetAmount) : "-"
                  )}
                </td>
                <td>{money(project.totalCost)}</td>
                <td className={project.isOverBudget ? "font-bold text-[#5b193f]" : "font-bold text-[#285d59]"}>
                  {project.budgetAmount > 0 ? money(project.budgetRemaining) : "-"}
                  {project.budgetAmount > 0 ? <div className="mt-1 text-xs text-[#6b7188]">{decimal(project.budgetUsed)}% used</div> : null}
                </td>
                <td>{money(project.invoiced)}</td>
                <td className={project.profit >= 0 ? "font-bold text-[#285d59]" : "font-bold text-[#5b193f]"}>{money(project.profit)}</td>
                <td>{decimal(project.margin)}%</td>
                <td>
                  <div className="grid w-24 gap-2">
                    <button className="btn btn-small btn-edit w-full justify-center" type="button" onClick={() => setEditingId(isEditing ? null : project.id)}>
                      {isEditing ? "Cancel" : "Edit"}
                    </button>
                    {isEditing ? (
                      <button form={formId} className="btn btn-small btn-save w-full justify-center" type="submit" onClick={() => setEditingId(null)}>Save</button>
                    ) : null}
                    <DeleteProjectButton id={project.id} name={project.name} />
                  </div>
                </td>
              </tr>
            );
          })}
          {!projects.length ? (
            <tr><td colSpan={11} className="py-8 text-center font-bold text-[#6b7188]">No projects match this filter.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
