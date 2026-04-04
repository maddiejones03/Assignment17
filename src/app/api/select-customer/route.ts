import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const customerId = request.nextUrl.searchParams.get("customer_id");
    if (!customerId) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const id = Number(customerId);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "invalid_customer_id" }, { status: 400 });
    }

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set("selected_customer_id", String(Math.trunc(id)), {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
