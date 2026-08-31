import React, { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../context/AdminContext";
import EmployeeForm, { emptyEmp } from "../components/EmployeeForm";
import BankAccountSelect from "../components/BankAccountSelect";
import { getBankAccounts, createLedgerEntry } from "../lib/bankAccounts";
import { getGroups, saveGroups } from "../lib/groups";

const WORK_HOURS = 10;

function getPeriodDates(year, month) {
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const nm = month === 11 ? 0 : month + 1;
  const ny = month === 11 ? year + 1 : year;
  const start = `${year}-${String(month+1).padStart(2,"0")}-26`;
  const end = `${ny}-${String(nm+1).padStart(2,"0")}-25`;
  const label = `${M[month]}-${M[nm]} (${year})`;
  return { start, end, label, year, month };
}

function getCurrentPeriod() {
  // Salary period: 26th → 25th next month
  // If today is 1-25: current period started LAST month on 26th
  // If today is 26-31: current period started THIS month on 26th
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (day <= 25) {
    // Still in previous month's period (e.g. June 1 → May-Jun period)
    let m = month - 1, y = year;
    if (m < 0) { m = 11; y--; }
    return getPeriodDates(y, m);
  } else {
    // New period started (e.g. June 26 → Jun-Jul period)
    return getPeriodDates(year, month);
  }
}

function getSalaryPeriods() {
  const now = new Date(); const out = [];
  for (let i = 0; i < 12; i++) {
    let m = now.getMonth() - i, y = now.getFullYear();
    while (m < 0) { m += 12; y--; }
    out.push(getPeriodDates(y, m));
  }
  return out;
}

/** Period immediately before the given period (26→25 cycle). */
function getPreviousPeriod(period) {
  // period.start is YYYY-MM-26
  const [y, m] = period.start.split("-").map(Number);
  // previous period started one month earlier on the 26th
  let pm = m - 2; // m is 1-based month of start; go back one more month → 0-based for getPeriodDates
  let py = y;
  // getPeriodDates expects 0-based month
  // start month 1-based = m, previous start month 1-based = m-1
  let startMonth0 = m - 2; // 0-based month for previous period start
  if (startMonth0 < 0) { startMonth0 += 12; py = y - 1; }
  return getPeriodDates(py, startMonth0);
}

// Get all dates in a salary period (26th to 25th)
function getPeriodDays(period) {
  const days = [];
  // Parse date parts directly to avoid timezone shift
  const [sy, sm, sd] = period.start.split("-").map(Number);
  const [ey, em, ed] = period.end.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function printPayslip(emp, calc, period, co = {}) {
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>Payslip</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:28px;max-width:680px;margin:auto;color:#1e293b}
  .hdr{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:20px 24px;border-radius:12px 12px 0 0}
  .bdy{border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:22px}
  .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
  .total{background:#0f172a;color:white;padding:14px 18px;border-radius:8px;display:flex;justify-content:space-between;margin:12px 0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
  .card{background:#f8fafc;padding:10px 14px;border-radius:8px}
  .sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:36px}
  .sigbox{border-top:2px solid #0f172a;padding-top:8px;text-align:center;font-size:12px;color:#64748b}
  @media print{button{display:none}}</style></head><body>
  <div class="hdr">
    <div style="display:flex;justify-content:space-between">
      <div>${co.company_logo ? `<img src="${co.company_logo}" style="height:36px;margin-bottom:6px;object-fit:contain"/>` : ""}
        <div style="font-size:18px;font-weight:800">${co.company_name || "TRATEEL AL NAJAH CONSTRUCTION"}</div>
        <div style="font-size:11px;color:#94a3b8">${co.company_address || "Oman"} | ${co.company_phone || "+968 XXXX XXXX"}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:20px;font-weight:900;color:#60a5fa">PAYSLIP</div>
        <div style="font-size:12px;color:#94a3b8">Period: ${period.label}</div>
        <div style="font-size:12px;color:#94a3b8">${period.start} → ${period.end}</div>
      </div>
    </div>
  </div>
  <div class="bdy">
    <div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:8px">EMPLOYEE</div>
    <div class="grid">
      <div class="card"><div style="font-size:10px;color:#64748b">Name</div><div style="font-weight:700">${emp.name}</div></div>
      <div class="card"><div style="font-size:10px;color:#64748b">Designation</div><div style="font-weight:700">${emp.role || "—"}</div></div>
      <div class="card"><div style="font-size:10px;color:#64748b">Group</div><div style="font-weight:700">${emp.emp_group || "Group 1"}</div></div>
      <div class="card"><div style="font-size:10px;color:#64748b">Daily Rate</div><div style="font-weight:700;color:#6366f1">OMR ${parseFloat(emp.daily_rate || 0).toFixed(3)}</div></div>
    </div>
    <div style="font-size:11px;color:#64748b;font-weight:700;margin:14px 0 8px">EARNINGS & DEDUCTIONS</div>
    <div class="row"><span>Days Worked</span><span style="font-weight:600">${calc.totalDays} days (${calc.totalHours} hrs)</span></div>
    <div class="row"><span>Gross Salary</span><span style="font-weight:700;color:#6366f1">OMR ${calc.grossSalary.toFixed(3)}</span></div>
    <div class="row"><span style="color:#ef4444">Advance Paid</span><span style="color:#ef4444">OMR ${(calc.paidAdvance||0).toFixed(3)}</span></div>
    <div class="row"><span style="color:#ef4444">(-) Food</span><span style="color:#ef4444">OMR ${calc.food.toFixed(3)}</span></div>
    <div class="row"><span style="color:#ef4444">(-) Other</span><span style="color:#ef4444">OMR ${calc.other.toFixed(3)}</span></div>
    <div class="row"><span style="color:#10b981">(+) Incentive</span><span style="color:#10b981">OMR ${calc.incentive.toFixed(3)}</span></div>
    <div class="total"><span style="font-weight:700">NET SALARY PAYABLE</span><span style="font-weight:900;color:#60a5fa;font-size:18px">OMR ${calc.netSalary.toFixed(3)}</span></div>
    <div class="row"><span>Total Paid</span><span style="color:#10b981;font-weight:700">OMR ${calc.paidAmt.toFixed(3)}</span></div>
    <div class="row"><span>Balance</span><span style="color:${calc.balance > 0 ? "#f59e0b" : "#10b981"};font-weight:700">OMR ${calc.balance.toFixed(3)}</span></div>
    <div class="sig">
      <div class="sigbox"><div style="height:48px"></div>Authorized Signature<br>${co.company_name || "TRATEEL AL NAJAH"}</div>
      <div class="sigbox"><div style="height:48px"></div>Employee Signature<br>${emp.name}</div>
    </div>
  </div>
  <div style="text-align:center;margin-top:14px">
    <button onclick="window.print()" style="background:#6366f1;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">🖨 Print Payslip</button>
  </div></body></html>`);
  w.document.close();
}

function printReceipt(emp, payment, pr, co = {}) {
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>Receipt</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:28px;max-width:680px;margin:auto;color:#1e293b}
  .hdr{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:20px 24px;border-radius:12px 12px 0 0}
  .bdy{border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:22px}
  .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
  .amount{background:#0f172a;color:white;padding:16px 24px;border-radius:10px;text-align:center;margin:14px 0}
  .sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:36px}
  .sigbox{border-top:2px solid #0f172a;padding-top:8px;text-align:center;font-size:12px;color:#64748b}
  @media print{button{display:none}}</style></head><body>
  <div class="hdr">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>${co.company_logo ? `<img src="${co.company_logo}" style="height:40px;margin-bottom:6px;object-fit:contain"/>` : ""}
        <div style="font-size:18px;font-weight:800">${co.company_name || "TRATEEL AL NAJAH"}</div>
        <div style="font-size:11px;color:#94a3b8">${co.company_address || "Oman"}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:20px;font-weight:900;color:#60a5fa">PAYMENT RECEIPT</div>
        <div style="font-size:12px;color:#94a3b8">Date: ${payment.payment_date}</div>
        <div style="font-size:12px;color:#94a3b8">Ref: PAY-${(payment.id || "").substring(0, 8).toUpperCase()}</div>
      </div>
    </div>
  </div>
  <div class="bdy">
    <div class="row"><span style="color:#64748b">Employee</span><span style="font-weight:700">${emp.name}</span></div>
    <div class="row"><span style="color:#64748b">Designation</span><span>${emp.role || "—"}</span></div>
    ${pr ? `<div class="row"><span style="color:#64748b">Period</span><span>${pr.period_label || ""}</span></div>` : ""}
    <div class="amount">
      <div style="font-size:12px;color:#94a3b8;margin-bottom:4px">AMOUNT PAID (${payment.payment_type})</div>
      <div style="font-size:28px;font-weight:900;color:#60a5fa">OMR ${parseFloat(payment.amount).toFixed(3)}</div>
    </div>
    ${payment.notes ? `<div class="row"><span style="color:#64748b">Notes</span><span>${payment.notes}</span></div>` : ""}
    <div class="sig">
      <div class="sigbox"><div style="height:48px"></div>Authorized Signature<br>${co.company_name || "TRATEEL AL NAJAH"}</div>
      <div class="sigbox"><div style="height:48px"></div>Employee Signature<br>${emp.name}</div>
    </div>
  </div>
  <div style="text-align:center;margin-top:14px">
    <button onclick="window.print()" style="background:#6366f1;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">🖨 Print</button>
  </div></body></html>`);
  w.document.close();
}

// ─── ATTENDANCE GRID COMPONENT ───────────────────────────────────────────────
function AttendanceGrid({ employees, attendance, period, isAdmin, onSave, confirmAction, bankAccounts, logActivity }) {
  const [marks, setMarks] = useState({});
  const [otValues, setOtValues] = useState({});
  const [ltValues, setLtValues] = useState({});
  const [wuValues, setWuValues] = useState({});
  const [subList, setSubList] = useState([]);
  const [saving2, setSaving2] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { supabase.from("subcontractors").select("name").then(({data}) => { setSubList([...new Set((data||[]).map(s=>s.name).filter(Boolean))]); }); }, []);

  // Build days array
  const days = useMemo(() => {
    const result = [];
    const [sy, sm, sd] = period.start.split("-").map(Number);
    const [ey, em, ed] = period.end.split("-").map(Number);
    const cur = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    while (cur <= end) {
      result.push(
        cur.getFullYear() + "-" +
        String(cur.getMonth() + 1).padStart(2, "0") + "-" +
        String(cur.getDate()).padStart(2, "0")
      );
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [period.start, period.end]);

  // Build existing map
  const existing = useMemo(() => {
    const map = {};
    attendance.forEach(a => {
      const d = a.att_date || a.work_date;
      if (d && d >= period.start && d <= period.end) {
        map[a.employee_id + "|" + d] = a;
      }
    });
    return map;
  }, [attendance, period.start, period.end]);

  const getMark = (empId, date) => {
    const key = empId + "|" + date;
    if (marks[key] !== undefined) {
      return marks[key] === "DEL" ? null : marks[key];
    }
    const ex = existing[key];
    if (!ex) return null;
    const hrs = parseFloat(ex.hours_worked || 0);
    if (hrs === 0 && ex.notes === "Absent") return "A";
    return hrs > 0 ? "P" : null;
  };
  const getOt = (empId, date) => { const key = empId + "|" + date; if (otValues[key] !== undefined) return otValues[key]; const ex = existing[key]; if (!ex) return 0; const hrs = parseFloat(ex.hours_worked || 0); return hrs > 10 ? parseFloat((hrs - 10).toFixed(2)) : 0; };
  const getLt = (empId, date) => { const key = empId + "|" + date; if (ltValues[key] !== undefined) return ltValues[key]; const ex = existing[key]; if (!ex) return 0; const hrs = parseFloat(ex.hours_worked || 0); return (hrs > 0 && hrs < 10) ? parseFloat((10 - hrs).toFixed(2)) : 0; };
  const getWu = (empId, date) => { const key = empId + "|" + date; if (wuValues[key] !== undefined) return wuValues[key]; const ex = existing[key]; return ex && ex.worked_under ? ex.worked_under : ""; };

  const clickCell = (empId, date) => {
    if (!isAdmin) return;
    const key = empId + "|" + date;
    const cur = getMark(empId, date);
    setMarks(prev => {
      const next = { ...prev };
      if (!cur) next[key] = "P";
      else if (cur === "P") next[key] = "A";
      else next[key] = existing[key] ? "DEL" : (() => { delete next[key]; return "__DEL__"; })();
      if (next[key] === "__DEL__") delete next[key];
      return next;
    });
  };

  const pendingCount = Object.keys(marks).length + Object.keys(otValues).length + Object.keys(ltValues).length + Object.keys(wuValues).length;

  const doSave = async () => {
    if (!isAdmin) return;
    setSaving2(true); setMsg("⏳ Saving...");
    const allKeys = new Set([...Object.keys(marks), ...Object.keys(otValues), ...Object.keys(ltValues), ...Object.keys(wuValues)]);
    const deleteIds = [], updates = [], inserts = [];
    for (const key of allKeys) {
      const bar = key.indexOf("|"); const empId = key.substring(0, bar); const date = key.substring(bar + 1);
      if (marks[key] === "DEL") { const ex = existing[key]; if (ex) deleteIds.push(ex.id); continue; }
      const status = marks[key] || getMark(empId, date); if (!status) continue;
      const ot = getOt(empId, date), lt = getLt(empId, date), wu = getWu(empId, date);
      const hrs = status === "P" ? 10 + ot - lt : 0;
      const payload = { employee_id: empId, att_date: date, work_date: date, hours_worked: hrs, days_worked: parseFloat((hrs / 10).toFixed(2)),
        worked_under: status === "A" ? "" : wu, notes: status === "A" ? "Absent" : (ot > 0 ? `OT +${ot}h` : lt > 0 ? `Short -${lt}h` : "Present") + (wu ? ` · under ${wu}` : "") };
      const ex = existing[key]; if (ex) updates.push({ id: ex.id, payload }); else inserts.push(payload);
    }
    try {
      const ops = [];
      if (deleteIds.length) ops.push(supabase.from("attendance").delete().in("id", deleteIds));
      if (inserts.length) ops.push(supabase.from("attendance").insert(inserts));
      for (const u of updates) ops.push(supabase.from("attendance").update(u.payload).eq("id", u.id));
      await Promise.all(ops);
      setMarks({}); setOtValues({}); setLtValues({}); setWuValues({});
      setMsg("✅ Saved " + (deleteIds.length + inserts.length + updates.length) + " records");
      logActivity("Marked attendance", (deleteIds.length + inserts.length + updates.length) + " records", "Payroll");
      await onSave();
    } catch (e) { setMsg("❌ " + (e.message || "Save failed")); }
    setSaving2(false);
  };

  const handleSaveAll = () => {
    if (pendingCount === 0 || !isAdmin) return;
    if (window.confirm(`Save ${pendingCount} attendance change(s)?\nAdmin confirmation required.`)) {
      doSave();
    }
  };

  // Group employees
  const groups = {};
  employees.filter(e => e.status === "Active" && (e.staff_type || "") !== "Fixed Monthly").forEach(e => {
    const g = e.emp_group || "Group 1";
    if (!groups[g]) groups[g] = [];
    groups[g].push(e);
  });

  const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 11 }}>
          {[["#6366f1", "P = Present (1 day)"], ["#10b981", "P+OT = Overtime"], ["#f59e0b", "P-LT = Less time"], ["#ef4444", "A = Absent"]].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: "inline-block" }} />
              <span style={{ color: "#64748b" }}>{l}</span>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {msg && <span style={{ fontSize: 12, color: msg.startsWith("✅") ? "#10b981" : "#ef4444", fontWeight: 600 }}>{msg}</span>}
          {pendingCount > 0 && <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20, border: "1px solid #f59e0b" }}>{pendingCount} unsaved</span>}
          {isAdmin && (
            <button
              onClick={handleSaveAll}
              disabled={saving2 || pendingCount === 0}
              style={{ background: pendingCount > 0 && !saving2 ? "#6366f1" : "#e2e8f0", color: pendingCount > 0 && !saving2 ? "#fff" : "#94a3b8", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: pendingCount > 0 && !saving2 ? "pointer" : "not-allowed" }}>
              {saving2 ? "⏳ Saving..." : `💾 Save All${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: "max-content" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 3 }}>
            <tr style={{ background: "#0f172a", color: "#fff" }}>
              <th style={{ padding: "10px 14px", textAlign: "left", position: "sticky", left: 0, top: 0, background: "#0f172a", zIndex: 4, minWidth: 140, whiteSpace: "nowrap" }}>Employee</th>
              {days.map(date => {
                const dow = new Date(date.replace(/-/g, "/")).getDay();
                const isFri = dow === 5;
                const day = parseInt(date.split("-")[2]);
                const mon = date.substring(5, 7);
                return (
                  <th key={date} style={{ padding: "3px 2px", textAlign: "center", background: isFri ? "#1e293b" : "#0f172a", minWidth: 46 }}>
                    <div style={{ fontSize: 8, color: "#94a3b8" }}>{DOW[dow]}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1 }}>{day}</div>
                    <div style={{ fontSize: 8, color: "#64748b" }}>{mon}</div>
                  </th>
                );
              })}
              <th style={{ padding: "8px", textAlign: "center", background: "#0f172a", minWidth: 50, whiteSpace: "nowrap" }}>Days</th>
              <th style={{ padding: "8px", textAlign: "center", background: "#065f46", minWidth: 50, whiteSpace: "nowrap" }}>Tot OT</th>
              <th style={{ padding: "8px", textAlign: "center", background: "#78350f", minWidth: 50, whiteSpace: "nowrap" }}>Tot LT</th>
              <th style={{ padding: "8px", textAlign: "center", background: "#0f172a", minWidth: 80, whiteSpace: "nowrap" }}>Gross OMR</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).sort().map(([group, emps]) => (
              <Fragment key={group}>
                <tr>
                  <td colSpan={days.length + 5} style={{ padding: "5px 14px", background: "#1e3a5f", color: "#60a5fa", fontWeight: 700, fontSize: 11 }}>▸ {group}</td>
                </tr>
                {emps.sort((a, b) => a.name.localeCompare(b.name)).map((emp, ei) => {
                  let totalHrs = 0, totalOt = 0, totalLt = 0;
                  days.forEach(date => {
                    const m = getMark(emp.id, date);
                    if (m === "P") {
                      const o = getOt(emp.id, date), l = getLt(emp.id, date);
                      totalHrs += 10 + o - l; totalOt += o; totalLt += l;
                    }
                  });
                  const totalDays = parseFloat((totalHrs / 10).toFixed(2));
                  const gross = parseFloat((totalDays * parseFloat(emp.daily_rate || 0)).toFixed(3));

                  return (
                    <tr key={emp.id} style={{ borderTop: "1px solid #f1f5f9", background: ei % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      <td style={{ padding: "7px 14px", position: "sticky", left: 0, background: ei % 2 === 0 ? "#fff" : "#f8fafc", zIndex: 1, whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 12 }}>{emp.name}</div>
                        <div style={{ fontSize: 10, color: "#6366f1" }}>OMR {parseFloat(emp.daily_rate || 0).toFixed(3)}/d</div>
                      </td>
                      {days.map(date => {
                        const key = emp.id + "|" + date;
                        const mark = getMark(emp.id, date);
                        const ot = getOt(emp.id, date);
                        const lt = getLt(emp.id, date);
                        const wu = getWu(emp.id, date);
                        const dow = new Date(date.replace(/-/g, "/")).getDay();
                        const isFri = dow === 5;
                        const isChanged = marks[key] !== undefined || otValues[key] !== undefined || ltValues[key] !== undefined || wuValues[key] !== undefined;
                        const bg = !mark ? (isFri ? "#fef9f9" : "#f8fafc") : mark === "A" ? "#fef2f2" : wu ? "#fffaf0" : ot > 0 ? "#f0fdf4" : lt > 0 ? "#fffbeb" : "#eef2ff";
                        return (
                          <td key={date} style={{ padding: "1px", textAlign: "center", background: bg, cursor: isAdmin ? "pointer" : "default", outline: isChanged ? "2px solid #f59e0b" : "none", outlineOffset: "-1px", verticalAlign: "top" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2px 0", minHeight: 34 }}>
                              <div onClick={() => clickCell(emp.id, date)} style={{ width: 26, height: 18, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: isAdmin ? "pointer" : "default", background: mark ? (mark === "A" ? "#ef4444" : "#6366f1") : "transparent", color: mark ? "#fff" : isFri ? "#fca5a5" : "#cbd5e1", border: mark ? "none" : "1px dashed #e2e8f0" }}>
                                {mark || "—"}
                              </div>
                              {mark === "P" && (ot > 0 || lt > 0) && (<div style={{ fontSize: 8, color: ot > 0 ? "#10b981" : "#f59e0b", fontWeight: 700 }}>{ot > 0 ? `OT+${ot}` : `LT-${lt}`}</div>)}
                              {mark === "P" && wu && (<div title={`Under ${wu}`} style={{ fontSize: 7, color: "#92400e", background: "#fde68a", borderRadius: 3, padding: "0 3px", marginTop: 1, fontWeight: 700, maxWidth: 34, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>👷{wu.slice(0,5)}</div>)}
                              {isAdmin && mark === "P" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }} onClick={e => e.stopPropagation()}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 1 }}><span style={{ fontSize: 8, color: "#10b981", fontWeight: 700, width: 12 }}>OT</span><input type="text" inputMode="decimal" value={ot || ""} placeholder="0" onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ""); setOtValues(prev => ({ ...prev, [key]: parseFloat(v) || 0 })); }} style={{ width: 28, fontSize: 10, border: "1px solid #10b981", borderRadius: 2, padding: "1px", textAlign: "center", color: "#10b981", fontWeight: 700 }} /></div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 1 }}><span style={{ fontSize: 8, color: "#f59e0b", fontWeight: 700, width: 12 }}>LT</span><input type="text" inputMode="decimal" value={lt || ""} placeholder="0" onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ""); setLtValues(prev => ({ ...prev, [key]: parseFloat(v) || 0 })); }} style={{ width: 28, fontSize: 10, border: "1px solid #f59e0b", borderRadius: 2, padding: "1px", textAlign: "center", color: "#f59e0b", fontWeight: 700 }} /></div>
                                  <select value={wu} onChange={e => setWuValues(prev => ({ ...prev, [key]: e.target.value }))} title="Who worked for today" style={{ width: 44, fontSize: 8, border: "1px solid #cbd5e1", borderRadius: 2, padding: "1px", color: wu ? "#92400e" : "#64748b", fontWeight: 700, background: wu ? "#fef3c7" : "#fff" }}><option value="">🏢Co</option>{subList.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                </div>
                              )}
                              {isAdmin && existing[key] && marks[key] !== "DEL" && (<div onClick={e => { e.stopPropagation(); if (window.confirm("Delete?")) { const ex = existing[key]; if (ex) supabase.from("attendance").delete().eq("id", ex.id).then(() => { onSave(); setMsg("✅ Deleted"); }); } }} style={{ fontSize: 8, color: "#ef4444", cursor: "pointer", marginTop: 1 }}>✕del</div>)}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, color: "#6366f1", fontSize: 12 }}>{totalDays}</td>
                      <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, color: "#10b981", fontSize: 12 }}>{totalOt > 0 ? `+${totalOt.toFixed(1)}` : "—"}</td>
                      <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, color: "#f59e0b", fontSize: 12 }}>{totalLt > 0 ? `-${totalLt.toFixed(1)}` : "—"}</td>
                      <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, color: "#10b981", fontSize: 12 }}>{gross.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ─── MAIN PAYROLL COMPONENT ──────────────────────────────────────────────────
export default function Payroll() {
  const { isAdmin: realIsAdmin, canEdit, setShowLogin, confirmAction, logActivity } = useAdmin();
  const isAdmin = canEdit("payroll");
  const periods = getSalaryPeriods();
  const [tab, setTab] = useState("employees");
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentPeriod());
  const [company, setCompany] = useState({});
  const [saving, setSaving] = useState(false);
  const [groupFilter, setGroupFilter] = useState("All");

  const [showEmpForm, setShowEmpForm] = useState(false);
  const [editEmpData, setEditEmpData] = useState(null);
  const [viewEmp, setViewEmp] = useState(null);
  const [showPayForm, setShowPayForm] = useState(false);
  const [expandedEmpId, setExpandedEmpId] = useState(null);
  const [deductForms, setDeductForms] = useState({});
  const [payForm, setPayForm] = useState({
    employee_id: "", amount: "", payment_type: "Salary",
    payment_date: new Date().toISOString().split("T")[0], notes: "",
    bank_account_id: ""
  });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [groups, setGroups] = useState(["Group 1","Group 2","Group 3","Group 4","Group 5","Group 6"]);
  const [showGroupMgr, setShowGroupMgr] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupIdx, setEditingGroupIdx] = useState(null);
  const [editGroupName, setEditGroupName] = useState("");

  useEffect(() => { 
    loadAll(); 
    loadCo();
    getBankAccounts().then(setBankAccounts);
    getGroups().then(setGroups);
  }, []);

  const addGroup = async () => {
    const name = newGroupName.trim();
    if (!name || groups.includes(name)) { setNewGroupName(""); return; }
    const updated = [...groups, name];
    setGroups(updated);
    setNewGroupName("");
    await saveGroups(updated);
  };

  const renameGroup = async (idx) => {
    const name = editGroupName.trim();
    if (!name) { setEditingGroupIdx(null); return; }
    const oldName = groups[idx];
    const updated = groups.map((g, i) => i === idx ? name : g);
    setGroups(updated);
    setEditingGroupIdx(null);
    await saveGroups(updated);
    // Reassign employees from old group name to new name
    if (oldName !== name) {
      await supabase.from("employees").update({ emp_group: name }).eq("emp_group", oldName);
      await loadAll();
    }
  };

  const deleteGroup = async (idx) => {
    const name = groups[idx];
    confirmAction(`Delete "${name}"? Employees in this group will be moved to ${groups[0] || "Group 1"}.`, async () => {
      const updated = groups.filter((_, i) => i !== idx);
      setGroups(updated);
      await saveGroups(updated);
      await supabase.from("employees").update({ emp_group: updated[0] || "Group 1" }).eq("emp_group", name);
      await loadAll();
    });
  };

  const loadCo = async () => {
    const { data } = await supabase.from("app_settings").select("*");
    if (data) { const m = {}; data.forEach(r => { m[r.key] = r.value; }); setCompany(m); }
  };

  const loadAll = async () => {
    setLoading(true);
    const [e, a, p, py] = await Promise.all([
      supabase.from("employees").select("*").order("name"),
      supabase.from("attendance").select("*").order("att_date", { ascending: false }),
      supabase.from("salary_payments").select("*").order("payment_date", { ascending: false }),
      supabase.from("payroll").select("*").order("period_start", { ascending: false }),
    ]);
    setEmployees(e.data || []);
    setAttendance(a.data || []);
    setPayments(p.data || []);
    setPayrollRecords(py.data || []);
    setLoading(false);
  };

  const periodAtt = (empId) => { const filtered = attendance.filter(a => { const d = a.att_date || a.work_date; return a.employee_id === empId && d >= selectedPeriod.start && d <= selectedPeriod.end; }); const byDate = {}; filtered.forEach(a => { byDate[a.att_date || a.work_date] = a; }); return Object.values(byDate); };

  const calcPayroll = (emp) => {
    const isFixedMonthly = (emp.staff_type || "") === "Fixed Monthly";
    const att = isFixedMonthly ? [] : periodAtt(emp.id);
    const totalHours = parseFloat(att.reduce((s, a) => s + parseFloat(a.hours_worked || 0), 0).toFixed(2));
    const totalDays = isFixedMonthly ? 0 : parseFloat((totalHours / WORK_HOURS).toFixed(2));
    let totalOt = 0, totalLt = 0; att.forEach(a => { const h = parseFloat(a.hours_worked || 0); if (h > WORK_HOURS) totalOt += (h - WORK_HOURS); else if (h > 0 && h < WORK_HOURS) totalLt += (WORK_HOURS - h); }); totalOt = parseFloat(totalOt.toFixed(2)); totalLt = parseFloat(totalLt.toFixed(2));
    const dailyRate = parseFloat(emp.daily_rate || 0);
    // Fixed Monthly (DEEPU): daily_rate = full monthly package; no attendance required
    const grossSalary = isFixedMonthly
      ? parseFloat(dailyRate.toFixed(3))
      : parseFloat((dailyRate * totalDays).toFixed(3));
    const pr = payrollRecords.find(p => p.employee_id === emp.id && p.period_start === selectedPeriod.start);
    const df = deductForms[emp.id] || {};
    const advance = pr ? parseFloat(pr.advance_deduction || 0) : parseFloat(df.advance || 0);
    const food = pr ? parseFloat(pr.food_deduction || 0) : parseFloat(df.food || 0);
    const other = pr ? parseFloat(pr.other_deduction || 0) : parseFloat(df.other || 0);
    const incentive = pr ? parseFloat(pr.incentive || 0) : parseFloat(df.incentive || 0);
    // --- Auto carry-forward: all unpaid earnings before this period ---
    // Gross from attendance before selectedPeriod.start
    const priorAtt = attendance.filter(a => {
      if (a.employee_id !== emp.id) return false;
      const d = a.att_date || a.work_date;
      return d && d < selectedPeriod.start;
    });
    const priorByDate = {};
    priorAtt.forEach(a => { priorByDate[a.att_date || a.work_date] = a; });
    const priorHours = Object.values(priorByDate).reduce((s, a) => s + parseFloat(a.hours_worked || 0), 0);
    const priorDays = parseFloat((priorHours / WORK_HOURS).toFixed(2));
    const priorGross = parseFloat((dailyRate * priorDays).toFixed(3));
    // Payments dated before this period
    const empPaymentsAll = payments.filter(p => p.employee_id === emp.id);
    const priorPaid = empPaymentsAll
      .filter(p => p.payment_date && p.payment_date < selectedPeriod.start)
      .reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    // Seed from employee.opening_balance only as legacy adjustment (manual arrears before attendance started)
    const seedBal = emp.opening_balance !== null && emp.opening_balance !== undefined ? parseFloat(emp.opening_balance) : 0;
    // Prefer live prior balance; if no prior attendance/payments, fall back to seed only
    const autoCarry = parseFloat((priorGross - priorPaid).toFixed(3));
    // Avoid double-counting: if we already set opening_balance FROM prior period, don't add both.
    // Use autoCarry when there is any prior attendance; otherwise use seedBal.
    const openingBal = priorHours > 0 || priorPaid > 0 ? autoCarry : seedBal;
    const netSalary = parseFloat((grossSalary - advance - food - other + incentive).toFixed(3));
    // Match payments by payroll_id OR by unlinked payment within the period
    const empPayments = empPaymentsAll;
    const periodPayments = empPayments.filter(p => {
      if (pr && p.payroll_id === pr.id) return true;
      if (!p.payroll_id && p.payment_date >= selectedPeriod.start && p.payment_date <= selectedPeriod.end) return true;
      return false;
    });
    const finalPayments = periodPayments.length > 0 ? periodPayments : empPayments.filter(p => !p.payroll_id && p.payment_date >= selectedPeriod.start && p.payment_date <= selectedPeriod.end);
    const paidAmt = finalPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const paidAdvance = finalPayments.filter(p => p.payment_type === "Advance").reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const paidSalary = finalPayments.filter(p => p.payment_type !== "Advance").reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    // Total balance = this period net + carried previous arrears − paid this period
    const balance = parseFloat((netSalary + openingBal - paidAmt).toFixed(3));
    return { totalHours, totalDays, totalOt, totalLt, grossSalary, advance, food, other, incentive, netSalary, openingBal, paidAmt, paidAdvance, paidSalary, balance, payrollRecord: pr };
  };

  const saveEmployee = async (formData) => {
    if (!isAdmin) { setShowLogin(true); return; }
    if (!formData.name) { alert("Please enter employee name"); return; }
    setSaving(true);
    try {
      const corePayload = {
        name: formData.name,
        phone: formData.phone_oman || null,
        daily_rate: parseFloat(formData.daily_rate) || 0,
        status: formData.status || "Active",
        emp_group: formData.emp_group || "Group 1",
        opening_balance: formData.opening_balance !== "" && formData.opening_balance !== null && formData.opening_balance !== undefined ? parseFloat(formData.opening_balance) : 0,
      };
      const extPayload = {
        role: formData.role || null,
        nationality: formData.nationality || null,
        phone_home: formData.phone_home || null,
        staff_type: formData.staff_type || "Own Staff",
        passport_no: formData.passport_no || null,
        ptaka_no: formData.ptaka_no || null,
        visa_no: formData.visa_no || null,
        bank_name: formData.bank_name || null,
        bank_branch: formData.bank_branch || null,
        account_no: formData.account_no || null,
        iban: formData.iban || null,
        join_date: formData.join_date ? formData.join_date : null,
        work_start: formData.work_start || "07:00",
        work_end: formData.work_end || "18:00",
        break_start: formData.break_start || "13:00",
        break_end: formData.break_end || "14:00",
      };
      const payload = { ...corePayload, ...extPayload };

      if (editEmpData) {
        const { error } = await supabase.from("employees").update(payload).eq("id", editEmpData.id);
        if (error) {
          const { error: e2 } = await supabase.from("employees").update(corePayload).eq("id", editEmpData.id);
          if (e2) throw e2;
          alert("⚠ Some fields not saved — run the SQL setup script in Supabase.");
        }
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) {
          const { error: e2 } = await supabase.from("employees").insert(corePayload);
          if (e2) throw e2;
          alert("⚠ Saved with basic info only. Run SQL setup script for all fields.");
        }
      }
      setShowEmpForm(false); setEditEmpData(null); setViewEmp(null);
      await loadAll();
    } catch (err) {
      alert("Save failed: " + (err.message || JSON.stringify(err)));
    }
    setSaving(false);
  };

  const deleteEmployee = (emp) => {
    if (!isAdmin) { setShowLogin(true); return; }
    confirmAction(`Delete employee "${emp.name}"?`, async () => {
      await supabase.from("salary_payments").delete().eq("employee_id", emp.id);
      await supabase.from("payroll").delete().eq("employee_id", emp.id);
      await supabase.from("attendance").delete().eq("employee_id", emp.id);
      await supabase.from("employees").delete().eq("id", emp.id);
      setViewEmp(null); await loadAll();
    });
  };

  const saveDeductions = async (emp) => {
    if (!isAdmin) { setShowLogin(true); return; }
    const calc = calcPayroll(emp);
    const df = deductForms[emp.id] || {};
    const advance = parseFloat(df.advance || calc.advance);
    const food = parseFloat(df.food || calc.food);
    const other = parseFloat(df.other || calc.other);
    const incentive = parseFloat(df.incentive || calc.incentive);
    const netSalary = parseFloat((calc.grossSalary - advance - food - other + incentive).toFixed(3));
    const data = {
      employee_id: emp.id, period_label: selectedPeriod.label,
      period_start: selectedPeriod.start, period_end: selectedPeriod.end,
      total_days: calc.totalDays, total_hours: calc.totalHours,
      gross_salary: calc.grossSalary, advance_deduction: advance,
      food_deduction: food, other_deduction: other, incentive,
      net_salary: netSalary, status: "Pending"
    };
    if (calc.payrollRecord) await supabase.from("payroll").update(data).eq("id", calc.payrollRecord.id);
    else await supabase.from("payroll").insert(data);
    await loadAll();
    alert("✅ Saved!");
  };

  const [editingPayment, setEditingPayment] = useState(null);

  const editPayment = (payment) => {
    if (!isAdmin) { setShowLogin(true); return; }
    confirmAction(`Edit this payment of OMR ${parseFloat(payment.amount).toFixed(3)}? Admin confirmation required.`, () => {
      setPayForm({
        employee_id: payment.employee_id,
        amount: String(payment.amount),
        payment_type: payment.payment_type || "Salary",
        payment_date: payment.payment_date,
        notes: payment.notes || "",
        bank_account_id: payment.bank_account_id || "",
      });
      setEditingPayment(payment.id);
      setShowPayForm(true);
    });
  };

  const deletePayment = (id, amount, empName) => {
    if (!isAdmin) { setShowLogin(true); return; }
    confirmAction(`Delete payment of OMR ${parseFloat(amount).toFixed(3)} for ${empName}? This cannot be undone.`, async () => {
      await supabase.from("salary_payments").delete().eq("id", id);
      await loadAll();
    });
  };

  const addPayment = async () => {
    if (!isAdmin) { setShowLogin(true); return; }
    if (!payForm.employee_id || !payForm.amount) return;
    setSaving(true);
    // Edit existing payment
    if (editingPayment) {
      await supabase.from("salary_payments").update({
        amount: parseFloat(payForm.amount),
        payment_type: payForm.payment_type,
        payment_date: payForm.payment_date,
        notes: payForm.notes,
        bank_account_id: payForm.bank_account_id || null,
      }).eq("id", editingPayment);
      setEditingPayment(null);
      setPayForm({ employee_id: "", amount: "", payment_type: "Salary", payment_date: new Date().toISOString().split("T")[0], notes: "" });
      setShowPayForm(false);
      await loadAll();
      setSaving(false);
      return;
    }
    const emp = employees.find(e => e.id === payForm.employee_id);
    const calc = calcPayroll(emp);
    let prId = calc.payrollRecord?.id;
    if (!prId) {
      const { data: pr } = await supabase.from("payroll").insert({
        employee_id: payForm.employee_id, period_label: selectedPeriod.label,
        period_start: selectedPeriod.start, period_end: selectedPeriod.end,
        total_days: calc.totalDays, total_hours: calc.totalHours,
        gross_salary: calc.grossSalary, net_salary: calc.netSalary, status: "Pending"
      }).select().single();
      prId = pr?.id;
    }
    const { data: paymentData } = await supabase.from("salary_payments").insert({
      employee_id: payForm.employee_id, payroll_id: prId,
      amount: parseFloat(payForm.amount), payment_type: payForm.payment_type,
      payment_date: payForm.payment_date, notes: payForm.notes,
      bank_account_id: payForm.bank_account_id || null,
    }).select().single();
    // Auto ledger entry
    if (payForm.bank_account_id) {
      const emp = employees.find(e => e.id === payForm.employee_id);
      await createLedgerEntry({
        bank_account_id: payForm.bank_account_id,
        bank_accounts: bankAccounts,
        type: "Debits (Payouts)",
        category: "Payroll",
        description: `${payForm.payment_type} - ${emp?.name || ""}`,
        payee: emp?.name || "",
        amount: payForm.amount,
        entry_date: payForm.payment_date,
        ref_voucher: `PAY-${(paymentData?.id||"").substring(0,8).toUpperCase()}`,
      });
    }
    if (prId) {
      const newPaid = calc.paidAmt + parseFloat(payForm.amount);
      await supabase.from("payroll").update({
        paid_amount: newPaid, balance: calc.netSalary - newPaid,
        status: (calc.netSalary - newPaid) <= 0 ? "Paid" : "Partial"
      }).eq("id", prId);
    }
    await loadAll();
    if (paymentData && emp) {
      const pr = payrollRecords.find(r => r.id === prId);
      printReceipt(emp, paymentData, pr, company);
    }
    setPayForm({ employee_id: "", amount: "", payment_type: "Salary", payment_date: new Date().toISOString().split("T")[0], notes: "" });
    setShowPayForm(false); setSaving(false);
  };

  const inp = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none" };

  const filteredEmps = employees
    .filter(e => groupFilter === "All" || (e.emp_group || "Group 1") === groupFilter)
    .sort((a, b) => {
      const ga = groups.indexOf(a.emp_group || "Group 1");
      const gb = groups.indexOf(b.emp_group || "Group 1");
      const gai = ga === -1 ? 999 : ga, gbi = gb === -1 ? 999 : gb;
      return gai !== gbi ? gai - gbi : a.name.localeCompare(b.name);
    });

  return (
    <div style={{ padding: 24 }}>
      {showEmpForm && isAdmin && (
        <EmployeeForm
          title={editEmpData ? "Edit Employee" : "New Employee — Full Details"}
          groups={groups}
          initial={editEmpData ? {
            name: editEmpData.name || "", role: editEmpData.role || "Mason / Bricklayer",
            nationality: editEmpData.nationality || "Indian",
            phone_oman: editEmpData.phone || "", phone_home: editEmpData.phone_home || "",
            staff_type: editEmpData.staff_type || "Own Staff",
            emp_group: editEmpData.emp_group || "Group 1",
            passport_no: editEmpData.passport_no || "", ptaka_no: editEmpData.ptaka_no || "",
            visa_no: editEmpData.visa_no || "", bank_name: editEmpData.bank_name || "",
            bank_branch: editEmpData.bank_branch || "", account_no: editEmpData.account_no || "",
            iban: editEmpData.iban || "", daily_rate: String(editEmpData.daily_rate || ""),
            status: editEmpData.status || "Active", join_date: editEmpData.join_date || "",
            opening_balance: editEmpData.opening_balance !== null && editEmpData.opening_balance !== undefined ? String(editEmpData.opening_balance) : "0",
            work_start: editEmpData.work_start || "07:00", work_end: editEmpData.work_end || "18:00",
            break_start: editEmpData.break_start || "13:00", break_end: editEmpData.break_end || "14:00",
          } : null}
          onSave={saveEmployee}
          onCancel={() => { setShowEmpForm(false); setEditEmpData(null); }}
          saving={saving}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Payroll & Attendance</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>26th → 25th · 10hrs/day standard</div>
        </div>
        <select value={periods.findIndex(p => p.start === selectedPeriod.start)}
          onChange={e => setSelectedPeriod(periods[parseInt(e.target.value)])}
          style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#0f172a", background: "#fff" }}>
          {periods.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f1f5f9", borderRadius: 12, padding: 4 }}>
        {[["employees", "👤 Employees"], ["attendance", "📅 Attendance Grid"], ["payroll", "💰 Payroll"], ["payments", "🧾 Payments"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600,
            background: tab === id ? "#fff" : "transparent",
            color: tab === id ? "#1e293b" : "#64748b",
            boxShadow: tab === id ? "0 1px 4px rgba(0,0,0,0.1)" : "none"
          }}>{label}</button>
        ))}
      </div>

      {/* ── EMPLOYEES TAB ── */}
      {tab === "employees" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Group:</span>
            {["All", ...groups].map(g => (
              <button key={g} onClick={() => setGroupFilter(g)} style={{
                padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: groupFilter === g ? "#6366f1" : "#f1f5f9",
                color: groupFilter === g ? "#fff" : "#64748b"
              }}>{g}</button>
            ))}
            <div style={{ flex: 1 }} />
            {isAdmin && (
              <button onClick={() => setShowGroupMgr(!showGroupMgr)}
                style={{ background: "#f5f3ff", color: "#8b5cf6", border: "1px solid #ddd6fe", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⚙ Manage Groups</button>
            )}
            {isAdmin
              ? <button onClick={() => { setEditEmpData(null); setShowEmpForm(true); }}
                  style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Employee</button>
              : <button onClick={() => setShowLogin(true)}
                  style={{ background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🔑 Login</button>
            }
          </div>

          {/* ── GROUP MANAGER ── */}
          {showGroupMgr && isAdmin && (
            <div style={{ background: "#fff", borderRadius: 12, padding: 18, marginBottom: 16, border: "2px solid #8b5cf6" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 12 }}>⚙ Manage Employee Groups</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {groups.map((g, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", borderRadius: 8, padding: "8px 12px", border: "1px solid #e2e8f0" }}>
                    {editingGroupIdx === idx ? (
                      <>
                        <input value={editGroupName} onChange={e => setEditGroupName(e.target.value)} autoFocus
                          style={{ flex: 1, border: "1px solid #8b5cf6", borderRadius: 6, padding: "6px 10px", fontSize: 13, outline: "none" }} />
                        <button onClick={() => renameGroup(idx)} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>💾 Save</button>
                        <button onClick={() => setEditingGroupIdx(null)} style={{ background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontWeight: 600, color: "#1e293b", fontSize: 13 }}>{g}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{employees.filter(e => (e.emp_group || "Group 1") === g).length} employees</span>
                        <button onClick={() => { setEditingGroupIdx(idx); setEditGroupName(g); }} style={{ background: "#eef2ff", color: "#6366f1", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏ Edit</button>
                        {groups.length > 1 && <button onClick={() => deleteGroup(idx)} style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>🗑</button>}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="New group name (e.g. Group 7, Masons, Site A)"
                  onKeyDown={e => { if (e.key === "Enter") addGroup(); }}
                  style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }} />
                <button onClick={addGroup} style={{ background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Add Group</button>
              </div>
            </div>
          )}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Name / Group", "Role", "Nationality", "Type", "Phone", "Daily Rate", "Status", "Summary", ...(isAdmin ? ["Actions"] : [])].map(h =>
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>⏳ Loading...</td></tr>
                  : filteredEmps.length === 0 ? <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No employees found.</td></tr>
                  : filteredEmps.map((e, i) => {
                    const c = calcPayroll(e);
                    return <Fragment key={e.id}>
                      <tr style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td style={{ padding: "11px 14px", cursor: "pointer" }} onClick={() => setViewEmp(viewEmp?.id === e.id ? null : e)}>
                          <div style={{ fontWeight: 700, color: "#1e293b" }}>{e.name}</div>
                          {isAdmin ? (
                            <select
                              value={e.emp_group || "Group 1"}
                              onClick={ev => ev.stopPropagation()}
                              onChange={async ev => {
                                const ng = ev.target.value;
                                await supabase.from("employees").update({ emp_group: ng }).eq("id", e.id);
                                await loadAll();
                              }}
                              style={{ marginTop: 3, fontSize: 10, color: "#6366f1", fontWeight: 600, border: "1px solid #ddd6fe", borderRadius: 6, padding: "2px 6px", background: "#f5f3ff", cursor: "pointer", outline: "none" }}>
                              {groups.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          ) : (
                            <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 600 }}>{e.emp_group || "Group 1"}</div>
                          )}
                        </td>
                        <td style={{ padding: "11px 14px", color: "#475569", fontSize: 12 }}>{e.role || "—"}</td>
                        <td style={{ padding: "11px 14px", color: "#64748b", fontSize: 12 }}>{e.nationality || "—"}</td>
                        <td style={{ padding: "11px 14px" }}><span style={{ background: "#f1f5f9", color: "#475569", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{e.staff_type || "Own"}</span></td>
                        <td style={{ padding: "11px 14px", color: "#64748b", fontSize: 12 }}>{e.phone || "—"}</td>
                        <td style={{ padding: "11px 14px", color: "#6366f1", fontWeight: 700 }}>
                          {(e.staff_type || "") === "Fixed Monthly"
                            ? <>OMR {parseFloat(e.daily_rate || 0).toFixed(3)}<div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>Fixed / month · no attendance</div></>
                            : <>OMR {parseFloat(e.daily_rate || 0).toFixed(3)}<div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>/day · {(parseFloat(e.daily_rate||0)/10).toFixed(3)}/hr</div></>}
                        </td>
                        <td style={{ padding: "11px 14px" }}><span style={{ background: e.status === "Active" ? "#ecfdf5" : "#fef2f2", color: e.status === "Active" ? "#10b981" : "#ef4444", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{e.status}</span></td>
                        <td style={{ padding: "11px 14px", fontSize: 11 }}>
                          <span style={{ color: "#10b981", fontWeight: 600 }}>{c.totalDays}d</span> / <span style={{ color: "#6366f1", fontWeight: 600 }}>OMR {c.grossSalary.toFixed(3)}</span>
                          {c.openingBal !== 0 && <span style={{ marginLeft: 6, color: c.openingBal > 0 ? "#8b5cf6" : "#ef4444", fontSize: 10, fontWeight: 600 }}>{c.openingBal > 0 ? "+" : ""}Prev: {c.openingBal.toFixed(3)}</span>}
                        </td>
                        {isAdmin && <td style={{ padding: "11px 14px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => { setEditEmpData(e); setShowEmpForm(true); }} style={{ background: "#eef2ff", color: "#6366f1", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Edit</button>
                            <button onClick={() => deleteEmployee(e)} style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>🗑</button>
                          </div>
                        </td>}
                      </tr>
                      {viewEmp?.id === e.id && (
                        <tr key={`d-${e.id}`}><td colSpan={9} style={{ padding: "0 14px 14px" }}>
                          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, fontSize: 12 }}>
                            {[["Designation", e.role], ["Nationality", e.nationality], ["Group", e.emp_group || "Group 1"], ["Join Date", e.join_date || "—"], ["Oman Phone", e.phone], ["Home Phone", e.phone_home || "—"], ["Passport", e.passport_no || "—"], ["PTAKA", e.ptaka_no || "—"], ["Visa", e.visa_no || "—"], ["Bank", e.bank_name || "—"], ["Branch", e.bank_branch || "—"], ["Account", e.account_no || "—"], ["IBAN", e.iban || "—"], ["Rate", (e.staff_type||"")==="Fixed Monthly" ? `OMR ${parseFloat(e.daily_rate||0).toFixed(3)} fixed/month` : `OMR ${parseFloat(e.daily_rate||0).toFixed(3)}/day · ${(parseFloat(e.daily_rate||0)/10).toFixed(3)}/hr`]].map(([l, v]) => (
                              <div key={l} style={{ background: "#fff", borderRadius: 8, padding: "8px 12px", border: "1px solid #e2e8f0" }}>
                                <div style={{ color: "#94a3b8", fontSize: 10 }}>{l}</div>
                                <div style={{ color: "#1e293b", fontWeight: 600 }}>{v}</div>
                              </div>
                            ))}
                          </div>
                        </td></tr>
                      )}
                    </Fragment>;
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ATTENDANCE GRID TAB ── */}
      <div style={{display: tab === 'attendance' ? 'block' : 'none'}}>
        <AttendanceGrid
          employees={employees.filter(e => e.status === "Active" && (e.staff_type || "") !== "Fixed Monthly")}
          attendance={attendance}
          period={selectedPeriod}
          isAdmin={isAdmin}
          onSave={loadAll}
          saving={saving}
          confirmAction={confirmAction}
          bankAccounts={bankAccounts}
          logActivity={logActivity}
        />
      </div>

      {/* ── PAYROLL TAB ── */}
      {tab === "payroll" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {employees.filter(e => e.status === "Active").length === 0
            ? <div style={{ background: "#fff", borderRadius: 12, padding: 60, textAlign: "center", border: "1px solid #e2e8f0", color: "#94a3b8" }}>No active employees.</div>
            : employees.filter(e => e.status === "Active")
                .sort((a, b) => {
                  const ga = groups.indexOf(a.emp_group || "Group 1");
                  const gb = groups.indexOf(b.emp_group || "Group 1");
                  const gai = ga === -1 ? 999 : ga, gbi = gb === -1 ? 999 : gb;
                  return gai !== gbi ? gai - gbi : a.name.localeCompare(b.name);
                })
                .map(emp => {
                  const c = calcPayroll(emp);
                  const open = expandedEmpId === emp.id;
                  const df = deductForms[emp.id] || { advance: String(c.advance), food: String(c.food), other: String(c.other), incentive: String(c.incentive) };
                  return (
                    <div key={emp.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                      <div onClick={() => setExpandedEmpId(open ? null : emp.id)}
                        style={{ padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: open ? "#f8fafc" : "#fff" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, background: "#eef2ff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#6366f1" }}>{emp.name[0]}</div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#1e293b" }}>{emp.name}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>{emp.role || "—"} · {emp.emp_group || "Group 1"} · OMR {parseFloat(emp.daily_rate || 0).toFixed(3)}/day</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                          {[["Days", `${c.totalDays}d`, "#6366f1"], ["OT", `${c.totalOt||0}h`, "#10b981"], ["LT", `${c.totalLt||0}h`, "#f59e0b"], ["Gross", c.grossSalary.toFixed(3), "#10b981"], ["Net", c.netSalary.toFixed(3), "#1e293b"], ["Balance", c.balance.toFixed(3), c.balance > 0 ? "#f59e0b" : "#10b981"]].map(([l, v, col]) => (
                            <div key={l} style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 10, color: "#64748b" }}>{l}</div>
                              <div style={{ fontWeight: 700, color: col, fontSize: 13 }}>{l==="Days"||l==="OT"||l==="LT"?v:`OMR ${v}`}</div>
                            </div>
                          ))}
                          <span style={{ color: "#94a3b8" }}>{open ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      {open && (
                        <div style={{ padding: "14px 20px", borderTop: "1px solid #f1f5f9" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
                            {[["Gross", `OMR ${c.grossSalary.toFixed(3)}`, "#6366f1"], ["Total Overtime", `${c.totalOt||0} hrs`, "#10b981"], ["Total Lower-time", `${c.totalLt||0} hrs`, "#f59e0b"], ["Prev. Balance", `${c.openingBal >= 0 ? "+" : ""}OMR ${c.openingBal.toFixed(3)}`, c.openingBal >= 0 ? "#8b5cf6" : "#ef4444"], ["Advance Paid", `OMR ${c.paidAdvance.toFixed(3)}`, "#ef4444"], ["Salary Paid", `OMR ${c.paidSalary.toFixed(3)}`, "#10b981"], ["Net Payable", `OMR ${c.netSalary.toFixed(3)}`, "#1e293b"], ["Total Paid", `OMR ${c.paidAmt.toFixed(3)}`, "#10b981"], ["Total Balance", `OMR ${c.balance.toFixed(3)}`, c.balance > 0 ? "#f59e0b" : "#10b981"]].map(([l, v, col]) => (
                              <div key={l} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", border: "1px solid #e2e8f0" }}>
                                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>{l}</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: col }}>{v}</div>
                              </div>
                            ))}
                          </div>
                          {isAdmin && (
                            <div style={{ display: "flex", gap: 10, marginTop: 4, marginBottom: 12 }}>
                              <button onClick={() => printPayslip(emp, c, selectedPeriod, company)} style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🖨 Print Payslip</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
          }
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {tab === "payments" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            {isAdmin && <button onClick={() => setShowPayForm(!showPayForm)} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Record Payment</button>}
          </div>
          {showPayForm && isAdmin && (
            <div style={{ background: "#fff", borderRadius: 12, padding: 22, marginBottom: 16, border: "2px solid #10b981" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 14 }}>{editingPayment ? "✏ Edit Payment" : "Record Payment"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>Employee</div>
                  <select value={payForm.employee_id} onChange={e => setPayForm(p => ({ ...p, employee_id: e.target.value }))} style={inp}>
                    <option value="">Select Employee</option>
                    {employees.filter(e => e.status === "Active").map(e => {
                      const c = calcPayroll(e);
                      return <option key={e.id} value={e.id}>{e.name} — Bal: OMR {c.balance.toFixed(3)}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>Type</div>
                  <select value={payForm.payment_type} onChange={e => setPayForm(p => ({ ...p, payment_type: e.target.value }))} style={inp}>
                    {["Salary", "Advance", "Incentive", "Food Allowance", "Other"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>Amount (OMR)</div>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} step="0.001" style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>Date</div>
                  <input type="date" value={payForm.payment_date} onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} style={inp} />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>Notes</div>
                  <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} style={inp} />
                </div>
                <div>
                  <BankAccountSelect
                    value={payForm.bank_account_id}
                    onChange={v => setPayForm(p => ({ ...p, bank_account_id: v }))}
                    bankAccounts={bankAccounts}
                    required={true}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button onClick={addPayment} disabled={saving} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{saving ? "Saving..." : "💾 Save & Print Receipt"}</button>
                <button onClick={() => setShowPayForm(false)} style={{ background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Employee", "Date", "Type", "Amount (OMR)", "Notes", "Account", "Receipt"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>⏳</td></tr>
                  : payments.map((p, i) => {
                    const emp = employees.find(e => e.id === p.employee_id);
                    const pr = payrollRecords.find(r => r.id === p.payroll_id);
                    return (
                      <tr key={p.id} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td style={{ padding: "11px 14px", fontWeight: 600, color: "#1e293b" }}>{emp?.name || "—"}</td>
                        <td style={{ padding: "11px 14px", color: "#64748b" }}>{p.payment_date}</td>
                        <td style={{ padding: "11px 14px" }}><span style={{ background: "#eef2ff", color: "#6366f1", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{p.payment_type}</span></td>
                        <td style={{ padding: "11px 14px", fontWeight: 700, color: "#10b981" }}>OMR {parseFloat(p.amount).toFixed(3)}</td>
                        <td style={{ padding: "11px 14px", color: "#94a3b8", fontSize: 11 }}>{p.notes || "—"}</td>
                        <td style={{ padding: "11px 14px", fontSize: 11 }}>
                          {bankAccounts.find(a => a.id === p.bank_account_id)
                            ? <span style={{ background: "#ecfdf5", color: "#10b981", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>
                                🏦 {bankAccounts.find(a => a.id === p.bank_account_id)?.account_name}
                              </span>
                            : <span style={{ color: "#94a3b8" }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{display:"flex",gap:4,alignItems:"center"}}>
                            <button onClick={() => emp && printReceipt(emp, p, pr, company)} style={{ background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>🖨 Print</button>
                            {isAdmin&&<button onClick={()=>editPayment(p)} style={{ background: "#eef2ff", color: "#6366f1", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✏ Edit</button>}
                            {isAdmin&&<button onClick={()=>deletePayment(p.id, p.amount, emp?.name)} style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 11 }}>🗑</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
