import { NextRequest, NextResponse } from "next/server";
import { cookieName, createAdminToken } from "../../../../lib/admin-auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, createAdminToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}
