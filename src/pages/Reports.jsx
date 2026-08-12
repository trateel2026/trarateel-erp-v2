import { useState, useEffect, useRef } from "react";
import { getBankAccounts } from "../lib/bankAccounts";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";


const toYMD = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
};
const parseYMD = (s) => {
  const [y, m, d] = (s || "").split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const STD_WORK_HOURS = 10;

const downloadExcel = (rows, filename) => {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  // Auto-width columns
  const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] || "").length)) + 2 }));
  ws["!cols"] = colWidths;
  XLSX.writeFile(wb, filename + ".xlsx");
};

const tabs = [
  { id: "accounts", label: "🏦 Account Statement" },
  { id: "supplier_statement", label: "🏪 Supplier Statement" },
  { id: "vat_report", label: "🧾 VAT Report" },
  { id: "executive", label: "Executive Overview", icon: "⚖" },
  { id: "projects", label: "Contract Sites Progress", icon: "🏗" },
  { id: "payments", label: "Payment Collections", icon: "💰" },
  { id: "ledger", label: "Cashbook Statement", icon: "📒" },
  { id: "subcontractors", label: "Subcontractor Balances", icon: "🔧" },
  { id: "commissions", label: "Commission Ledger", icon: "💼" },
  { id: "payroll", label: "Payroll Summary", icon: "👤" },
  { id: "attendance", label: "📅 Daily Attendance", icon: "📅" },
];

