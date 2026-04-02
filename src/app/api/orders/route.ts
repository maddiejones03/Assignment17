import { createOrder } from "@/lib/data";
import type { NewOrderInput, OrderStatus } from "@/lib/types";
import { redirect } from "next/navigation";

function parseStatus(value: string): OrderStatus {
  if (value === "placed" || value === "shipped" || value === "delivered" || value === "late") {
    return value;
  }
  return "placed";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const customerId = Number(formData.get("customer_id"));
  const amount = Number(formData.get("amount"));
  const status = parseStatus(String(formData.get("status") ?? "placed"));

  if (!Number.isFinite(customerId) || !Number.isFinite(amount) || amount <= 0) {
    redirect("/orders/new");
  }

  const payload: NewOrderInput = {
    customer_id: customerId,
    amount,
    status,
  };

  await createOrder(payload);
  redirect("/orders/history");
}
