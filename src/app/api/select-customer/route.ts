import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const customerId = request.nextUrl.searchParams.get("customer_id");
  if (!customerId) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set("selected_customer_id", customerId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  });
  return response;
}
