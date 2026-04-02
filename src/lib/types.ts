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
  late_delivery_probability?: number;
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
