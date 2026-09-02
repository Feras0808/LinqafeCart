import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { randomUUID } from "crypto";
import { isAdminRequest } from "../../../lib/admin-auth";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, customerPhone, orderType, tableNumber, notes, items, total } = body;
    if (!customerName || !customerPhone || !Array.isArray(items) || !items.length || !total) {
      return NextResponse.json({ error: "Missing required order details" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const orderNumber = `LQ-${Date.now().toString().slice(-6)}`;
    const order = {
      id: randomUUID(),
      order_number: orderNumber,
      customer_name: customerName,
      customer_phone: customerPhone,
      order_type: orderType === "dine-in" ? "dine-in" : "pickup",
      table_number: tableNumber || null,
      notes: notes || null,
      items,
      total: Number(total),
      payment_status: "pending",
      payment_method: null,
      order_status: "new",
    };

    const { data, error } = await supabase.from("orders").insert(order).select().single();
    if (error) throw error;
    return NextResponse.json({ order: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create order" }, { status: 500 });
  }
}
