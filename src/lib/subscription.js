import { supabase } from "./supabase";

export const PAYPAL_LINKS = {
  sixMonths: {
    url: "https://www.paypal.com/ncp/payment/FS6TCGTVZXXJ6",
    label: "6 months",
    priceUsd: "182.00",
    priceOmrNote: "OMR equivalent via PayPal (USD)",
  },
  oneYear: {
    url: "https://www.paypal.com/ncp/payment/F9CV3MNZ4GNAS",
    label: "1 year",
    priceUsd: "365.00",
    priceOmrNote: "OMR equivalent via PayPal (USD)",
  },
};

export const SUBSCRIPTION_KEY = "subscription_paid_until";
/** Payroll, Cashbook, Settings, Reports locked when unpaid */
export const LOCKED_PAGES = ["payroll", "ledger", "settings", "reports"];

/** SHA-256 of provider unlock codes (plain codes only with Minarva — not shown in UI) */
const UNLOCK_HASH_6M = "58685e5afa011a18d2f950250e310bf4a349adcc5df95967400cd94ca71460f6";
const UNLOCK_HASH_1Y = "808275cef777509f39c182b847e89bf863688ef99e192fe9f671ddc0649811c8";

export function isPageLocked(pageId, { isPaid }) {
  if (isPaid) return false;
  return LOCKED_PAGES.includes(pageId);
}

export async function getPaidUntil() {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SUBSCRIPTION_KEY)
      .maybeSingle();
    return (data?.value || "").trim() || null;
  } catch {
    return null;
  }
}

export function isSubscriptionActive(paidUntil) {
  if (!paidUntil) return false;
  const d = new Date(paidUntil + "T23:59:59");
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

export async function setPaidUntil(dateStr) {
  const value = (dateStr || "").trim();
  const { data: existing } = await supabase
    .from("app_settings")
    .select("id")
    .eq("key", SUBSCRIPTION_KEY)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("app_settings")
      .update({ value })
      .eq("key", SUBSCRIPTION_KEY);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("app_settings")
      .insert({ key: SUBSCRIPTION_KEY, value });
    if (error) throw error;
  }
  return value;
}

export function defaultEndDate(plan) {
  const d = new Date();
  if (plan === "sixMonths") {
    d.setMonth(d.getMonth() + 6);
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().slice(0, 10);
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text.trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Provider-only unlock. Returns { ok, plan, paidUntil } or { ok:false, error }.
 */
export async function tryProviderUnlock(code) {
  if (!code || !String(code).trim()) {
    return { ok: false, error: "Enter unlock code" };
  }
  const hash = await sha256Hex(String(code));
  let plan = null;
  if (hash === UNLOCK_HASH_6M) plan = "sixMonths";
  else if (hash === UNLOCK_HASH_1Y) plan = "oneYear";
  else return { ok: false, error: "Invalid unlock code" };

  const paidUntil = defaultEndDate(plan);
  await setPaidUntil(paidUntil);
  return { ok: true, plan, paidUntil };
}
