import { AppShell } from "@/components/AppShell";
import { getCustomerById } from "@/lib/data";
import { cookies } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function selectedCustomerId(): Promise<number | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("selected_customer_id")?.value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function NewOrderPage() {
  const customerId = await selectedCustomerId();

  if (!customerId) {
    return (
      <AppShell title="Place New Order">
        <p className="mb-4">Please select a customer before placing an order.</p>
        <Link href="/" className="rounded-md border px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
          Select Customer
        </Link>
      </AppShell>
    );
  }

  const customer = await getCustomerById(customerId);

  return (
    <AppShell title="Place New Order">
      <div className="mb-4 rounded-md border p-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Placing order for <span className="font-semibold">{customer?.name ?? customerId}</span>
        </p>
      </div>
      <form action="/api/orders" method="POST" className="max-w-md space-y-3 rounded-lg border p-4">
        <input type="hidden" name="customer_id" value={customerId} />
        <div>
          <label className="mb-1 block text-sm">Amount</label>
          <input
            name="amount"
            type="number"
            min="1"
            step="0.01"
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">Status</label>
          <select name="status" className="w-full rounded-md border px-3 py-2">
            <option value="placed">placed</option>
            <option value="shipped">shipped</option>
            <option value="delivered">delivered</option>
            <option value="late">late</option>
          </select>
        </div>
        <button className="rounded-md bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black">
          Save Order
        </button>
      </form>
    </AppShell>
  );
}
