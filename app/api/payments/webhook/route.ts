import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    const secret = process.env.MYFATOORAH_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });

    const signature = request.headers.get("myfatoorah-signature") || "";
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(raw);
    const data = payload?.Data;
    const transactionStatus = String(data?.TransactionStatus || data?.Transaction?.TransactionStatus || "").toUpperCase();
    const reference = data?.Customer?.Reference || data?.CustomerReference || data?.MetaData?.orderId || data?.UserDefinedField;
    if (reference) {
      const supabase = getSupabaseAdmin();
      const paid = transactionStatus === "SUCCESS" || String(data?.Invoice?.Status || "").toUpperCase() === "PAID";
      await supabase.from("orders").update({
        payment_status: paid ? "paid" : "failed",
        payment_method: data?.PaymentMethod || data?.PaymentMethodName || null,
        ...(paid ? { order_status: "confirmed" } : {}),
      }).eq("id", reference);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook error" }, { status: 500 });
  }
}