export default function Reports() {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState("");
  const [bankLedger, setBankLedger] = useState([]);
  const [activeTab, setActiveTab] = useState("executive");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);

  // Data states
  const [projects, setProjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [subs, setSubs] = useState([]);
  const [subMilestones, setSubMilestones] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [bpSuppliers, setBpSuppliers] = useState([]);
  const [bpBills, setBpBills] = useState([]);
  const [bpPayments, setBpPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [cbFilter, setCbFilter] = useState("All");
  const [suppSubTab, setSuppSubTab] = useState("all");
  const [attDay, setAttDay] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => { loadAllData(); }, []);

  const loadAllData = async () => {
    setLoading(true);
    const [p, s, l, sb, sm, c, e, py, bps, bpb, bpp, att] = await Promise.all([
      supabase.from("projects").select("*").order("created_at"),
      supabase.from("schedules").select("*"),
      supabase.from("ledger").select("*").order("entry_date"),
      supabase.from("subcontractors").select("*").order("name"),
      supabase.from("sub_milestones").select("*"),
      supabase.from("commissions").select("*").order("commission_date"),
      supabase.from("employees").select("*").order("name"),
      supabase.from("payroll").select("*"),
      supabase.from("bp_suppliers").select("*").order("name"),
      supabase.from("bp_bills").select("*").order("bill_date"),
      supabase.from("bp_payments").select("*").order("payment_date"),
      supabase.from("attendance").select("*").order("att_date", { ascending: false }),
    ]);
    setProjects(p.data || []);
    setSchedules(s.data || []);
    setLedger(l.data || []);
    setSubs(sb.data || []);
    setSubMilestones(sm.data || []);
    setCommissions(c.data || []);
    setEmployees(e.data || []);
    setPayroll(py.data || []);
    setBpSuppliers(bps.data || []);
    setBpBills(bpb.data || []);
    setBpPayments(bpp.data || []);
    setAttendance(att.data || []);
    getBankAccounts().then(setBankAccounts);
    setLoading(false);
  };

  const applyPreset = (pr) => {
    const now = new Date();
    if (pr === "This Month") { setStartDate(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`); setEndDate(now.toISOString().split("T")[0]); }
    if (pr === "Last 30 Days") { const d = new Date(now-30*86400000); setStartDate(d.toISOString().split("T")[0]); setEndDate(now.toISOString().split("T")[0]); }
    if (pr === "This Year") { setStartDate(`${now.getFullYear()}-01-01`); setEndDate(now.toISOString().split("T")[0]); }
    if (pr === "Reset") { setStartDate(""); setEndDate(""); }
  };

  const print = () => {
    const content = printRef.current?.innerHTML;
    const w = window.open("", "_blank");
    w.document.write(`
      <html><head><title>Minarva Biz Report — TRATEEL AL NAJAH FOR TRADING</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #0f172a; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
        td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
        tr:nth-child(even) { background: #f8fafc; }
        .header { background: linear-gradient(135deg,#0f172a,#1e3a5f); color: #fff; padding: 20px 24px; margin: -20px -20px 20px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
        .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
        .kpi-label { font-size: 9px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
        .kpi-value { font-size: 18px; font-weight: 800; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
        .green { color: #10b981; } .red { color: #ef4444; } .blue { color: #6366f1; }
        .progress-bar { background: #e2e8f0; height: 6px; border-radius: 4px; }
        .progress-fill { background: #6366f1; height: 6px; border-radius: 4px; }
        @media print { body { margin: 0; } }
      </style></head><body>${content}</body></html>
    `);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  // Computed values
  const projWithSched = projects.map(p => {
    const scheds = schedules.filter(s => s.project_id === p.id);
    const received = scheds.reduce((t, s) => t + parseFloat(s.received || 0), 0);
    return { ...p, received, scheds };
  });

  const trackingOnlyNames = bankAccounts.filter(a => a.include_in_balance === false).map(a => a.account_name);
  const trackingOnlyIds = new Set(bankAccounts.filter(a => a.include_in_balance === false).map(a => a.id));
  // Net-cash ledger only: hide COMPANY ACCOUNT / tracking-only (by mode name OR bank_account_id)
  // Also hard-exclude known tracking mode name so report stays clean even before bankAccounts load
  const isTrackingEntry = (e) =>
    trackingOnlyNames.includes(e.payment_mode) ||
    e.payment_mode === "COMPANY ACCOUNT" ||
    (e.bank_account_id && trackingOnlyIds.has(e.bank_account_id));
  const netLedgerAll = ledger.filter(e => !isTrackingEntry(e));
  const filtLedger = netLedgerAll.filter(e =>
    (!startDate || e.entry_date >= startDate) && (!endDate || e.entry_date <= endDate)
  );
  const totalIncome = filtLedger.filter(e => e.type === "Credits (Income)").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const totalExpense = filtLedger.filter(e => e.type === "Debits (Payouts)").reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  // Bank openings for accounts included in net cash
  const bankOpeningSum = bankAccounts
    .filter(a => a.include_in_balance !== false)
    .reduce((s, a) => s + parseFloat(a.opening_balance || 0), 0);
  // Movements before selected start date (= opening for the statement period)
  const priorLedger = startDate
    ? netLedgerAll.filter(e => e.entry_date && e.entry_date < startDate)
    : [];
  const priorNet = priorLedger.reduce((s, e) => {
    const amt = parseFloat(e.amount || 0);
    return s + (e.type === "Credits (Income)" ? amt : -amt);
  }, 0);
  const statementOpening = bankOpeningSum + priorNet;
  // All-time current net balance
  const allTimeCredits = netLedgerAll.filter(e => e.type === "Credits (Income)").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const allTimeDebits = netLedgerAll.filter(e => e.type === "Debits (Payouts)").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const allTimeNet = allTimeCredits - allTimeDebits;
  const currentTotalBalance = bankOpeningSum + allTimeNet;
  const statementClosing = statementOpening + totalIncome - totalExpense;
  const totalContract = projWithSched.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalReceived = projWithSched.reduce((s, p) => s + p.received, 0);
  const activeProjects = projects.filter(p => p.status === "Active").length;
  const avgProgress = projects.length > 0 ? Math.round(projWithSched.reduce((s, p) => s + (p.amount > 0 ? (p.received / p.amount) * 100 : 0), 0) / projects.length) : 0;
  const totalSubContract = subs.reduce((s, s2) => s + parseFloat(s2.contract_amount || 0), 0);
  const totalSubPaid = subs.reduce((s, s2) => s + parseFloat(s2.paid || 0), 0);
  const totalCommission = commissions.reduce((s, c) => s + parseFloat(c.computed_payout || 0), 0);
  const paidCommission = commissions.filter(c => c.status === "Settled").reduce((s, c) => s + parseFloat(c.computed_payout || 0), 0);

  const Header = () => (
    <div className="header">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>TRATEEL AL NAJAH FOR TRADING</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Oman | Trading · VAT OM1100538733</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Powered by Minarva Technologies ERP v1.0 · Cashbook v2</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#60a5fa" }}>{tabs.find(t => t.id === activeTab)?.label} Report</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            {startDate && endDate ? `Period: ${startDate} to ${endDate}` : `Generated: ${new Date().toLocaleDateString("en-OM")}`}
          </div>
        </div>
      </div>
    </div>
  );

  const KPI = ({ label, value, unit = "OMR", color = "#6366f1" }) => (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value} <span style={{ fontSize: 11, fontWeight: 400 }}>{unit}</span></div>
    </div>
  );

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>⏳ Loading report data from database...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Omani Corporate Audit Desk</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Live reports from Supabase database — all data is real-time</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => {
            let rows = []; let fname = "report";
            const suppName = (id) => (bpSuppliers.find(s=>s.id===id)||{}).name || "—";
            if (activeTab === "vat_report") {
              fname = "VAT_Report";
              const filtered = bpBills.filter(b => (!startDate || b.bill_date >= startDate) && (!endDate || b.bill_date <= endDate)).sort((a,b)=>(a.bill_date||"").localeCompare(b.bill_date||""));
              const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              rows = filtered.map((b,i) => ({ "AT": i+1, "Date": b.bill_date, "Month": months[new Date(b.bill_date).getMonth()]||"", "P/E": (bpSuppliers.find(s=>s.id===b.supplier_id)||{}).category||"Purchase", "Invoice": b.bill_number||"", "Supplier": suppName(b.supplier_id), "Value": parseFloat(b.net_amount||0).toFixed(3), "VAT": parseFloat(b.vat_amount||0).toFixed(3), "Roundoff": (parseFloat(b.total_amount||0)-parseFloat(b.net_amount||0)-parseFloat(b.vat_amount||0)).toFixed(3), "Total": parseFloat(b.total_amount||0).toFixed(3) }));
            } else if (activeTab === "ledger") {
              fname = "Cashbook_Statement";
              const xlEntries = ledger.filter(e => !trackingOnlyNames.includes(e.payment_mode) && (!startDate || e.entry_date >= startDate) && (!endDate || e.entry_date <= endDate))
                .slice().sort((a,b)=>(a.entry_date||"").localeCompare(b.entry_date||"")||(a.created_at||"").localeCompare(b.created_at||""));
              let run = statementOpening;
              const xlRows = [
                { "Date": "", "Description": "COMPANY TOTAL CREDITS (all time)", "Payee": "", "Category": "", "Site": "", "Account": "", "Type": "Summary", "Credit": allTimeCredits.toFixed(3), "Debit": "", "Balance": "" },
                { "Date": "", "Description": "COMPANY TOTAL DEBITS (all time)", "Payee": "", "Category": "", "Site": "", "Account": "", "Type": "Summary", "Credit": "", "Debit": allTimeDebits.toFixed(3), "Balance": "" },
                { "Date": startDate || "", "Description": "Opening Balance (brought forward)", "Payee": "", "Category": "", "Site": "", "Account": "", "Type": "Opening", "Credit": "", "Debit": "", "Balance": statementOpening.toFixed(3) },
              ];
              for (const e of xlEntries) {
                const amt = parseFloat(e.amount||0);
                const isC = e.type === "Credits (Income)";
                run += isC ? amt : -amt;
                xlRows.push({
                  "Date": e.entry_date,
                  "Description": e.description || "",
                  "Payee": e.payee || "",
                  "Category": e.category || "",
                  "Site": e.site || "",
                  "Account": e.payment_mode || "",
                  "Type": isC ? "Credit" : "Debit",
                  "Credit": isC ? amt.toFixed(3) : "",
                  "Debit": !isC ? amt.toFixed(3) : "",
                  "Balance": run.toFixed(3),
                });
              }
              xlRows.push({ "Date": endDate || "", "Description": "Closing Balance (period)", "Payee": "", "Category": "", "Site": "", "Account": "", "Type": "Closing", "Credit": "", "Debit": "", "Balance": statementClosing.toFixed(3) });
              xlRows.push({ "Date": "", "Description": "Current Total Balance (all-time net cash)", "Payee": "", "Category": "", "Site": "", "Account": "", "Type": "Current", "Credit": "", "Debit": "", "Balance": currentTotalBalance.toFixed(3) });
              rows = xlRows;
            } else if (activeTab === "accounts") {
              fname = "Account_Statement";
              const accId = document.querySelector("[data-acc-filter]")?.value;
              rows = ledger.filter(e => (!startDate || e.entry_date >= startDate) && (!endDate || e.entry_date <= endDate)).map(e => ({ "Date": e.entry_date, "Description": e.description, "Payee": e.payee, "Category": e.category, "Account": e.payment_mode, "Credit": e.type==="Credits (Income)"?parseFloat(e.amount||0).toFixed(3):"", "Debit": e.type==="Debits (Payouts)"?parseFloat(e.amount||0).toFixed(3):"" }));
            } else if (activeTab === "supplier_statement") {
              fname = "Supplier_Statement";
              rows = bpBills.filter(b => (!startDate || b.bill_date >= startDate) && (!endDate || b.bill_date <= endDate)).map(b => ({ "Date": b.bill_date, "Bill No": b.bill_number||"", "Supplier": suppName(b.supplier_id), "Description": b.description||"", "Net": parseFloat(b.net_amount||0).toFixed(3), "VAT": parseFloat(b.vat_amount||0).toFixed(3), "Total": parseFloat(b.total_amount||0).toFixed(3), "Status": b.status }));
            } else if (activeTab === "payroll") {
              fname = "Payroll_Summary";
              rows = employees.map(emp => { const att = payroll.filter(p=>p.employee_id===emp.id); return { "Employee": emp.name, "Role": emp.role||"", "Daily Rate": emp.daily_rate, "Department": emp.department||"", "Group": emp.group_name||"" }; });
            } else if (activeTab === "subcontractors") {
              fname = "Subcontractor_Balances";
              rows = subs.map(s => { const ms = subMilestones.filter(m=>m.subcontractor_id===s.id); const contracted = ms.reduce((t,m)=>t+parseFloat(m.amount||0),0); const paid = ms.filter(m=>m.status==="Paid").reduce((t,m)=>t+parseFloat(m.amount||0),0); return { "Subcontractor": s.name, "Trade": s.trade||"", "Contract Value": contracted.toFixed(3), "Paid": paid.toFixed(3), "Balance": (contracted-paid).toFixed(3) }; });
            } else if (activeTab === "commissions") {
              fname = "Commission_Ledger";
              rows = commissions.filter(c => (!startDate || c.commission_date >= startDate) && (!endDate || c.commission_date <= endDate)).map(c => ({ "Date": c.commission_date, "Agent": c.agent_name||"", "Project": c.project_name||"", "Amount": parseFloat(c.amount||0).toFixed(3), "Type": c.type||"", "Notes": c.notes||"" }));
            } else if (activeTab === "payments") {
              fname = "Payment_Collections";
              rows = ledger.filter(e => e.type==="Credits (Income)" && (!startDate || e.entry_date >= startDate) && (!endDate || e.entry_date <= endDate)).map(e => ({ "Date": e.entry_date, "Description": e.description, "Payee": e.payee, "Category": e.category, "Account": e.payment_mode, "Amount": parseFloat(e.amount||0).toFixed(3) }));
            } else if (activeTab === "attendance") {
              fname = "Daily_Attendance";
              const day = attDay || new Date().toISOString().split("T")[0];
              const dayStart = startDate || day;
              const dayEnd = endDate || startDate || day;
              const activeEmps = employees.filter(e => (e.status || "Active") !== "Inactive");
              rows = [];
              const dates = [];
              {
                const cur = parseYMD(dayStart);
                const end = parseYMD(dayEnd);
                let n = 0;
                while (cur <= end && n < 62) {
                  dates.push(toYMD(cur));
                  cur.setDate(cur.getDate() + 1);
                  n++;
                }
              }
              for (const d of dates) {
                for (const emp of activeEmps) {
                  const rec = attendance.find(a => a.employee_id === emp.id && (a.att_date === d || a.work_date === d));
                  let status = "Absent";
                  let hours = 0, ot = 0, site = "", notes = "";
                  if (rec) {
                    hours = parseFloat(rec.hours_worked || 0);
                    ot = parseFloat(rec.Overtime || 0);
                    if (!ot && hours > STD_WORK_HOURS) ot = hours - STD_WORK_HOURS;
                    site = rec.site || "Sinaw";
                    notes = rec.notes || "";
                    if ((rec.notes || "").toLowerCase() === "absent" || (hours === 0 && (rec.notes || "").toLowerCase().includes("absent"))) status = "Absent";
                    else if (hours > 0 || (rec.notes || "").toLowerCase() === "present") status = "Present";
                    else status = "Absent";
                  }
                  rows.push({
                    "Date": d,
                    "Employee": emp.name,
                    "Role": emp.role || "",
                    "Group": emp.emp_group || "",
                    "Status": status,
                    "Hours": hours.toFixed(2),
                    "Overtime (hrs)": ot.toFixed(2),
                    "Site": site || "Sinaw",
                    "Notes": notes,
                  });
                }
              }
            }
            if (rows.length === 0) { alert("No data to export for the selected period/tab."); return; }
            downloadExcel(rows, fname + "_" + new Date().toISOString().split("T")[0]);
          }} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📥 Excel</button>
          <button onClick={loadAllData} style={{ background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer" }}>🔄 Refresh</button>
          <button onClick={print} style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🖨 Print / Save PDF</button>
        </div>
      </div>

      {/* Period Selector */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 18, marginBottom: 16, border: "1px solid #e2e8f0" }}>
        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13, marginBottom: 12 }}>📅 REPORT PERIOD</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>START DATE</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 12 }} /></div>
          <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>END DATE</div>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 12 }} /></div>
          {["This Month","Last 30 Days","This Year","Reset"].map(p => (
            <button key={p} onClick={() => applyPreset(p)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: p === "Reset" ? "#0f172a" : "#f1f5f9", color: p === "Reset" ? "#fff" : "#64748b" }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Tab Selector */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", padding: "8px 8px 0", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "10px 16px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "transparent", color: activeTab === t.id ? "#6366f1" : "#64748b", borderBottom: activeTab === t.id ? "2px solid #6366f1" : "2px solid transparent", marginBottom: -1, whiteSpace: "nowrap" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Print area */}
        <div ref={printRef} style={{ padding: 24 }}>
          <Header />

          {/* EXECUTIVE OVERVIEW */}
          {activeTab === "accounts" && (
            <div>
              <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center" }}>
                <div style={{ fontWeight:700,fontSize:15,color:"#0f172a" }}>🏦 Account Statement</div>
                <div style={{ display:"flex",gap:8 }}>
                  {bankAccounts.map(a=>(
                    <button key={a.id} onClick={async()=>{
                      setSelectedBankAccount(a.id);
                      const {supabase:sb}=await import("../lib/supabase");
                      const {data}=await sb.from("ledger").select("*").eq("bank_account_id",a.id).order("entry_date",{ascending:false});
                      setBankLedger(data||[]);
                    }} style={{ padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
                      background:selectedBankAccount===a.id?"#0f172a":"#f1f5f9",color:selectedBankAccount===a.id?"#fff":"#64748b" }}>
                      {a.account_name}
                    </button>
                  ))}
                </div>
              </div>
              {(()=>{
                const creds=bankLedger.filter(e=>e.type==="Credits (Income)").reduce((s,e)=>s+parseFloat(e.amount||0),0);
                const debs=bankLedger.filter(e=>e.type==="Debits (Payouts)").reduce((s,e)=>s+parseFloat(e.amount||0),0);
                const acc=bankAccounts.find(a=>a.id===selectedBankAccount);
                const opening=parseFloat(acc?.opening_balance||0);
                const balance=opening+creds-debs;
                return (
                  <div>
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16 }}>
                      {[["Opening Balance",`OMR ${opening.toFixed(3)}`,"#6366f1"],["Total Credits",`OMR ${creds.toFixed(3)}`,"#10b981"],["Total Debits",`OMR ${debs.toFixed(3)}`,"#ef4444"],["Current Balance",`OMR ${balance.toFixed(3)}`,balance>=0?"#0f172a":"#ef4444"]].map(([l,v,c])=>(
                        <div key={l} style={{ background:"#fff",borderRadius:10,padding:"14px 16px",border:"1px solid #e2e8f0" }}>
                          <div style={{ fontSize:10,color:"#64748b",fontWeight:600 }}>{l}</div>
                          <div style={{ fontSize:16,fontWeight:800,color:c,marginTop:4 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden" }}>
                      <thead><tr style={{ background:"#f8fafc" }}>
                        {["Date","Description","Payee","Category","Type","Amount (OMR)"].map(h=><th key={h} style={{ padding:"10px 14px",textAlign:"left",color:"#64748b",fontWeight:600,fontSize:11 }}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {bankLedger.length===0
                          ?<tr><td colSpan={6} style={{ padding:40,textAlign:"center",color:"#94a3b8" }}>No transactions for this account yet.</td></tr>
                          :bankLedger.map((e,i)=>(
                            <tr key={e.id} style={{ borderTop:"1px solid #f1f5f9",background:i%2===0?"#fff":"#f8fafc" }}>
                              <td style={{ padding:"10px 14px",color:"#64748b" }}>{e.entry_date}</td>
                              <td style={{ padding:"10px 14px",color:"#1e293b",fontWeight:500 }}>{e.description}</td>
                              <td style={{ padding:"10px 14px",color:"#64748b" }}>{e.payee||"—"}</td>
                              <td style={{ padding:"10px 14px" }}><span style={{ background:"#f1f5f9",color:"#475569",borderRadius:20,padding:"2px 8px",fontSize:11 }}>{e.category}</span></td>
                              <td style={{ padding:"10px 14px" }}><span style={{ background:e.type==="Credits (Income)"?"#ecfdf5":"#fef2f2",color:e.type==="Credits (Income)"?"#10b981":"#ef4444",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:600 }}>{e.type==="Credits (Income)"?"Credit":"Debit"}</span></td>
                              <td style={{ padding:"10px 14px",fontWeight:700,color:e.type==="Credits (Income)"?"#10b981":"#ef4444" }}>{e.type==="Credits (Income)"?"+":"-"}OMR {parseFloat(e.amount||0).toFixed(3)}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
          {activeTab === "supplier_statement" && (
            <div>
              <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center" }}>
                <div style={{ fontWeight:700,fontSize:15,color:"#0f172a" }}>🏪 Supplier Statement</div>
                <select value={selectedSupplier} onChange={e=>{setSelectedSupplier(e.target.value);setSuppSubTab("all");}}
                  style={{ border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",fontSize:13,minWidth:220,outline:"none" }}>
                  <option value="">— Select a supplier —</option>
                  {bpSuppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {selectedSupplier && (
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {[["all","📋 All"],["vat","🧾 VAT Bills"],["normal","📄 Normal Bills"],["rent","🏠 Rent"],["utility","💡 Utility"],["vat_report","📊 VAT Report"]].map(([k,l])=>(
                      <button key={k} onClick={()=>setSuppSubTab(k)} style={{padding:"5px 12px",borderRadius:16,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:suppSubTab===k?"#6366f1":"#f1f5f9",color:suppSubTab===k?"#fff":"#64748b"}}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
              {!selectedSupplier ? (
                <div style={{ padding:40,textAlign:"center",color:"#94a3b8",background:"#f8fafc",borderRadius:12 }}>
                  Select a supplier above to view their complete statement (bills + payments + balance).
                </div>
              ) : (()=>{
                const supp = bpSuppliers.find(s=>s.id===selectedSupplier);
                const myBills = bpBills.filter(b=>b.supplier_id===selectedSupplier);
                const myPays = bpPayments.filter(p=>p.supplier_id===selectedSupplier);
                const opening = parseFloat(supp?.opening_balance||0);
                const billsTotal = myBills.reduce((s,b)=>s+parseFloat(b.total_amount||0),0);
                const paidTotal = myPays.reduce((s,p)=>s+parseFloat(p.amount||0),0);
                const balance = opening + billsTotal - paidTotal;
                // Filter bills by sub-tab
                const vatBills = myBills.filter(b=>parseFloat(b.vat_amount||0)>0.001);
                const normalBills = myBills.filter(b=>parseFloat(b.vat_amount||0)<=0.001 && (supp?.category==="Material Supplier"||supp?.category==="Subcontractor"||supp?.category==="Other"));
                const rentBills = myBills.filter(b=>supp?.category==="Rent / Hire" || (b.description||"").toLowerCase().includes("rent"));
                const utilityBills = myBills.filter(b=>supp?.category==="Utility");
                const displayBills = suppSubTab==="vat" ? vatBills : suppSubTab==="normal" ? normalBills : suppSubTab==="rent" ? rentBills : suppSubTab==="utility" ? utilityBills : myBills;
                // Transaction list
                const txns = [];
                if (opening>0) txns.push({ date: supp?.created_at?.split("T")[0]||"—", desc:"Opening balance", type:"bill", amount:opening, vat:0, net:opening });
                displayBills.forEach(b=>txns.push({ date:b.bill_date, desc:`Bill: ${b.description||b.bill_number||"—"}${b.site?" ("+b.site+")":""}`, type:"bill", amount:parseFloat(b.total_amount||0), vat:parseFloat(b.vat_amount||0), net:parseFloat(b.net_amount||0), site:b.site, billNo:b.bill_number }));
                if (suppSubTab==="all"||suppSubTab==="vat_report") myPays.forEach(p=>txns.push({ date:p.payment_date, desc:`Payment${p.notes?": "+p.notes:""}`, type:"payment", amount:parseFloat(p.amount||0), vat:0, net:0 }));
                txns.sort((a,b)=>(a.date<b.date?-1:1));
                let running=0;
                const totalVat = displayBills.reduce((s,b)=>s+parseFloat(b.vat_amount||0),0);
                const totalNet = displayBills.reduce((s,b)=>s+parseFloat(b.net_amount||0),0);

                // VAT Report special view
                if (suppSubTab==="vat_report") {
                  return (
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:12}}>📊 VAT Filing Report — {supp?.name}</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
                        {[["Total Bills",vatBills.length+" bills","#6366f1"],["Net Amount",`OMR ${totalNet.toFixed(3)}`,"#0ea5e9"],["VAT Amount (5%)",`OMR ${totalVat.toFixed(3)}`,"#f59e0b"],["Total (incl VAT)",`OMR ${(totalNet+totalVat).toFixed(3)}`,"#ef4444"]].map(([l,v,c])=>(
                          <div key={l} style={{background:"#fff",borderRadius:10,padding:"14px 16px",border:"1px solid #e2e8f0"}}>
                            <div style={{fontSize:10,color:"#64748b",fontWeight:600}}>{l}</div>
                            <div style={{fontSize:16,fontWeight:800,color:c,marginTop:4}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {supp?.cr_number && <div style={{fontSize:12,color:"#64748b",marginBottom:8}}>CR / Tax No: <strong>{supp.cr_number}</strong></div>}
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden"}}>
                        <thead><tr style={{background:"#f59e0b20"}}>
                          {["#","Date","Bill No","Description","Site","Net Amount","VAT (5%)","Total Amount"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",color:"#92400e",fontWeight:600,fontSize:11}}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {vatBills.length===0
                            ?<tr><td colSpan={8} style={{padding:40,textAlign:"center",color:"#94a3b8"}}>No VAT bills found for this supplier.</td></tr>
                            :vatBills.map((b,i)=>(
                              <tr key={b.id} style={{borderTop:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fffbeb"}}>
                                <td style={{padding:"8px 14px",color:"#94a3b8"}}>{i+1}</td>
                                <td style={{padding:"8px 14px",color:"#64748b"}}>{b.bill_date}</td>
                                <td style={{padding:"8px 14px",color:"#1e293b",fontWeight:600}}>{b.bill_number||"—"}</td>
                                <td style={{padding:"8px 14px",color:"#475569"}}>{b.description||"—"}</td>
                                <td style={{padding:"8px 14px",color:"#64748b"}}>{b.site||"—"}</td>
                                <td style={{padding:"8px 14px",color:"#0ea5e9",fontWeight:600}}>{parseFloat(b.net_amount||0).toFixed(3)}</td>
                                <td style={{padding:"8px 14px",color:"#f59e0b",fontWeight:700}}>{parseFloat(b.vat_amount||0).toFixed(3)}</td>
                                <td style={{padding:"8px 14px",color:"#ef4444",fontWeight:700}}>{parseFloat(b.total_amount||0).toFixed(3)}</td>
                              </tr>
                            ))
                          }
                          {vatBills.length>0 && (
                            <tr style={{borderTop:"2px solid #f59e0b",background:"#fffbeb",fontWeight:800}}>
                              <td colSpan={5} style={{padding:"10px 14px"}}>TOTAL VAT ({vatBills.length} bills)</td>
                              <td style={{padding:"10px 14px",color:"#0ea5e9"}}>{totalNet.toFixed(3)}</td>
                              <td style={{padding:"10px 14px",color:"#f59e0b"}}>{totalVat.toFixed(3)}</td>
                              <td style={{padding:"10px 14px",color:"#ef4444"}}>{(totalNet+totalVat).toFixed(3)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                return (
                  <div>
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16 }}>
                      {[["Opening Balance",`OMR ${opening.toFixed(3)}`,"#6366f1"],["Total Bills",`OMR ${billsTotal.toFixed(3)}`,"#0ea5e9"],["Total Paid",`OMR ${paidTotal.toFixed(3)}`,"#10b981"],["Balance Due",`OMR ${balance.toFixed(3)}`,balance>0.001?"#ef4444":"#10b981"]].map(([l,v,c])=>(
                        <div key={l} style={{ background:"#fff",borderRadius:10,padding:"14px 16px",border:"1px solid #e2e8f0" }}>
                          <div style={{ fontSize:10,color:"#64748b",fontWeight:600 }}>{l}</div>
                          <div style={{ fontSize:16,fontWeight:800,color:c,marginTop:4 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:12,color:"#64748b",marginBottom:8 }}>
                      {supp?.category}{supp?.phone?" · "+supp.phone:""}{supp?.cr_number?" · CR "+supp.cr_number:""}
                    </div>
                    {totalVat>0.001 && <div style={{fontSize:12,color:"#f59e0b",background:"#fffbeb",borderRadius:8,padding:"6px 12px",marginBottom:12}}>🧾 VAT in this view: OMR {totalVat.toFixed(3)} (Net: {totalNet.toFixed(3)})</div>}
                    <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden" }}>
                      <thead><tr style={{ background:"#f8fafc" }}>
                        {["Date","Description","Site","Net","VAT","Bill (+)","Payment (-)","Running Balance"].map(h=><th key={h} style={{ padding:"10px 14px",textAlign:"left",color:"#64748b",fontWeight:600,fontSize:11 }}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {txns.length===0
                          ?<tr><td colSpan={8} style={{ padding:40,textAlign:"center",color:"#94a3b8" }}>No transactions in this category.</td></tr>
                          :txns.map((t,i)=>{
                            running += t.type==="bill"?t.amount:-t.amount;
                            return (
                              <tr key={i} style={{ borderTop:"1px solid #f1f5f9",background:i%2===0?"#fff":"#f8fafc" }}>
                                <td style={{ padding:"10px 14px",color:"#64748b" }}>{t.date}</td>
                                <td style={{ padding:"10px 14px",color:"#1e293b",fontWeight:500 }}>{t.desc}</td>
                                <td style={{ padding:"10px 14px",color:"#64748b",fontSize:11 }}>{t.site||"—"}</td>
                                <td style={{ padding:"10px 14px",color:"#0ea5e9",fontSize:12 }}>{t.net>0?t.net.toFixed(3):"—"}</td>
                                <td style={{ padding:"10px 14px",color:"#f59e0b",fontSize:12 }}>{t.vat>0?t.vat.toFixed(3):"—"}</td>
                                <td style={{ padding:"10px 14px",color:"#0ea5e9",fontWeight:600 }}>{t.type==="bill"?t.amount.toFixed(3):"—"}</td>
                                <td style={{ padding:"10px 14px",color:"#10b981",fontWeight:600 }}>{t.type==="payment"?t.amount.toFixed(3):"—"}</td>
                                <td style={{ padding:"10px 14px",fontWeight:700,color:running>0.001?"#ef4444":"#10b981" }}>{running.toFixed(3)}</td>
                              </tr>
                            );
                          })
                        }
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
          {activeTab === "vat_report" && (() => {
            const filteredBills = bpBills.filter(b => {
              const d = b.bill_date;
              return (!startDate || d >= startDate) && (!endDate || d <= endDate);
            }).sort((a, b) => (a.bill_date || "").localeCompare(b.bill_date || ""));
            const getSupp = (id) => bpSuppliers.find(s => s.id === id);
            const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const getMonth = (d) => { try { return months[new Date(d).getMonth()]; } catch { return ""; } };
            const totNet = filteredBills.reduce((s, b) => s + parseFloat(b.net_amount || 0), 0);
            const totVat = filteredBills.reduce((s, b) => s + parseFloat(b.vat_amount || 0), 0);
            const totAll = filteredBills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
            const totRound = filteredBills.reduce((s, b) => { const r = parseFloat(b.total_amount||0) - parseFloat(b.net_amount||0) - parseFloat(b.vat_amount||0); return s + r; }, 0);
            return (
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>🧾 SEVEN SEAS MODERN ENTERPRISES</div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Purchase Bill Details — VAT Report {startDate && endDate ? `(${startDate} to ${endDate})` : "(All Time)"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
                  <KPI label="Total Bills" value={filteredBills.length} color="#6366f1" />
                  <KPI label="Net Value (OMR)" value={totNet.toFixed(3)} color="#1e293b" />
                  <KPI label="Total VAT (OMR)" value={totVat.toFixed(3)} color="#f59e0b" />
                  <KPI label="Grand Total (OMR)" value={totAll.toFixed(3)} color="#10b981" />
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#fff" }}>
                    <thead>
                      <tr style={{ background: "#fef9c3", borderBottom: "2px solid #eab308" }}>
                        {["AT", "Date", "Month", "P/E", "Invoice", "Supplier", "Value", "VAT", "Roundoff", "Total"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: h === "AT" ? "center" : "left", color: "#1e293b", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBills.map((b, i) => {
                        const supp = getSupp(b.supplier_id);
                        const net = parseFloat(b.net_amount || 0);
                        const vat = parseFloat(b.vat_amount || 0);
                        const total = parseFloat(b.total_amount || 0);
                        const roundoff = parseFloat((total - net - vat).toFixed(3));
                        return (
                          <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                            <td style={{ padding: "7px 10px", textAlign: "center", color: "#64748b", fontWeight: 600 }}>{i + 1}</td>
                            <td style={{ padding: "7px 10px", color: "#1e293b", whiteSpace: "nowrap" }}>{b.bill_date}</td>
                            <td style={{ padding: "7px 10px", color: "#6366f1", fontWeight: 600 }}>{getMonth(b.bill_date)}</td>
                            <td style={{ padding: "7px 10px" }}><span style={{ background: "#f1f5f9", color: "#475569", borderRadius: 10, padding: "1px 8px", fontSize: 10 }}>{supp?.category || "Purchase"}</span></td>
                            <td style={{ padding: "7px 10px", color: "#1e293b", fontWeight: 600 }}>{b.bill_number || "—"}</td>
                            <td style={{ padding: "7px 10px", color: "#1e293b", fontWeight: 600 }}>{supp?.name || "—"}</td>
                            <td style={{ padding: "7px 10px", color: "#1e293b", textAlign: "right" }}>{net.toFixed(3)}</td>
                            <td style={{ padding: "7px 10px", color: "#f59e0b", fontWeight: 700, textAlign: "right" }}>{vat > 0 ? vat.toFixed(3) : "—"}</td>
                            <td style={{ padding: "7px 10px", color: "#94a3b8", textAlign: "right" }}>{Math.abs(roundoff) > 0.001 ? roundoff.toFixed(3) : "—"}</td>
                            <td style={{ padding: "7px 10px", color: "#10b981", fontWeight: 700, textAlign: "right" }}>{total.toFixed(3)}</td>
                          </tr>
                        );
                      })}
                      {filteredBills.length === 0 && (
                        <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No bills found for the selected period.</td></tr>
                      )}
                    </tbody>
                    {filteredBills.length > 0 && (
                      <tfoot>
                        <tr style={{ background: "#fef9c3", borderTop: "2px solid #eab308", fontWeight: 800 }}>
                          <td colSpan={6} style={{ padding: "10px", textAlign: "right", fontSize: 12 }}>TOTAL</td>
                          <td style={{ padding: "10px", textAlign: "right", fontSize: 13 }}>{totNet.toFixed(3)}</td>
                          <td style={{ padding: "10px", textAlign: "right", color: "#f59e0b", fontSize: 13 }}>{totVat.toFixed(3)}</td>
                          <td style={{ padding: "10px", textAlign: "right", color: "#94a3b8", fontSize: 13 }}>{Math.abs(totRound) > 0.001 ? totRound.toFixed(3) : "—"}</td>
                          <td style={{ padding: "10px", textAlign: "right", color: "#10b981", fontSize: 13 }}>{totAll.toFixed(3)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            );
          })()}
          {activeTab === "executive" && (
            <div>
              <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                <KPI label="Total Contract Value" value={totalContract.toFixed(3)} color="#6366f1" />
                <KPI label="Total Received" value={totalReceived.toFixed(3)} color="#10b981" />
                <KPI label="Total Pending" value={(totalContract-totalReceived).toFixed(3)} color="#f59e0b" />
                <KPI label="Overall Progress" value={`${avgProgress}%`} unit="" color="#0ea5e9" />
                <KPI label="Cash Income (Period)" value={totalIncome.toFixed(3)} color="#10b981" />
                <KPI label="Cash Expenses (Period)" value={totalExpense.toFixed(3)} color="#ef4444" />
                <KPI label="Net Cash Balance" value={(totalIncome-totalExpense).toFixed(3)} color="#6366f1" />
                <KPI label="Active Projects" value={activeProjects} unit="sites" color="#f59e0b" />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12, borderBottom: "2px solid #e2e8f0", paddingBottom: 6 }}>Operational Summary</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ background: "#0f172a", color: "#fff" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Category</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Amount (OMR)</th>
                  </tr></thead>
                  <tbody>
                    {[
                      ["Total Contract Billing Sales", totalContract.toFixed(3), "#6366f1"],
                      ["Total Payment Receipts Collected", totalReceived.toFixed(3), "#10b981"],
                      ["Outstanding Client Billing Pending", (totalContract-totalReceived).toFixed(3), "#f59e0b"],
                      ["Subcontractor Total Commitments", totalSubContract.toFixed(3), "#8b5cf6"],
                      ["Subcontractor Payments Made", totalSubPaid.toFixed(3), "#10b981"],
                      ["Subcontractor Balance Pending", (totalSubContract-totalSubPaid).toFixed(3), "#ef4444"],
                      ["Total Commission Obligations", totalCommission.toFixed(3), "#8b5cf6"],
                      ["Commissions Paid", paidCommission.toFixed(3), "#10b981"],
                      ["Cash Ledger Net Balance", (totalIncome-totalExpense).toFixed(3), (totalIncome-totalExpense)>=0?"#10b981":"#ef4444"],
                    ].map(([l, v, c]) => (
                      <tr key={l} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 14px", color: "#1e293b" }}>{l}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: c }}>{v} OMR</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PROJECTS */}
          {activeTab === "projects" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                <KPI label="Total Projects" value={projects.length} unit="sites" color="#6366f1" />
                <KPI label="Active" value={projects.filter(p=>p.status==="Active").length} unit="sites" color="#10b981" />
                <KPI label="Completed" value={projects.filter(p=>p.status==="Completed").length} unit="sites" color="#64748b" />
                <KPI label="Total Contract" value={totalContract.toFixed(3)} color="#0ea5e9" />
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#0f172a", color: "#fff" }}>
                  {["Project","Customer","Location","Area (m²)","Contract (OMR)","Received (OMR)","Pending (OMR)","Progress","Status"].map(h=>
                    <th key={h} style={{ padding: "9px 10px", textAlign: "left", fontSize: 10 }}>{h}</th>
                  )}
                </tr></thead>
                <tbody>
                  {projWithSched.map((p, i) => {
                    const pct = p.amount > 0 ? Math.round((p.received/p.amount)*100) : 0;
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9", background: i%2===0?"#fff":"#f8fafc" }}>
                        <td style={{ padding: "9px 10px", fontWeight: 600, color: "#1e293b" }}>{p.name}</td>
                        <td style={{ padding: "9px 10px", color: "#475569" }}>{p.customer}</td>
                        <td style={{ padding: "9px 10px", color: "#64748b" }}>{p.location}</td>
                        <td style={{ padding: "9px 10px", color: "#64748b" }}>{p.sqm}</td>
                        <td style={{ padding: "9px 10px", color: "#1e293b" }}>{parseFloat(p.amount).toFixed(3)}</td>
                        <td style={{ padding: "9px 10px", color: "#10b981", fontWeight: 700 }}>{p.received.toFixed(3)}</td>
                        <td style={{ padding: "9px 10px", color: "#f59e0b", fontWeight: 700 }}>{(p.amount-p.received).toFixed(3)}</td>
                        <td style={{ padding: "9px 10px", minWidth: 100 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ flex: 1, background: "#e2e8f0", borderRadius: 4, height: 5 }}>
                              <div style={{ width: `${Math.min(pct,100)}%`, background: "#6366f1", borderRadius: 4, height: 5 }} />
                            </div>
                            <span style={{ fontSize: 10 }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "9px 10px" }}>
                          <span style={{ background: p.status==="Active"?"#ecfdf5":p.status==="Completed"?"#f1f5f9":"#fffbeb", color: p.status==="Active"?"#10b981":p.status==="Completed"?"#64748b":"#f59e0b", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{p.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: "2px solid #e2e8f0", background: "#f8fafc", fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: "10px" }}>TOTAL ({projects.length} projects)</td>
                    <td style={{ padding: "10px", color: "#6366f1" }}>{totalContract.toFixed(3)}</td>
                    <td style={{ padding: "10px", color: "#10b981" }}>{totalReceived.toFixed(3)}</td>
                    <td style={{ padding: "10px", color: "#f59e0b" }}>{(totalContract-totalReceived).toFixed(3)}</td>
                    <td colSpan={2} style={{ padding: "10px", color: "#6366f1" }}>{avgProgress}% avg</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* CASHBOOK */}
          {activeTab === "ledger" && (()=>{
            const cbEntries = filtLedger.filter(e => cbFilter==="All" || (cbFilter==="Credit" && e.type==="Credits (Income)") || (cbFilter==="Debit" && e.type==="Debits (Payouts)")).slice().sort((a,b) => (a.entry_date||"").localeCompare(b.entry_date||"") || (a.created_at||"").localeCompare(b.created_at||""));
            const cbCredits = cbEntries.filter(e=>e.type==="Credits (Income)").reduce((s,e)=>s+parseFloat(e.amount||0),0);
            const cbDebits  = cbEntries.filter(e=>e.type==="Debits (Payouts)").reduce((s,e)=>s+parseFloat(e.amount||0),0);
            const cbOpening = statementOpening;
            const cbClosing = cbOpening + cbCredits - cbDebits;
            let running = cbOpening;
            return (
            <div>
              <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center", flexWrap:"wrap" }}>
                {["All","Credit","Debit"].map(f=>(
                  <button key={f} onClick={()=>setCbFilter(f)} style={{padding:"6px 16px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:cbFilter===f?"#6366f1":"#f1f5f9", color:cbFilter===f?"#fff":"#64748b"}}>{f==="Credit"?"💚 Credits Only":f==="Debit"?"🔴 Debits Only":"All Entries"}</button>
                ))}
                <span style={{marginLeft:"auto", fontSize:12, color:"#64748b"}}>{cbEntries.length} entries</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 12 }}>
                <div style={{ background:"#ecfdf5", borderRadius:10, padding:"12px 16px", border:"1px solid #a7f3d0" }}>
                  <div style={{ fontSize:11, color:"#059669", fontWeight:700 }}>COMPANY TOTAL CREDITS (all time)</div>
                  <div style={{ fontSize:20, fontWeight:800, color:"#047857", marginTop:4 }}>OMR {allTimeCredits.toFixed(3)}</div>
                </div>
                <div style={{ background:"#fef2f2", borderRadius:10, padding:"12px 16px", border:"1px solid #fecaca" }}>
                  <div style={{ fontSize:11, color:"#dc2626", fontWeight:700 }}>COMPANY TOTAL DEBITS (all time)</div>
                  <div style={{ fontSize:20, fontWeight:800, color:"#b91c1c", marginTop:4 }}>OMR {allTimeDebits.toFixed(3)}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 12 }}>
                <div style={{ background:"#eef2ff", borderRadius:10, padding:"12px 14px", border:"1px solid #c7d2fe" }}>
                  <div style={{ fontSize:11, color:"#6366f1", fontWeight:700 }}>Opening Balance {startDate ? `(as of day before ${startDate})` : "(start)"}</div>
                  <div style={{ fontSize:18, fontWeight:800, color:"#4338ca", marginTop:4 }}>OMR {cbOpening.toFixed(3)}</div>
                  <div style={{ fontSize:10, color:"#64748b", marginTop:2 }}>Previous day closing / brought forward</div>
                </div>
                <div style={{ background:"#ecfdf5", borderRadius:10, padding:"12px 14px", border:"1px solid #a7f3d0" }}>
                  <div style={{ fontSize:11, color:"#059669", fontWeight:700 }}>Current Total Balance (all accounts · net cash)</div>
                  <div style={{ fontSize:18, fontWeight:800, color:"#047857", marginTop:4 }}>OMR {currentTotalBalance.toFixed(3)}</div>
                  <div style={{ fontSize:10, color:"#64748b", marginTop:2 }}>As of today · full ledger</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                <KPI label="Opening" value={cbOpening.toFixed(3)} color="#6366f1" />
                <KPI label="Credits (Income)" value={cbCredits.toFixed(3)} color="#10b981" />
                <KPI label="Debits (Expenses)" value={cbDebits.toFixed(3)} color="#ef4444" />
                <KPI label="Closing Balance" value={cbClosing.toFixed(3)} color={cbClosing>=0?"#0f172a":"#ef4444"} />
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ background: "#0f172a", color: "#fff" }}>
                  {["Date","Payee","Description","Category","Site","Mode","Credit (OMR)","Debit (OMR)","Balance"].map(h=>
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10 }}>{h}</th>
                  )}
                </tr></thead>
                <tbody>
                  <tr style={{ background:"#eef2ff", borderBottom:"1px solid #c7d2fe" }}>
                    <td style={{ padding:"8px 10px", color:"#64748b" }}>{startDate || "—"}</td>
                    <td style={{ padding:"8px 10px", fontWeight:700, color:"#4338ca" }} colSpan={5}>Opening Balance (brought forward)</td>
                    <td style={{ padding:"8px 10px" }}></td>
                    <td style={{ padding:"8px 10px" }}></td>
                    <td style={{ padding:"8px 10px", fontWeight:800, color:"#4338ca" }}>{cbOpening.toFixed(3)}</td>
                  </tr>
                  {cbEntries.map((e, i) => {
                    const isCredit = e.type==="Credits (Income)";
                    running += isCredit ? parseFloat(e.amount||0) : -parseFloat(e.amount||0);
                    return (
                    <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9", background: i%2===0?"#fff":"#f8fafc" }}>
                      <td style={{ padding: "7px 10px", color: "#64748b", whiteSpace: "nowrap" }}>{e.entry_date}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 600, color: "#1e293b" }}>{e.payee||"—"}</td>
                      <td style={{ padding: "7px 10px", color: "#475569" }}>{e.description}</td>
                      <td style={{ padding: "7px 10px", color: "#64748b" }}>{e.category}</td>
                      <td style={{ padding: "7px 10px", color: "#64748b" }}>{e.site||"—"}</td>
                      <td style={{ padding: "7px 10px", color: "#64748b" }}>{e.payment_mode||"Cash"}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 700, color: "#10b981" }}>{isCredit ? parseFloat(e.amount).toFixed(3) : "—"}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 700, color: "#ef4444" }}>{!isCredit ? parseFloat(e.amount).toFixed(3) : "—"}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 700, color: running>=0?"#6366f1":"#ef4444" }}>{running.toFixed(3)}</td>
                    </tr>
                    );
                  })}
                  <tr style={{ borderTop: "2px solid #e2e8f0", background: "#f8fafc", fontWeight: 700 }}>
                    <td colSpan={6} style={{ padding: "10px" }}>Period TOTAL ({cbEntries.length} entries)</td>
                    <td style={{ padding: "10px", color: "#10b981" }}>{cbCredits.toFixed(3)}</td>
                    <td style={{ padding: "10px", color: "#ef4444" }}>{cbDebits.toFixed(3)}</td>
                    <td style={{ padding: "10px", color: running>=0?"#6366f1":"#ef4444" }}>{running.toFixed(3)}</td>
                  </tr>
                  <tr style={{ background: "#ecfdf5", fontWeight: 800 }}>
                    <td colSpan={8} style={{ padding: "10px", color: "#047857" }}>Closing Balance (end of period)</td>
                    <td style={{ padding: "10px", color: cbClosing>=0?"#047857":"#ef4444" }}>{cbClosing.toFixed(3)}</td>
                  </tr>
                  <tr style={{ background: "#f0fdf4", fontWeight: 700 }}>
                    <td colSpan={8} style={{ padding: "10px", color: "#166534" }}>Current Total Balance (all-time net cash)</td>
                    <td style={{ padding: "10px", color: "#166534" }}>{currentTotalBalance.toFixed(3)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            );
          })()}

          {/* SUBCONTRACTORS */}
          {activeTab === "subcontractors" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                <KPI label="Total Subcontractors" value={[...new Set(subs.map(s=>s.name))].length} unit="contractors" color="#6366f1" />
                <KPI label="Total Contract Value" value={totalSubContract.toFixed(3)} color="#8b5cf6" />
                <KPI label="Total Pending" value={(totalSubContract-totalSubPaid).toFixed(3)} color="#f59e0b" />
              </div>
              {[...new Set(subs.map(s=>s.name))].map(name => {
                const works = subs.filter(s=>s.name===name);
                const total = works.reduce((t,w)=>t+parseFloat(w.contract_amount||0),0);
                const paid = works.reduce((t,w)=>t+parseFloat(w.paid||0),0);
                return (
                  <div key={name} style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 8, background: "#f8fafc", padding: "8px 12px", borderRadius: 8, borderLeft: "4px solid #6366f1" }}>
                      👷 {name} — Total: OMR {total.toFixed(3)} | Paid: OMR {paid.toFixed(3)} | Pending: OMR {(total-paid).toFixed(3)}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr style={{ background: "#334155", color: "#fff" }}>
                        {["Work / Project","Specialty","Contract (OMR)","Paid (OMR)","Pending (OMR)","%"].map(h=>
                          <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 10 }}>{h}</th>
                        )}
                      </tr></thead>
                      <tbody>
                        {works.map((w,i) => {
                          const pct = w.contract_amount>0?Math.round((w.paid/w.contract_amount)*100):0;
                          return (
                            <tr key={w.id} style={{ borderBottom: "1px solid #f1f5f9", background: i%2===0?"#fff":"#f8fafc" }}>
                              <td style={{ padding: "7px 10px", color: "#1e293b" }}>{w.project}</td>
                              <td style={{ padding: "7px 10px", color: "#6366f1", fontWeight: 600 }}>{w.specialty}</td>
                              <td style={{ padding: "7px 10px", color: "#1e293b" }}>{parseFloat(w.contract_amount).toFixed(3)}</td>
                              <td style={{ padding: "7px 10px", color: "#10b981", fontWeight: 700 }}>{parseFloat(w.paid).toFixed(3)}</td>
                              <td style={{ padding: "7px 10px", color: "#f59e0b", fontWeight: 700 }}>{(w.contract_amount-w.paid).toFixed(3)}</td>
                              <td style={{ padding: "7px 10px", color: "#6366f1" }}>{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {/* COMMISSIONS */}
          {activeTab === "commissions" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                <KPI label="Total Commissions" value={totalCommission.toFixed(3)} color="#8b5cf6" />
                <KPI label="Paid / Settled" value={paidCommission.toFixed(3)} color="#10b981" />
                <KPI label="Pending" value={(totalCommission-paidCommission).toFixed(3)} color="#f59e0b" />
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#0f172a", color: "#fff" }}>
                  {["Ref","Agent","Client","Site","Contract Value","Rate","Payout (OMR)","Status"].map(h=>
                    <th key={h} style={{ padding: "9px 10px", textAlign: "left", fontSize: 10 }}>{h}</th>
                  )}
                </tr></thead>
                <tbody>
                  {commissions.map((c,i) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9", background: i%2===0?"#fff":"#f8fafc" }}>
                      <td style={{ padding: "9px 10px", color: "#6366f1", fontFamily: "monospace" }}>{c.ref_number}</td>
                      <td style={{ padding: "9px 10px", fontWeight: 600, color: "#1e293b" }}>{c.agent_name}</td>
                      <td style={{ padding: "9px 10px", color: "#475569" }}>{c.client}</td>
                      <td style={{ padding: "9px 10px", color: "#64748b" }}>{c.site}</td>
                      <td style={{ padding: "9px 10px", color: "#1e293b" }}>{parseFloat(c.contract_value).toFixed(3)}</td>
                      <td style={{ padding: "9px 10px", color: "#6366f1" }}>{c.commission_rate}%</td>
                      <td style={{ padding: "9px 10px", color: "#8b5cf6", fontWeight: 700 }}>{parseFloat(c.computed_payout).toFixed(3)}</td>
                      <td style={{ padding: "9px 10px" }}>
                        <span style={{ background: c.status==="Settled"?"#ecfdf5":"#fffbeb", color: c.status==="Settled"?"#10b981":"#854d0e", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid #e2e8f0", background: "#f8fafc", fontWeight: 700 }}>
                    <td colSpan={6} style={{ padding: "10px" }}>TOTAL ({commissions.length} commissions)</td>
                    <td style={{ padding: "10px", color: "#8b5cf6" }}>{totalCommission.toFixed(3)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* PAYROLL */}
          {activeTab === "payroll" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                <KPI label="Total Employees" value={employees.length} unit="staff" color="#6366f1" />
                <KPI label="Active Employees" value={employees.filter(e=>e.status==="Active").length} unit="staff" color="#10b981" />
                <KPI label="Total Monthly Salary" value={employees.filter(e=>e.status==="Active").reduce((s,e)=>s+parseFloat(e.salary||0),0).toFixed(3)} color="#f59e0b" />
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#0f172a", color: "#fff" }}>
                  {["Employee","Role","Type","Salary (OMR/mo)","Daily Rate","Status"].map(h=>
                    <th key={h} style={{ padding: "9px 10px", textAlign: "left", fontSize: 10 }}>{h}</th>
                  )}
                </tr></thead>
                <tbody>
                  {employees.map((e,i) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9", background: i%2===0?"#fff":"#f8fafc" }}>
                      <td style={{ padding: "9px 10px", fontWeight: 600, color: "#1e293b" }}>{e.name}</td>
                      <td style={{ padding: "9px 10px", color: "#475569" }}>{e.role}</td>
                      <td style={{ padding: "9px 10px", color: "#6366f1", fontSize: 10 }}>{e.type}</td>
                      <td style={{ padding: "9px 10px", color: "#10b981", fontWeight: 700 }}>{parseFloat(e.salary||0).toFixed(3)}</td>
                      <td style={{ padding: "9px 10px", color: "#64748b" }}>{parseFloat(e.daily_rate||0).toFixed(3)}</td>
                      <td style={{ padding: "9px 10px" }}>
                        <span style={{ background: e.status==="Active"?"#ecfdf5":"#fef2f2", color: e.status==="Active"?"#10b981":"#ef4444", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{e.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PAYMENTS */}
          {activeTab === "payments" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                <KPI label="Total Billed" value={totalContract.toFixed(3)} color="#6366f1" />
                <KPI label="Collected" value={totalReceived.toFixed(3)} color="#10b981" />
                <KPI label="Outstanding" value={(totalContract-totalReceived).toFixed(3)} color="#f59e0b" />
              </div>
              {projWithSched.map((p, i) => {
                const pct = p.amount>0?Math.round((p.received/p.amount)*100):0;
                return (
                  <div key={p.id} style={{ marginBottom: 16, background: i%2===0?"#fff":"#f8fafc", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div><div style={{ fontWeight: 700, color: "#1e293b" }}>{p.name}</div><div style={{ fontSize: 12, color: "#64748b" }}>{p.customer}</div></div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#10b981", fontWeight: 700 }}>OMR {p.received.toFixed(3)}</div>
                        <div style={{ fontSize: 11, color: "#f59e0b" }}>OMR {(p.amount-p.received).toFixed(3)} pending</div>
                      </div>
                    </div>
                    <div style={{ background: "#e2e8f0", borderRadius: 4, height: 8 }}>
                      <div style={{ width: `${pct}%`, background: pct>=100?"#10b981":"#6366f1", borderRadius: 4, height: 8 }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{pct}% of OMR {parseFloat(p.amount).toFixed(3)} collected</div>
                  </div>
                );
              })}
            </div>
          )}


          {/* DAILY ATTENDANCE */}
          {activeTab === "attendance" && (() => {
            const today = new Date().toISOString().split("T")[0];
            const dayStart = startDate || attDay || today;
            const dayEnd = endDate || (startDate ? startDate : (attDay || today));
            const activeEmps = employees.filter(e => (e.status || "Active") !== "Inactive");
            const viewDates = [];
            {
              const cur = parseYMD(dayStart);
              const end = parseYMD(dayEnd);
              let n = 0;
              while (cur <= end && n < 62) {
                viewDates.push(toYMD(cur));
                cur.setDate(cur.getDate() + 1);
                n++;
              }
            }

            const buildDayRows = (d) => {
              return activeEmps.map(emp => {
                const rec = attendance.find(a => a.employee_id === emp.id && (a.att_date === d || a.work_date === d));
                let status = "Absent";
                let hours = 0, ot = 0, site = "", notes = "", checkIn = "", checkOut = "";
                if (rec) {
                  hours = parseFloat(rec.hours_worked || 0);
                  ot = parseFloat(rec.Overtime || 0);
                  if (!ot && hours > STD_WORK_HOURS) ot = hours - STD_WORK_HOURS;
                  site = rec.site || "Sinaw";
                  notes = rec.notes || "";
                  checkIn = rec.check_in || "";
                  checkOut = rec.check_out || "";
                  const n = (rec.notes || "").toLowerCase();
                  if (n === "absent" || (hours === 0 && n.includes("absent"))) status = "Absent";
                  else if (hours > 0 || n === "present") status = "Present";
                  else status = "Absent";
                }
                return { emp, status, hours, ot, site, notes, checkIn, checkOut };
              });
            };

            return (
              <div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16, background: "#f8fafc", padding: 14, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>From date</div>
                    <input type="date" value={startDate || attDay || today}
                      onChange={e => {
                        const v = e.target.value;
                        setStartDate(v);
                        setAttDay(v);
                        if (!endDate || endDate < v) setEndDate(v);
                      }}
                      style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>To date</div>
                    <input type="date" value={endDate || startDate || attDay || today}
                      onChange={e => {
                        const v = e.target.value;
                        setEndDate(v);
                        if (!startDate) { setStartDate(v); setAttDay(v); }
                      }}
                      style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13 }} />
                  </div>
                  <button type="button" onClick={() => {
                    const t0 = new Date().toISOString().split("T")[0];
                    setAttDay(t0); setStartDate(t0); setEndDate(t0);
                  }} style={{ background: "#eef2ff", color: "#6366f1", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Today</button>
                  <div style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>
                    Showing <strong>{viewDates.length}</strong> day{viewDates.length !== 1 ? "s" : ""}: {dayStart} → {dayEnd}
                  </div>
                </div>


                {viewDates.map(d => {
                  const rows = buildDayRows(d);
                  const present = rows.filter(r => r.status === "Present");
                  const absent = rows.filter(r => r.status === "Absent");
                  const withOT = rows.filter(r => r.ot > 0);
                  return (
                    <div key={d} style={{ marginBottom: 28 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 10, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, borderLeft: "4px solid #6366f1" }}>
                        📅 {d} — Present: {present.length} · Absent: {absent.length} · OT: {withOT.length} workers
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>✅ PRESENT ({present.length})</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
                        <thead>
                          <tr style={{ background: "#0f172a", color: "#fff" }}>
                            {["#", "Employee", "Role", "Group", "Hours", "OT (hrs)", "Site", "Notes"].map(h => (
                              <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {present.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: 12, color: "#94a3b8", textAlign: "center" }}>No one marked present</td></tr>
                          ) : present.map((r, i) => (
                            <tr key={r.emp.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 ? "#f8fafc" : "#fff" }}>
                              <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{i + 1}</td>
                              <td style={{ padding: "8px 10px", fontWeight: 700 }}>{r.emp.name}</td>
                              <td style={{ padding: "8px 10px", color: "#64748b" }}>{r.emp.role || "—"}</td>
                              <td style={{ padding: "8px 10px", color: "#64748b" }}>{r.emp.emp_group || "—"}</td>
                              <td style={{ padding: "8px 10px", fontWeight: 700, color: "#6366f1" }}>{r.hours.toFixed(1)}</td>
                              <td style={{ padding: "8px 10px", fontWeight: 700, color: r.ot > 0 ? "#f59e0b" : "#94a3b8" }}>{r.ot > 0 ? r.ot.toFixed(1) : "—"}</td>
                              <td style={{ padding: "8px 10px", color: "#64748b" }}>{r.site || "Sinaw"}</td>
                              <td style={{ padding: "8px 10px", color: "#64748b" }}>{r.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>❌ ABSENT ({absent.length})</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
                        <thead>
                          <tr style={{ background: "#7f1d1d", color: "#fff" }}>
                            {["#", "Employee", "Role", "Group", "Notes"].map(h => (
                              <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {absent.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: 12, color: "#94a3b8", textAlign: "center" }}>No absentees</td></tr>
                          ) : absent.map((r, i) => (
                            <tr key={r.emp.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 ? "#fff5f5" : "#fff" }}>
                              <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{i + 1}</td>
                              <td style={{ padding: "8px 10px", fontWeight: 700 }}>{r.emp.name}</td>
                              <td style={{ padding: "8px 10px", color: "#64748b" }}>{r.emp.role || "—"}</td>
                              <td style={{ padding: "8px 10px", color: "#64748b" }}>{r.emp.emp_group || "—"}</td>
                              <td style={{ padding: "8px 10px", color: "#64748b" }}>{r.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {withOT.length > 0 && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>⏱️ OVERTIME ({withOT.length})</div>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: "#78350f", color: "#fff" }}>
                                {["Employee", "Hours", "OT (hrs)", "Site"].map(h => (
                                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {withOT.map((r, i) => (
                                <tr key={r.emp.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 ? "#fffbeb" : "#fff" }}>
                                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{r.emp.name}</td>
                                  <td style={{ padding: "8px 10px" }}>{r.hours.toFixed(1)}</td>
                                  <td style={{ padding: "8px 10px", fontWeight: 800, color: "#f59e0b" }}>{r.ot.toFixed(1)}</td>
                                  <td style={{ padding: "8px 10px", color: "#64748b" }}>{r.site || "Sinaw"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Report Footer */}
          <div style={{ marginTop: 28, paddingTop: 14, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8" }}>
            <span>Minarva Biz ERP · TRATEEL AL NAJAH FOR TRADING · Oman</span>
            <span>Generated: {new Date().toLocaleString("en-OM")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
