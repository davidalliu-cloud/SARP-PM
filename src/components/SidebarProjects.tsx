"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarProject = { id: string; name: string };
type ProjectGroup = { key: string; label: string; projects: SidebarProject[] };

export function SidebarProjects({ groups }: { groups: ProjectGroup[] }) {
  const pathname = usePathname();

  return (
    <div className="border-t border-line px-3 py-5">
      <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">
        Projects
      </div>
      {groups.map((group) => (
        <div key={group.key} className="mb-4 last:mb-0">
          <div className="mb-1 flex items-center justify-between px-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              {group.label}
            </span>
            <span className="text-[10px] font-semibold text-muted">{group.projects.length}</span>
          </div>
          {group.projects.length ? (
            <div>
              {group.projects.map((project) => {
                const base = `/projects/${project.id}`;
                const active = pathname === base || pathname.startsWith(`${base}/`);
                return (
                  <Link
                    key={project.id}
                    href={base}
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
          )}
        </div>
      ))}
    </div>
  );
}
