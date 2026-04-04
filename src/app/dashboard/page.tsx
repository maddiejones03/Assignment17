import { AppShell } from "@/components/AppShell";
import { getCustomerById, getDashboardStats, getOrdersByCustomer } from "@/lib/data";
import { formatFraudPercent } from "@/lib/format";
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

      <section className="mt-8 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Fraud ML pipeline</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Run inference to update fraud probability and binary flags, then review the highest-risk orders before
          fulfilling.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action="/api/scoring/run" method="POST">
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              Run fraud scoring
            </button>
          </form>
          <Link
            href="/warehouse"
            className="inline-flex items-center rounded-lg border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-600 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
          >
            Open fraud verification queue
          </Link>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 text-lg font-semibold">Recent orders</h3>
        <ul className="space-y-2">
          {orders.slice(0, 5).map((order) => (
            <li key={order.order_id} className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-700">
              <span className="font-medium">#{order.order_id}</span> · ${order.amount.toFixed(2)} · Fraud risk{" "}
              {formatFraudPercent(order.fraud_risk_score)}
              {order.is_fraud_predicted != null && (
                <span className="text-zinc-500">
                  {" "}
                  ({order.is_fraud_predicted ? "flagged" : "clear"})
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
