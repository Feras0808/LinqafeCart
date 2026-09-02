import crypto from "crypto";
import { NextRequest } from "next/server";

const cookieName = "linqafe_admin";
function secret() { return process.env.ADMIN_SECRET || "change-this-secret"; }
function sign(value: string) { return crypto.createHmac("sha256", secret()).update(value).digest("hex"); }

export function createAdminToken() {
  const value = `linqafe:${Date.now()}`;
  return `${value}.${sign(value)}`;
}

export function isAdminRequest(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return false;
  const [value, signature] = token.split(".");
  if (!value || !signature) return false;
  const expected = sign(value);
  if (signature.length != expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export { cookieName };
