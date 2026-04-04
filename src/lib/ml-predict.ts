type MlRow = Record<string, unknown>;

function mlPredictUrl(): string | null {
  const explicit = process.env.ML_PREDICT_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    const host = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    return `${host.replace(/\/$/, "")}/api/ml_predict`;
  }
  return null;
}

/** Returns probabilities in the same order as rows, or null if ML is unavailable or errors. */
export async function fetchFraudProbabilities(rows: MlRow[]): Promise<number[] | null> {
  if (rows.length === 0) return [];
  const url = mlPredictUrl();
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
      cache: "no-store",
    });
    if (res.status === 503) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { probabilities?: unknown };
    if (!Array.isArray(data.probabilities)) return null;
    const probs = data.probabilities.filter((x): x is number => typeof x === "number");
    if (probs.length !== rows.length) return null;
    return probs;
  } catch {
    return null;
  }
}
