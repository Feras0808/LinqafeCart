import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
    if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const apiKey = process.env.MYFATOORAH_API_KEY;
    const apiUrl = process.env.MYFATOORAH_API_URL || "https://apitest.myfatoorah.com";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!apiKey || !siteUrl) return NextResponse.json({ error: "Payment gateway is not configured" }, { status: 500 });

    const response = await fetch(`${apiUrl}/v3/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        Order: { Amount: Number(order.total) },
        Customer: {
          Reference: order.id,
          Name: order.customer_name,
          Mobile: { CountryCode: "+974", Number: order.customer_phone.replace(/\D/g, "").slice(-8) },
        },
        IntegrationUrls: { Redirection: `${siteUrl}/?payment=success&order=${order.id}` },
        NotificationOption: "LINK",
        Language: "EN",
        MetaData: { orderId: order.id, orderNumber: order.order_number },
        DisplayPaymentMethods: ["card", "applepay", "googlepay"],
      }),
    });
    const result = await response.json();
    if (!response.ok || !result?.IsSuccess) return NextResponse.json({ error: result?.Message || "Payment gateway error" }, { status: 502 });

    await supabase.from("orders").update({ payment_invoice_id: String(result.Data.InvoiceId), payment_url: result.Data.PaymentURL }).eq("id", order.id);
    return NextResponse.json({ paymentUrl: result.Data.PaymentURL, invoiceId: result.Data.InvoiceId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start payment" }, { status: 500 });
  }
}
