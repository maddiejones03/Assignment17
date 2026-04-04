import type { Customer, Order } from "@/lib/types";

export const mockCustomers: Customer[] = [
  { customer_id: 1, name: "Ava Carter", email: "ava@example.com", city: "Denver" },
  { customer_id: 2, name: "Noah Kim", email: "noah@example.com", city: "Austin" },
  { customer_id: 3, name: "Mia Patel", email: "mia@example.com", city: "Seattle" },
  { customer_id: 4, name: "Liam Smith", email: "liam@example.com", city: "Boston" },
];

let orderSeq = 1005;

export const mockOrders: Order[] = [
  {
    order_id: 1001,
    customer_id: 1,
    amount: 120.5,
    status: "delivered",
    created_at: "2026-03-20T14:00:00.000Z",
    fraud_risk_score: 0.11,
    is_fraud_predicted: false,
  },
  {
    order_id: 1002,
    customer_id: 2,
    amount: 89.99,
    status: "late",
    created_at: "2026-03-22T17:30:00.000Z",
    fraud_risk_score: 0.83,
    is_fraud_predicted: true,
  },
  {
    order_id: 1003,
    customer_id: 1,
    amount: 220,
    status: "shipped",
    created_at: "2026-03-26T09:15:00.000Z",
    fraud_risk_score: 0.42,
    is_fraud_predicted: false,
  },
  {
    order_id: 1004,
    customer_id: 3,
    amount: 49.25,
    status: "placed",
    created_at: "2026-03-28T11:05:00.000Z",
    fraud_risk_score: 0.19,
    is_fraud_predicted: false,
  },
];

export function nextOrderId(): number {
  orderSeq += 1;
  return orderSeq;
}
