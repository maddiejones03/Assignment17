import { AppShell } from "@/components/AppShell";
import { getLateDeliveryQueue } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const queue = await getLateDeliveryQueue(50);

  return (
    <AppShell title="Late Delivery Priority Queue">
      <form action="/api/scoring/run" method="POST" className="mb-4">
        <button className="rounded-md bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black">
          Run Scoring
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2">Order ID</th>
              <th className="px-4 py-2">Customer ID</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Late Probability</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((order) => (
              <tr key={order.order_id} className="border-t">
                <td className="px-4 py-2">#{order.order_id}</td>
                <td className="px-4 py-2">{order.customer_id}</td>
                <td className="px-4 py-2">${order.amount.toFixed(2)}</td>
                <td className="px-4 py-2">{(order.late_delivery_probability ?? 0).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
