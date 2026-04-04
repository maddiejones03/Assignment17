/** Display fraud probability whether DB stores 0–1 or 0–100. */
export function formatFraudPercent(riskScore: number | undefined): string {
  const v = Number(riskScore);
  if (!Number.isFinite(v)) return "—";
  const pct = v > 1 ? v : v * 100;
  return `${Math.min(100, Math.max(0, pct)).toFixed(1)}%`;
}
