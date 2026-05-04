import Link from "next/link";
import { ReactNode } from "react";
import type { User } from "@prisma/client";
import { logout } from "@/app/login/actions";

const navItems = [
  { href: "/", label: "Dashboard", icon: "D" },
  { href: "/projects", label: "Projects", icon: "P" },
  { href: "/invoices", label: "Invoices", icon: "I" },
  { href: "/products", label: "Products", icon: "M" },
  { href: "/employees", label: "Employees", icon: "E" },
  { href: "/expenses", label: "Expenses", icon: "X" },
  { href: "/exports", label: "Exports", icon: "Ex" },
  { href: "/users", label: "Users", icon: "U" },
];

export function AppShell({ children, user }: { children: ReactNode; user: User }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="bg-[#373455] text-white lg:min-h-screen">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 lg:block">
          <Link href="/" className="block">
            <div className="rounded-lg border border-white/10 bg-[#f3f7f3] p-3">
              <img src="/brand/sarp-logo.png" alt="SARP Building the Future" className="h-auto w-40 max-w-full" />
            </div>
            <div className="mt-4 text-xs font-black uppercase text-[#e6f8f6]">Project Management</div>
            <div className="mt-1 text-xs font-semibold text-[#bdc8d0]">Costs, invoices, and profitability</div>
          </Link>
          <div className="rounded border border-white/10 bg-[#5b193f] px-2 py-1 text-xs font-black lg:mt-6 lg:inline-block">SARP & LAB</div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:space-y-1 lg:px-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-fit items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-[#f3f7f3] transition hover:bg-white/10"
            >
              <span className="grid size-7 place-items-center rounded border border-white/10 bg-[#5b193f]/70 text-xs">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0">
        <header className="border-b border-[#d7e1e5] bg-white/90 px-5 py-4 md:px-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-black uppercase text-[#5b193f]">SARP & LAB Operations</div>
              <div className="text-sm font-semibold text-[#6b7188]">Daily costs, invoices, and project profitability</div>
            </div>
            <form action={logout} className="flex items-center gap-3">
              <div className="rounded-lg border border-[#d7e1e5] bg-[#f3f7f3] px-3 py-2 text-sm font-bold text-[#373455]">
                {user.name} · {user.role.toLowerCase()}
              </div>
              <button className="btn btn-secondary" type="submit">Sign out</button>
            </form>
          </div>
        </header>
        <div className="px-5 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}
