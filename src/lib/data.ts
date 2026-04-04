import { mockCustomers, mockOrders, nextOrderId } from "@/lib/mock-data";
import { scoreOrdersBatch } from "@/lib/fraudInference";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  Customer,
  DashboardStats,
  NewOrderInput,
  Order,
  OrderAdminRow,
  ScoringRunResult,
} from "@/lib/types";

function normSearch(value: string): string {
  return value.trim().toLowerCase();
}

/** Normalize DB `risk_score` to 0–1 (handles legacy 0–100 values). */
function normalizeFraudRisk(riskScore: number): number {
  const v = Number(riskScore);
  if (!Number.isFinite(v)) return 0;
  return v > 1 ? v / 100 : v;
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

export async function getAllOrdersAdmin(limit = 500): Promise<OrderAdminRow[]> {
  if (isSupabaseConfigured && supabase) {
    const { data: flat, error } = await supabase
      .from("orders")
      .select("order_id,customer_id,order_total,order_datetime,risk_score,is_fraud")
      .order("order_datetime", { ascending: false })
      .limit(limit);
    if (error) throw error;

    const ids = [...new Set((flat ?? []).map((r) => r.customer_id))];
    const names = new Map<number, string>();
    if (ids.length) {
      const { data: custs, error: custErr } = await supabase
        .from("customers")
        .select("customer_id,full_name")
        .in("customer_id", ids);
      if (custErr) throw custErr;
      for (const c of custs ?? []) {
        names.set(c.customer_id, c.full_name);
      }
    }

    return (flat ?? []).map((row) => ({
      order_id: row.order_id,
      customer_id: row.customer_id,
      amount: Number(row.order_total),
      status: "placed",
      created_at: row.order_datetime,
      fraud_risk_score: normalizeFraudRisk(Number(row.risk_score)),
      is_fraud_predicted: Number(row.is_fraud) === 1,
      customer_name: names.get(row.customer_id) ?? `Customer ${row.customer_id}`,
    }));
  }

  return mockOrders
    .map((o) => {
      const c = mockCustomers.find((x) => x.customer_id === o.customer_id);
      return {
        ...o,
        is_fraud_predicted: o.is_fraud_predicted ?? (o.fraud_risk_score ?? 0) >= 0.5,
        customer_name: c?.name ?? `Customer ${o.customer_id}`,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

async function getNextOrderId(): Promise<number> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is required for order id allocation");
  }
  const { data, error } = await supabase
    .from("orders")
    .select("order_id")
    .order("order_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const max = data?.order_id ?? 0;
  return max + 1;
}

export async function getOrdersByCustomer(customerId: number): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("orders")
      .select("order_id,customer_id,order_total,order_datetime,risk_score,is_fraud")
      .eq("customer_id", customerId)
      .order("order_datetime", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => ({
      order_id: row.order_id,
      customer_id: row.customer_id,
      amount: Number(row.order_total),
      status: "placed",
      created_at: row.order_datetime,
      fraud_risk_score: normalizeFraudRisk(Number(row.risk_score)),
      is_fraud_predicted: Number(row.is_fraud) === 1,
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
    const orderId = await getNextOrderId();
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
      order_id: orderId,
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
      .select("order_id,customer_id,order_total,order_datetime,risk_score,is_fraud")
      .single();

    if (error) throw error;
    return {
      order_id: data.order_id,
      customer_id: data.customer_id,
      amount: Number(data.order_total),
      status: input.status,
      created_at: data.order_datetime,
      fraud_risk_score: normalizeFraudRisk(Number(data.risk_score)),
      is_fraud_predicted: Number(data.is_fraud) === 1,
    };
  }

  const order: Order = {
    order_id: nextOrderId(),
    customer_id: input.customer_id,
    amount: input.amount,
    status: input.status,
    created_at: new Date().toISOString(),
    fraud_risk_score: 0,
  };
  mockOrders.push(order);
  return order;
}

/** Top orders by fraud risk for verification before fulfillment (ML pipeline output). */
export async function getFraudVerificationQueue(limit = 50): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("orders")
      .select("order_id,customer_id,order_total,order_datetime,risk_score,is_fraud")
      .order("risk_score", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((row) => ({
      order_id: row.order_id,
      customer_id: row.customer_id,
      amount: Number(row.order_total),
      status: "placed",
      created_at: row.order_datetime,
      fraud_risk_score: normalizeFraudRisk(Number(row.risk_score)),
      is_fraud_predicted: Number(row.is_fraud) === 1,
    }));
  }

  return [...mockOrders]
    .sort((a, b) => (b.fraud_risk_score ?? 0) - (a.fraud_risk_score ?? 0))
    .slice(0, limit);
}

type CustomerJoin = {
  gender: string | null;
  birthdate: string | null;
  created_at: string | null;
  state: string | null;
  customer_segment: string | null;
  loyalty_tier: string | null;
  is_active: number | null;
};

type OrderWithCustomer = Record<string, unknown> & {
  order_id: number;
  customers: CustomerJoin | CustomerJoin[] | null;
};

function firstCustomer(
  c: CustomerJoin | CustomerJoin[] | null | undefined
): CustomerJoin | null {
  if (!c) return null;
  return Array.isArray(c) ? (c[0] ?? null) : c;
}

function orderToScoringRow(o: OrderWithCustomer): Record<string, unknown> {
  const c = firstCustomer(o.customers);
  if (!c) {
    throw new Error(`Order ${o.order_id} has no linked customer row`);
  }
  return {
    order_id: o.order_id,
    order_datetime: o.order_datetime,
    billing_zip: o.billing_zip,
    shipping_zip: o.shipping_zip,
    shipping_state: o.shipping_state,
    payment_method: o.payment_method,
    device_type: o.device_type,
    ip_country: o.ip_country,
    promo_used: o.promo_used,
    promo_code: o.promo_code,
    order_subtotal: o.order_subtotal,
    shipping_fee: o.shipping_fee,
    tax_amount: o.tax_amount,
    order_total: o.order_total,
    is_fraud: o.is_fraud,
    gender: c.gender,
    birthdate: c.birthdate,
    customer_created_at: c.created_at,
    customer_state: c.state,
    customer_segment: c.customer_segment,
    loyalty_tier: c.loyalty_tier,
    is_active: c.is_active,
  };
}

/** Placeholder when Supabase is off (no DB join). */
function placeholderFraudModelScore(orderId: number): number {
  const seed = ((orderId * 9301 + 49297) % 233280) / 233280;
  return Number(seed.toFixed(3));
}

/** Writes fraud scores to `orders.risk_score` and thresholded labels to `orders.is_fraud`. */
export async function runScoring(): Promise<ScoringRunResult> {
  if (isSupabaseConfigured && supabase) {
    const { data: orders, error } = await supabase.from("orders").select(`
      *,
      customers (
        gender,
        birthdate,
        created_at,
        state,
        customer_segment,
        loyalty_tier,
        is_active
      )
    `);
    if (error) throw error;

    const list = (orders ?? []) as OrderWithCustomer[];
    const scoringRows = list.map((o) => orderToScoringRow(o));
    const { probabilities, threshold } = await scoreOrdersBatch(scoringRows);

    const rows = list.map((o, i) => {
      const p = probabilities[i]!;
      const { customers: _c, ...rest } = o;
      return {
        ...rest,
        risk_score: p,
        is_fraud: p >= threshold ? 1 : 0,
      };
    });

    const chunkSize = 400;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error: upsertErr } = await supabase.from("orders").upsert(chunk, {
        onConflict: "order_id",
      });
      if (upsertErr) throw upsertErr;
    }

    return {
      scored_count: rows.length,
      run_at: new Date().toISOString(),
    };
  }

  mockOrders.forEach((order) => {
    const p = placeholderFraudModelScore(order.order_id);
    order.fraud_risk_score = p;
    order.is_fraud_predicted = p >= 0.5;
  });

  return {
    scored_count: mockOrders.length,
    run_at: new Date().toISOString(),
  };
}
