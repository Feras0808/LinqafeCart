import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "../../../../lib/supabase";

function formatAmount(amount: unknown): string {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return "0.00";
  }

  return value.toFixed(2);
}

function calculateHash(
  charge: any,
  secretKey: string
): string {
  const id = charge?.id || "";

  const amount = formatAmount(
    charge?.amount
  );

  const currency =
    charge?.currency || "";

  const gatewayReference =
    charge?.reference?.gateway || "";

  const paymentReference =
    charge?.reference?.payment || "";

  const status =
    charge?.status || "";

  const created =
    charge?.transaction?.created || "";

  const data =
    `x_id${id}` +
    `x_amount${amount}` +
    `x_currency${currency}` +
    `x_gateway_reference${gatewayReference}` +
    `x_payment_reference${paymentReference}` +
    `x_status${status}` +
    `x_created${created}`;

  return crypto
    .createHmac("sha256", secretKey)
    .update(data)
    .digest("hex");
}

function safeCompare(
  a: string,
  b: string
): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    first,
    second
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const secretKey =
      process.env.TAP_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        {
          error:
            "TAP_SECRET_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const charge =
      await request.json();

    console.log(
      "Tap webhook:",
      {
        id: charge?.id,
        status: charge?.status,
      }
    );

    const receivedHash =
      request.headers.get(
        "hashstring"
      );

    if (!receivedHash) {
      return NextResponse.json(
        {
          error:
            "Missing Tap webhook signature.",
        },
        { status: 401 }
      );
    }

    const calculatedHash =
      calculateHash(
        charge,
        secretKey
      );

    if (
      !safeCompare(
        calculatedHash,
        receivedHash
      )
    ) {
      console.error(
        "Invalid Tap webhook signature."
      );

      return NextResponse.json(
        {
          error:
            "Invalid webhook signature.",
        },
        { status: 401 }
      );
    }

    const orderId =
      charge?.reference?.transaction ||
      charge?.metadata?.orderId;

    if (!orderId) {
      return NextResponse.json({
        received: true,
      });
    }

    const supabase =
      getSupabaseAdmin();

    const { data: order, error } =
      await supabase
        .from("orders")
        .select(
          "id, total, payment_status"
        )
        .eq("id", orderId)
        .single();

    if (error || !order) {
      console.error(
        "Order not found:",
        orderId
      );

      return NextResponse.json(
        {
          error: "Order not found.",
        },
        { status: 404 }
      );
    }

    const orderAmount =
      Number(order.total);

    const tapAmount =
      Number(charge.amount);

    if (
      !Number.isFinite(orderAmount) ||
      !Number.isFinite(tapAmount) ||
      Math.abs(
        orderAmount - tapAmount
      ) > 0.001
    ) {
      return NextResponse.json(
        {
          error:
            "Payment amount mismatch.",
        },
        { status: 400 }
      );
    }

    if (
      charge.status === "CAPTURED"
    ) {
      const {
        error: updateError,
      } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method:
            charge?.source
              ?.payment_method ||
            "tap",
          payment_invoice_id:
            String(charge.id),
          payment_url: null,
          order_status:
            "confirmed",
        })
        .eq("id", order.id);

      if (updateError) {
        console.error(
          "Could not update order:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              "Could not update order.",
          },
          { status: 500 }
        );
      }

      console.log(
        `Order ${order.id} marked as PAID`
      );
    }

    return NextResponse.json({
      received: true,
      orderId: order.id,
      chargeId: charge.id,
      status: charge.status,
    });
  } catch (error) {
    console.error(
      "Tap webhook error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}