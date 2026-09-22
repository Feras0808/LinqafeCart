import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing orderId" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order lookup error:", orderError);

      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    if (order.payment_status === "paid") {
      return NextResponse.json(
        { error: "This order has already been paid." },
        { status: 400 }
      );
    }

    const secretKey = process.env.TAP_SECRET_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!secretKey) {
      return NextResponse.json(
        { error: "TAP_SECRET_KEY is not configured." },
        { status: 500 }
      );
    }

    if (!siteUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL is not configured." },
        { status: 500 }
      );
    }

    const amount = Number(order.total);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid order amount." },
        { status: 400 }
      );
    }

    const rawPhone = String(order.customer_phone || "");

    const phone = rawPhone
      .replace(/\D/g, "")
      .replace(/^974/, "")
      .slice(-8);

    const tapPayload = {
      amount: Number(amount.toFixed(2)),
      currency: "QAR",

      customer_initiated: true,
      threeDSecure: true,
      save_card: false,

      description: `LinQafé Order ${order.order_number}`,

      reference: {
        transaction: String(order.id),
        order: String(order.order_number),
      },

      metadata: {
        orderId: String(order.id),
        orderNumber: String(order.order_number),
      },

      customer: {
        first_name: String(
          order.customer_name || "LinQafé Customer"
        ),

        email: order.customer_email || undefined,

        phone: {
          country_code: "974",
          number: phone,
        },
      },

      source: {
        id: "src_all",
      },

      post: {
        url: `${siteUrl}/api/payments/webhook`,
      },

      redirect: {
        url: `${siteUrl}/?payment=tap&order=${encodeURIComponent(
          String(order.id)
        )}`,
      },
    };

    console.log("Creating Tap charge:", {
      orderId: order.id,
      orderNumber: order.order_number,
      amount,
      currency: "QAR",
    });

    const response = await fetch(
      "https://api.tap.company/v2/charges/",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify(tapPayload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Tap API error:", result);

      return NextResponse.json(
        {
          error:
            result?.errors?.[0]?.description ||
            result?.errors?.[0]?.message ||
            result?.message ||
            "Tap could not create the payment.",

          tapResponse: result,
        },
        { status: 502 }
      );
    }

    const paymentUrl = result?.transaction?.url;

    if (!paymentUrl) {
      console.error("Tap response:", result);

      return NextResponse.json(
        {
          error: "Tap did not return a payment URL.",
          tapResponse: result,
        },
        { status: 502 }
      );
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "pending",
        payment_invoice_id: String(result.id),
        payment_url: paymentUrl,
      })
      .eq("id", order.id);

    if (updateError) {
      console.error(
        "Failed to save Tap payment:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Payment was created but the order could not be updated.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentUrl,
      chargeId: result.id,
      status: result.status,
    });
  } catch (error) {
    console.error("Tap create payment error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create payment.",
      },
      { status: 500 }
    );
  }
}