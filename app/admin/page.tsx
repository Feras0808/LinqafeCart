"use client";

import { useEffect, useState } from "react";

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

const statusLabels: Record<string, string> = {
  new: "NEW",
  confirmed: "CONFIRMED",
  preparing: "PREPARING",
  ready: "READY",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};

const statusIcons: Record<string, string> = {
  new: "◷",
  confirmed: "✓",
  preparing: "◉",
  ready: "✓",
  completed: "✓",
  cancelled: "×",
};

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const meResponse = await fetch("/api/admin/me");
      const me = await meResponse.json();

      if (!me.authenticated) {
        setLoading(false);
        return;
      }

      setAuthenticated(true);

      const response = await fetch("/api/orders");
      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Unable to load orders"
        );
      } else {
        setOrders(data.orders || []);
        setError("");
      }
    } catch {
      setError("Unable to load orders");
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!authenticated) return;

    const interval = setInterval(() => {
      load();
    }, 15000);

    return () => clearInterval(interval);
  }, [authenticated]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch(
        "/api/admin/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password,
          }),
        }
      );

      if (!response.ok) {
        setError("Incorrect password");
        return;
      }

      setPassword("");
      setAuthenticated(true);
      setLoading(true);

      await load();
    } catch {
      setError("Unable to sign in");
    }
  };

  const updateStatus = async (
    id: string,
    order_status: string
  ) => {
    try {
      const response = await fetch(
        `/api/orders/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            order_status,
          }),
        }
      );

      if (response.ok) {
        await load();
      } else {
        const data = await response
          .json()
          .catch(() => ({}));

        setError(
          data.error ||
            "Unable to update order status"
        );
      }
    } catch {
      setError("Unable to update order status");
    }
  };

  const markCashAsPaid = async (id: string) => {
    try {
      const response = await fetch(
        `/api/orders/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payment_status: "paid",
          }),
        }
      );

      if (response.ok) {
        await load();
      } else {
        const data = await response
          .json()
          .catch(() => ({}));

        setError(
          data.error ||
            "Unable to mark cash payment as paid"
        );
      }
    } catch {
      setError(
        "Unable to mark cash payment as paid"
      );
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", {
      method: "POST",
    });

    setAuthenticated(false);
  };

  const today = new Date().toDateString();

  const todayOrders = orders.filter(
    (order) =>
      new Date(
        order.created_at
      ).toDateString() === today
  );

  const sales = todayOrders
    .filter(
      (order) =>
        order.payment_status === "paid"
    )
    .reduce(
      (sum, order) =>
        sum + Number(order.total),
      0
    );

  const open = orders.filter(
    (order) =>
      ![
        "completed",
        "cancelled",
      ].includes(order.order_status)
  );

  const paid = orders.filter(
    (order) =>
      order.payment_status === "paid"
  ).length;

  /*
   * CASH ORDERS
   *
   * Cash is always unpaid until the staff
   * explicitly marks the order as paid.
   *
   * This also fixes older cash orders that
   * may have payment_status = "pending".
   */
  const getPaymentLabel = (order: Order) => {
    if (
      order.payment_method === "cash" &&
      order.payment_status !== "paid"
    ) {
      return "UNPAID";
    }

    if (order.payment_status === "paid") {
      return "PAID";
    }

    if (
      order.payment_status === "pending"
    ) {
      return "PENDING";
    }

    return order.payment_status.toUpperCase();
  };

  const getPaymentClass = (order: Order) => {
    const label =
      getPaymentLabel(order);

    if (label === "PAID") {
      return "payment-paid";
    }

    if (label === "UNPAID") {
      return "payment-unpaid";
    }

    return "payment-pending";
  };

  const getPaymentIcon = (order: Order) => {
    const label =
      getPaymentLabel(order);

    if (label === "PAID") {
      return "▣";
    }

    if (label === "UNPAID") {
      return "▣";
    }

    return "⌛";
  };

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <div className="admin-loading">
            Loading…
          </div>
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="admin-page">
        <form
          className="admin-login"
          onSubmit={login}
        >
          <h1>LinQafé Admin</h1>

          <p>Staff sign in</p>

          <input
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            placeholder="Admin password"
            autoFocus
          />

          <button type="submit">
            Sign in
          </button>

          {error && (
            <span>{error}</span>
          )}
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">

        {/* HEADER */}
        <header className="admin-head">
          <div>
            <h1>LinQafé Orders</h1>
            <p>
              Live café ordering dashboard
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
          >
            Sign out
          </button>
        </header>

        {/* ERROR */}
        {error && (
          <div className="admin-error">
            {error}
          </div>
        )}

        {/* STATISTICS */}
        <section className="stats">

          <div>
            <span>
              Today's orders
            </span>

            <strong>
              {todayOrders.length}
            </strong>
          </div>

          <div>
            <span>
              Today's sales
            </span>

            <strong>
              {sales.toFixed(2)} QAR
            </strong>
          </div>

          <div>
            <span>
              Open orders
            </span>

            <strong>
              {open.length}
            </strong>
          </div>

          <div>
            <span>
              Paid orders
            </span>

            <strong>
              {paid}
            </strong>
          </div>

        </section>

        {/* ORDERS */}
        <section className="orders-list">

          <h2>Orders</h2>

          {orders.length === 0 ? (
            <div className="empty">
              No orders yet.
            </div>
          ) : (
            orders.map((order) => {

              const paymentLabel =
                getPaymentLabel(order);

              const paymentClass =
                getPaymentClass(order);

              const paymentIcon =
                getPaymentIcon(order);

              return (
                <article
                  className="order-card"
                  key={order.id}
                >

                  {/* TOP */}
                  <div className="order-top">

                    <div>
                      <strong>
                        {order.order_number}
                      </strong>

                      <span>
                        {new Date(
                          order.created_at
                        ).toLocaleString()}
                      </span>
                    </div>

                    <strong>
                      {Number(
                        order.total
                      ).toFixed(2)} QAR
                    </strong>

                  </div>

                  {/* CUSTOMER */}
                  <div className="order-customer">

                    <b>
                      {order.customer_name}
                    </b>

                    <span>
                      {order.customer_phone}
                    </span>

                    <span>
                      {order.order_type}

                      {order.table_number
                        ? ` · Table ${order.table_number}`
                        : ""}
                    </span>

                  </div>

                  {/* ITEMS */}
                  <div className="order-items">

                    {order.items.map(
                      (item, i) => (
                        <div
                          className="admin-item"
                          key={`${item.name}-${i}`}
                        >

                          <img
                            src={`/images/${item.image}`}
                            alt=""
                          />

                          <span>
                            {item.quantity} ×{" "}
                            {item.name}
                          </span>

                          <b>
                            {(
                              item.price *
                              item.quantity
                            ).toFixed(2)}
                          </b>

                        </div>
                      )
                    )}

                  </div>

                  {/* NOTES */}
                  {order.notes && (
                    <p className="order-notes">
                      <b>Note:</b>{" "}
                      {order.notes}
                    </p>
                  )}

                  {/* BOTTOM */}
                  <div className="order-bottom">

                    {/* STATUS BADGES */}
                    <div className="order-statuses">

                      {/* ORDER STATUS */}
                      <div className="status-group">

                        <span className="status-title">
                          ORDER STATUS:
                        </span>

                        <span
                          className={`order-status-badge status-${order.order_status}`}
                        >
                          <span className="status-icon">
                            {
                              statusIcons[
                                order.order_status
                              ] || "•"
                            }
                          </span>

                          {
                            statusLabels[
                              order.order_status
                            ] ||
                            order.order_status.toUpperCase()
                          }
                        </span>

                      </div>

                      {/* DIVIDER */}
                      <span className="status-divider">
                        |
                      </span>

                      {/* PAYMENT STATUS */}
                      <div className="status-group">

                        <span className="status-title">
                          PAYMENT STATUS:
                        </span>

                        <span
                          className={`payment-status-badge ${paymentClass}`}
                        >
                          <span className="status-icon">
                            {paymentIcon}
                          </span>

                          {paymentLabel}

                          {order.payment_method && (
                            <>
                              {" · "}
                              {order.payment_method.toUpperCase()}
                            </>
                          )}

                        </span>

                      </div>

                    </div>

                    {/* CONTROLS */}
                    <div className="order-controls">

                      <select
                        value={
                          order.order_status
                        }
                        onChange={(e) =>
                          updateStatus(
                            order.id,
                            e.target.value
                          )
                        }
                      >

                        {statuses.map(
                          (status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {status}
                            </option>
                          )
                        )}

                      </select>

                      {/* CASH PAYMENT */}
                      {order.payment_method ===
                        "cash" &&
                        order.payment_status !==
                          "paid" && (
                          <button
                            type="button"
                            className="cash-paid-btn"
                            onClick={() =>
                              markCashAsPaid(
                                order.id
                              )
                            }
                          >
                            Mark Cash as Paid
                          </button>
                        )}

                      {/* PRINT */}
                      <button
                        type="button"
                        className="print-btn"
                        onClick={() =>
                          window.print()
                        }
                      >
                        Print receipt
                      </button>

                    </div>

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