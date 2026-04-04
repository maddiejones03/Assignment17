/**
 * Runtime data: Supabase when NEXT_PUBLIC_SUPABASE_* are set, else mock stores.
 * SQLite `shop.db` is only for training/migration scripts, not read by this module.
 */
import { mockCustomers, mockOrders, nextOrderId } from "@/lib/mock-data";
import { fetchFraudProbabilities } from "@/lib/ml-predict";
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

/** Approximate risk_score used when creating placeholder orders (not from ML). */
function statusToRiskScore(status: Order["status"]): number {
  switch (status) {
    case "late":
      return 0.85;
    case "shipped":
      return 0.55;
    case "placed":
      return 0.35;
    default:
      return 0.15;
  }
}

type CustomerScoringEmbed = {
  gender?: string | null;
  birthdate?: string | null;
  created_at?: string | null;
  customer_created_at?: string | null;
  state?: string | null;
  customer_state?: string | null;
  customer_segment?: string | null;
  loyalty_tier?: string | null;
  is_active?: number | null;
} | null;

type OrderScoringRow = {
  order_id: number;
  customer_id: number;
  order_datetime: string;
  billing_zip: string | null;
  shipping_zip: string | null;
  shipping_state: string | null;
  payment_method: string;
  device_type: string;
  ip_country: string;
  promo_used: number;
  promo_code: string | null;
  order_subtotal: number;
  shipping_fee: number;
  tax_amount: number;
  order_total: number;
  risk_score: number | null;
  customers: CustomerScoringEmbed;
};

/** Maps joined Supabase row to the JSON contract expected by inference.py / the training notebook. */
function orderRowToMlPayload(row: OrderScoringRow): Record<string, unknown> | null {
  const c = row.customers;
  if (!c) return null;
  const customerCreated = c.customer_created_at ?? c.created_at;
  const customerState = c.customer_state ?? c.state;
  if (
    customerCreated == null ||
    customerCreated === "" ||
    customerState == null ||
    customerState === ""
  ) {
    return null;
  }
  return {
    order_datetime: row.order_datetime,
    billing_zip: row.billing_zip ?? "",
    shipping_zip: row.shipping_zip ?? "",
    shipping_state: row.shipping_state ?? "",
    payment_method: row.payment_method,
    device_type: row.device_type,
    ip_country: row.ip_country,
    promo_used: row.promo_used,
    promo_code: row.promo_code,
    order_subtotal: row.order_subtotal,
    shipping_fee: row.shipping_fee,
    tax_amount: row.tax_amount,
    order_total: row.order_total,
    gender: c.gender ?? "",
    birthdate: c.birthdate ?? "",
    customer_created_at: customerCreated,
    customer_state: customerState,
    customer_segment: c.customer_segment ?? "",
    loyalty_tier: c.loyalty_tier ?? "",
    is_active: c.is_active ?? 0,
  };
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
    const riskScore = statusToRiskScore(input.status);

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

/** Placeholder when Supabase is off (no DB join). */
function placeholderFraudModelScore(orderId: number): number {
  const seed = ((orderId * 9301 + 49297) % 233280) / 233280;
  return Number(seed.toFixed(3));
}

/** Writes fraud scores to `orders.risk_score` (main branch: `/api/ml_predict` when configured). */
export async function runScoring(): Promise<ScoringRunResult> {
  if (isSupabaseConfigured && supabase) {
    const { data: rows, error } = await supabase.from("orders").select(`
        order_id,
        customer_id,
        order_datetime,
        billing_zip,
        shipping_zip,
        shipping_state,
        payment_method,
        device_type,
        ip_country,
        promo_used,
        promo_code,
        order_subtotal,
        shipping_fee,
        tax_amount,
        order_total,
        risk_score,
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

    const ordersList = (rows ?? []) as OrderScoringRow[];
    const mlPayloads: Record<string, unknown>[] = [];
    const mlOrderIds: number[] = [];
    for (const row of ordersList) {
      const payload = orderRowToMlPayload(row);
      if (payload) {
        mlPayloads.push(payload);
        mlOrderIds.push(row.order_id);
      }
    }

    const mlProbs =
      mlPayloads.length > 0 ? await fetchFraudProbabilities(mlPayloads) : null;
    const probByOrderId = new Map<number, number>();
    if (mlProbs && mlProbs.length === mlPayloads.length) {
      mlOrderIds.forEach((id, idx) => {
        probByOrderId.set(id, mlProbs[idx]!);
      });
    }

    let scoredCount = 0;
    for (const o of ordersList) {
      const fromMl = probByOrderId.get(o.order_id);
      const riskScore =
        fromMl !== undefined ? fromMl : placeholderFraudModelScore(o.order_id);

      const { error: updateError } = await supabase
        .from("orders")
        .update({ risk_score: riskScore })
        .eq("order_id", o.order_id);
      if (!updateError) scoredCount += 1;
    }

    return {
      scored_count: scoredCount,
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
