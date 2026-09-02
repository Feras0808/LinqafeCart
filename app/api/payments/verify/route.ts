import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { paymentId, orderId } = await request.json();
    if (!paymentId || !orderId) return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    const apiKey = process.env.MYFATOORAH_API_KEY;
    const apiUrl = process.env.MYFATOORAH_API_URL || "https://apitest.myfatoorah.com";
    if (!apiKey) return NextResponse.json({ error: "Payment gateway is not configured" }, { status: 500 });
    const r = await fetch(`${apiUrl}/v3/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    const result = await r.json();
    if (!r.ok || !result?.IsSuccess) return NextResponse.json({ error: result?.Message || "Unable to verify payment" }, { status: 502 });
    const data = result.Data;
    const paid = String(data?.Invoice?.Status || "").toUpperCase() === "PAID" || String(data?.Transaction?.Status || "").toUpperCase() === "SUCCESS";
    const supabase = getSupabaseAdmin();
    if (paid) {
      await supabase.from("orders").update({ payment_status: "paid", payment_method: data?.Transaction?.PaymentMethod || null, order_status: "confirmed" }).eq("id", orderId);
    }
    return NextResponse.json({ paid });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify payment" }, { status: 500 });
  }
}
