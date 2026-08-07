"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export function SidebarNav({
  items,
  variant = "sidebar",
}: {
  items: NavItem[];
  variant?: "sidebar" | "horizontal";
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (variant === "horizontal") {
    return (
      <nav className="flex gap-1 overflow-x-auto px-4 py-2">
        {items.map(({ href, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-lab-burgundy text-white"
                  : "text-ink hover:bg-lab-burgundy/5 hover:text-lab-burgundy"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="px-3 py-5">
      {items.map(({ href, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`mb-1 flex min-h-11 items-center border-l-2 px-4 text-sm font-medium transition ${
              active
                ? "border-lab-burgundy bg-lab-burgundy/5 font-semibold text-lab-burgundy hover:bg-lab-burgundy hover:text-white"
                : "border-transparent text-ink hover:bg-lab-burgundy hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
