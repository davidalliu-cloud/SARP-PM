"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type SidebarProject = { id: string; name: string };
type ProjectGroup = { key: string; label: string; projects: SidebarProject[] };

export function SidebarProjects({ groups }: { groups: ProjectGroup[] }) {
  const pathname = usePathname();
  const isActive = (id: string) => {
    const base = `/projects/${id}`;
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  // Start collapsed; auto-open only the group holding the project you're viewing.
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of groups) {
      initial[group.key] = group.projects.some((project) => isActive(project.id));
    }
    return initial;
  });
  const toggle = (key: string) => setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="border-t border-line px-3 py-5">
      <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">
        Projects
      </div>
      {groups.map((group) => {
        const isOpen = openKeys[group.key];
        return (
          <div key={group.key} className="mb-1 last:mb-0">
            <button
              type="button"
              onClick={() => toggle(group.key)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-muted transition hover:bg-lab-burgundy hover:text-white"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                {group.label}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[10px] font-semibold">{group.projects.length}</span>
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3 w-3 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <path d="M4 2l4 4-4 4" />
                </svg>
              </span>
            </button>
            {isOpen ? (
              group.projects.length ? (
                <div className="mt-1">
                  {group.projects.map((project) => {
                    const active = isActive(project.id);
                    return (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        title={project.name}
                        className={`block truncate rounded-md px-3 py-1.5 text-sm transition ${
                          active
                            ? "bg-lab-burgundy/5 font-semibold text-lab-burgundy hover:bg-lab-burgundy hover:text-white"
                            : "text-ink hover:bg-lab-burgundy hover:text-white"
                        }`}
                      >
                        {project.name}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-1 text-xs text-muted/60">None</div>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
