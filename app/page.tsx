"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { menuItems } from "./menu-data";

type Language = "en" | "ar";

type CartItem = {
  name: string;
  arName: string;
  image: string;
  price: number;
  quantity: number;
};

type Category =
  | "sandwiches"
  | "cold-drinks"
  | "salads"
  | "desserts"
  | "hot-drinks";

const labels = {
  en: {
    subtitle: "COFFEE SHOP",
    choose: "Choose your menu",
    english: "English Menu",
    arabic: "Arabic Menu",
    back: "Change Language",
    menu: "Our Menu",
    sandwiches: "Sandwiches",
    coldDrinks: "Cold Drinks",
    salads: "Salads",
    desserts: "Desserts",
    hotDrinks: "Hot Drinks",
    soon: "Coming soon",
    qr: "Scan • Browse • Enjoy",
    currency: "QAR",
    addToCart: "Add to Cart",
    cart: "Cart",
    emptyCart: "Your cart is empty",
    checkout: "Checkout",
    backToCart: "Back to Cart",
    customerName: "Name",
    phone: "Mobile number",
    orderType: "Order type",
    pickup: "Pickup",
    dineIn: "Dine-in",
    table: "Table number",
    notes: "Order notes",
    placeOrder: "Continue to Payment",
    total: "Total",
    orderReceived: "Order received",
    paymentStarted: "Opening secure payment…",
    paymentFailed: "We could not start payment. Please try again.",
    paidMessage: "Your payment was received. Order number",
  },

  ar: {
    subtitle: "مقهى",
    choose: "اختر القائمة",
    english: "القائمة الإنجليزية",
    arabic: "القائمة العربية",
    back: "تغيير اللغة",
    menu: "قائمتنا",
    sandwiches: "الساندويتشات",
    coldDrinks: "المشروبات الباردة",
    salads: "السلطات",
    desserts: "الحلويات",
    hotDrinks: "المشروبات الساخنة",
    soon: "قريباً",
    qr: "امسح • تصفح • استمتع",
    currency: "ر.ق",
    addToCart: "أضف إلى السلة",
    cart: "السلة",
    emptyCart: "السلة فارغة",
    checkout: "إتمام الطلب",
    backToCart: "العودة للسلة",
    customerName: "الاسم",
    phone: "رقم الجوال",
    orderType: "نوع الطلب",
    pickup: "استلام",
    dineIn: "داخل المقهى",
    table: "رقم الطاولة",
    notes: "ملاحظات الطلب",
    placeOrder: "المتابعة للدفع",
    total: "الإجمالي",
    orderReceived: "تم استلام الطلب",
    paymentStarted: "جاري فتح صفحة الدفع الآمنة…",
    paymentFailed: "تعذر بدء الدفع. حاول مرة أخرى.",
    paidMessage: "تم استلام دفعتك. رقم الطلب",
  },
};

const categories: {
  id: Category;
  icon: string;
}[] = [
  {
    id: "sandwiches",
    icon: "🥪",
  },
  {
    id: "cold-drinks",
    icon: "🧊",
  },
  {
    id: "salads",
    icon: "🥗",
  },
  {
    id: "desserts",
    icon: "🍰",
  },
  {
    id: "hot-drinks",
    icon: "☕",
  },
];

