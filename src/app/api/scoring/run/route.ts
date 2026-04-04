import { runScoring } from "@/lib/data";
import { redirect } from "next/navigation";

/** Allow enough time for batched scoring on large tables (Vercel Pro / higher limits). */
export const maxDuration = 60;

export async function POST() {
  try {
    await runScoring();
  } catch (e) {
    console.error("runScoring failed:", e);
    redirect("/warehouse?error=scoring_failed");
  }
  redirect("/warehouse?scored=1");
}
