"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Customers" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/orders/new", label: "Place Order" },
  { href: "/orders/history", label: "Orders" },
  { href: "/warehouse", label: "Warehouse" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1.5" aria-label="Main">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-600"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
