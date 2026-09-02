"use client";

import { useEffect, useMemo, useState } from "react";

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  order_type: string;
  table_number: string | null;
  notes: string | null;
  items: {
    name: string;
    arName: string;
    image: string;
    price: number;
    quantity: number;
  }[];
  total: number;
  payment_status: string;
  payment_method: string | null;
  order_status: string;
  created_at: string;
};

const statuses = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyOrderId, setBusyOrderId] = useState("");

  const load = async () => {
    try {
      const meResponse = await fetch("/api/admin/me", {
        cache: "no-store",
      });
      const me = await meResponse.json();

      if (!me.authenticated) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      setAuthenticated(true);

      const response = await fetch("/api/orders", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load orders");
      }

      setOrders(data.orders || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!authenticated) return;

    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [authenticated]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      setError("Incorrect password");
      return;
    }

    setPassword("");
    setAuthenticated(true);
    setLoading(true);
    await load();
  };

  const updateStatus = async (id: string, orderStatus: string) => {
    setBusyOrderId(id);
    setError("");

    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_status: orderStatus }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to update order status");
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order status");
    } finally {
      setBusyOrderId("");
    }
  };

  const markCashAsPaid = async (id: string) => {
    setBusyOrderId(id);
    setError("");

    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_status: "paid" }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to mark cash payment as paid");
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to mark cash payment as paid"
      );
    } finally {
      setBusyOrderId("");
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setOrders([]);
  };

  const todayOrders = useMemo(() => {
    const today = new Date();
    return orders.filter((order) => {
      const date = new Date(order.created_at);
      return date.toDateString() === today.toDateString();
    });
  }, [orders]);

  const todaySales = useMemo(() => {
    return todayOrders
      .filter((order) => order.payment_status === "paid")
      .reduce((sum, order) => sum + Number(order.total), 0);
  }, [todayOrders]);

  const openOrders = useMemo(() => {
    return orders.filter(
      (order) => !["completed", "cancelled"].includes(order.order_status)
    );
  }, [orders]);

  const paidOrders = useMemo(() => {
    return orders.filter((order) => order.payment_status === "paid");
  }, [orders]);

  const getPaymentLabel = (order: Order) => {
    if (order.payment_status === "paid") return "PAID";
    if (order.payment_method === "cash") return "UNPAID";
    if (order.payment_status === "pending") return "PENDING";
    return order.payment_status.toUpperCase();
  };

  const getPaymentClass = (order: Order) => {
    if (order.payment_status === "paid") return "paid";
    if (order.payment_method === "cash") return "unpaid";
    return "pending";
  };

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-shell">Loading…</div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="admin-page">
        <form className="admin-login" onSubmit={login}>
          <h1>LinQafé Admin</h1>
          <p>Staff sign in</p>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Admin password"
            autoFocus
          />
          <button type="submit">Sign in</button>
          {error && <span>{error}</span>}
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-head">
          <div>
            <h1>LinQafé Orders</h1>
            <p>Live café ordering dashboard</p>
          </div>
          <button onClick={logout}>Sign out</button>
        </header>

        {error && <div className="admin-error">{error}</div>}

        <section className="stats">
          <div>
            <span>Today's orders</span>
            <strong>{todayOrders.length}</strong>
          </div>
          <div>
            <span>Today's sales</span>
            <strong>{todaySales.toFixed(2)} QAR</strong>
          </div>
          <div>
            <span>Open orders</span>
            <strong>{openOrders.length}</strong>
          </div>
          <div>
            <span>Paid orders</span>
            <strong>{paidOrders.length}</strong>
          </div>
        </section>

        <section className="orders-list">
          <h2>Orders</h2>

          {orders.length === 0 ? (
            <div className="empty">No orders yet.</div>
          ) : (
            orders.map((order) => {
              const isCashUnpaid =
                order.payment_method === "cash" &&
                order.payment_status !== "paid";

              const isBusy = busyOrderId === order.id;

              return (
                <article className="order-card" key={order.id}>
                  <div className="order-top">
                    <div>
                      <strong>{order.order_number}</strong>
                      <span>
                        {new Date(order.created_at).toLocaleString()}
                      </span>
                    </div>
                    <strong>
                      {Number(order.total).toFixed(2)} QAR
                    </strong>
                  </div>

                  <div className="order-customer">
                    <b>{order.customer_name}</b>
                    <span>{order.customer_phone}</span>
                    <span>
                      {order.order_type}
                      {order.table_number
                        ? ` · Table ${order.table_number}`
                        : ""}
                    </span>
                  </div>

                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div
                        className="admin-item"
                        key={`${item.name}-${index}`}
                      >
                        <img src={`/images/${item.image}`} alt="" />
                        <span>
                          {item.quantity} × {item.name}
                        </span>
                        <b>
                          {(item.price * item.quantity).toFixed(2)}
                        </b>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <p className="order-notes">
                      <b>Note:</b> {order.notes}
                    </p>
                  )}

                  <div className="order-bottom">
                    <div className="order-statuses">
                      <span className={`order-status-badge status-${order.order_status}`}>
                        ORDER: {order.order_status.toUpperCase()}
                      </span>

                      <span className={getPaymentClass(order)}>
                        PAYMENT: {getPaymentLabel(order)}
                        {order.payment_method
                          ? ` · ${order.payment_method.toUpperCase()}`
                          : ""}
                      </span>
                    </div>

                    <select
                      value={order.order_status}
                      disabled={isBusy}
                      onChange={(event) =>
                        updateStatus(order.id, event.target.value)
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    {isCashUnpaid && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => markCashAsPaid(order.id)}
                      >
                        {isBusy ? "Updating…" : "Mark Cash as Paid"}
                      </button>
                    )}

                    <button type="button" onClick={() => window.print()}>
                      Print receipt
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
