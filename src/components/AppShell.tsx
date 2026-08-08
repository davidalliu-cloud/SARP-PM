import Link from "next/link";
import { ReactNode } from "react";
import type { User } from "@prisma/client";
import { logout } from "@/app/login/actions";
import { prisma } from "@/lib/prisma";
import { SidebarNav } from "@/components/SidebarNav";
import { SidebarProjects } from "@/components/SidebarProjects";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/invoices", label: "Invoices" },
  { href: "/products", label: "Products" },
  { href: "/employees", label: "Employees" },
  { href: "/expenses", label: "Expenses" },
  { href: "/exports", label: "Exports" },
  { href: "/users", label: "Users" },
];

// Groups always shown; "On hold" only appears when such projects exist so none are hidden.
const projectGroupDefs = [
  { key: "ACTIVE", label: "Active", alwaysShow: true },
  { key: "NOT_STARTED", label: "Will start", alwaysShow: true },
  { key: "ON_HOLD", label: "On hold", alwaysShow: false },
  { key: "FINISHED", label: "Finished", alwaysShow: true },
];

export async function AppShell({ children, user }: { children: ReactNode; user: User }) {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
  const projectGroups = projectGroupDefs
    .map((group) => ({
      key: group.key,
      label: group.label,
      alwaysShow: group.alwaysShow,
      projects: projects
        .filter((project) => project.status === group.key)
        .map((project) => ({ id: project.id, name: project.name })),
    }))
    .filter((group) => group.alwaysShow || group.projects.length > 0)
    .map(({ key, label, projects }) => ({ key, label, projects }));

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 overflow-y-auto border-r border-line bg-white lg:block">
        <div className="border-b border-line px-6 py-8">
          <Link href="/" className="block">
            <img
              src="/brand/sarp-logo.png"
              alt="SARP Building the Future"
              className="h-auto w-40 max-w-full"
            />
          </Link>
          <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">
            SARP · LAB
          </div>
          <div className="mt-2 text-xl font-bold leading-tight tracking-[-0.01em] text-ink">
            Project Management
          </div>
          <div className="mt-2 max-w-[13rem] text-xs leading-5 text-muted">
            Daily costs, invoices, and project profitability
          </div>
        </div>
        <SidebarNav items={navItems} />
        <SidebarProjects groups={projectGroups} />
      </aside>

      <div className="lg:pl-72">
        <header className="no-print sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <img
                src="/brand/sarp-logo.png"
                alt="SARP"
                className="h-8 w-auto lg:hidden"
              />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">
                  SARP &amp; LAB Operations
                </div>
                <div className="text-sm font-semibold tracking-[-0.01em] text-ink">
                  Project Management
                </div>
                <div className="hidden text-xs text-muted sm:block">
                  Daily costs, invoices, and project profitability
                </div>
              </div>
            </div>
            <form action={logout} className="flex items-center gap-3">
              <div className="hidden rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink sm:block">
                {user.name} · {user.role.toLowerCase()}
              </div>
              <button
                className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:border-lab-burgundy hover:bg-lab-burgundy hover:text-white"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
          <div className="border-t border-line lg:hidden">
            <SidebarNav items={navItems} variant="horizontal" />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}
