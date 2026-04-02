import { AppShell } from "@/components/AppShell";
import { getCustomerById, getDashboardStats, getOrdersByCustomer } from "@/lib/data";
import { cookies } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getSelectedCustomerId(): Promise<number | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("selected_customer_id")?.value;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function DashboardPage() {
  const customerId = await getSelectedCustomerId();

  if (!customerId) {
    return (
      <AppShell title="Customer Dashboard">
        <p className="mb-4">No customer selected yet.</p>
        <Link href="/" className="rounded-md border px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
          Go to Select Customer
        </Link>
      </AppShell>
    );
  }

  const [customer, stats, orders] = await Promise.all([
    getCustomerById(customerId),
    getDashboardStats(customerId),
    getOrdersByCustomer(customerId),
  ]);

  return (
    <AppShell title="Customer Dashboard">
      <div className="mb-6 rounded-lg border p-4">
        <h2 className="text-xl font-semibold">{customer?.name ?? `Customer ${customerId}`}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{customer?.email ?? "No email"}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Total Orders</p>
          <p className="text-2xl font-semibold">{stats.totalOrders}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Total Spend</p>
          <p className="text-2xl font-semibold">${stats.totalSpend.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Average Order Value</p>
          <p className="text-2xl font-semibold">${stats.averageOrderValue.toFixed(2)}</p>
        </div>
      </div>

      <section className="mt-6">
        <h3 className="mb-2 text-lg font-semibold">Recent Orders</h3>
        <ul className="space-y-2">
          {orders.slice(0, 5).map((order) => (
            <li key={order.order_id} className="rounded-md border p-3">
              #{order.order_id} - ${order.amount.toFixed(2)} - {order.status}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
