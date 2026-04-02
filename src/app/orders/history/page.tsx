import { AppShell } from "@/components/AppShell";
import { getCustomerById, getOrdersByCustomer } from "@/lib/data";
import { cookies } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function selectedCustomerId(): Promise<number | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("selected_customer_id")?.value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function OrderHistoryPage() {
  const customerId = await selectedCustomerId();

  if (!customerId) {
    return (
      <AppShell title="Order History">
        <p className="mb-4">Please select a customer first.</p>
        <Link href="/" className="rounded-md border px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
          Select Customer
        </Link>
      </AppShell>
    );
  }

  const [customer, orders] = await Promise.all([
    getCustomerById(customerId),
    getOrdersByCustomer(customerId),
  ]);

  return (
    <AppShell title="Order History">
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Showing orders for <span className="font-semibold">{customer?.name ?? customerId}</span>
      </p>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2">Order ID</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created At</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.order_id} className="border-t">
                <td className="px-4 py-2">#{order.order_id}</td>
                <td className="px-4 py-2">${order.amount.toFixed(2)}</td>
                <td className="px-4 py-2">{order.status}</td>
                <td className="px-4 py-2">{new Date(order.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
