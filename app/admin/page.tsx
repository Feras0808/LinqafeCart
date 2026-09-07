"use client";

import { useEffect, useRef, useState } from "react";

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

  // New-order notification sound
  const knownOrderIds = useRef<Set<string> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDate, setHistoryDate] = useState("");

  // Printing
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  const getDateKey = (dateString: string) => {
    const date = new Date(dateString);

    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getTodayKey = () => {
    const date = new Date();

    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getYesterdayKey = () => {
    const date = new Date();

    date.setDate(date.getDate() - 1);

    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Reliable browser notification chime.
  // The employee enables it with the button in the dashboard header.
  const playNewOrderSound = async () => {
    if (typeof window === "undefined") return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const ctx = audioContextRef.current;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      // Three clear notification notes.
      [880, 1174.66, 1567.98].forEach((frequency, index) => {
        const startTime = now + index * 0.16;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14);

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.15);
      });
    } catch (err) {
      console.error("LinQafé notification sound error:", err);
    }
  };

  const enableSound = async () => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      await audioContextRef.current.resume();
      setSoundEnabled(true);

      // Test sound immediately so staff knows it works.
      await playNewOrderSound();

      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch (err) {
      console.error("Unable to enable notification sound:", err);
    }
  };

  const load = async () => {
    try {
      const meResponse = await fetch("/api/admin/me");

      const me = await meResponse.json();

      if (!me.authenticated) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      setAuthenticated(true);

      const response = await fetch("/api/orders");

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to load orders");
      } else {
        const incomingOrders: Order[] = data.orders || [];

        // First successful load establishes the baseline silently.
        // Every later load only sounds for an order that was not previously seen.
        if (knownOrderIds.current === null) {
          knownOrderIds.current = new Set(
            incomingOrders.map((order) => order.id)
          );
        } else {
          const newOrders = incomingOrders.filter(
            (order) => !knownOrderIds.current!.has(order.id)
          );

          if (newOrders.length > 0) {
            newOrders.forEach((order) => {
              knownOrderIds.current!.add(order.id);
            });

            if (soundEnabled) {
              void playNewOrderSound();
            }

            // Optional browser notification when permission is already granted.
            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              newOrders.forEach((order) => {
                new Notification("New LinQafé Order", {
                  body: `${order.order_number} · ${Number(order.total).toFixed(
                    2
                  )} QAR`,
                  icon: "/favicon.ico",
                });
              });
            }
          }
        }

        // Keep the ID list current even if an order was removed/cancelled.
        incomingOrders.forEach((order) =>
          knownOrderIds.current?.add(order.id)
        );

        setOrders(incomingOrders);
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
  }, [authenticated, soundEnabled]);

  // Set history date once
  useEffect(() => {
    if (!historyDate) {
      setHistoryDate(getYesterdayKey());
    }
  }, []);

  // Reset printing state after browser print
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintingOrderId(null);
    };

    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      });

      if (!response.ok) {
        setError("Incorrect password");
        return;
      }

      setPassword("");
      setAuthenticated(true);
      setLoading(true);

      // Unlock browser audio after the employee's login interaction.
      try {
        if (typeof window !== "undefined") {
          const AudioContextClass =
            window.AudioContext ||
            (window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }).webkitAudioContext;

          if (AudioContextClass) {
            if (!audioContextRef.current) {
              audioContextRef.current = new AudioContextClass();
            }

            if (audioContextRef.current.state === "suspended") {
              await audioContextRef.current.resume();
            }
          }

          // Ask once for desktop/browser notifications.
          if (
            "Notification" in window &&
            Notification.permission === "default"
          ) {
            await Notification.requestPermission();
          }
        }
      } catch {
        // Audio/notifications are optional and must not block login.
      }

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
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_status,
        }),
      });

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
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_status: "paid",
        }),
      });

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
      setError("Unable to mark cash payment as paid");
    }
  };

  /*
   * PRINT ONE ORDER ONLY
   *
   * This works for:
   * - Today's orders
   * - History orders
   *
   * We wait for React to add the print-target class
   * before opening the browser print dialog.
   */
  const printReceipt = (id: string) => {
    setPrintingOrderId(id);

    setTimeout(() => {
      window.print();
    }, 150);
  };

  const logout = async () => {
    await fetch("/api/admin/logout", {
      method: "POST",
    });

    setAuthenticated(false);
  };

  const todayKey = getTodayKey();

  // ONLY today's orders
  const todayOrders = orders.filter(
    (order) =>
      getDateKey(order.created_at) === todayKey
  );

  // Selected history date
  const historyOrders = orders.filter(
    (order) =>
      getDateKey(order.created_at) === historyDate &&
      getDateKey(order.created_at) !== todayKey
  );

  // Today's sales
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

  // Today's open orders
  const open = todayOrders.filter(
    (order) =>
      ![
        "completed",
        "cancelled",
      ].includes(order.order_status)
  );

  // Today's paid orders
  const paid = todayOrders.filter(
    (order) =>
      order.payment_status === "paid"
  ).length;

  /*
   * CASH ORDERS
   *
   * Cash is displayed as UNPAID until
   * staff marks it as PAID.
   */
  const getPaymentLabel = (order: Order) => {
    if (
      order.payment_method === "cash" &&
      order.payment_status !== "paid"
    ) {
      return "UNPAID";
    }

    if (
      order.payment_status === "paid"
    ) {
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
    const label = getPaymentLabel(order);

    if (label === "PAID") {
      return "paid";
    }

    if (label === "UNPAID") {
      return "unpaid";
    }

    return "pending";
  };

  const getPaymentIcon = (order: Order) => {
    const label = getPaymentLabel(order);

    if (
      label === "PAID" ||
      label === "UNPAID"
    ) {
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

  /*
   * Reusable order card
   */
  const renderOrder = (order: Order) => {
    const paymentLabel =
      getPaymentLabel(order);

    const paymentClass =
      getPaymentClass(order);

    const paymentIcon =
      getPaymentIcon(order);

    /*
     * IMPORTANT:
     *
     * When printingOrderId exists:
     *
     * selected order = print-target
     * all other orders = print-hidden
     *
     * This applies equally to Today's Orders
     * and Order History.
     */
    const printClass = printingOrderId
      ? printingOrderId === order.id
        ? "print-target"
        : "print-hidden"
      : "";

    return (
      <article
        className={`order-card ${printClass}`}
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
            ).toFixed(2)}{" "}
            QAR
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
                  {statusIcons[
                    order.order_status
                  ] || "•"}
                </span>

                {statusLabels[
                  order.order_status
                ] ||
                  order.order_status.toUpperCase()}
              </span>
            </div>

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
              value={order.order_status}
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

            {/* PRINT ONLY THIS ORDER */}
            <button
              type="button"
              className="print-btn"
              onClick={() =>
                printReceipt(order.id)
              }
            >
              Print receipt
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <main
      className={`admin-page ${
        printingOrderId
          ? "printing-order"
          : ""
      }`}
    >
      <div className="admin-shell">
        {/* HEADER */}
        <header className="admin-head">
          <div>
            <h1>
              LinQafé Orders
            </h1>

            <p>
              Live café ordering dashboard
            </p>
          </div>

          <div className="admin-head-actions">
            <button
              type="button"
              onClick={enableSound}
              title="Enable and test new-order sound"
            >
              {soundEnabled
                ? "🔊 Sound On"
                : "🔔 Enable Order Sound"}
            </button>

            <button
              type="button"
              onClick={logout}
            >
              Sign out
            </button>
          </div>
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

        {/* TODAY */}
        <section className="orders-list">
          <div className="section-heading-row">
            <div>
              <h2>
                Today's Orders
              </h2>

              <p className="section-subtitle">
                {todayOrders.length} order
                {todayOrders.length !== 1
                  ? "s"
                  : ""}{" "}
                today
              </p>
            </div>

            <button
              type="button"
              className="history-toggle"
              onClick={() =>
                setHistoryOpen(
                  !historyOpen
                )
              }
            >
              {historyOpen
                ? "Hide Order History"
                : "View Order History"}
            </button>
          </div>

          {todayOrders.length === 0 ? (
            <div className="empty">
              No orders today.
            </div>
          ) : (
            todayOrders.map(
              renderOrder
            )
          )}
        </section>

        {/* ORDER HISTORY */}
        {historyOpen && (
          <section className="orders-list history-section">
            <div className="history-header">
              <div>
                <h2>
                  Order History
                </h2>

                <p className="section-subtitle">
                  View orders from a
                  specific date
                </p>
              </div>

              <div className="history-filter">
                <label htmlFor="history-date">
                  Date
                </label>

                <input
                  id="history-date"
                  type="date"
                  value={historyDate}
                  max={getYesterdayKey()}
                  onChange={(e) =>
                    setHistoryDate(
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            <div className="history-date-title">
              {historyDate
                ? new Date(
                    `${historyDate}T00:00:00`
                  ).toLocaleDateString(
                    undefined,
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )
                : "Select a date"}
            </div>

            {historyOrders.length ===
            0 ? (
              <div className="empty">
                No orders found for
                this date.
              </div>
            ) : (
              historyOrders.map(
                renderOrder
              )
            )}
          </section>
        )}
      </div>
    </main>
  );
}