export default function Home() {
  const [language, setLanguage] =
    useState<Language | null>(null);

  const [category, setCategory] =
    useState<Category>("sandwiches");

  const t = labels[language ?? "en"];

  const rtl = language === "ar";

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<"pickup" | "dine-in">("pickup");
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [paying, setPaying] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("linqafe-cart");
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("linqafe-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("paymentId");
    const orderId = params.get("order");
    if (!paymentId || !orderId) return;
    fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, orderId }),
    }).then(async (r) => {
      const data = await r.json();
      if (data.paid) {
        setCart([]);
        setCartOpen(true);
        setCheckoutOpen(false);
        setPaymentMessage(`${t.paidMessage} ${orderId.slice(0, 8)}`);
      }
      window.history.replaceState({}, "", window.location.pathname);
    }).catch(() => {});
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addToCart = (item: typeof menuItems[number]) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.name === item.name);
      if (existing) return current.map((entry) => entry.name === item.name ? { ...entry, quantity: entry.quantity + 1 } : entry);
      return [...current, { name: item.name, arName: item.arName, image: item.image, price: item.price, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const changeQuantity = (name: string, amount: number) => {
    setCart((current) => current.map((item) => item.name === name ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0));
  };

  const startCheckout = () => {
    if (!cart.length) return;
    setCheckoutOpen(true);
  };

  const placeOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || (orderType === "dine-in" && !tableNumber.trim())) return;
    setPaying(true);
    setPaymentMessage(t.paymentStarted);
    try {
      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, customerPhone, orderType, tableNumber, notes, items: cart, total: cartTotal }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error);
      const paymentResponse = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderData.order.id }),
      });
      const paymentData = await paymentResponse.json();
      if (!paymentResponse.ok || !paymentData.paymentUrl) throw new Error(paymentData.error);
      window.location.href = paymentData.paymentUrl;
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : t.paymentFailed);
      setPaying(false);
    }
  };

  /*
   * =====================================================
   * FILTER MENU ITEMS
   * =====================================================
   */

  const visibleItems = useMemo(() => {
    if (
      category === "cold-drinks" ||
      category === "hot-drinks"
    ) {
      return [];
    }

    return menuItems.filter(
      (item) => item.category === category
    );
  }, [category]);

  /*
   * =====================================================
   * GO HOME
   * =====================================================
   */

  const goHome = () => {
    setLanguage(null);
    setCategory("sandwiches");
  };

  /*
   * =====================================================
   * LANDING PAGE
   * =====================================================
   */

  if (!language) {
    return (
      <main className="landing">

        {/* BACKGROUND OVERLAY */}
        <div className="landing-overlay" />

        <div className="landing-content">

          {/* =================================================
              TOP LOGO
          ================================================= */}

          <button
            type="button"
            className="brand-pill"
            onClick={goHome}
            aria-label="Go to home"
          >
            <Image
              src="/logo2.png"
              alt="LinQafé"
              width={270}
              height={73}
              priority
            />
          </button>

          {/* =================================================
              HERO CARD
          ================================================= */}

          <div className="hero-card">

            {/* VIDEO */}
            <video
              src="/hero.mov"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="hero-image"
            />

            {/* VIDEO SHADE */}
            <div className="hero-shade" />


            <div className="hero-copy">

              {/* CHOOSE YOUR MENU */}
              <h1>
                {t.choose}
              </h1>

              {/* LANGUAGE BUTTONS */}
              <div className="language-buttons">

                <button
                  type="button"
                  onClick={() =>
                    setLanguage("en")
                  }
                  className="language-btn primary"
                >
                  {t.english}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setLanguage("ar")
                  }
                  className="language-btn"
                >
                  {t.arabic}
                </button>

              </div>

            </div>

          </div>

          {/* =================================================
              LANDING FOOTER
          ================================================= */}

          <p className="landing-footer">
            LinQafé
          </p>

        </div>

      </main>
    );
  }

  /*
   * =====================================================
   * MENU PAGE
   * =====================================================
   */

  return (
    <main
      className={`menu-page ${
        rtl ? "rtl" : ""
      }`}
      dir={rtl ? "rtl" : "ltr"}
    >

      {/* =================================================
          MENU HEADER
      ================================================= */}

      <header className="menu-header">

        <div className="header-inner">

          {/* CLICKABLE LOGO */}
          <button
            type="button"
            className="header-logo-button"
            onClick={goHome}
            aria-label="Go to home"
          >
            <Image
              src="/logo2.png"
              alt="LinQafé"
              width={210}
              height={57}
              priority
            />
          </button>

          {/* CHANGE LANGUAGE */}
          <div className="header-right">

            <button
              type="button"
              className="change-language"
              onClick={() =>
                setLanguage(null)
              }
            >
              {t.back}
            </button>

          </div>

        </div>

      </header>

      {/* =================================================
          MENU INTRO
      ================================================= */}

      <section className="menu-intro">

        <div className="intro-line" />

        <h1>
          {t.menu}
        </h1>

      </section>

      {/* =================================================
          CATEGORY NAVIGATION
      ================================================= */}

      <nav
        className="category-scroll"
        aria-label="Menu categories"
      >

        {categories.map((item) => {

          let label = "";

          switch (item.id) {

            case "sandwiches":
              label = t.sandwiches;
              break;

            case "cold-drinks":
              label = t.coldDrinks;
              break;

            case "salads":
              label = t.salads;
              break;

            case "desserts":
              label = t.desserts;
              break;

            case "hot-drinks":
              label = t.hotDrinks;
              break;

          }

          return (
            <button
              key={item.id}
              type="button"
              className={`category-btn ${
                category === item.id
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setCategory(item.id)
              }
            >

              <span>
                {item.icon}
              </span>

              <b>
                {label}
              </b>

            </button>
          );

        })}

      </nav>

      {/* =================================================
          MENU ITEMS
      ================================================= */}

      <section className="items-section">

        {visibleItems.length > 0 ? (

          <div className="items-grid">

            {visibleItems.map((item) => (

              <article
                className="item-card"
                key={item.name}
              >

                {/* ITEM IMAGE */}
                <div className="item-image-wrap">

                  {item.image ? (

                    <Image
                      src={`/images/${item.image}`}
                      alt={
                        rtl
                          ? item.arName
                          : item.name
                      }
                      fill
                      sizes="(max-width: 680px) 92vw, 420px"
                      className="item-image"
                    />

                  ) : (

                    <div className="image-placeholder" />

                  )}

                </div>

                {/* ITEM DETAILS */}
                <div className="item-body">

                  <div className="item-top">

                    <h2>
                      {rtl
                        ? item.arName
                        : item.name}
                    </h2>

                    <span className="price">

                      {item.price}

                      <small>
                        {t.currency}
                      </small>

                    </span>

                  </div>

                  <p>
                    {rtl
                      ? item.arDesc
                      : item.description}
                  </p>

                  <button
                    type="button"
                    className="add-cart"
                    onClick={() => addToCart(item)}
                  >
                    {t.addToCart}
                  </button>

                </div>

              </article>

            ))}

          </div>

        ) : (

          <div className="coming-soon">

            <span>
              ☕
            </span>

            <h2>
              {t.soon}
            </h2>

            <p>
              {rtl
                ? "سيتم إضافة هذه الفئة قريباً."
                : "This category will be added soon."}
            </p>

          </div>

        )}

      </section>

      {/* =================================================
          MENU FOOTER

          LinQafé ABOVE Scan • Browse • Enjoy
      ================================================= */}

      <footer className="menu-footer">

        <strong>
          LinQafé
        </strong>

        <span>
          {t.qr}
        </span>

      </footer>

      {cartCount > 0 && !cartOpen && (
        <button type="button" className="cart-floating" onClick={() => setCartOpen(true)}>
          🛒 {t.cart} <span className="cart-count">{cartCount}</span>
        </button>
      )}

      {cartOpen && (
        <div className="cart-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCartOpen(false); }}>
          <aside className="cart-panel" aria-label={t.cart}>
            <div className="cart-head">
              <h2>{paymentMessage || t.cart}</h2>
              <button type="button" className="cart-close" onClick={() => setCartOpen(false)}>×</button>
            </div>

            {paymentMessage ? (
              <div className="empty-cart">
                <div style={{ fontSize: 48 }}>✓</div>
                <h3>{t.orderReceived}</h3>
                <p>{paymentMessage}</p>
                <button className="checkout-btn" onClick={() => { setPaymentMessage(""); setCartOpen(false); }}>Back to Menu</button>
              </div>
            ) : !checkoutOpen ? (
              cart.length ? (
                <>
                  {cart.map((item) => (
                    <div className="cart-item" key={item.name}>
                      <Image src={`/images/${item.image}`} alt={rtl ? item.arName : item.name} width={82} height={82} />
                      <div>
                        <h3>{rtl ? item.arName : item.name}</h3>
                        <p>{item.price} {t.currency}</p>
                        <div className="qty">
                          <button onClick={() => changeQuantity(item.name, -1)}>-</button>
                          <b>{item.quantity}</b>
                          <button onClick={() => changeQuantity(item.name, 1)}>+</button>
                        </div>
                      </div>
                      <div className="cart-item-total">{(item.price * item.quantity).toFixed(2)} {t.currency}</div>
                    </div>
                  ))}
                  <div className="cart-summary">
                    <div className="cart-total"><span>{t.total}</span><span>{cartTotal.toFixed(2)} {t.currency}</span></div>
                    <button type="button" className="checkout-btn" onClick={startCheckout}>{t.checkout}</button>
                  </div>
                </>
              ) : <div className="empty-cart"><h3>{t.emptyCart}</h3></div>
            ) : (
              <form className="checkout-form" onSubmit={placeOrder}>
                <button type="button" className="checkout-back" onClick={() => setCheckoutOpen(false)}>← {t.backToCart}</button>
                {cart.map(item => <div className="cart-item" key={item.name}><Image src={`/images/${item.image}`} alt="" width={64} height={64}/><div><h3>{rtl ? item.arName : item.name}</h3><p>{item.quantity} × {item.price} {t.currency}</p></div></div>)}
                <input required value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder={t.customerName}/>
                <input required value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder={t.phone} inputMode="tel"/>
                <select value={orderType} onChange={e=>setOrderType(e.target.value as "pickup" | "dine-in")}><option value="pickup">{t.pickup}</option><option value="dine-in">{t.dineIn}</option></select>
                {orderType === "dine-in" && <input required value={tableNumber} onChange={e=>setTableNumber(e.target.value)} placeholder={t.table}/>}
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder={t.notes}/>
                <div className="cart-total"><span>{t.total}</span><span>{cartTotal.toFixed(2)} {t.currency}</span></div>
                {paymentMessage && <p className="cart-note">{paymentMessage}</p>}
                <button disabled={paying} className="pay-btn" type="submit">{paying ? t.paymentStarted : t.placeOrder}</button>
                <p className="cart-note">Apple Pay and other payment methods are shown on the secure MyFatoorah checkout when enabled for the LinQafé merchant account.</p>
              </form>
            )}
          </aside>
        </div>
      )}

    </main>
  );
}