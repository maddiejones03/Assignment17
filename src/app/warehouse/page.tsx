import { AppShell } from "@/components/AppShell";
import { getFraudVerificationQueue } from "@/lib/data";
import { formatFraudPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ scored?: string; error?: string }>;
}) {
  const params = await searchParams;
  const queue = await getFraudVerificationQueue(50);

  return (
    <AppShell title="Fraud verification queue">
      {params.scored === "1" && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
          Fraud scoring finished. Queue refreshed.
        </p>
      )}
      {params.error === "scoring_failed" && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Scoring failed. Check server logs and Supabase permissions.
        </p>
      )}
      <p className="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Top 50 orders by <strong>predicted fraud probability</strong> from the ML pipeline (
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">orders.risk_score</code> and{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">orders.is_fraud</code>
        ). Run scoring to recompute — swap the placeholder model with your notebook export when ready.
      </p>
      <form action="/api/scoring/run" method="POST" className="mb-6">
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
        >
          Run fraud scoring
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-semibold">Order ID</th>
              <th className="px-4 py-3 font-semibold">Customer ID</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Fraud probability</th>
              <th className="px-4 py-3 font-semibold">Predicted fraud</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((order) => (
              <tr key={order.order_id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-2">#{order.order_id}</td>
                <td className="px-4 py-2">{order.customer_id}</td>
                <td className="px-4 py-2">${order.amount.toFixed(2)}</td>
                <td className="px-4 py-2">{formatFraudPercent(order.fraud_risk_score)}</td>
                <td className="px-4 py-2">
                  {order.is_fraud_predicted ? (
                    <span className="font-medium text-red-700 dark:text-red-400">Yes</span>
                  ) : (
                    <span className="text-zinc-600 dark:text-zinc-400">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
