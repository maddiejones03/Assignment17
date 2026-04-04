import { runScoring } from "@/lib/data";
import { NextResponse } from "next/server";

/** Allow enough time for batched scoring on large tables (Vercel Pro / higher limits). */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await runScoring();
    return NextResponse.redirect(new URL("/warehouse", request.url));
  } catch {
    return NextResponse.redirect(new URL("/warehouse?error=scoring", request.url));
  }
}
