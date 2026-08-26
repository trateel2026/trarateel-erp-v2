import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../context/AdminContext";
const STATUSES=["Available","In Use","Maintenance","Retired","On Hire"];
const DEFAULT_EQUIP=["Excavator","Loader","Crane","Truck","Mixer","Compactor","Generator","Welder","JCB","Dump Truck","Scaffolding","Roller","Bulldozer","Forklift","Water Tanker","Concrete Pump"];
const empty=()=>({name:"",customName:"",quantity:"1",status:"Available",current_site:"",customSite:"",daily_rate:"",notes:"",rent_due:"",rent_amount:""});


/** Parse rent due meta from notes. Tags: [RENT_DUE:YYYY-MM-DD] [RENT_AMT:120] */
function parseRentMeta(notes="") {
  const dueM = String(notes).match(/\[RENT_DUE:(\d{4}-\d{2}-\d{2})\]/);
  const amtM = String(notes).match(/\[RENT_AMT:([\d.]+)\]/);
  let due = dueM ? dueM[1] : null;
  let amt = amtM ? parseFloat(amtM[1]) : null;
  if (!due) {
    const m2 = String(notes).match(/DUE on (\d{2})\/(\d{2})\/(\d{4})/i);
    if (m2) due = `${m2[3]}-${m2[2]}-${m2[1]}`;
    const m3 = String(notes).match(/DUE on (\d{4}-\d{2}-\d{2})/i);
    if (m3) due = m3[1];
  }
  return { due, amt };
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr + "T00:00:00");
  const n = new Date(); n.setHours(0,0,0,0);
  return Math.round((t - n) / 86400000);
}
/** Rental if status On Hire, or notes have rent tags / "Rented from" */
function isRental(eq) {
  if (!eq) return false;
  if (eq.status === "On Hire") return true;
  const n = String(eq.notes || "");
  if (/\[RENT_DUE:/.test(n) || /\[RENT_AMT:/.test(n)) return true;
  if (/rented from/i.test(n)) return true;
  return false;
}
function buildNotes(base, rentDue, rentAmt) {
  let n = String(base || "").replace(/\[RENT_DUE:[^\]]*\]/g, "").replace(/\[RENT_AMT:[^\]]*\]/g, "").trim();
  if (rentDue) n = `${n} [RENT_DUE:${rentDue}]`.trim();
  if (rentAmt !== "" && rentAmt !== null && rentAmt !== undefined) n = `${n} [RENT_AMT:${rentAmt}]`.trim();
  return n;
}


