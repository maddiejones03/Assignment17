import Link from "next/link";

const links = [
  { href: "/", label: "Select Customer" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/orders/new", label: "Place Order" },
  { href: "/orders/history", label: "Order History" },
  { href: "/warehouse", label: "Warehouse Queue" },
];

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <nav className="mt-4 flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
