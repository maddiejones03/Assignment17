import { runScoring } from "@/lib/data";
import { redirect } from "next/navigation";

export async function POST() {
  await runScoring();
  redirect("/warehouse");
}
