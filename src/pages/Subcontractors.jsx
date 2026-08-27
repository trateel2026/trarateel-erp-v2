import { useState, useEffect } from "react";
import BankAccountSelect from "../components/BankAccountSelect";
import { getBankAccounts, createLedgerEntry } from "../lib/bankAccounts";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../context/AdminContext";

const SPECIALTIES = ["Civil Works","Electrical Works","Plumbing Works","Plastering Works","Tiling Works","Painting Works","Interlock Works","Steel Works","Other"];
const statusColor = { "Completed":"#10b981","In Progress":"#f59e0b","Pending":"#94a3b8","Cancelled":"#ef4444" };
const statusBg = { "Completed":"#ecfdf5","In Progress":"#fffbeb","Pending":"#f8fafc","Cancelled":"#fef2f2" };

/** Pending = contract - paid. If no contract set, return null (show "Advance / No contract"). */
const calcPending = (contract, paid) => {
  const c = parseFloat(contract) || 0;
  const p = parseFloat(paid) || 0;
  if (c <= 0) return null;
  return c - p;
};
const formatPending = (contract, paid) => {
  const pend = calcPending(contract, paid);
  if (pend === null) {
    const p = parseFloat(paid) || 0;
    if (p > 0) return { text: "Advance only", sub: `Paid OMR ${p.toFixed(3)} · set contract value`, color: "#6366f1", value: null };
    return { text: "No contract", sub: "", color: "#94a3b8", value: null };
  }
  return { text: `OMR ${pend.toFixed(3)}`, sub: "", color: pend > 0.001 ? "#f59e0b" : "#10b981", value: pend };
};

function MilestoneGraph({ milestones, type, title }) {
  const total = milestones.reduce((s,m) => s + parseFloat(m.amount||0), 0);
  const done = milestones.filter(m => m.status==="Completed").reduce((s,m) => s + parseFloat(m.amount||0), 0);
  const pct = total > 0 ? Math.round((done/total)*100) : 0;
  const color = type === "payment" ? "#10b981" : "#6366f1";

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 8 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>{title}</div>
        <div style={{ fontSize:12, color, fontWeight:700 }}>{pct}% · OMR {done.toFixed(3)} / {total.toFixed(3)}</div>
      </div>
      {/* Progress bar */}
      <div style={{ background:"#f1f5f9", borderRadius:8, height:12, marginBottom:10, position:"relative", overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, background:`linear-gradient(90deg, ${color}, ${color}cc)`, height:"100%", borderRadius:8, transition:"width 0.5s" }} />
        <div style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", fontSize:9, color:"#fff", fontWeight:700, textShadow:"0 1px 2px rgba(0,0,0,0.3)" }}>{pct}%</div>
      </div>
      {/* Step graph */}
      <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:48 }}>
        {milestones.map((m, i) => {
          const mPct = total > 0 ? (parseFloat(m.amount||0)/total)*100 : 0;
          const isComplete = m.status === "Completed";
          return (
            <div key={i} title={`${m.label}: OMR ${parseFloat(m.amount||0).toFixed(3)}`}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <div style={{ width:"100%", background: isComplete ? color : "#e2e8f0", borderRadius:"3px 3px 0 0",
                height:`${Math.max(mPct*0.4+4, 6)}px`, minHeight:6, transition:"all 0.3s",
                border: isComplete ? `1px solid ${color}` : "1px solid #e2e8f0" }} />
              <div style={{ width:6, height:6, borderRadius:"50%", background: isComplete ? color : "#cbd5e1",
                border:`1px solid ${isComplete ? color : "#94a3b8"}` }} />
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:12, marginTop:6, fontSize:10, color:"#64748b" }}>
        <span style={{ display:"flex", alignItems:"center", gap:3 }}>
          <span style={{ width:8,height:8,background:color,borderRadius:"50%",display:"inline-block" }} />
          Completed ({milestones.filter(m=>m.status==="Completed").length})
        </span>
        <span style={{ display:"flex", alignItems:"center", gap:3 }}>
          <span style={{ width:8,height:8,background:"#e2e8f0",borderRadius:"50%",display:"inline-block" }} />
          Pending ({milestones.filter(m=>m.status!=="Completed").length})
        </span>
      </div>
    </div>
  );
}

const Field = ({label,children}) => <div><div style={{fontSize:12,color:"#64748b",marginBottom:4,fontWeight:500}}>{label}</div>{children}</div>;


