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

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const customerId = await selectedCustomerId();

  if (!customerId) {
    return (
      <AppShell title="Place New Order">
        <p className="mb-4">Please select a customer before placing an order.</p>
        <Link
          href="/"
          className="inline-flex rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Select Customer
        </Link>
      </AppShell>
    );
  }

  const customer = await getCustomerById(customerId);
  const err = params.error;

  return (
    <AppShell title="Place New Order">
      {err === "save_failed" && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Could not save the order. Check Supabase permissions and try again.
        </p>
      )}
      {err === "invalid" && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Enter a valid amount greater than zero.
        </p>
      )}

      <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Placing order for <span className="font-semibold text-zinc-900 dark:text-zinc-100">{customer?.name ?? customerId}</span>
        </p>
      </div>
      <form action="/api/orders" method="POST" className="max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
        <input type="hidden" name="customer_id" value={customerId} />
        <div>
          <label className="mb-1.5 block text-sm font-medium">Order total ($)</label>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="0.00"
            className="w-full rounded-lg border px-3 py-2.5"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Fulfillment status</label>
          <select name="status" className="w-full rounded-lg border px-3 py-2.5">
            <option value="placed">placed</option>
            <option value="shipped">shipped</option>
            <option value="delivered">delivered</option>
            <option value="late">late</option>
          </select>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Save order to database
        </button>
      </form>
    </AppShell>
  );
}
