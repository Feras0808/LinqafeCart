import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { isAdminRequest } from "../../../../lib/admin-auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const { order_status } = await request.json();
    const allowed = ["new", "confirmed", "preparing", "ready", "completed", "cancelled"];
    if (!allowed.includes(order_status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("orders").update({ order_status }).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ order: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update order" }, { status: 500 });
  }
}