function printSubcontractorsReport(subs, milestonesBySub = {}, company = {}) {
  const coName = company.company_name || "TRATEEL AL NAJAH FOR TRADING";
  const coNameAr = company.company_name_ar || "";
  const coAddr = company.company_address || "Sultanate of Oman";
  const coVat = company.company_vat_no || company.company_tax_no || "";
  const logo = company.company_logo || "";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const groups = {};
  (subs || []).forEach(s => {
    const k = s.name || "Unknown";
    if (!groups[k]) groups[k] = [];
    groups[k].push(s);
  });
  const names = Object.keys(groups).sort();
  const grandContract = (subs || []).reduce((t, w) => t + parseFloat(w.contract_amount || 0), 0);
  const grandPaid = (subs || []).reduce((t, w) => t + parseFloat(w.paid || 0), 0);

  let body = "";
  names.forEach((name, gi) => {
    const works = groups[name];
    const totalContract = works.reduce((t, w) => t + parseFloat(w.contract_amount || 0), 0);
    const totalPaid = works.reduce((t, w) => t + parseFloat(w.paid || 0), 0);
    body += `<div class="contractor">
      <div class="c-hd">
        <div>
          <div class="c-name">${name}</div>
          <div class="c-sub">${works.length} work contract${works.length > 1 ? "s" : ""} · Phone: ${works[0].phone || "—"}</div>
        </div>
        <div class="c-totals">
          <div><span class="lbl">Contract</span><span class="val">OMR ${totalContract.toFixed(3)}</span></div>
          <div><span class="lbl">Paid</span><span class="val paid">OMR ${totalPaid.toFixed(3)}</span></div>
        </div>
      </div>`;
    works.forEach((w) => {
      const ms = (milestonesBySub[w.id] || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const msSum = ms.reduce((s, m) => s + parseFloat(m.paid_amount || m.amount || 0), 0);
      body += `<div class="work">
        <div class="w-hd">
          <div><b>${w.project || "—"}</b> · ${w.specialty || "—"} · <span class="pill">${w.status || "Active"}</span></div>
          <div class="w-amt">Contract OMR ${parseFloat(w.contract_amount || 0).toFixed(3)} · Paid OMR ${parseFloat(w.paid || 0).toFixed(3)}</div>
        </div>`;
      if (ms.length) {
        body += `<table>
          <thead><tr>
            <th style="width:36px">#</th>
            <th>Payment schedule / milestone</th>
            <th style="width:90px" class="r">Amount</th>
            <th style="width:90px" class="r">Paid</th>
            <th style="width:88px">Date</th>
            <th style="width:90px">Status</th>
          </tr></thead><tbody>`;
        ms.forEach((m, i) => {
          const stt = m.status || "—";
          const stColor = stt === "Completed" ? "#059669" : "#b45309";
          body += `<tr>
            <td class="c">${i + 1}</td>
            <td>${m.label || m.title || "Milestone"}</td>
            <td class="r num">${parseFloat(m.amount || 0).toFixed(3)}</td>
            <td class="r num">${parseFloat(m.paid_amount || m.amount || 0).toFixed(3)}</td>
            <td class="c">${m.payment_date || "—"}</td>
            <td class="c"><span style="color:${stColor};font-weight:700">${stt}</span></td>
          </tr>`;
        });
        body += `<tr class="sum"><td></td><td><b>Schedule total</b></td><td></td><td class="r num"><b>${msSum.toFixed(3)}</b></td><td colspan="2"></td></tr>`;
        body += `</tbody></table>`;
      } else {
        body += `<div class="no-ms">No payment schedule recorded</div>`;
      }
      body += `</div>`;
    });
    body += `</div>`;
  });

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <title>Subcontractors Report — ${coName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:"Segoe UI",system-ui,sans-serif;color:#0f172a;background:#fff;font-size:9.5px;line-height:1.25}
    .page{width:100%;padding:8px 10px 16px}
    .hdr{display:flex;justify-content:space-between;gap:8px;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:8px}
    .hdr-left{display:flex;gap:8px;align-items:center}
    .logo{height:32px;object-fit:contain}
    .co-name{font-size:13px;font-weight:800}
    .co-ar{font-size:10px;color:#475569}
    .co-meta{font-size:8.5px;color:#64748b}
    .doc-box{text-align:right}
    .doc-title{font-size:11px;font-weight:800;color:#4f46e5;text-transform:uppercase}
    .doc-sub{font-size:8.5px;color:#64748b}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}
    .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px}
    .kpi-l{font-size:7.5px;font-weight:700;color:#64748b;text-transform:uppercase}
    .kpi-v{font-size:13px;font-weight:800}
    .contractor{margin-bottom:8px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
    .c-hd{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;background:#0f172a;color:#fff;flex-wrap:wrap}
    .c-name{font-size:12px;font-weight:800}
    .c-sub{font-size:8.5px;opacity:0.8}
    .c-totals{display:flex;gap:12px}
    .c-totals .lbl{font-size:7.5px;text-transform:uppercase;opacity:0.7}
    .c-totals .val{font-size:11px;font-weight:800}
    .c-totals .paid{color:#6ee7b7}
    .work{padding:6px 8px;border-top:1px solid #e2e8f0}
    .w-hd{display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;margin-bottom:4px;font-size:9px}
    .w-amt{color:#64748b;font-size:8.5px}
    .pill{display:inline-block;background:#eef2ff;color:#4338ca;padding:1px 6px;border-radius:999px;font-size:8px;font-weight:700}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th{background:#f1f5f9;color:#475569;padding:3px 5px;text-align:left;font-size:7.5px;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e2e8f0}
    td{padding:3px 5px;border-bottom:1px solid #f1f5f9;font-size:8.5px}
    tr.sum td{background:#f8fafc}
    .c{text-align:center}.r{text-align:right}
    .num{font-variant-numeric:tabular-nums;font-weight:600}
    .no-ms{font-size:8.5px;color:#94a3b8;padding:4px 0}
    .ftr{margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8px;color:#94a3b8}
    .actions{margin-top:10px;text-align:center}
    .btn{background:#4f46e5;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer}
    @page{size:A4 portrait;margin:8mm 6mm}
    @media print{
      body{background:#fff !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .page{padding:0}
      .actions,.btn{display:none !important}
      .contractor{page-break-inside:avoid}
      thead{display:table-header-group}
      .c-hd,th{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    }
  </style></head><body>
  <div class="page">
    <div class="hdr">
      <div class="hdr-left">
        ${logo ? `<img class="logo" src="${logo}" alt="logo"/>` : ""}
        <div>
          <div class="co-name">${coName}</div>
          ${coNameAr ? `<div class="co-ar">${coNameAr}</div>` : ""}
          <div class="co-meta">${coAddr}${coVat ? " · VAT " + coVat : ""}</div>
        </div>
      </div>
      <div class="doc-box">
        <div class="doc-title">Subcontractors Report</div>
        <div class="doc-sub">Contracts & payment history</div>
        <div class="doc-sub">${dateStr} · ${timeStr}</div>
      </div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-l">Contractors</div><div class="kpi-v" style="color:#4f46e5">${names.length}</div></div>
      <div class="kpi"><div class="kpi-l">Work contracts</div><div class="kpi-v" style="color:#0f172a">${(subs||[]).length}</div></div>
      <div class="kpi"><div class="kpi-l">Total contract</div><div class="kpi-v" style="color:#6366f1">OMR ${grandContract.toFixed(3)}</div></div>
      <div class="kpi"><div class="kpi-l">Total paid</div><div class="kpi-v" style="color:#059669">OMR ${grandPaid.toFixed(3)}</div></div>
    </div>
    ${body || "<p style='color:#94a3b8'>No subcontractors.</p>"}
    <div class="ftr">
      <span>Minarva Biz ERP · Confidential</span>
      <span>${coName}</span>
    </div>
    <div class="actions"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div>
  </div>
  </body></html>`);
  w.document.close();
}

function printOneSubcontractor(work, milestones, company = {}) {
  printSubcontractorsReport([work], { [work.id]: milestones || [] }, company);
}


export default function Subcontractors() {
  const { isAdmin: realIsAdmin, canEdit, setShowLogin, confirmAction, logActivity } = useAdmin();
  const isAdmin = canEdit("subcontractors");
  const [subs, setSubs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [company, setCompany] = useState({});
  const [allMilestones, setAllMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [selectedWork, setSelectedWork] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paidEdit, setPaidEdit] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [payMilestoneId, setPayMilestoneId] = useState("");
  const [editingName, setEditingName] = useState(null); // old name being edited
  const [newName, setNewName] = useState("");

  const renameContractor = async (oldName) => {
    if (!isAdmin) { setShowLogin(true); return; }
    if (!newName.trim() || newName.trim() === oldName) { setEditingName(null); return; }
    setSaving(true);
    const { error } = await supabase.from("subcontractors").update({ name: newName.trim() }).eq("name", oldName);
    if (error) { alert("Error: " + error.message); }
    else { setEditingName(null); setNewName(""); await loadAll(); }
    setSaving(false);
  };

  const emptyForm = { name:"", isNew:true, specialty:"Civil Works", project:"", isNewProject:false, contract_amount:"", paid:"0" };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { 
    loadAll();
    getBankAccounts().then(setBankAccounts);
  }, []);
  useEffect(() => { if (selectedWork) { loadMilestones(selectedWork.id); setPaidEdit(selectedWork.paid||0); } }, [selectedWork]);

  const loadAll = async () => {
    setLoading(true);
    const [s, p] = await Promise.all([
      supabase.from("subcontractors").select("*").order("name"),
      supabase.from("projects").select("id,name,customer").order("name"),
    ]);
    setSubs((s.data||[]).filter(x => x.name && String(x.name).trim())); setProjects(p.data||[]); setLoading(false);
  
    try {
      const [{ data: st }, { data: allMs }] = await Promise.all([
        supabase.from("app_settings").select("key,value"),
        supabase.from("sub_milestones").select("*").order("sort_order"),
      ]);
      const map = {};
      (st || []).forEach(r => { if (r.key) map[r.key] = r.value; });
      setCompany(map);
      setAllMilestones(allMs || []);
    } catch {}
  };

  const loadMilestones = async (subId) => {
    const { data } = await supabase.from("sub_milestones").select("*").eq("subcontractor_id", subId).order("sort_order");
    setMilestones(data||[]);
  };

  const contractors = [...new Set(subs.map(s=>s.name).filter(Boolean))].sort();
  const specialtiesFor = [...new Set(subs.filter(s=>s.name===selectedContractor).map(s=>s.specialty))];
  const worksFor = subs.filter(s=>s.name===selectedContractor && s.specialty===selectedSpecialty);

  const stats = (name) => {
    const w = subs.filter(s=>s.name===name);
    return { total:w.reduce((t,x)=>t+parseFloat(x.contract_amount||0),0), paid:w.reduce((t,x)=>t+parseFloat(x.paid||0),0), count:w.length, specialties:[...new Set(w.map(x=>x.specialty))] };
  };
  const spStats = (name, sp) => {
    const w = subs.filter(s=>s.name===name&&s.specialty===sp);
    return { total:w.reduce((t,x)=>t+parseFloat(x.contract_amount||0),0), paid:w.reduce((t,x)=>t+parseFloat(x.paid||0),0), count:w.length };
  };

  const icon = sp => ({"Civil Works":"🏗","Electrical Works":"⚡","Plumbing Works":"🔧","Plastering Works":"🪣","Tiling Works":"🪟","Painting Works":"🎨","Interlock Works":"🧱","Steel Works":"⚙","Other":"📦"}[sp]||"📦");

  const addContract = async () => {
    if (!isAdmin) { setShowLogin(true); return; }
    if (!form.name?.trim()) { alert("Subcontractor name is required"); return; }
    if (!form.project?.trim()) { alert("Project name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("subcontractors").insert({
      name: form.name.trim(),
      specialty: form.specialty || "Civil Works",
      project: form.project.trim(),
      contract_amount: parseFloat(form.contract_amount)||0,
      paid: parseFloat(form.paid)||0,
      status: "Active"
    });
    if (error) { alert("❌ Save failed: " + error.message); setSaving(false); return; }
    await loadAll(); setForm(emptyForm); setShowForm(false); setSaving(false);
  };

  const addMilestone = async () => {
    if (!isAdmin) { setShowLogin(true); return; }
    const { data } = await supabase.from("sub_milestones").insert({
      subcontractor_id: selectedWork.id, label:"New Milestone", status:"Pending", amount:0, sort_order:milestones.length
    }).select().single();
    if (data) setMilestones([...milestones, data]);
  };

  const updateMilestone = async (id, field, val) => {
    if (!isAdmin) { setShowLogin(true); return; }
    await supabase.from("sub_milestones").update({ [field]:val }).eq("id", id);
    setMilestones(milestones.map(m => m.id===id ? {...m,[field]:val} : m));
  };

  const updateLockedMilestone = (id, field, val) => {
    if (!isAdmin) { setShowLogin(true); return; }
    confirmAction("This milestone is already paid. Edit requires admin confirmation.", async () => {
      await supabase.from("sub_milestones").update({ [field]:val }).eq("id", id);
      setMilestones(milestones.map(m => m.id===id ? {...m,[field]:val} : m));
    });
  };

  // Save per-milestone payment (paid_amount + date)
  const saveMilestonePaid = async (id, paidAmt, paidDate, bankAccId) => {
    if (!isAdmin) { setShowLogin(true); return; }
    const amt = parseFloat(paidAmt) || 0;
    const status = amt > 0 ? "Completed" : "Pending";
    await supabase.from("sub_milestones").update({ 
      paid_amount: amt, 
      payment_date: paidDate || null,
      status,
      bank_account_id: bankAccId || null,
    }).eq("id", id);
    // Auto ledger entry
    if (bankAccId && amt > 0) {
      await createLedgerEntry({
        bank_account_id: bankAccId,
        bank_accounts: bankAccounts,
        type: "Debits (Payouts)",
        category: "Subcontractor",
        description: `Subcontractor Payment - ${selectedWork?.name || ""} - ${milestones.find(m=>m.id===id)?.label||""}`,
        payee: selectedWork?.name || "",
        amount: amt,
        entry_date: paidDate || new Date().toISOString().split("T")[0],
      });
    }
    setMilestones(milestones.map(m => m.id===id ? {...m, paid_amount:amt, payment_date:paidDate, status} : m));
    // Update total paid in subcontractors table
    const newTotal = milestones.map(m => m.id===id ? amt : parseFloat(m.paid_amount||0)).reduce((s,v)=>s+v,0);
    await supabase.from("subcontractors").update({ paid: newTotal }).eq("id", selectedWork.id);
    setSubs(subs.map(s=>s.id===selectedWork.id?{...s,paid:newTotal}:s));
    setSelectedWork({...selectedWork, paid:newTotal});
  };

  const savePaid = async () => {
    if (!isAdmin) { setShowLogin(true); return; }
    const newPaid = parseFloat(paidEdit)||0;
    if (payMilestoneId) {
      const m = milestones.find(x=>x.id===payMilestoneId);
      if (m && m.status !== "Completed") {
        await supabase.from("sub_milestones").update({ status:"Completed" }).eq("id", payMilestoneId);
        setMilestones(milestones.map(x=>x.id===payMilestoneId?{...x,status:"Completed"}:x));
      }
    }
    await supabase.from("subcontractors").update({ paid:newPaid }).eq("id", selectedWork.id);
    setSubs(subs.map(s=>s.id===selectedWork.id?{...s,paid:newPaid}:s));
    setSelectedWork({...selectedWork,paid:newPaid});
    setPayMilestoneId("");
  };

  /** Sync missing cashbook subcontractor payments into Payment Schedule milestones. */
  const syncFromCashbook = async () => {
    if (!isAdmin) { setShowLogin(true); return; }
    if (!selectedWork) return;
    const name = selectedWork.name || "";
    // Fetch ledger debits for this subcontractor
    const { data: led } = await supabase.from("ledger")
      .select("*")
      .eq("type", "Debits (Payouts)")
      .or(`payee.ilike.%${name}%,description.ilike.%${name}%,category.eq.Subcontractor`)
      .order("entry_date");
    const rows = (led || []).filter(r => {
      const payee = (r.payee || "").toLowerCase();
      const desc = (r.description || "").toLowerCase();
      const n = name.toLowerCase();
      return payee.includes(n) || desc.includes(n) || (r.category === "Subcontractor" && (payee.includes(n) || desc.includes("steel")));
    });
    const existing = milestones || [];
    const used = new Set();
    let added = 0;
    const newMs = [...existing];
    for (const r of rows) {
      const amt = parseFloat(r.amount || 0);
      if (amt <= 0) continue;
      const date = r.entry_date || "";
      const ref = r.ref_voucher || "";
      // Match existing milestone by payment_date+amount or notes/ref containing ref
      const match = existing.find(m => {
        const key = `${m.id}`;
        if (used.has(key)) return false;
        const sameAmt = Math.abs(parseFloat(m.paid_amount || m.amount || 0) - amt) < 0.001;
        const sameDate = (m.payment_date || "") === date;
        const refHit = ref && ((m.notes || "").includes(ref) || (m.label || "").includes(ref));
        return (sameAmt && sameDate) || refHit;
      });
      if (match) { used.add(match.id); continue; }
      // Also skip if an unused milestone has same amount+date already among new ones
      const already = newMs.find(m =>
        Math.abs(parseFloat(m.paid_amount || m.amount || 0) - amt) < 0.001 &&
        (m.payment_date || "") === date &&
        (ref ? ((m.notes || "").includes(ref) || (m.label || "").includes(ref)) : true)
      );
      if (already) continue;
      const label = `Payment ${date.slice(8,10)}/${date.slice(5,7)} — Transfer ${amt}${ref ? ` (${ref})` : ""}`;
      const payload = {
        subcontractor_id: selectedWork.id,
        title: "",
        label,
        amount: amt,
        paid_amount: amt,
        received: amt,
        status: "Completed",
        pct_complete: 100,
        payment_date: date || null,
        sort_order: newMs.length + 1,
        bank_account_id: r.bank_account_id || null,
        notes: `Synced from cashbook${ref ? " · " + ref : ""} · ${r.description || ""}`.slice(0, 240),
      };
      const { data, error } = await supabase.from("sub_milestones").insert(payload).select().single();
      if (!error && data) {
        newMs.push(data);
        added++;
      }
    }
    const totalPaid = newMs.reduce((s, m) => s + parseFloat(m.paid_amount || m.amount || 0), 0);
    await supabase.from("subcontractors").update({
      paid: totalPaid,
      notes: `Payments total OMR ${totalPaid}. Schedule synced from cashbook.`,
    }).eq("id", selectedWork.id);
    setMilestones(newMs);
    setSubs(subs.map(s => s.id === selectedWork.id ? { ...s, paid: totalPaid } : s));
    setSelectedWork({ ...selectedWork, paid: totalPaid });
    setPaidEdit(String(totalPaid));
    alert(added > 0
      ? `✅ Synced ${added} payment(s) from Cashbook. Total paid: OMR ${totalPaid.toFixed(3)}`
      : `✅ Schedule already matches Cashbook. Total paid: OMR ${totalPaid.toFixed(3)}`);
  };


  const deleteWork = (id) => {
    if (!isAdmin) { setShowLogin(true); return; }
    confirmAction("Delete this work contract and all milestones?", async () => {
      await supabase.from("sub_milestones").delete().eq("subcontractor_id", id);
      await supabase.from("subcontractors").delete().eq("id", id);
      setSelectedWork(null); await loadAll();
    });
  };

  const go = (lvl, val=null) => {
    if (lvl===0){setSelectedContractor(null);setSelectedSpecialty(null);setSelectedWork(null);}
    if (lvl===1){setSelectedContractor(val);setSelectedSpecialty(null);setSelectedWork(null);}
    if (lvl===2){setSelectedSpecialty(val);setSelectedWork(null);}
  };

  const inp = { border:"1px solid #e2e8f0",borderRadius:8,padding:"9px 12px",fontSize:13,width:"100%",boxSizing:"border-box",outline:"none" };

  // Payment milestones (milestones where payment is tracked)
  const paymentMilestones = milestones;
  // Work milestones = same milestones but tracking completion
  const workMilestones = milestones;

  return (
    <div style={{ padding:24 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:"#0f172a", marginBottom:4 }}>Subcontractors</div>
          <div style={{ fontSize:13, color:"#64748b" }}>{contractors.length} contractors · {subs.length} work contracts</div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={() => {
            const map = {};
            (allMilestones || []).forEach(m => {
              if (!map[m.subcontractor_id]) map[m.subcontractor_id] = [];
              map[m.subcontractor_id].push(m);
            });
            printSubcontractorsReport(subs, map, company);
          }} style={{ background:"#0f172a", color:"#fff", border:"none", borderRadius:8, padding:"10px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>🖨 Print / PDF</button>
          {isAdmin
            ? <button onClick={()=>setShowForm(!showForm)} style={{ background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"10px 18px",fontSize:13,fontWeight:600,cursor:"pointer" }}>+ Add Work Contract</button>
            : <button onClick={()=>setShowLogin(true)} style={{ background:"#f1f5f9",color:"#64748b",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 18px",fontSize:13,fontWeight:600,cursor:"pointer" }}>🔑 Login to Add</button>
          }
        </div>
      </div>

      {/* Breadcrumb */}
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:16,fontSize:13,flexWrap:"wrap" }}>
        <button onClick={()=>go(0)} style={{ background:!selectedContractor?"#eef2ff":"#f1f5f9",border:"none",borderRadius:6,padding:"5px 12px",cursor:"pointer",color:"#6366f1",fontWeight:600 }}>All Contractors</button>
        {selectedContractor&&<><span style={{color:"#94a3b8"}}>›</span>
          <button onClick={()=>go(1,selectedContractor)} style={{ background:!selectedSpecialty?"#eef2ff":"#f1f5f9",border:"none",borderRadius:6,padding:"5px 12px",cursor:"pointer",color:"#6366f1",fontWeight:600 }}>{selectedContractor}</button>
          {isAdmin && editingName!==selectedContractor && <button onClick={()=>{setEditingName(selectedContractor);setNewName(selectedContractor);}} style={{background:"#eef2ff",color:"#6366f1",border:"1px solid #c7d2fe",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Rename</button>}
          {isAdmin && editingName===selectedContractor && <span style={{display:"inline-flex",gap:6,alignItems:"center"}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} autoFocus style={{border:"1px solid #6366f1",borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:600,width:160,outline:"none"}}
              onKeyDown={e=>{if(e.key==="Enter"){renameContractor(selectedContractor);setSelectedContractor(newName.trim());}if(e.key==="Escape")setEditingName(null);}} />
            <button onClick={()=>{const nn=newName.trim();renameContractor(selectedContractor).then(()=>setSelectedContractor(nn));}} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:4,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>✓</button>
            <button onClick={()=>setEditingName(null)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:4,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✕</button>
          </span>}</>}
        {selectedSpecialty&&<><span style={{color:"#94a3b8"}}>›</span>
          <button onClick={()=>go(2,selectedSpecialty)} style={{ background:!selectedWork?"#eef2ff":"#f1f5f9",border:"none",borderRadius:6,padding:"5px 12px",cursor:"pointer",color:"#6366f1",fontWeight:600 }}>{icon(selectedSpecialty)} {selectedSpecialty}</button></>}
        {selectedWork&&<><span style={{color:"#94a3b8"}}>›</span>
          <span style={{ background:"#eef2ff",borderRadius:6,padding:"5px 12px",color:"#6366f1",fontWeight:600 }}>{selectedWork.project}</span></>}
      </div>

      {/* Add Form */}
      {showForm&&isAdmin&&(
        <div style={{ background:"#fff",borderRadius:12,padding:22,marginBottom:16,border:"2px solid #6366f1" }}>
          <div style={{ fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:16 }}>New Work Contract</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            {/* Contractor Name */}
            <Field label="Contractor Name">
              <select value={form.isNew?"__new__":form.name} onChange={e=>{
                if(e.target.value==="__new__") setForm({...form,isNew:true,name:""});
                else setForm({...form,isNew:false,name:e.target.value});
              }} style={inp}>
                <option value="">Select Contractor</option>
                {contractors.map(c=><option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ Add New Contractor</option>
              </select>
              {form.isNew&&<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Enter new contractor name" style={{...inp,marginTop:8}} />}
            </Field>

            {/* Specialty */}
            <Field label="Specialty / Category">
              <select value={form.specialty} onChange={e=>setForm({...form,specialty:e.target.value})} style={inp}>
                {SPECIALTIES.map(s=><option key={s}>{s}</option>)}
              </select>
            </Field>

            {/* Project */}
            <Field label="Project / Work Name">
              <select value={form.isNewProject?"__new__":form.project} onChange={e=>{
                if(e.target.value==="__new__") setForm({...form,isNewProject:true,project:""});
                else setForm({...form,isNewProject:false,project:e.target.value});
              }} style={inp}>
                <option value="">Select Project</option>
                {projects.map(p=><option key={p.id} value={p.name}>{p.name} — {p.customer}</option>)}
                <option value="__new__">+ Add Custom Work Name</option>
              </select>
              {form.isNewProject&&<input value={form.project} onChange={e=>setForm({...form,project:e.target.value})} placeholder="Enter work name" style={{...inp,marginTop:8}} />}
            </Field>

            <Field label="Contract Amount (OMR)">
              <input type="number" value={form.contract_amount} onChange={e=>setForm({...form,contract_amount:e.target.value})} step="0.001" style={inp} />
            </Field>
            <Field label="Amount Already Paid (OMR)">
              <input type="number" value={form.paid} onChange={e=>setForm({...form,paid:e.target.value})} step="0.001" style={inp} />
            </Field>
          </div>
          <div style={{ display:"flex",gap:10,marginTop:14 }}>
            <button onClick={addContract} disabled={saving} style={{ background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",cursor:"pointer",fontSize:13,fontWeight:600 }}>{saving?"Saving...":"💾 Save Contract"}</button>
            <button onClick={()=>setShowForm(false)} style={{ background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,padding:"9px 18px",cursor:"pointer",fontSize:13 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* LEVEL 1: Contractors */}
      {!selectedContractor&&(
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16 }}>
          {loading?<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Loading...</div>:
           contractors.length===0?<div style={{background:"#fff",borderRadius:12,padding:60,textAlign:"center",border:"1px solid #e2e8f0",gridColumn:"span 3",color:"#94a3b8"}}>No subcontractors yet.</div>:
           contractors.map(name=>{
             const st=stats(name);
             const pct=st.total>0?Math.round((st.paid/st.total)*100):0;
             return (
               <div key={name} onClick={()=>go(1,name)} style={{ background:"#fff",borderRadius:12,padding:20,cursor:"pointer",border:"1px solid #e2e8f0",transition:"border 0.15s" }}
                 onMouseEnter={e=>e.currentTarget.style.border="1px solid #6366f1"}
                 onMouseLeave={e=>e.currentTarget.style.border="1px solid #e2e8f0"}>
                 <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                   <div style={{flex:1}}>
                     {editingName===name ? (
                       <div style={{display:"flex",gap:6,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                         <input value={newName} onChange={e=>setNewName(e.target.value)} autoFocus
                           style={{border:"1px solid #6366f1",borderRadius:6,padding:"4px 8px",fontSize:14,fontWeight:700,width:160,outline:"none"}}
                           onKeyDown={e=>{if(e.key==="Enter")renameContractor(name);if(e.key==="Escape")setEditingName(null);}} />
                         <button onClick={(e)=>{e.stopPropagation();renameContractor(name);}} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:4,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>✓</button>
                         <button onClick={(e)=>{e.stopPropagation();setEditingName(null);}} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:4,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✕</button>
                       </div>
                     ) : (
                       <div style={{display:"flex",alignItems:"center",gap:6}}>
                         <div style={{ fontWeight:800,color:"#1e293b",fontSize:16 }}>{name}</div>
                         {isAdmin && <button onClick={(e)=>{e.stopPropagation();setEditingName(name);setNewName(name);}}
                           style={{background:"#eef2ff",color:"#6366f1",border:"1px solid #c7d2fe",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Edit</button>}
                       </div>
                     )}
                     <div style={{ fontSize:12,color:"#64748b",marginTop:2 }}>{st.count} contracts</div>
                   </div>
                   <div style={{ width:40,height:40,background:"#eef2ff",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>👷</div>
                 </div>
                 <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
                   {st.specialties.map(sp=><span key={sp} style={{ background:"#f1f5f9",color:"#475569",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600 }}>{icon(sp)} {sp}</span>)}
                 </div>
                 <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:8 }}>
                   <span style={{ color:"#10b981",fontWeight:600 }}>Paid: OMR {st.paid.toFixed(3)}</span>
                   <span style={{ color:"#f59e0b",fontWeight:600 }}>{(() => { const fp = formatPending(st.total, st.paid); return fp.value === null ? fp.text : `Pending: ${fp.text}`; })()}</span>
                 </div>
                 <div style={{ background:"#f1f5f9",borderRadius:4,height:6 }}>
                   <div style={{ width:`${Math.min(pct,100)}%`,background:"#6366f1",borderRadius:4,height:6 }} />
                 </div>
                 <div style={{ display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:"#94a3b8" }}>
                   <span>Total: OMR {st.total.toFixed(3)}</span>
                   <span>{pct}% paid →</span>
                 </div>
               </div>
             );
           })}
        </div>
      )}

      {/* LEVEL 2: Specialties */}
      {selectedContractor&&!selectedSpecialty&&(
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16 }}>
          {specialtiesFor.map(sp=>{
            const st=spStats(selectedContractor,sp);
            const pct=st.total>0?Math.round((st.paid/st.total)*100):0;
            return (
              <div key={sp} onClick={()=>go(2,sp)} style={{ background:"#fff",borderRadius:12,padding:20,cursor:"pointer",border:"1px solid #e2e8f0" }}
                onMouseEnter={e=>e.currentTarget.style.border="1px solid #6366f1"}
                onMouseLeave={e=>e.currentTarget.style.border="1px solid #e2e8f0"}>
                <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:14 }}>
                  <div style={{ width:50,height:50,background:"#eef2ff",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26 }}>{icon(sp)}</div>
                  <div>
                    <div style={{ fontWeight:700,color:"#1e293b",fontSize:15 }}>{sp}</div>
                    <div style={{ fontSize:12,color:"#64748b" }}>{st.count} work{st.count!==1?"s":""}</div>
                  </div>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:8 }}>
                  <span style={{ color:"#10b981",fontWeight:600 }}>Paid: OMR {st.paid.toFixed(3)}</span>
                  <span style={{ color:"#f59e0b",fontWeight:600 }}>{(() => { const fp = formatPending(st.total, st.paid); return fp.value === null ? fp.text : `Pending: ${fp.text}`; })()}</span>
                </div>
                <div style={{ background:"#f1f5f9",borderRadius:4,height:6 }}>
                  <div style={{ width:`${Math.min(pct,100)}%`,background:sp==="Civil Works"?"#6366f1":"#f59e0b",borderRadius:4,height:6 }} />
                </div>
                <div style={{ fontSize:11,color:"#94a3b8",marginTop:6,display:"flex",justifyContent:"space-between" }}>
                  <span>Total: OMR {st.total.toFixed(3)}</span>
                  <span>{pct}% paid →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LEVEL 3: Works */}
      {selectedContractor&&selectedSpecialty&&!selectedWork&&(
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {worksFor.length===0?<div style={{ background:"#fff",borderRadius:12,padding:40,textAlign:"center",border:"1px solid #e2e8f0",color:"#94a3b8" }}>No works found.</div>:
           worksFor.map(w=>{
             const pct=w.contract_amount>0?Math.round((w.paid/w.contract_amount)*100):0;
             return (
               <div key={w.id} onClick={()=>setSelectedWork(w)} style={{ background:"#fff",borderRadius:12,padding:18,cursor:"pointer",border:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center" }}
                 onMouseEnter={e=>e.currentTarget.style.border="1px solid #6366f1"}
                 onMouseLeave={e=>e.currentTarget.style.border="1px solid #e2e8f0"}>
                 <div style={{ flex:1 }}>
                   <div style={{ fontWeight:700,color:"#1e293b",fontSize:14,marginBottom:6 }}>{w.project}</div>
                   <div style={{ display:"flex",gap:16,fontSize:12,marginBottom:8 }}>
                     <span style={{ color:"#10b981",fontWeight:600 }}>Paid: OMR {parseFloat(w.paid).toFixed(3)}</span>
                     <span style={{ color:"#f59e0b",fontWeight:600 }}>{(() => { const fp = formatPending(w.contract_amount, w.paid); return fp.value === null ? fp.text : `Pending: ${fp.text}`; })()}</span>
                     <span style={{ color:"#6366f1",fontWeight:700 }}>{pct}% complete</span>
                   </div>
                   <div style={{ background:"#f1f5f9",borderRadius:4,height:5,maxWidth:400 }}>
                     <div style={{ width:`${Math.min(pct,100)}%`,background:"#6366f1",borderRadius:4,height:5 }} />
                   </div>
                 </div>
                 <div style={{ textAlign:"right",marginLeft:20 }}>
                   <div style={{ fontSize:18,fontWeight:800,color:"#6366f1" }}>OMR {parseFloat(w.contract_amount).toFixed(3)}</div>
                   <div style={{ fontSize:11,color:"#94a3b8" }}>View details →</div>
                 </div>
               </div>
             );
           })}
        </div>
      )}

      {/* LEVEL 4: Work Detail */}
      {selectedWork&&(
        <div style={{ background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",overflow:"hidden" }}>
          {/* Header */}
          <div style={{ padding:"16px 20px",borderBottom:"1px solid #f1f5f9",background:"#f8fafc" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
              <div>
                <div style={{ fontWeight:800,color:"#1e293b",fontSize:16 }}>{selectedWork.project}</div>
                <div style={{ color:"#64748b",fontSize:12,marginTop:2 }}>{selectedWork.name} · {selectedWork.specialty}</div>
              </div>
              <div style={{ display:"flex",gap:8 }}>
                {isAdmin&&<>
                  <button onClick={syncFromCashbook} style={{ background:"#ecfdf5",color:"#059669",border:"1px solid #a7f3d0",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:600,marginRight:8 }}>↻ Sync from Cashbook</button>
                  <button onClick={addMilestone} style={{ background:"#eef2ff",color:"#6366f1",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:600 }}>+ Milestone</button>
                </>}
                {isAdmin&&<button onClick={()=>deleteWork(selectedWork.id)} style={{ background:"#fef2f2",color:"#ef4444",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12 }}>🗑</button>}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:14 }}>
              {[
                ["Contract Value","OMR "+parseFloat(selectedWork.contract_amount).toFixed(3),"#6366f1"],
                ["Amount Paid","OMR "+parseFloat(selectedWork.paid).toFixed(3),"#10b981"],
                (() => { const fp = formatPending(selectedWork.contract_amount, selectedWork.paid); return ["Pending", fp.text, fp.color]; })(),
                ["Completion",`${selectedWork.contract_amount>0?Math.round((selectedWork.paid/selectedWork.contract_amount)*100):0}%`,"#6366f1"],
              ].map(([l,v,c])=>(
                <div key={l} style={{ background:"#fff",borderRadius:8,padding:"10px 12px",border:"1px solid #e2e8f0" }}>
                  <div style={{ fontSize:10,color:"#64748b",marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:14,fontWeight:800,color:c }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Pay amount */}
            {isAdmin&&(
              <div style={{ marginTop:14,background:"#fff",borderRadius:10,padding:14,border:"1px solid #e2e8f0" }}>
                <div style={{ fontSize:12,fontWeight:700,color:"#0f172a",marginBottom:10 }}>Record Payment</div>
                <div style={{ display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:120 }}>
                    <div style={{ fontSize:11,color:"#64748b",marginBottom:4 }}>Amount Paid (OMR)</div>
                    <input type="number" value={paidEdit} onChange={e=>setPaidEdit(e.target.value)} step="0.001"
                      style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#10b981",fontWeight:700,boxSizing:"border-box" }} />
                  </div>
                  <div style={{ flex:2,minWidth:180 }}>
                    <div style={{ fontSize:11,color:"#64748b",marginBottom:4 }}>Apply to Milestone (optional)</div>
                    <select value={payMilestoneId} onChange={e=>setPayMilestoneId(e.target.value)}
                      style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",fontSize:12 }}>
                      <option value="">— Select milestone to mark complete —</option>
                      {milestones.filter(m=>m.status!=="Completed").map(m=>(
                        <option key={m.id} value={m.id}>{m.label} (OMR {parseFloat(m.amount||0).toFixed(3)})</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={savePaid} style={{ background:"#10b981",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap" }}>
                    💾 Save Payment
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isAdmin&&<div style={{ padding:"8px 20px",background:"#fffbeb",fontSize:12,color:"#92400e" }}>👁 View only — Admin login required to add contracts, payments, or edit amounts</div>}

          <div style={{ padding:20 }}>
            {/* MILESTONE GRAPHS */}
            {milestones.length > 0 && (
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20 }}>
                <div style={{ background:"#f8fafc",borderRadius:12,padding:16,border:"1px solid #e2e8f0" }}>
                  <MilestoneGraph milestones={milestones} type="payment" title="💰 Payment Milestone Progress" />
                </div>
                <div style={{ background:"#f8fafc",borderRadius:12,padding:16,border:"1px solid #e2e8f0" }}>
                  <MilestoneGraph milestones={milestones} type="work" title="🏗 Work Completion Progress" />
                </div>
              </div>
            )}

            {/* MILESTONE TABLE — Excel style */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
              <div style={{ fontSize:12,fontWeight:700,color:"#64748b",letterSpacing:0.5 }}>PAYMENT SCHEDULE</div>
              <button onClick={() => printOneSubcontractor(selectedWork, milestones, company)} style={{ background:"#0f172a", color:"#fff", border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>🖨 Print this contract</button>
            </div>
            {milestones.length===0
              ?<div style={{ textAlign:"center",color:"#94a3b8",fontSize:13,padding:30 }}>No milestones yet. {isAdmin?"Click \"+ Milestone\" to add.":""}</div>
              :<div style={{ overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
                  <thead>
                    <tr style={{ background:"#0f172a",color:"#fff" }}>
                      <th style={{ padding:"10px 14px",textAlign:"left",fontWeight:600,fontSize:11 }}>#</th>
                      <th style={{ padding:"10px 14px",textAlign:"left",fontWeight:600,fontSize:11 }}>Schedule / Milestone</th>
                      <th style={{ padding:"10px 14px",textAlign:"right",fontWeight:600,fontSize:11 }}>Amount (OMR)</th>
                      <th style={{ padding:"10px 14px",textAlign:"right",fontWeight:600,fontSize:11 }}>Paid (OMR)</th>
                      <th style={{ padding:"10px 14px",textAlign:"center",fontWeight:600,fontSize:11 }}>Date Paid</th>
                      <th style={{ padding:"10px 14px",textAlign:"right",fontWeight:600,fontSize:11 }}>Balance (OMR)</th>
                      <th style={{ padding:"10px 14px",textAlign:"center",fontWeight:600,fontSize:11 }}>Account</th>
                      <th style={{ padding:"10px 14px",textAlign:"center",fontWeight:600,fontSize:11 }}>Status</th>
                      {isAdmin&&<th style={{ padding:"10px 14px",textAlign:"center",fontWeight:600,fontSize:11 }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map((m,i)=>{
                      const isPaid = m.status==="Completed";
                      const paidAmt = parseFloat(m.paid_amount||0);
                      const contractAmt = parseFloat(m.amount||0);
                      const balance = contractAmt - paidAmt;
                      return (
                        <tr key={m.id} style={{ borderTop:"1px solid #f1f5f9",background:isPaid?"#f0fdf4":i%2===0?"#fff":"#f8fafc" }}>
                          <td style={{ padding:"10px 14px",color:"#94a3b8",fontWeight:700 }}>{i+1}</td>
                          <td style={{ padding:"10px 14px" }}>
                            {isAdmin&&!isPaid
                              ?<input value={m.label} onChange={e=>updateMilestone(m.id,"label",e.target.value)}
                                  style={{ width:"100%",background:"transparent",border:"none",color:"#1e293b",fontSize:13,fontWeight:600,outline:"none" }} />
                              :<span style={{ color:"#1e293b",fontWeight:600 }}>{m.label}</span>
                            }
                          </td>
                          <td style={{ padding:"10px 14px",textAlign:"right" }}>
                            {isAdmin&&!isPaid
                              ?<input type="number" value={m.amount} onChange={e=>updateMilestone(m.id,"amount",parseFloat(e.target.value)||0)}
                                  style={{ width:90,border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 8px",fontSize:12,textAlign:"right",color:"#6366f1",fontWeight:700 }} />
                              :<span style={{ color:"#6366f1",fontWeight:700 }}>{contractAmt.toFixed(3)}</span>
                            }
                          </td>
                          <td style={{ padding:"10px 14px",textAlign:"right" }}>
                            {isAdmin
                              ?<input type="number" value={paidAmt||""} placeholder="0.000"
                                  onChange={e=>{
                                    const val = e.target.value;
                                    setMilestones(milestones.map(x=>x.id===m.id?{...x,paid_amount:val}:x));
                                  }}
                                  onBlur={e=>saveMilestonePaid(m.id,e.target.value,m.payment_date,m.bank_account_id)}
                                  style={{ width:90,border:"1px solid #10b981",borderRadius:6,padding:"4px 8px",fontSize:12,textAlign:"right",color:"#10b981",fontWeight:700 }} />
                              :<span style={{ color:"#10b981",fontWeight:700 }}>{paidAmt>0?paidAmt.toFixed(3):"—"}</span>
                            }
                          </td>
                          <td style={{ padding:"10px 14px",textAlign:"center" }}>
                            {isAdmin
                              ?<input type="date" value={m.payment_date||""}
                                  onChange={e=>{
                                    const val = e.target.value;
                                    setMilestones(milestones.map(x=>x.id===m.id?{...x,payment_date:val}:x));
                                  }}
                                  onBlur={e=>saveMilestonePaid(m.id,m.paid_amount,e.target.value,m.bank_account_id)}
                                  style={{ border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 8px",fontSize:11,color:"#64748b" }} />
                              :<span style={{ color:"#64748b",fontSize:12 }}>{m.payment_date||"—"}</span>
                            }
                          </td>
                          <td style={{ padding:"10px 14px",textAlign:"right",fontWeight:800,
                            color:balance>0?"#ef4444":balance===0?"#10b981":"#f59e0b" }}>
                            {balance!==0?balance.toFixed(3):"✓ Paid"}
                          </td>
                          <td style={{ padding:"10px 14px",textAlign:"center" }}>
                            {isAdmin
                              ?<select value={m.bank_account_id||""} onChange={e=>{
                                  const v=e.target.value;
                                  setMilestones(milestones.map(x=>x.id===m.id?{...x,bank_account_id:v}:x));
                                  supabase.from("sub_milestones").update({bank_account_id:v||null}).eq("id",m.id);
                                }}
                                style={{border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",fontSize:10,background:m.bank_account_id?"#f0fdf4":"#fef9c3"}}>
                                <option value="">— Account —</option>
                                {bankAccounts.map(a=><option key={a.id} value={a.id}>{a.account_name}</option>)}
                              </select>
                              :<span style={{fontSize:10,color:"#10b981"}}>{bankAccounts.find(a=>a.id===m.bank_account_id)?.account_name||"—"}</span>
                            }
                          </td>
                          <td style={{ padding:"10px 14px",textAlign:"center" }}>
                            <span style={{ background:statusBg[m.status],color:statusColor[m.status],borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700 }}>
                              {m.status}
                            </span>
                          </td>
                          {isAdmin&&<td style={{ padding:"10px 14px",textAlign:"center" }}>
                            <button onClick={()=>confirmAction("Delete this milestone?",async()=>{
                              await supabase.from("sub_milestones").delete().eq("id",m.id);
                              setMilestones(milestones.filter(x=>x.id!==m.id));
                            })} style={{ background:"#fef2f2",color:"#ef4444",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11 }}>🗑</button>
                          </td>}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop:"2px solid #e2e8f0",background:"#f8fafc" }}>
                      <td colSpan={2} style={{ padding:"10px 14px",fontWeight:800,color:"#0f172a" }}>TOTAL</td>
                      <td style={{ padding:"10px 14px",textAlign:"right",fontWeight:800,color:"#6366f1" }}>
                        {milestones.reduce((s,m)=>s+parseFloat(m.amount||0),0).toFixed(3)}
                      </td>
                      <td style={{ padding:"10px 14px",textAlign:"right",fontWeight:800,color:"#10b981" }}>
                        {milestones.reduce((s,m)=>s+parseFloat(m.paid_amount||0),0).toFixed(3)}
                      </td>
                      <td></td>
                      <td style={{ padding:"10px 14px",textAlign:"right",fontWeight:800,color:"#ef4444" }}>
                        {milestones.reduce((s,m)=>s+parseFloat(m.amount||0)-parseFloat(m.paid_amount||0),0).toFixed(3)}
                      </td>
                      <td colSpan={isAdmin?2:1}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }
          </div>
        </div>
      )}
    </div>
  );
}
