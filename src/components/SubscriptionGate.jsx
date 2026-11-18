import { PAYPAL_LINKS } from "../lib/subscription";

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.55)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card = {
  background: "#fff",
  borderRadius: 16,
  maxWidth: 440,
  width: "100%",
  padding: "28px 24px",
  boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
};

const btnPrimary = {
  width: "100%",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  marginBottom: 10,
};

export function SubscriptionDialog({ onRemindLater }) {
  const openPay = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#b45309", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
          Software subscription payment pending
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
          Minarva Biz — Subscription
        </div>
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.55, margin: "0 0 12px" }}>
          Software fee from <strong>1 July 2026</strong> is outstanding.
          Please complete payment to keep full access (Payroll, Cashbook entries, Settings, Reports).
        </p>
        <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, margin: "0 0 16px" }}>
          We could not reach you on the registered contact details.
          For payment confirmation, software updates or new features, email{" "}
          <a href="mailto:minarvabiz@gmail.com" style={{ color: "#2563eb", fontWeight: 600 }}>minarvabiz@gmail.com</a>.
        </p>

        <button
          type="button"
          onClick={() => openPay(PAYPAL_LINKS.sixMonths.url)}
          style={{ ...btnPrimary, background: "#2563eb", color: "#fff" }}
        >
          Pay 6 months — ${PAYPAL_LINKS.sixMonths.priceUsd} USD
        </button>
        <button
          type="button"
          onClick={() => openPay(PAYPAL_LINKS.oneYear.url)}
          style={{ ...btnPrimary, background: "#0f172a", color: "#fff" }}
        >
          Pay 1 year — ${PAYPAL_LINKS.oneYear.priceUsd} USD
        </button>
        <button
          type="button"
          onClick={onRemindLater}
          style={{ ...btnPrimary, background: "#f1f5f9", color: "#475569", marginBottom: 0 }}
        >
          Remind me later
        </button>
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 14, marginBottom: 0, lineHeight: 1.45 }}>
          Payment opens PayPal (business name: Minarva Biz). After paying, send the receipt to minarvabiz@gmail.com — access is unlocked when payment is confirmed.
        </p>
      </div>
    </div>
  );
}

export function SubscriptionLockScreen({ pageLabel, onPay }) {
  return (
    <div style={{ padding: 40, maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
        Subscription required
      </div>
      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55, marginBottom: 20 }}>
        <strong>{pageLabel || "This section"}</strong> is locked until the software subscription is paid.
        Pay via PayPal, then email the receipt to <strong>minarvabiz@gmail.com</strong> for unlock.
      </p>
      <button
        type="button"
        onClick={onPay}
        style={{ ...btnPrimary, background: "#2563eb", color: "#fff", maxWidth: 320, margin: "0 auto 10px" }}
      >
        Pay now
      </button>
      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
        Updates & support: minarvabiz@gmail.com
      </p>
    </div>
  );
}
