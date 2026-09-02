"use client";

import { useEffect, useMemo, useState } from "react";

type Order = {
  id: string; order_number: string; customer_name: string; customer_phone: string;
  order_type: string; table_number: string | null; notes: string | null;
  items: { name: string; arName: string; image: string; price: number; quantity: number }[];
  total: number; payment_status: string; payment_method: string | null; order_status: string; created_at: string;
};

const statuses = ["new", "confirmed", "preparing", "ready", "completed", "cancelled"];

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    const me = await fetch("/api/admin/me").then(r => r.json());
    if (!me.authenticated) { setLoading(false); return; }
    setAuthenticated(true);
    const r = await fetch("/api/orders");
    const data = await r.json();
    if (!r.ok) setError(data.error || "Unable to load orders"); else setOrders(data.orders || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!authenticated) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [authenticated]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (!r.ok) { setError("Incorrect password"); return; }
    setPassword(""); setAuthenticated(true); load();
  };

  const updateStatus = async (id: string, order_status: string) => {
    const r = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_status }) });
    if (r.ok) load();
  };

  const markCashAsPaid = async (id: string) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_status: "paid" }),
    });
    if (r.ok) load();
    else {
      const data = await r.json().catch(() => ({}));
      setError(data.error || "Unable to mark cash payment as paid");
    }
  };

  const logout = async () => { await fetch("/api/admin/logout", { method: "POST" }); setAuthenticated(false); };
  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);
  const sales = todayOrders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + Number(o.total), 0);
  const open = orders.filter(
    (o) => !["completed", "cancelled"].includes(o.order_status)
  );
  const paid = orders.filter((o) => o.payment_status === "paid").length;

  // Cash orders are always unpaid until staff explicitly marks them as paid.
  // This also makes older cash orders that were accidentally stored as
  // "pending" display correctly in the dashboard.
  const paymentLabel = (order: Order) => {
    if (order.payment_method === "cash" && order.payment_status !== "paid") {
      return "UNPAID";
    }
    if (order.payment_status === "paid") return "PAID";
    if (order.payment_status === "pending") return "PENDING";
    return order.payment_status.toUpperCase();
  };

  const paymentClass = (order: Order) =>
    paymentLabel(order) === "PAID" ? "paid" : paymentLabel(order) === "UNPAID" ? "unpaid" : "pending";

  if (loading) return <main className="admin-page"><div className="admin-shell">Loading…</div></main>;
  if (!authenticated) return <main className="admin-page"><form className="admin-login" onSubmit={login}><h1>LinQafé Admin</h1><p>Staff sign in</p><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Admin password" autoFocus/><button>Sign in</button>{error&&<span>{error}</span>}</form></main>;

  return <main className="admin-page"><div className="admin-shell">
    <header className="admin-head"><div><h1>LinQafé Orders</h1><p>Live café ordering dashboard</p></div><button onClick={logout}>Sign out</button></header>
    <section className="stats"><div><span>Today's orders</span><strong>{todayOrders.length}</strong></div><div><span>Today's sales</span><strong>{sales.toFixed(2)} QAR</strong></div><div><span>Open orders</span><strong>{open.length}</strong></div><div><span>Paid orders</span><strong>{paid}</strong></div></section>
    <section className="orders-list"><h2>Orders</h2>{orders.length===0?<div className="empty">No orders yet.</div>:orders.map(order=><article className="order-card" key={order.id}>
      <div className="order-top"><div><strong>{order.order_number}</strong><span>{new Date(order.created_at).toLocaleString()}</span></div><strong>{Number(order.total).toFixed(2)} QAR</strong></div>
      <div className="order-customer"><b>{order.customer_name}</b><span>{order.customer_phone}</span><span>{order.order_type}{order.table_number ? ` · Table ${order.table_number}` : ""}</span></div>
      <div className="order-items">{order.items.map((item,i)=><div className="admin-item" key={`${item.name}-${i}`}><img src={`/images/${item.image}`} alt=""/><span>{item.quantity} × {item.name}</span><b>{(item.price*item.quantity).toFixed(2)}</b></div>)}</div>
      {order.notes && <p className="order-notes"><b>Note:</b> {order.notes}</p>}
      <div className="order-bottom"><div className="order-statuses"><span className={`order-status-badge status-${order.order_status}`}>ORDER: {order.order_status.toUpperCase()}</span><span className={paymentClass(order)}>PAYMENT: {paymentLabel(order)} {order.payment_method ? `· ${order.payment_method.toUpperCase()}` : ""}</span></div><select value={order.order_status} onChange={e=>updateStatus(order.id,e.target.value)}>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select>{order.payment_method === "cash" && order.payment_status !== "paid" && (
        <button onClick={()=>markCashAsPaid(order.id)}>Mark Cash as Paid</button>
      )}
      <button onClick={()=>window.print()}>Print receipt</button></div>
    </article>)}</section>
  </div></main>;
}
