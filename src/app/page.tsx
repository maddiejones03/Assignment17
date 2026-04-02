import { AppShell } from "@/components/AppShell";
import { listCustomers } from "@/lib/data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const customers = await listCustomers(search);

  async function selectCustomer(formData: FormData) {
    "use server";
    const customerId = Number(formData.get("customer_id"));
    if (!Number.isFinite(customerId)) return;
    redirect(`/api/select-customer?customer_id=${customerId}`);
  }

  return (
    <AppShell title="Select Customer">
      <form method="GET" className="mb-4 flex gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search name or email"
          className="w-full max-w-sm rounded-md border px-3 py-2"
        />
        <button className="rounded-md bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black">
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">City</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.customer_id} className="border-t">
                <td className="px-4 py-2">{customer.name}</td>
                <td className="px-4 py-2">{customer.email}</td>
                <td className="px-4 py-2">{customer.city}</td>
                <td className="px-4 py-2">
                  <form action={selectCustomer}>
                    <input type="hidden" name="customer_id" value={customer.customer_id} />
                    <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
                      Select
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
