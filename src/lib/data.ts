import { mockCustomers, mockOrders, nextOrderId } from "@/lib/mock-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  Customer,
  DashboardStats,
  NewOrderInput,
  Order,
  ScoringRunResult,
} from "@/lib/types";

function normSearch(value: string): string {
  return value.trim().toLowerCase();
}

function mapRiskToStatus(riskScore: number): Order["status"] {
  if (riskScore >= 0.75) return "late";
  if (riskScore >= 0.5) return "shipped";
  if (riskScore >= 0.25) return "placed";
  return "delivered";
}

export async function listCustomers(search = ""): Promise<Customer[]> {
  if (isSupabaseConfigured && supabase) {
    const query = supabase
      .from("customers")
      .select("customer_id,full_name,email,city")
      .order("customer_id", { ascending: true })
      .limit(200);

    const searchNorm = normSearch(search);
    if (searchNorm) {
      query.or(`full_name.ilike.%${searchNorm}%,email.ilike.%${searchNorm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => ({
      customer_id: row.customer_id,
      name: row.full_name,
      email: row.email,
      city: row.city ?? "",
    }));
  }

  const searchNorm = normSearch(search);
  if (!searchNorm) return mockCustomers;

  return mockCustomers.filter((c) => {
    return (
      c.name.toLowerCase().includes(searchNorm) ||
      c.email.toLowerCase().includes(searchNorm)
    );
  });
}

export async function getCustomerById(customerId: number): Promise<Customer | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("customers")
      .select("customer_id,full_name,email,city")
      .eq("customer_id", customerId)
      .single();
    if (error) return null;
    return {
      customer_id: data.customer_id,
      name: data.full_name,
      email: data.email,
      city: data.city ?? "",
    };
  }

  return mockCustomers.find((c) => c.customer_id === customerId) ?? null;
}

export async function getOrdersByCustomer(customerId: number): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("orders")
      .select("order_id,customer_id,order_total,order_datetime,risk_score")
      .eq("customer_id", customerId)
      .order("order_datetime", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => ({
      order_id: row.order_id,
      customer_id: row.customer_id,
      amount: Number(row.order_total),
      status: mapRiskToStatus(Number(row.risk_score)),
      created_at: row.order_datetime,
      late_delivery_probability: Number(row.risk_score),
    }));
  }

  return mockOrders
    .filter((o) => o.customer_id === customerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getDashboardStats(customerId: number): Promise<DashboardStats> {
  const orders = await getOrdersByCustomer(customerId);
  const totalOrders = orders.length;
  const totalSpend = orders.reduce((sum, order) => sum + order.amount, 0);
  return {
    totalOrders,
    totalSpend,
    averageOrderValue: totalOrders ? totalSpend / totalOrders : 0,
  };
}

export async function createOrder(input: NewOrderInput): Promise<Order> {
  if (isSupabaseConfigured && supabase) {
    const orderSubtotal = Number((input.amount / 1.09).toFixed(2));
    const taxAmount = Number((orderSubtotal * 0.07).toFixed(2));
    const shippingFee = Number((input.amount - orderSubtotal - taxAmount).toFixed(2));
    const riskScore =
      input.status === "late"
        ? 0.85
        : input.status === "shipped"
          ? 0.55
          : input.status === "placed"
            ? 0.35
            : 0.15;

    const payload = {
      customer_id: input.customer_id,
      order_datetime: new Date().toISOString(),
      billing_zip: "00000",
      shipping_zip: "00000",
      shipping_state: "NA",
      payment_method: "card",
      device_type: "web",
      ip_country: "US",
      promo_used: 0,
      promo_code: null,
      order_subtotal: orderSubtotal,
      shipping_fee: shippingFee >= 0 ? shippingFee : 0,
      tax_amount: taxAmount,
      order_total: input.amount,
      risk_score: riskScore,
      is_fraud: 0,
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(payload)
      .select("order_id,customer_id,order_total,order_datetime,risk_score")
      .single();

    if (error) throw error;
    return {
      order_id: data.order_id,
      customer_id: data.customer_id,
      amount: Number(data.order_total),
      status: mapRiskToStatus(Number(data.risk_score)),
      created_at: data.order_datetime,
      late_delivery_probability: Number(data.risk_score),
    };
  }

  const order: Order = {
    order_id: nextOrderId(),
    customer_id: input.customer_id,
    amount: input.amount,
    status: input.status,
    created_at: new Date().toISOString(),
    late_delivery_probability: 0,
  };
  mockOrders.push(order);
  return order;
}

export async function getLateDeliveryQueue(limit = 50): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("orders")
      .select("order_id,customer_id,order_total,order_datetime,risk_score")
      .order("risk_score", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((row) => ({
      order_id: row.order_id,
      customer_id: row.customer_id,
      amount: Number(row.order_total),
      status: mapRiskToStatus(Number(row.risk_score)),
      created_at: row.order_datetime,
      late_delivery_probability: Number(row.risk_score),
    }));
  }

  return [...mockOrders]
    .sort(
      (a, b) =>
        (b.late_delivery_probability ?? 0) - (a.late_delivery_probability ?? 0),
    )
    .slice(0, limit);
}

function deterministicScore(order: Order): number {
  const seed = ((order.order_id * 9301 + 49297) % 233280) / 233280;
  return Number(seed.toFixed(3));
}

export async function runScoring(): Promise<ScoringRunResult> {
  if (isSupabaseConfigured && supabase) {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("order_id,customer_id,order_total,order_datetime,risk_score");
    if (error) throw error;

    const updates =
      orders?.map((o) => ({
        order_id: o.order_id,
        risk_score: deterministicScore({
          order_id: o.order_id,
          customer_id: o.customer_id,
          amount: Number(o.order_total),
          status: mapRiskToStatus(Number(o.risk_score ?? 0)),
          created_at: o.order_datetime,
        }),
      })) ?? [];

    let scoredCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ risk_score: update.risk_score })
        .eq("order_id", update.order_id);
      if (!updateError) scoredCount += 1;
    }

    return {
      scored_count: scoredCount,
      run_at: new Date().toISOString(),
    };
  }

  mockOrders.forEach((order) => {
    order.late_delivery_probability = deterministicScore(order);
  });

  return {
    scored_count: mockOrders.length,
    run_at: new Date().toISOString(),
  };
}
