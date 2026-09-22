import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { paymentId, orderId } = await request.json();

    if (!paymentId) {
      return NextResponse.json(
        { error: "Missing Tap payment ID." },
        { status: 400 }
      );
    }

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing order ID." },
        { status: 400 }
      );
    }

    const secretKey = process.env.TAP_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        { error: "TAP_SECRET_KEY is not configured." },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.tap.company/v2/charges/${encodeURIComponent(
        paymentId
      )}`,
      {
        method: "GET",

        headers: {
          Authorization: `Bearer ${secretKey}`,
          Accept: "application/json",
        },
      }
    );

    const charge = await response.json();

    if (!response.ok || !charge?.id) {
      console.error("Tap verification error:", charge);

      return NextResponse.json(
        {
          error:
            charge?.errors?.[0]?.description ||
            charge?.errors?.[0]?.message ||
            charge?.message ||
            "Unable to verify payment.",
        },
        { status: 502 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    /*
     * Make sure this Tap payment belongs
     * to this LinQafé order.
     */
    const tapOrderId =
      charge?.reference?.transaction ||
      charge?.metadata?.orderId;

    if (String(tapOrderId) !== String(order.id)) {
      return NextResponse.json(
        {
          error:
            "This payment does not belong to this order.",
        },
        { status: 400 }
      );
    }

    /*
     * Make sure the amount matches.
     */
    const orderAmount = Number(order.total);
    const tapAmount = Number(charge.amount);

    if (
      !Number.isFinite(orderAmount) ||
      !Number.isFinite(tapAmount) ||
      Math.abs(orderAmount - tapAmount) > 0.001
    ) {
      return NextResponse.json(
        {
          error:
            "Payment amount does not match order amount.",
        },
        { status: 400 }
      );
    }

    const paid = charge.status === "CAPTURED";

    if (paid) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method:
            charge?.source?.payment_method || "tap",
          payment_invoice_id: String(charge.id),
          payment_url: null,
          order_status: "confirmed",
        })
        .eq("id", order.id);

      if (updateError) {
        console.error(
          "Failed to update paid order:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              "Payment succeeded but order update failed.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      paid,
      status: charge.status,
      chargeId: charge.id,
      responseCode:
        charge?.response?.code || null,
      responseMessage:
        charge?.response?.message || null,
    });
  } catch (error) {
    console.error("Tap verification error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify payment.",
      },
      { status: 500 }
    );
  }
}