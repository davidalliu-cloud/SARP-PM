import Link from "next/link";
import { ReactNode } from "react";
import type { User } from "@prisma/client";
import { logout } from "@/app/login/actions";
import { canApproveOffers, pendingApprovalCount } from "@/lib/offers";
import { prisma } from "@/lib/prisma";
import { SidebarNav } from "@/components/SidebarNav";
import { SidebarProjects } from "@/components/SidebarProjects";
import { LanguageToggle } from "@/components/LanguageToggle";
import { projectAttention, projectTotals } from "@/lib/totals";
import { getT } from "@/lib/i18n-server";

function attentionDotClass(level: ReturnType<typeof projectAttention>["level"]) {
  if (level === "critical") return "bg-lab-burgundy";
  if (level === "risk") return "bg-lab-gold";
  if (level === "ok") return "bg-lab-green";
  return "bg-lab-steel";
}

const navItems = [
  { href: "/", key: "dashboard" },
  { href: "/offers", key: "offers" },
  { href: "/projects", key: "projects" },
  { href: "/invoices", key: "invoices" },
  { href: "/products", key: "products" },
  { href: "/employees", key: "employees" },
  { href: "/expenses", key: "expenses" },
  { href: "/exports", key: "exports" },
  { href: "/users", key: "users" },
];

// Groups always shown; "On hold" only appears when such projects exist so none are hidden.
const projectGroupDefs = [
  { key: "ACTIVE", alwaysShow: true },
  { key: "NOT_STARTED", alwaysShow: true },
  { key: "ON_HOLD", alwaysShow: false },
  { key: "FINISHED", alwaysShow: true },
];

export async function AppShell({ children, user }: { children: ReactNode; user: User }) {
  const t = await getT();
  const [projects, approvals] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        budgetAmount: true,
        estimatedContractValue: true,
        invoices: true,
        dailyRecords: { include: { productItems: true, labourItems: true, expenseItems: true } },
      },
      orderBy: { name: "asc" },
    }),
    canApproveOffers(user) ? pendingApprovalCount() : Promise.resolve(0),
  ]);
  // Admins see how many offers wait for their approval right in the nav.
  const shellNavItems = navItems.map((item) => ({
    href: item.href,
    label:
      item.href === "/offers" && approvals
        ? t("nav.offersToApprove", { count: approvals })
        : t(`nav.${item.key}`),
  }));
  // Each project carries an attention dot in the sidebar list.
  const projectsWithDot = projects.map((project) => {
    const totals = projectTotals(project.dailyRecords, project.invoices);
    const attention = projectAttention(project, totals);
    return { id: project.id, name: project.name, status: project.status, dotClass: attentionDotClass(attention.level), dotTitle: t(attention.labelKey) };
  });
  const projectGroups = projectGroupDefs
    .map((group) => ({
      key: group.key,
      alwaysShow: group.alwaysShow,
      projects: projectsWithDot
        .filter((project) => project.status === group.key)
        .map((project) => ({ id: project.id, name: project.name, dotClass: project.dotClass, dotTitle: project.dotTitle })),
    }))
    .map((group) => ({ ...group, label: t(`projectGroups.${group.key}`) }))
    .filter((group) => group.alwaysShow || group.projects.length > 0)
    .map(({ key, label, projects }) => ({ key, label, projects }));

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 overflow-y-auto bg-sidebar text-white lg:block">
        <div className="border-b border-white/10 px-6 py-8">
          <Link href="/" className="block">
            <img
              src="/brand/sarp-logo.png"
              alt="SARP Building the Future"
              className="h-auto w-40 max-w-full brightness-0 invert"
            />
          </Link>
          <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-rose">
            {t("brand.eyebrow")}
          </div>
          <div className="mt-2 text-xl font-bold leading-tight tracking-[-0.01em] text-white">
            {t("brand.appName")}
          </div>
          <div className="mt-2 max-w-[13rem] text-xs leading-5 text-white/55">
            {t("brand.tagline")}
          </div>
        </div>
        <SidebarNav items={shellNavItems} />
        <SidebarProjects groups={projectGroups} />
      </aside>

      <div className="min-h-screen bg-canvas lg:pl-72">
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
                  {t("brand.operations")}
                </div>
                <div className="text-sm font-semibold tracking-[-0.01em] text-ink">
                  {t("brand.appName")}
                </div>
                <div className="hidden text-xs text-muted sm:block">
                  {t("brand.tagline")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <form action={logout} className="flex items-center gap-3">
                <div className="hidden rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink sm:block">
                  {user.name} · {t(`roles.${user.role}`)}
                </div>
                <button
                  className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:border-lab-burgundy hover:bg-lab-burgundy hover:text-white"
                  type="submit"
                >
                  {t("common.signOut")}
                </button>
              </form>
            </div>
          </div>
          <div className="border-t border-line lg:hidden">
            <SidebarNav items={shellNavItems} variant="horizontal" />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}
