import { AppShell } from "@/components/AppShell";
import { getAllOrdersAdmin } from "@/lib/data";
import { formatFraudPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const orders = await getAllOrdersAdmin(500);

  return (
    <AppShell title="Order history (administrator)">
      {params.saved === "1" && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
          Order saved successfully.
        </p>
      )}
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        All orders (newest first). Fraud fields come from the ML pipeline columns in{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">orders</code>.
      </p>
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-semibold">Order ID</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Fraud probability</th>
              <th className="px-4 py-3 font-semibold">Predicted fraud</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.order_id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-2">#{order.order_id}</td>
                <td className="px-4 py-2">{order.customer_name}</td>
                <td className="px-4 py-2">${order.amount.toFixed(2)}</td>
                <td className="px-4 py-2">{formatFraudPercent(order.fraud_risk_score)}</td>
                <td className="px-4 py-2">
                  {order.is_fraud_predicted ? (
                    <span className="font-medium text-red-700 dark:text-red-400">Yes</span>
                  ) : (
                    <span className="text-zinc-600 dark:text-zinc-400">No</span>
                  )}
                </td>
                <td className="px-4 py-2">{new Date(order.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
