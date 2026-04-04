export type Customer = {
  customer_id: number;
  name: string;
  email: string;
  city: string;
};

export type OrderStatus = "placed" | "shipped" | "delivered" | "late";

export type Order = {
  order_id: number;
  customer_id: number;
  amount: number;
  status: OrderStatus;
  created_at: string;
  /** Fraud probability from ML pipeline (same source as `orders.risk_score` in DB). */
  fraud_risk_score?: number;
  /** Binary fraud flag from model threshold (`orders.is_fraud`). */
  is_fraud_predicted?: boolean;
};

/** Admin order history row */
export type OrderAdminRow = Order & {
  customer_name: string;
};

export type DashboardStats = {
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
};

export type NewOrderInput = {
  customer_id: number;
  amount: number;
  status: OrderStatus;
};

export type ScoringRunResult = {
  scored_count: number;
  run_at: string;
};
