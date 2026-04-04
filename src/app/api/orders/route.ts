import { createOrder } from "@/lib/data";
import type { NewOrderInput, OrderStatus } from "@/lib/types";
import { NextResponse } from "next/server";

function parseStatus(value: string): OrderStatus {
  if (value === "placed" || value === "shipped" || value === "delivered" || value === "late") {
    return value;
  }
  return "placed";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const customerId = Number(formData.get("customer_id"));
    const amount = Number(formData.get("amount"));
    const status = parseStatus(String(formData.get("status") ?? "placed"));

    if (!Number.isFinite(customerId) || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.redirect(new URL("/orders/new?error=invalid", request.url));
    }

    const payload: NewOrderInput = {
      customer_id: customerId,
      amount,
      status,
    };

    await createOrder(payload);
    return NextResponse.redirect(new URL("/orders/history", request.url));
  } catch {
    return NextResponse.redirect(new URL("/orders/new?error=save", request.url));
  }
}
