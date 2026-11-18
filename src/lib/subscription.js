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
export const LOCKED_PAGES = ["payroll", "ledger", "settings", "reports"];

/** Pages locked for non-admin when subscription is unpaid */
export function isPageLocked(pageId, { isPaid, isAdmin }) {
  if (isPaid) return false;
  // Admin must reach Settings to mark paid
  if (isAdmin && pageId === "settings") return false;
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

/** Default end dates after marking a plan paid */
export function defaultEndDate(plan) {
  const d = new Date();
  if (plan === "sixMonths") {
    d.setMonth(d.getMonth() + 6);
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().slice(0, 10);
}