function printEquipmentReport(equip, company = {}) {
  const isRent = (e) => {
    if (!e) return false;
    if (e.status === "On Hire") return true;
    const n = String(e.notes || "");
    return /\[RENT_DUE:/.test(n) || /\[RENT_AMT:/.test(n) || /rented from/i.test(n);
  };
  const coName = company.company_name || "TRATEEL AL NAJAH FOR TRADING";
  const coNameAr = company.company_name_ar || "";
  const coAddr = company.company_address || "Sultanate of Oman";
  const coVat = company.company_vat_no || company.company_tax_no || "";
  const coCr = company.company_cr || "";
  const logo = company.company_logo || "";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const own = equip.filter(e => !isRent(e));
  const rent = equip.filter(e => isRent(e));
  const cleanNotes = (n) => String(n || "")
    .replace(/\[RENT_DUE:[^\]]*\]/g, "")
    .replace(/\[RENT_AMT:[^\]]*\]/g, "")
    .replace(/\[RETURNED:[^\]]*\]/g, "")
    .trim();

  const section = (list, title, accent) => {
    const rows = list.map((e, i) => {
      const tag = isRent(e) ? "RENT" : "OWN";
      const tagBg = isRent(e) ? "#fff7ed" : "#ecfdf5";
      const tagFg = isRent(e) ? "#c2410c" : "#047857";
      return `<tr>
        <td class="c">${i + 1}</td>
        <td><div class="name">${e.name || "—"}</div><div class="sub">${e.type || ""}</div></td>
        <td class="c"><span class="badge" style="background:${tagBg};color:${tagFg}">${tag}</span></td>
        <td class="c num">${e.quantity ?? 1}</td>
        <td class="c">${e.status || "—"}</td>
        <td>${e.current_site || "—"}</td>
        <td>${e.operator || "—"}</td>
        <td class="notes">${cleanNotes(e.notes).slice(0, 100)}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="8" class="empty">No items in this group</td></tr>`;
    return `
      <div class="section">
        <div class="section-hd" style="border-left:4px solid ${accent}">
          <span>${title}</span>
          <span class="count">${list.length} item${list.length === 1 ? "" : "s"}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:36px">#</th>
              <th>Name / Type</th>
              <th style="width:64px">Own/Rent</th>
              <th style="width:48px">Qty</th>
              <th style="width:88px">Status</th>
              <th style="width:90px">Site</th>
              <th style="width:100px">Supplier</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <title>Equipment Register — ${coName}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:"Segoe UI",system-ui,-apple-system,sans-serif;margin:0;padding:0;color:#0f172a;background:#f1f5f9;font-size:11px;line-height:1.4}
    .page{max-width:190mm;margin:0 auto;background:#fff;padding:10mm 8mm 12mm;min-height:auto}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #0f172a;padding-bottom:16px;margin-bottom:18px}
    .hdr-left{display:flex;gap:14px;align-items:center}
    .logo{height:40px;width:auto;object-fit:contain}
    .co-name{font-size:18px;font-weight:800;letter-spacing:-0.02em;margin:0}
    .co-ar{font-size:13px;color:#475569;margin-top:2px}
    .co-meta{font-size:11px;color:#64748b;margin-top:4px}
    .doc-box{text-align:right}
    .doc-title{font-size:15px;font-weight:800;color:#4f46e5;text-transform:uppercase;letter-spacing:0.04em}
    .doc-sub{font-size:11px;color:#64748b;margin-top:4px}
    .kpis{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
    .kpi{flex:1;min-width:120px;background:linear-gradient(180deg,#f8fafc,#fff);border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
    .kpi-l{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em}
    .kpi-v{font-size:18px;font-weight:800;margin-top:2px}
    .section{margin-bottom:22px}
    .section-hd{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f8fafc;border-radius:8px 8px 0 0;font-weight:800;font-size:13px;margin-bottom:0}
    .count{font-size:11px;font-weight:600;color:#64748b}
    table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none}
    th{background:#0f172a;color:#fff;padding:6px 7px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.03em}
    td{padding:6px 7px;border-bottom:1px solid #f1f5f9;vertical-align:top}
    tr:nth-child(even) td{background:#fafbfc}
    tr:hover td{background:#f1f5f9}
    .c{text-align:center}
    .num{font-weight:700;font-variant-numeric:tabular-nums}
    .name{font-weight:700;color:#0f172a}
    .sub{font-size:10px;color:#94a3b8;margin-top:1px}
    .notes{font-size:8.5px;color:#64748b;max-width:120px}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800}
    .empty{text-align:center;color:#94a3b8;padding:20px !important}
    .ftr{margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
    .actions{position:sticky;bottom:0;background:rgba(255,255,255,0.95);padding:12px 0;margin-top:16px;border-top:1px solid #e2e8f0;text-align:center}
    .btn{background:#4f46e5;color:#fff;border:none;padding:11px 28px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.25)}
    .btn:hover{background:#4338ca}
    @page{size:A4 portrait;margin:10mm 8mm}
    @media print{
      body{background:#fff !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:10px}
      .page{padding:0;max-width:none;width:100%;margin:0}
      .actions,.btn{display:none !important}
      tr:hover td{background:transparent}
      .section,.contractor,.work{page-break-inside:avoid}
      thead{display:table-header-group}
      .kpis{gap:6px}
      .kpi-v{font-size:14px !important}
      .logo{height:36px !important}
      table{font-size:9px}
      th,td{padding:4px 5px !important}
    }
  </style></head><body>
  <div class="page">
    <div class="hdr">
      <div class="hdr-left">
        ${logo ? `<img class="logo" src="${logo}" alt="logo"/>` : ""}
        <div>
          <div class="co-name">${coName}</div>
          ${coNameAr ? `<div class="co-ar">${coNameAr}</div>` : ""}
          <div class="co-meta">${coAddr}${coVat ? " · VAT " + coVat : ""}${coCr ? " · CR " + coCr : ""}</div>
        </div>
      </div>
      <div class="doc-box">
        <div class="doc-title">Equipment Register</div>
        <div class="doc-sub">Tools · PPE · Rentals</div>
        <div class="doc-sub">${dateStr} · ${timeStr}</div>
      </div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-l">Total items</div><div class="kpi-v" style="color:#4f46e5">${equip.length}</div></div>
      <div class="kpi"><div class="kpi-l">Owned</div><div class="kpi-v" style="color:#059669">${own.length}</div></div>
      <div class="kpi"><div class="kpi-l">Rented</div><div class="kpi-v" style="color:#d97706">${rent.length}</div></div>
      <div class="kpi"><div class="kpi-l">Total qty (own+rent)</div><div class="kpi-v" style="color:#0f172a">${equip.reduce((s,e)=>s+parseFloat(e.quantity||1),0)}</div></div>
    </div>
    ${section(own, "Owned equipment, tools & PPE", "#059669")}
    ${section(rent, "Rented equipment", "#d97706")}
    <div class="ftr">
      <span>Minarva Biz ERP · Confidential</span>
      <span>${coName}</span>
    </div>
    <div class="actions"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div>
  </div>
  </body></html>`);
  w.document.close();
}


export default function Equipment(){
  const{isAdmin:r,canEdit,confirmAction,logActivity}=useAdmin();const isAdmin=canEdit("equipment");
  const[equip,setEquip]=useState([]);const[schedules,setSchedules]=useState([]);const[sites,setSites]=useState([]);const[company,setCompany]=useState({});
  const[loading,setLoading]=useState(true);const[tab,setTab]=useState("fleet");
  const[showForm,setShowForm]=useState(false);const[form,setForm]=useState(empty());const[editId,setEditId]=useState(null);
  const[filterStatus,setFilterStatus]=useState("All");const[filterOwn,setFilterOwn]=useState("All");const[saving,setSaving]=useState(false);const[msg,setMsg]=useState("");
  const[showSched,setShowSched]=useState(null);const[schedSite,setSchedSite]=useState("");const[schedCustom,setSchedCustom]=useState("");
  const[showTransfer,setShowTransfer]=useState(null);const[transferSite,setTransferSite]=useState("");const[transferCustom,setTransferCustom]=useState("");

  const load=async()=>{
    const[e,s,p]=await Promise.all([supabase.from("equipment").select("*").order("name"),supabase.from("equipment_schedule").select("*").order("start_date",{ascending:false}),supabase.from("projects").select("name,site").order("name")]);
    setEquip(e.data||[]);setSchedules(s.data||[]);
    const allSites=new Set();(p.data||[]).forEach(pr=>{if(pr.name)allSites.add(pr.name);if(pr.site)allSites.add(pr.site);});(e.data||[]).forEach(eq=>{if(eq.current_site)allSites.add(eq.current_site);});
    setSites([...allSites].filter(Boolean).sort());
    try{const{data:st}=await supabase.from("app_settings").select("key,value");const map={};(st||[]).forEach(r=>{if(r.key)map[r.key]=r.value;});setCompany(map);}catch{}
    setLoading(false);
  };
  useEffect(()=>{load();},[]);
  const showMsg=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3000);};

  // Rent reminders: due within 7 days or overdue
  const rentAlerts = equip.map(eq => {
    const meta = parseRentMeta(eq.notes || "");
    // Fallback: latest schedule end_date for this equipment
    let due = meta.due;
    if (!due) {
      const scheds = schedules.filter(s => s.equipment_id === eq.id && s.end_date).sort((a,b) => (b.end_date||"").localeCompare(a.end_date||""));
      if (scheds[0]) due = scheds[0].end_date;
    }
    if (!due) return null;
    const d = daysUntil(due);
    if (d === null || d > 7) return null;
    return { eq, due, days: d, amt: meta.amt != null ? meta.amt : parseFloat(eq.daily_rate||0) * parseFloat(eq.quantity||1) };
  }).filter(Boolean).sort((a,b) => a.days - b.days);

  const inp={border:"1px solid #e2e8f0",borderRadius:8,padding:"9px 12px",fontSize:13,width:"100%",boxSizing:"border-box",outline:"none",background:"#fff"};

  // All known equipment names (defaults + previously added)
  const equipNames=[...new Set([...DEFAULT_EQUIP,...equip.map(e=>e.name).filter(Boolean)])].sort();

  // Get the final name/site value (handles custom)
  const getFinalName=()=>form.name==="__custom__"?form.customName.trim():form.name;
  const getFinalSite=()=>form.current_site==="__custom__"?form.customSite.trim():form.current_site;

  const saveEquip=async()=>{const finalName=getFinalName();if(!finalName){showMsg("❌ Equipment name required");return;}setSaving(true);
    const row={name:finalName,quantity:parseFloat(form.quantity)||1,status:form.status,current_site:getFinalSite(),daily_rate:parseFloat(form.daily_rate)||0,notes: buildNotes(form.notes, form.rent_due, form.rent_amount)};
    if(editId){await supabase.from("equipment").update(row).eq("id",editId);logActivity("Edited equipment",finalName,"Equipment");}
    else{await supabase.from("equipment").insert(row);logActivity("Added equipment",finalName,"Equipment");}
    showMsg("✅ Saved!");setShowForm(false);setForm(empty());setEditId(null);await load();setSaving(false);};
  const deleteEquip=(item)=>{confirmAction(`Delete "${item.name}"?`,async()=>{await supabase.from("equipment").delete().eq("id",item.id);logActivity("Deleted",item.name,"Equipment");showMsg("✅ Deleted");await load();});};

  /** Write off worn/damaged/consumed qty (gloves etc). Keeps history in schedule. */
  const writeOff = (eq) => {
    if (!isAdmin) { setShowLogin(true); return; }
    const maxQ = parseFloat(eq.quantity || 1);
    const raw = prompt(`Write-off quantity for "${eq.name}"\n(Current qty: ${maxQ})\nEnter how many worn out / used up:`, "1");
    if (raw === null) return;
    const n = parseFloat(raw);
    if (!n || n <= 0) { showMsg("❌ Invalid quantity"); return; }
    if (n > maxQ) { showMsg("❌ Cannot exceed current quantity"); return; }
    const reason = prompt("Reason (optional):", "Worn out / consumed") || "Worn out / consumed";
    confirmAction(`Write off ${n} × ${eq.name}?\nReason: ${reason}`, async () => {
      const left = parseFloat((maxQ - n).toFixed(3));
      const status = left <= 0 ? "Retired" : (eq.status || "In Use");
      await supabase.from("equipment").update({ quantity: left <= 0 ? 0 : left, status }).eq("id", eq.id);
      await supabase.from("equipment_schedule").insert({
        equipment_id: eq.id,
        site: eq.current_site || "",
        start_date: new Date().toISOString().split("T")[0],
        notes: `WRITE-OFF ×${n} · ${reason} · remaining ${left <= 0 ? 0 : left}`,
      });
      logActivity("Write-off", `${eq.name} ×${n} (${reason})`, "Equipment");
      showMsg(`✅ Wrote off ${n}. Remaining: ${left <= 0 ? 0 : left}`);
      await load();
    });
  };

  /** Return rented equipment to supplier — ends hire, clears rent due. */
  const returnRental = (eq) => {
    if (!isAdmin) { setShowLogin(true); return; }
    confirmAction(`Mark "${eq.name}" as RETURNED to supplier (${eq.operator || "vendor"})?\nRent tracking will be closed.`, async () => {
      let notes = String(eq.notes || "")
        .replace(/\[RENT_DUE:[^\]]*\]/g, "")
        .replace(/\[RENT_AMT:[^\]]*\]/g, "")
        .trim();
      notes = `${notes} [RETURNED:${new Date().toISOString().split("T")[0]}]`.trim();
      await supabase.from("equipment").update({
        status: "Retired",
        notes,
        // keep quantity for history; operator stays for audit
      }).eq("id", eq.id);
      await supabase.from("equipment_schedule").insert({
        equipment_id: eq.id,
        site: eq.current_site || "",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
        notes: `RETURNED to supplier · ${eq.operator || ""} · hire closed`,
      });
      logActivity("Rental returned", `${eq.name} → ${eq.operator || "supplier"}`, "Equipment");
      showMsg("✅ Rental returned & closed");
      await load();
    });
  };

  const doAssign=async()=>{const site=schedSite==="__custom__"?schedCustom.trim():schedSite;if(!site){showMsg("❌ Select site");return;}setSaving(true);
    await supabase.from("equipment_schedule").insert({equipment_id:showSched,site,start_date:new Date().toISOString().split("T")[0],notes:"Assigned"});
    await supabase.from("equipment").update({status:"In Use",current_site:site}).eq("id",showSched);
    logActivity("Assigned",`${equip.find(e=>e.id===showSched)?.name} → ${site}`,"Equipment");
    showMsg("✅ Assigned!");setShowSched(null);setSchedSite("");setSchedCustom("");await load();setSaving(false);};

  const doTransfer=async()=>{const site=transferSite==="__custom__"?transferCustom.trim():transferSite;if(!site){showMsg("❌ Select new site");return;}setSaving(true);
    const eq=equip.find(e=>e.id===showTransfer);
    await supabase.from("equipment_schedule").insert({equipment_id:showTransfer,site,start_date:new Date().toISOString().split("T")[0],notes:`From ${eq?.current_site||"—"}`});
    await supabase.from("equipment").update({current_site:site}).eq("id",showTransfer);
    logActivity("Transferred",`${eq?.name}: ${eq?.current_site} → ${site}`,"Equipment");
    showMsg("✅ Transferred!");setShowTransfer(null);setTransferSite("");setTransferCustom("");await load();setSaving(false);};

  const filtered=equip.filter(e=>{
    if(filterStatus!=="All"&&e.status!==filterStatus) return false;
    if(filterOwn==="Own"&&isRental(e)) return false;
    if(filterOwn==="Rented"&&!isRental(e)) return false;
    return true;
  });
  const ownCount=equip.filter(e=>!isRental(e)).length;
  const rentCount=equip.filter(e=>isRental(e)).length;
  const stColor=(s)=>s==="Available"?"#10b981":s==="In Use"?"#6366f1":s==="Maintenance"?"#f59e0b":"#94a3b8";
  if(loading)return<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>Loading...</div>;

  // Reusable Site Selector component
  const SiteSelect=({value,onChange,customValue,onCustomChange,id})=>(
    <div>
      <select value={value} onChange={e=>onChange(e.target.value)} style={inp}>
        <option value="">-- Select Site --</option>
        {sites.map(s=><option key={s} value={s}>{s}</option>)}
        <option value="__custom__">➕ Add Custom Site...</option>
      </select>
      {value==="__custom__"&&<input value={customValue} onChange={e=>onCustomChange(e.target.value)} placeholder="Type new site name..." style={{...inp,marginTop:6,border:"2px solid #6366f1"}}/>}
    </div>
  );

  return(
    <div style={{padding:"24px 28px",maxWidth:1400}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div><h2 style={{margin:0,fontSize:22,color:"#0f172a"}}>🚜 Equipment</h2><div style={{fontSize:13,color:"#64748b"}}>Track machinery and site assignments</div></div>
        {msg&&<span style={{fontSize:12,fontWeight:600,color:msg.startsWith("✅")?"#10b981":"#ef4444",padding:"6px 14px",borderRadius:20,background:msg.startsWith("✅")?"#ecfdf5":"#fef2f2"}}>{msg}</span>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>printEquipmentReport(equip, company)} style={{background:"#0f172a",color:"#fff",border:"none",borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>🖨 Print / PDF</button>
          {isAdmin&&<button onClick={()=>{setForm(empty());setEditId(null);setShowForm(true);}} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Add Equipment</button>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        {[["Total",equip.length,"#6366f1"],["Own",ownCount,"#059669"],["Rented",rentCount,"#d97706"],["In Use",equip.filter(e=>e.status==="In Use"||e.status==="On Hire").length,"#8b5cf6"]].map(([l,v,c])=>(<div key={l} style={{background:"#fff",borderRadius:12,padding:"16px 20px",border:"1px solid #e2e8f0"}}><div style={{fontSize:11,color:"#64748b",fontWeight:600}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div></div>))}
      </div>
      <div style={{display:"flex",gap:4,marginBottom:16}}>{[["fleet","🚜 Fleet"],["schedule","📅 History"]].map(([id,label])=>(<button key={id} onClick={()=>setTab(id)} style={{padding:"10px 20px",borderRadius:"10px 10px 0 0",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:tab===id?"#6366f1":"#f1f5f9",color:tab===id?"#fff":"#64748b"}}>{label}</button>))}</div>

      {rentAlerts.length > 0 && (
        <div style={{marginBottom:14,padding:"12px 16px",borderRadius:12,background:rentAlerts.some(a=>a.days<0)?"#fef2f2":"#fffbeb",border:`1px solid ${rentAlerts.some(a=>a.days<0)?"#fecaca":"#fde68a"}`}}>
          <div style={{fontWeight:800,fontSize:13,color:rentAlerts.some(a=>a.days<0)?"#b91c1c":"#b45309",marginBottom:6}}>
            ⏰ Equipment rent reminder
          </div>
          {rentAlerts.map((a,i)=>(
            <div key={i} style={{fontSize:12,color:"#334155",marginTop:4}}>
              <b>{a.eq.name}</b> × {a.eq.quantity||1}
              {" · "}Due <b>{a.due}</b>
              {" · "}{a.days < 0 ? <span style={{color:"#dc2626",fontWeight:700}}>{Math.abs(a.days)}d overdue</span> : a.days === 0 ? <span style={{color:"#dc2626",fontWeight:700}}>Due today</span> : <span style={{color:"#d97706"}}>in {a.days} day{a.days>1?"s":""}</span>}
              {a.amt ? ` · OMR ${Number(a.amt).toFixed(3)}` : ""}
              {a.eq.operator ? ` · ${a.eq.operator}` : ""}
            </div>
          ))}
        </div>
      )}
      {tab==="fleet"&&(<div>
        <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
          {[["All","All"],["Own","🟢 Own"],["Rented","🟠 Rented"]].map(([id,label])=>(
            <button key={id} onClick={()=>setFilterOwn(id)} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:filterOwn===id?(id==="Rented"?"#d97706":id==="Own"?"#059669":"#6366f1"):"#f1f5f9",color:filterOwn===id?"#fff":"#64748b"}}>{label}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>{["All",...STATUSES].map(s=>(<button key={s} onClick={()=>setFilterStatus(s)} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:filterStatus===s?"#6366f1":"#f1f5f9",color:filterStatus===s?"#fff":"#64748b"}}>{s}</button>))}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          {filtered.map(eq=>{const sc=stColor(eq.status);return(
            <div key={eq.id} style={{background:"#fff",borderRadius:12,padding:18,border:"1px solid #e2e8f0"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:8,flexWrap:"wrap"}}>
                <div style={{fontWeight:700,fontSize:16,color:"#0f172a"}}>{eq.name}</div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{background:isRental(eq)?"#fff7ed":"#ecfdf5",color:isRental(eq)?"#c2410c":"#047857",border:`1px solid ${isRental(eq)?"#fed7aa":"#a7f3d0"}`,borderRadius:10,padding:"2px 10px",fontSize:11,fontWeight:800}}>{isRental(eq)?"🟠 RENT":"🟢 OWN"}</span>
                  <span style={{background:`${sc}20`,color:sc,borderRadius:10,padding:"2px 10px",fontSize:11,fontWeight:600}}>{eq.status}</span>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:12,color:"#64748b",marginBottom:12}}>
                <div>Qty: <strong style={{color:"#6366f1"}}>{eq.quantity||1}</strong> · 📍 <strong style={{color:"#1e293b"}}>{eq.current_site||"—"}</strong></div>
                <div>{isRental(eq)
                  ? <span>🏷 Supplier: <strong style={{color:"#c2410c"}}>{eq.operator||"—"}</strong></span>
                  : <span>💰 <strong style={{color:"#10b981"}}>OMR {parseFloat(eq.daily_rate||0).toFixed(3)}/day</strong></span>}
                </div>
              </div>
              {isRental(eq) && parseRentMeta(eq.notes||"").due && (
                <div style={{fontSize:11,color:"#b45309",marginBottom:10,fontWeight:600}}>Next rent due: {parseRentMeta(eq.notes||"").due}{parseRentMeta(eq.notes||"").amt!=null?` · OMR ${parseRentMeta(eq.notes||"").amt}`:""}</div>
              )}
              {isAdmin&&(<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {eq.status==="Available"&&<button onClick={()=>{setShowSched(eq.id);setSchedSite("");setSchedCustom("");}} style={{flex:1,background:"#eef2ff",color:"#6366f1",border:"1px solid #c7d2fe",borderRadius:8,padding:"7px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📌 Assign</button>}
                {eq.status==="In Use"&&<>
                  <button onClick={()=>{setShowTransfer(eq.id);setTransferSite("");setTransferCustom("");}} style={{flex:1,background:"#fffbeb",color:"#92400e",border:"1px solid #fcd34d",borderRadius:8,padding:"7px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🔄 Transfer</button>
                  <button onClick={async()=>{await supabase.from("equipment").update({quantity:"1",status:"Available",current_site:""}).eq("id",eq.id);await supabase.from("equipment_schedule").insert({equipment_id:eq.id,site:eq.current_site,start_date:new Date().toISOString().split("T")[0],notes:"Released"});logActivity("Released",eq.name,"Equipment");showMsg("✅ Released");await load();}} style={{background:"#ecfdf5",color:"#10b981",border:"1px solid #86efac",borderRadius:8,padding:"7px",fontSize:12,fontWeight:700,cursor:"pointer"}}>✅ Release</button>
                </>}
                <button onClick={()=>{const isInList=equipNames.includes(eq.name);setForm({name:isInList?eq.name:"__custom__",customName:isInList?"":eq.name,quantity:String(eq.quantity||1),status:eq.status,current_site:sites.includes(eq.current_site)?eq.current_site:(eq.current_site?"__custom__":""),customSite:sites.includes(eq.current_site)?"":eq.current_site||"",daily_rate:String(eq.daily_rate||""),notes:(()=>{const m=parseRentMeta(eq.notes||"");return String(eq.notes||"").replace(/\[RENT_DUE:[^\]]*\]/g,"").replace(/\[RENT_AMT:[^\]]*\]/g,"").trim();})(),rent_due:(parseRentMeta(eq.notes||"").due||""),rent_amount:(()=>{const m=parseRentMeta(eq.notes||"");return m.amt!=null?String(m.amt):"";})()});setEditId(eq.id);setShowForm(true);}} style={{background:"#eef2ff",color:"#6366f1",border:"none",borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer"}}>✏️</button>
                <button onClick={()=>writeOff(eq)} style={{background:"#fff7ed",color:"#c2410c",border:"1px solid #fed7aa",borderRadius:8,padding:"7px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}} title="Worn out / consumed">📉 Write-off</button>
                {isRental(eq)&&eq.status!=="Retired"&&<button onClick={()=>returnRental(eq)} style={{background:"#f0fdf4",color:"#15803d",border:"1px solid #bbf7d0",borderRadius:8,padding:"7px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>↩️ Return rent</button>}
                <button onClick={()=>deleteEquip(eq)} style={{background:"#fef2f2",color:"#ef4444",border:"none",borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer"}}>🗑</button>
              </div>)}
            </div>);})}
        </div>
        {filtered.length===0&&<div style={{padding:40,textAlign:"center",color:"#94a3b8",background:"#f8fafc",borderRadius:12}}>No equipment. Click "+ Add Equipment".</div>}
      </div>)}

      {tab==="schedule"&&(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:"#f8fafc"}}>{["Equipment","Site","Date","Notes"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",color:"#64748b",fontWeight:600,fontSize:11,borderBottom:"1px solid #e2e8f0"}}>{h}</th>)}</tr></thead><tbody>
        {schedules.map((s,i)=>{const eq=equip.find(e=>e.id===s.equipment_id);return(<tr key={s.id} style={{borderTop:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fafbfc"}}><td style={{padding:"10px 14px",fontWeight:600}}>{eq?.name||"?"}</td><td style={{padding:"10px 14px"}}>{s.site||"—"}</td><td style={{padding:"10px 14px",color:"#64748b"}}>{s.start_date||"—"}</td><td style={{padding:"10px 14px",color:"#94a3b8",fontSize:12}}>{s.notes||"—"}</td></tr>);})}
        {schedules.length===0&&<tr><td colSpan={4} style={{padding:40,textAlign:"center",color:"#94a3b8"}}>No history.</td></tr>}
      </tbody></table></div>)}

      {/* Add/Edit form */}
      {showForm&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowForm(false)}><div style={{background:"#fff",borderRadius:16,padding:28,width:"min(440px,90vw)"}} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 16px",fontSize:16}}>🚜 {editId?"Edit":"Add"} Equipment</h3>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Equipment Name *</div>
          <select value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value,customName:""}))} style={inp}>
            <option value="">-- Select Equipment --</option>
            {equipNames.map(n=><option key={n} value={n}>{n}</option>)}
            <option value="__custom__">➕ Add Custom Equipment...</option>
          </select>
          {form.name==="__custom__"&&<input value={form.customName} onChange={e=>setForm(p=>({...p,customName:e.target.value}))} placeholder="Type custom equipment name..." style={{...inp,marginTop:6,border:"2px solid #6366f1"}} autoFocus/>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
          <div><div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Quantity</div><input type="number" value={form.quantity} onChange={e=>setForm(p=>({...p,quantity:e.target.value}))} min="1" style={inp}/></div>
          <div><div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Status</div><select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} style={inp}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>Use <b>On Hire</b> for rented items. Own items → Available / In Use.</div>
          </div>
          <div><div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Rate/Day (OMR)</div><input type="number" value={form.daily_rate} onChange={e=>setForm(p=>({...p,daily_rate:e.target.value}))} step="0.001" style={inp}/></div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Current Site</div>
          <SiteSelect value={form.current_site} onChange={v=>setForm(p=>({...p,current_site:v,customSite:""}))} customValue={form.customSite} onCustomChange={v=>setForm(p=>({...p,customSite:v}))}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div><div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Rent due date (monthly hire)</div>
            <input type="date" value={form.rent_due||""} onChange={e=>setForm(p=>({...p,rent_due:e.target.value}))} style={inp} placeholder="Next rent due"/>
          </div>
          <div><div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Monthly rent (OMR)</div>
            <input type="number" step="0.001" value={form.rent_amount||""} onChange={e=>setForm(p=>({...p,rent_amount:e.target.value}))} style={inp} placeholder="e.g. 120"/>
          </div>
        </div>
        <div style={{marginBottom:12}}><div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Notes</div><input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={inp}/></div>
        <div style={{display:"flex",gap:10}}><button onClick={saveEquip} disabled={saving} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"10px 22px",fontSize:13,fontWeight:700,cursor:"pointer"}}>{saving?"Saving...":"💾 Save"}</button><button onClick={()=>setShowForm(false)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,padding:"10px 14px",fontSize:13,cursor:"pointer"}}>Cancel</button></div>
      </div></div>)}

      {/* Assign to site */}
      {showSched&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowSched(null)}><div style={{background:"#fff",borderRadius:16,padding:28,width:"min(400px,90vw)"}} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 12px",fontSize:16}}>📌 Assign: {equip.find(e=>e.id===showSched)?.name}</h3>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Site *</div>
          <SiteSelect value={schedSite} onChange={setSchedSite} customValue={schedCustom} onCustomChange={setSchedCustom}/>
        </div>
        <div style={{display:"flex",gap:10}}><button onClick={doAssign} disabled={saving} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"10px 22px",fontSize:13,fontWeight:700,cursor:"pointer"}}>{saving?"...":"📌 Assign"}</button><button onClick={()=>setShowSched(null)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,padding:"10px 14px",fontSize:13,cursor:"pointer"}}>Cancel</button></div>
      </div></div>)}

      {/* Transfer site */}
      {showTransfer&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowTransfer(null)}><div style={{background:"#fff",borderRadius:16,padding:28,width:"min(400px,90vw)"}} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 4px",fontSize:16}}>🔄 Transfer: {equip.find(e=>e.id===showTransfer)?.name}</h3>
        <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>Current: <strong>{equip.find(e=>e.id===showTransfer)?.current_site||"—"}</strong></div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>New Site *</div>
          <SiteSelect value={transferSite} onChange={setTransferSite} customValue={transferCustom} onCustomChange={setTransferCustom}/>
        </div>
        <div style={{display:"flex",gap:10}}><button onClick={doTransfer} disabled={saving} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:8,padding:"10px 22px",fontSize:13,fontWeight:700,cursor:"pointer"}}>{saving?"...":"🔄 Transfer"}</button><button onClick={()=>setShowTransfer(null)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,padding:"10px 14px",fontSize:13,cursor:"pointer"}}>Cancel</button></div>
      </div></div>)}
    </div>);
}
