import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

export type FraudBatchResult = {
  probabilities: number[];
  threshold: number;
};

/** Where `fraud_model.joblib`, `threshold.json`, and `feature_order.json` live (checked in order). */
export function resolveFraudModelDir(): string | null {
  const env = process.env.FRAUD_MODEL_DIR;
  if (env) {
    const resolved = path.resolve(env);
    if (fs.existsSync(path.join(resolved, "fraud_model.joblib"))) return resolved;
  }
  const cwd = process.cwd();
  const inModel = path.join(/* turbopackIgnore: true */ cwd, "model", "fraud_model.joblib");
  const inRoot = path.join(/* turbopackIgnore: true */ cwd, "fraud_model.joblib");
  if (fs.existsSync(inModel)) return path.join(/* turbopackIgnore: true */ cwd, "model");
  if (fs.existsSync(inRoot)) return cwd;
  return null;
}

function scorerScriptPath(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "python", "score_fraud_batch.py");
}

/** Same Vercel deployment: Python function at /api/fraud_score (see api/fraud_score.py). */
function resolveVercelPythonScorerUrl(): string | undefined {
  if (process.env.VERCEL !== "1" || !process.env.VERCEL_URL) {
    return undefined;
  }
  const host = process.env.VERCEL_URL;
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return `${host.replace(/\/$/, "")}/api/fraud_score`;
  }
  if (host.includes("localhost") || host.startsWith("127.")) {
    return `http://${host}/api/fraud_score`;
  }
  return `https://${host}/api/fraud_score`;
}

/**
 * Runs the notebook-exported sklearn pipeline on a batch of feature rows.
 * - **Vercel:** POST to `/api/fraud_score` (auto when `VERCEL=1`) or override with `FRAUD_SCORING_URL`.
 * - **Local dev:** subprocess `python3 python/score_fraud_batch.py` (set `PYTHON_PATH` to override).
 */
export async function scoreOrdersBatch(
  rows: Record<string, unknown>[]
): Promise<FraudBatchResult> {
  const remote = process.env.FRAUD_SCORING_URL ?? resolveVercelPythonScorerUrl();
  if (remote) {
    const res = await fetch(remote, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Fraud scorer HTTP ${res.status}: ${t.slice(0, 500)}`);
    }
    const parsed = (await res.json()) as FraudBatchResult & { error?: string | null };
    if (parsed.error) {
      throw new Error(`Fraud scoring service: ${parsed.error}`);
    }
    return { probabilities: parsed.probabilities, threshold: parsed.threshold };
  }

  const modelDir = resolveFraudModelDir();
  if (!modelDir) {
    throw new Error(
      "Missing fraud_model.joblib. Add it (and threshold.json, feature_order.json) to the repo root or model/, set FRAUD_MODEL_DIR, or set FRAUD_SCORING_URL. On Vercel, commit those files or use a remote scorer URL."
    );
  }

  const script = scorerScriptPath();
  if (!fs.existsSync(script)) {
    throw new Error(`Missing scorer script: ${script}`);
  }

  const bin = process.env.PYTHON_PATH || "python3";
  const payload = JSON.stringify({ rows, model_dir: modelDir });
  const child = spawnSync(bin, [script], {
    input: payload,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (child.error) throw child.error;
  if (child.status !== 0) {
    const errText = [child.stderr, child.stdout].filter(Boolean).join("\n");
    throw new Error(`Python scorer exited ${child.status}: ${errText || "(no output)"}`);
  }

  const parsed = JSON.parse(child.stdout) as FraudBatchResult & { error?: string | null };
  if (parsed.error) {
    throw new Error(`Fraud scoring: ${parsed.error}`);
  }
  if (!parsed.probabilities || parsed.probabilities.length !== rows.length) {
    throw new Error(
      `Fraud scoring returned ${parsed.probabilities?.length ?? 0} scores for ${rows.length} rows`
    );
  }
  return {
    probabilities: parsed.probabilities,
    threshold: parsed.threshold,
  };
}
