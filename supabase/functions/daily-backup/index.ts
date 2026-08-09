// Daily full ERP backup → email (Resend)
// Deploy: supabase functions deploy daily-backup --no-verify-jwt
// Secrets: RESEND_API_KEY, BACKUP_TO_EMAIL, BACKUP_FROM_EMAIL (optional)
// Cron: Supabase Dashboard → Edge Functions → Schedules → 0 20 * * * (00:00 Oman ≈ 20:00 UTC)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TABLES = [
  "projects", "schedules", "subcontractors", "sub_milestones",
  "bank_accounts", "ledger", "invoices", "invoice_line_items",
  "employees", "attendance", "payroll",
  "bp_suppliers", "bp_bills", "bp_bill_items", "bp_payments",
  "bp_recurring", "bp_recurring_payments",
  "app_users", "app_settings",
  "inventory_items", "material_requests", "equipment",
  "commissions", "credit_purchases",
];

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const toEmail = Deno.env.get("BACKUP_TO_EMAIL");
    const fromEmail = Deno.env.get("BACKUP_FROM_EMAIL") || "onboarding@resend.dev";

    if (!resendKey || !toEmail) {
      return new Response(JSON.stringify({
        error: "Missing RESEND_API_KEY or BACKUP_TO_EMAIL secrets",
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const backup: Record<string, unknown> = {
      backup_date: new Date().toISOString(),
      version: "1.2",
      company: "TRATEEL AL NAJAH FOR TRADING",
      source: "daily-backup-edge-function",
      data: {},
    };

    const counts: Record<string, number> = {};
    for (const table of TABLES) {
      try {
        const { data, error } = await sb.from(table).select("*");
        if (error) {
          counts[table] = -1;
          (backup.data as Record<string, unknown>)[table] = [];
          continue;
        }
        (backup.data as Record<string, unknown>)[table] = data || [];
        counts[table] = (data || []).length;
      } catch {
        counts[table] = -1;
        (backup.data as Record<string, unknown>)[table] = [];
      }
    }

    const json = JSON.stringify(backup, null, 2);
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `trateel-backup-${dateStr}.json`;
    // base64 for Resend attachment
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const totalRows = Object.values(counts).filter((n) => n > 0).reduce((a, b) => a + b, 0);

    const summaryLines = Object.entries(counts)
      .map(([t, n]) => `  ${t}: ${n < 0 ? "skip/error" : n}`)
      .join("\n");

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `TRATEEL ERP Daily Backup — ${dateStr} (${totalRows} rows)`,
        text: `Automatic full backup for TRATEEL AL NAJAH FOR TRADING\n\nDate: ${dateStr}\nTotal rows: ${totalRows}\n\nTables:\n${summaryLines}\n\nJSON attachment attached. Keep this file safe.\n`,
        attachments: [
          {
            filename,
            content: b64,
          },
        ],
      }),
    });

    const emailBody = await emailRes.text();
    if (!emailRes.ok) {
      return new Response(JSON.stringify({
        error: "Resend failed",
        status: emailRes.status,
        body: emailBody,
      }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: true,
      date: dateStr,
      totalRows,
      counts,
      email: JSON.parse(emailBody),
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
