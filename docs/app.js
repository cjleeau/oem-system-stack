// Global OEM System Stack — D3 (Grid + Network) — CSV-driven
// Phase 12 — Governance Dashboard View (tables + mini charts)
// Includes: Grid (default), Network, Governance tabs; Reset fix; dependent dropdown disabling; greyed-out empty fields

const LAYERS = [
  "Ownership & Brand Stack",
  "Tier-1 Hardware Suppliers",
  "Battery & Cell Suppliers",
  "Semiconductor & Compute",
  "Vehicle OS & Middleware",
  "OTA & Software Update Infrastructure",
  "Telematics & TCU",
  "Connectivity Providers",
  "Cloud Infrastructure",
  "Streaming & Data Lake",
  "Data Governance & Sovereignty",
  "AI / Analytics",
  "Product APIs",
  "Dealer Systems",
  "Finance & Insurance",
  "External Insurance & Risk Ecosystem",
  "Fleet & Enterprise Integrations",
  "Regulators",
  "Energy & Charging"
];

const TELEMETRY_RELATIONS = new Set([
  "ROUTES DATA","INGESTS","STREAMS","STORES","PROCESSES","EXPOSES DATA",
  "HOSTS TELEMETRY","DATA LOCALIZATION REQUIRED","MANDATORY REPORTING",
  "TRANSFERS DATA"
]);

const vizEl = d3.select("#viz");
const tooltip = d3.select("#tooltip");

const state = {
  view: "grid", // grid | network | governance
  region: "all",
  oem: "all",
  layer: "all",
  type: "all",
  confidence: "all",
  search: "",
  telemetryOnly: false,
  evidenceOnly: false
};

function safe(v){ return (v ?? "").toString().trim(); }
function norm(s){ return safe(s).toLowerCase(); }
function uniq(arr) { return Array.from(new Set(arr)).sort((a,b)=>a.localeCompare(b)); }

function applyReadableText(textSel, opts = {}) {
  const size = opts.size ?? 12;
  const fill = opts.fill ?? "#F9FAFB";
  const stroke = opts.stroke ?? "rgba(0,0,0,0.85)";
  const strokeWidth = opts.strokeWidth ?? 3;
  textSel.attr("font-size", size).attr("opacity", 1).attr("fill", fill)
    .attr("stroke", stroke).attr("stroke-width", strokeWidth).attr("paint-order", "stroke");
}

function nodeFill(d){
  if (d.control_boundary === "regulatory") return "#F4A261";
  if (d.control_boundary === "external") return "#6C8CFF";
  return "#3B82F6";
}

function isVerifiedEdge(e){
  const status = safe(e.evidence_status).toUpperCase();
  const verifiedBool = (e.verified_edge === true) || (safe(e.verified_edge).toLowerCase() === "true");
  const hasUrl = !!safe(e.source_url);
  return status === "VERIFIED" || verifiedBool || hasUrl;
}

function isEvidencePass(e){
  const status = safe(e.evidence_status).toUpperCase();
  const verifiedBool = (e.verified_edge === true) || (safe(e.verified_edge).toLowerCase() === "true");
  const lvl = Number(safe(e.verification_level));
  const hasLvl = Number.isFinite(lvl);
  return status === "VERIFIED" || verifiedBool || (hasLvl && lvl >= 3);
}

function isTelemetryEdge(e){
  const rel = safe(e.relation);
  const telemetryBool = (e.telemetry_edge === true) || (safe(e.telemetry_edge).toLowerCase() === "true");
  return telemetryBool || TELEMETRY_RELATIONS.has(rel);
}

function edgeDash(e){ return isVerifiedEdge(e) ? "0" : "5 4"; }

function matchesNodeFilters(n, override = {}) {
  const region = override.region ?? state.region;
  const oem = override.oem ?? state.oem;
  const layer = override.layer ?? state.layer;
  const type = override.type ?? state.type;
  const confidence = override.confidence ?? state.confidence;
  const search = override.search ?? state.search;

  if (region !== "all" && n.region !== region) return false;
  if (oem !== "all" && n.oem_group !== oem) return false;
  if (layer !== "all" && n.layer !== layer) return false;
  if (type !== "all" && n.node_type !== type) return false;
  if (confidence !== "all" && n.confidence !== confidence) return false;

  if (search) {
    const q = norm(search);
    const hay = norm(`${n.label} ${n.id} ${n.notes ?? ""}`);
    if (!hay.includes(q)) return false;
  }
  return true;
}

function filterEdges(edges, nodeById) {
  return edges
    .filter(e => nodeById.has(e.source) && nodeById.has(e.target))
    .filter(e => !state.telemetryOnly || isTelemetryEdge(e))
    .filter(e => !state.evidenceOnly || isEvidencePass(e));
}

function restrictNodesToEdges(nodes, edges) {
  if (!state.evidenceOnly) return nodes;
  const keep = new Set();
  edges.forEach(e => { keep.add(e.source); keep.add(e.target); });
  return nodes.filter(n => keep.has(n.id));
}

// ---------- Dependent dropdown disabling ----------

function setOptionsWithDisable(selectEl, values, isEnabledFn) {
  const current = selectEl.value || "all";
  selectEl.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All";
  optAll.disabled = false;
  selectEl.appendChild(optAll);

  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    opt.disabled = !isEnabledFn(v);
    selectEl.appendChild(opt);
  });

  const stillThere = Array.from(selectEl.options).some(o => o.value === current && !o.disabled);
  selectEl.value = stillThere ? current : "all";
}

function rebuildDependentDropdowns(nodesAll) {
  const regionSel = document.querySelector("#region");
  const oemSel = document.querySelector("#oem");
  const layerSel = document.querySelector("#layer");
  const typeSel = document.querySelector("#type");
  const confSel = document.querySelector("#confidence");
  if (!regionSel || !oemSel || !layerSel || !typeSel || !confSel) return;

  const regions = uniq(nodesAll.map(d => d.region));
  const oems = uniq(nodesAll.map(d => d.oem_group));
  const types = uniq(nodesAll.map(d => d.node_type));
  const confs = uniq(nodesAll.map(d => d.confidence));

  function existsWith(override) { return nodesAll.some(n => matchesNodeFilters(n, override)); }

  setOptionsWithDisable(regionSel, regions, (v) =>
    existsWith({ region: v, oem: state.oem, layer: state.layer, type: state.type, confidence: state.confidence, search: state.search })
  );
  setOptionsWithDisable(oemSel, oems, (v) =>
    existsWith({ region: state.region, oem: v, layer: state.layer, type: state.type, confidence: state.confidence, search: state.search })
  );
  setOptionsWithDisable(layerSel, LAYERS, (v) =>
    existsWith({ region: state.region, oem: state.oem, layer: v, type: state.type, confidence: state.confidence, search: state.search })
  );
  setOptionsWithDisable(typeSel, types, (v) =>
    existsWith({ region: state.region, oem: state.oem, layer: state.layer, type: v, confidence: state.confidence, search: state.search })
  );
  setOptionsWithDisable(confSel, confs, (v) =>
    existsWith({ region: state.region, oem: state.oem, layer: state.layer, type: state.type, confidence: v, search: state.search })
  );

  state.region = regionSel.value;
  state.oem = oemSel.value;
  state.layer = layerSel.value;
  state.type = typeSel.value;
  state.confidence = confSel.value;
}

// ---------- Tooltip with greyed-out empty fields ----------

function fieldRow(label, value) {
  const v = safe(value);
  if (!v) return `<div style="opacity:.45"><strong>${label}:</strong> —</div>`;
  return `<div><strong>${label}:</strong> ${v}</div>`;
}

function evidenceBlock(d){
  const rows = [
    fieldRow("Evidence status", d.evidence_status),
    fieldRow("Evidence class", d.evidence_class),
    fieldRow("Verification level", d.verification_level),
    fieldRow("Verification status", d.verification_status),
    fieldRow("Source", d.source_name),
    fieldRow("Date", d.source_date),
    fieldRow("Evidence note", d.evidence_note),
    fieldRow("URL", d.source_url),
    fieldRow("Provenance ID", d.provenance_id),
    fieldRow("Citation required", d.citation_required),
    fieldRow("Last validated", d.last_validated_date),
    fieldRow("Last reviewed", d.last_reviewed),
    fieldRow("Owner", d.verification_owner)
  ];
  return `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.12)">${rows.join("")}</div>`;
}

function showTip(evt, d) {
  tooltip.style("display","block")
    .style("left", (evt.pageX + 12) + "px")
    .style("top", (evt.pageY + 12) + "px")
    .html(`
      <div><strong>${safe(d.label)}</strong></div>
      <div style="opacity:.85">${safe(d.region)} • ${safe(d.layer)}</div>
      <div style="opacity:.85">${safe(d.node_type)} • ${safe(d.control_boundary)} • ${safe(d.confidence)}</div>
      ${fieldRow("Notes", d.notes)}
      ${evidenceBlock(d)}
    `);
}

function showEdgeTip(evt, e) {
  tooltip.style("display","block")
    .style("left", (evt.pageX + 12) + "px")
    .style("top", (evt.pageY + 12) + "px")
    .html(`
      <div><strong>${safe(e.relation)}</strong></div>
      <div style="opacity:.85">${safe(e.region)} • ${safe(e.confidence)}</div>
      ${fieldRow("Notes", e.notes)}
      ${evidenceBlock(e)}
    `);
}

function hideTip(){ tooltip.style("display","none"); }

// ---------- Load + render ----------

let _nodesAll = null;
let _edgesAll = null;

Promise.all([
  d3.csv("data/nodes.csv", d3.autoType),
  d3.csv("data/edges.csv", d3.autoType)
]).then(([nodesRaw, edgesRaw]) => {

  _nodesAll = nodesRaw.map(d => ({
    ...d,
    id: safe(d.id),
    label: safe(d.label),
    region: safe(d.region),
    layer: safe(d.layer),
    oem_group: safe(d.oem_group),
    node_type: safe(d.node_type),
    control_boundary: safe(d.control_boundary),
    confidence: safe(d.confidence),
    notes: d.notes ?? "",

    source_name: d.source_name ?? "",
    source_url: d.source_url ?? "",
    source_date: d.source_date ?? "",
    evidence_note: d.evidence_note ?? "",
    evidence_status: safe(d.evidence_status).toUpperCase(),
    provenance_id: d.provenance_id ?? "",
    citation_required: d.citation_required ?? "",
    last_validated_date: d.last_validated_date ?? "",

    evidence_class: d.evidence_class ?? "",
    verification_level: d.verification_level ?? "",
    verification_status: d.verification_status ?? "",
    verification_owner: d.verification_owner ?? "",
    last_reviewed: d.last_reviewed ?? ""
  }))
  .map(d => ({...d, layerIndex: LAYERS.indexOf(d.layer)}))
  .filter(d => d.layerIndex >= 0);

  _edgesAll = edgesRaw.map(e => ({
    ...e,
    id: safe(e.id),
    source: safe(e.source),
    target: safe(e.target),
    relation: safe(e.relation),
    confidence: safe(e.confidence),
    region: safe(e.region),
    notes: e.notes ?? "",

    source_name: e.source_name ?? "",
    source_url: e.source_url ?? "",
    source_date: e.source_date ?? "",
    evidence_note: e.evidence_note ?? "",
    evidence_status: safe(e.evidence_status).toUpperCase(),
    telemetry_edge: e.telemetry_edge,
    verified_edge: e.verified_edge,
    provenance_id: e.provenance_id ?? "",
    citation_required: e.citation_required ?? "",
    last_validated_date: e.last_validated_date ?? "",

    evidence_class: e.evidence_class ?? "",
    verification_level: e.verification_level ?? "",
    verification_status: e.verification_status ?? "",
    verification_owner: e.verification_owner ?? "",
    last_reviewed: e.last_reviewed ?? ""
  }));

  // Tabs
  const tabGrid = document.querySelector("#tab-grid");
  const tabNet = document.querySelector("#tab-network");
  const tabGov = document.querySelector("#tab-governance");
  const tabDocs = document.querySelector("#tab-docs");

  function setView(v){
    state.view = v;
    if (tabGrid) tabGrid.classList.toggle("active", v==="grid");
    if (tabNet) tabNet.classList.toggle("active", v==="network");
    if (tabGov) tabGov.classList.toggle("active", v==="governance");
    if (tabDocs) tabDocs.classList.toggle("active", v==="docs");
    render();
  }
  if (tabGrid) tabGrid.addEventListener("click", ()=>setView("grid"));
  if (tabNet) tabNet.addEventListener("click", ()=>setView("network"));
  if (tabGov) tabGov.addEventListener("click", ()=>setView("governance"));
  if (tabDocs) tabDocs.addEventListener("click", ()=>setView("docs"));

  // Controls
  const regionSel = document.querySelector("#region");
  const oemSel = document.querySelector("#oem");
  const layerSel = document.querySelector("#layer");
  const typeSel = document.querySelector("#type");
  const confSel = document.querySelector("#confidence");
  const searchEl = document.querySelector("#search");
  const telem = document.querySelector("#telemetryOnly");
  const evidence = document.querySelector("#evidenceOnly");
  const resetBtn = document.querySelector("#reset");

  if (regionSel) regionSel.addEventListener("change", (e)=>{ state.region=e.target.value; render(); });
  if (oemSel) oemSel.addEventListener("change", (e)=>{ state.oem=e.target.value; render(); });
  if (layerSel) layerSel.addEventListener("change", (e)=>{ state.layer=e.target.value; render(); });
  if (typeSel) typeSel.addEventListener("change", (e)=>{ state.type=e.target.value; render(); });
  if (confSel) confSel.addEventListener("change", (e)=>{ state.confidence=e.target.value; render(); });

  if (searchEl) searchEl.addEventListener("input", (e)=>{ state.search=e.target.value; render(); });
  if (telem) telem.addEventListener("change", (e)=>{ state.telemetryOnly=e.target.checked; render(); });
  if (evidence) evidence.addEventListener("change", (e)=>{ state.evidenceOnly=e.target.checked; render(); });

  // Reset fix
  if (resetBtn) resetBtn.addEventListener("click", ()=>{
    Object.assign(state, {
      view: "grid",
      region: "all",
      oem: "all",
      layer: "all",
      type: "all",
      confidence: "all",
      search: "",
      telemetryOnly: false,
      evidenceOnly: false
    });

    if (regionSel) regionSel.value = "all";
    if (oemSel) oemSel.value = "all";
    if (layerSel) layerSel.value = "all";
    if (typeSel) typeSel.value = "all";
    if (confSel) confSel.value = "all";
    if (searchEl) searchEl.value = "";
    if (telem) telem.checked = false;
    if (evidence) evidence.checked = false;

    if (tabGrid) tabGrid.classList.add("active");
    if (tabNet) tabNet.classList.remove("active");
    if (tabGov) tabGov.classList.remove("active");

    render();
  });

  render();
});

function render() {
  if (!_nodesAll || !_edgesAll) return;

  if (state.view !== "governance" && state.view !== "docs") rebuildDependentDropdowns(_nodesAll);

  vizEl.selectAll("*").remove();

  if (state.view === "governance") {
    renderGovernance(_nodesAll, _edgesAll);
    return;
  }

  if (state.view === "docs") {
    renderDocs();
    return;
  }

  let nodes = _nodesAll.filter(n => matchesNodeFilters(n));
  const nodeById = new Map(nodes.map(d => [d.id, d]));
  let edges = filterEdges(_edgesAll, nodeById);
  nodes = restrictNodesToEdges(nodes, edges);

  if (state.view === "network") renderNetwork(nodes, edges);
  else renderGrid(nodes, edges, uniq(nodes.map(d => d.oem_group)));
}

// ----- Governance View -----

function parseLevel(v){
  const s = safe(v);
  if (!s) return 1; // blank => modelled default
  const n = Number(s);
  if (Number.isFinite(n) && n >= 0) return n;
  return 1;
}

function pct(n, d){
  if (!d) return "0%";
  return `${Math.round((n/d)*1000)/10}%`;
}

function renderTable(svg, cfg){
  const { title, x, y, columns, rows } = cfg;
  const rowH = 22;
  const headerH = 24;
  const tableW = columns.reduce((s,c)=>s+c.w, 0);

  const g = svg.append("g").attr("transform", `translate(${x},${y})`);

  g.append("text").attr("x",0).attr("y",-10).text(title);
  applyReadableText(g.select("text"), { size: 13, fill:"#D1D5DB", stroke:"rgba(0,0,0,0.9)" });

  g.append("rect")
    .attr("x",0).attr("y",0)
    .attr("width", tableW)
    .attr("height", headerH + rows.length*rowH + 10)
    .attr("fill","rgba(255,255,255,0.03)")
    .attr("stroke","rgba(255,255,255,0.08)")
    .attr("rx", 10);

  let cx = 10;
  columns.forEach(col => {
    const t = g.append("text").attr("x", cx).attr("y", 18).text(col.label);
    applyReadableText(t, { size: 11, fill:"#D1D5DB", stroke:"rgba(0,0,0,0.9)" });
    cx += col.w;
  });

  rows.forEach((r, i) => {
    const y0 = headerH + 6 + i*rowH;

    if (i % 2 === 1){
      g.append("rect")
        .attr("x",6).attr("y", y0-16)
        .attr("width", tableW-12).attr("height", rowH)
        .attr("fill","rgba(255,255,255,0.02)")
        .attr("rx", 6);
    }

    let x0 = 10;
    columns.forEach(col => {
      const val = r[col.key];
      const out = col.fmt ? col.fmt(val) : String(val ?? "");
      const t = g.append("text").attr("x", x0).attr("y", y0).text(out);
      applyReadableText(t, { size: 11 });
      x0 += col.w;
    });
  });
}

function renderGovernance(nodesAll, edgesAll){
  // HTML-first dashboard to avoid SVG/table overlap
  const nodes = nodesAll.filter(n => matchesNodeFilters(n));
  const nodeById = new Map(nodes.map(d=>[d.id,d]));
  const edges = edgesAll.filter(e => nodeById.has(e.source) && nodeById.has(e.target));

  const totalNodes = nodes.length;
  const totalEdges = edges.length;

  // Data completeness checks (edges)
  const fields = ["evidence_status","verification_level","verification_status","source_url","source_name","source_date","provenance_id"];
  const missing = {};
  fields.forEach(k => missing[k] = 0);
  edges.forEach(e => { fields.forEach(k => { if (!safe(e[k])) missing[k] += 1; }); });

  // Verification level counts (treat blank as L1 by parseLevel)
  const levels = [4,3,2,1,0];
  const levelCounts = new Map(levels.map(l => [l,0]));
  edges.forEach(e => {
    const l = parseLevel(e.verification_level);
    levelCounts.set(l, (levelCounts.get(l) || 0) + 1);
  });

  const unreviewed = edges.filter(e => safe(e.verification_status).toUpperCase() === "UNREVIEWED").length;

  const bannerMsg =
    (missing["verification_level"] / (totalEdges || 1) > 0.5)
      ? `Most edges have no verification_level set (${missing["verification_level"]}/${totalEdges}). Dashboard is showing defaults. Populate verification_level (0–4) to get meaningful coverage.`
      : null;

  // evidence_status distribution
  const statusCounts = new Map([["VERIFIED",0],["UNVERIFIED",0],["UNREVIEWED",0],["BLANK",0]]);
  edges.forEach(e => {
    const s = safe(e.evidence_status).toUpperCase();
    if (!s) statusCounts.set("BLANK", statusCounts.get("BLANK")+1);
    else if (statusCounts.has(s)) statusCounts.set(s, statusCounts.get(s)+1);
    else statusCounts.set(s, (statusCounts.get(s)||0)+1);
  });
  const statusRows = Array.from(statusCounts.entries())
    .map(([status,count]) => ({ status, count, pct: count/(totalEdges||1) }))
    .sort((a,b)=>b.count-a.count);

  // OEM aggregation
  const oemAgg = new Map();
  edges.forEach(e => {
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    const oem = (src && safe(src.oem_group)) || (tgt && safe(tgt.oem_group)) || "UNKNOWN";
    if (!oemAgg.has(oem)) oemAgg.set(oem, { oem, edges:0, l4:0, l3:0, l1:0 });
    const a = oemAgg.get(oem);
    a.edges += 1;
    const l = parseLevel(e.verification_level);
    if (l===4) a.l4 += 1;
    else if (l===3) a.l3 += 1;
    else if (l===1) a.l1 += 1;
  });

  const oems = Array.from(oemAgg.values()).map(r => ({
    ...r,
    verified_pct: (r.l4 + r.l3) / (r.edges || 1)
  })).sort((a,b)=>b.verified_pct - a.verified_pct);

  // Layer aggregation (weakest first)
  const layerAgg = new Map();
  edges.forEach(e => {
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    const layers = new Set([src ? safe(src.layer) : "", tgt ? safe(tgt.layer) : ""]);
    layers.forEach(layer => {
      if (!layer) return;
      if (!layerAgg.has(layer)) layerAgg.set(layer, { layer, edges:0, l4:0, l3:0, l1:0 });
      const a = layerAgg.get(layer);
      a.edges += 1;
      const l = parseLevel(e.verification_level);
      if (l===4) a.l4 += 1;
      else if (l===3) a.l3 += 1;
      else if (l===1) a.l1 += 1;
    });
  });

  const layersTbl = Array.from(layerAgg.values()).map(r => ({
    ...r,
    verified_pct: (r.l4 + r.l3) / (r.edges || 1),
    modelled_pct: r.l1 / (r.edges || 1)
  })).sort((a,b)=>a.verified_pct - b.verified_pct);

  const missingRows = Object.entries(missing)
    .map(([field,missingCount]) => ({ field, missing: missingCount, pct: missingCount/(totalEdges||1) }))
    .sort((a,b)=>b.missing-a.missing);

  // -------- HTML dashboard --------
  const root = vizEl.append("div")
    .attr("class","gov-root")
    .style("width","100%")
    .style("height","100%")
    .style("padding","18px 18px 28px 18px")
    .style("box-sizing","border-box");

  root.append("div")
    .style("font-size","18px")
    .style("font-weight","700")
    .style("color","#F9FAFB")
    .style("margin","6px 0 10px 0")
    .text("Governance Dashboard — Verification Coverage");

  if (bannerMsg){
    root.append("div")
      .style("background","rgba(244,162,97,0.18)")
      .style("border","1px solid rgba(244,162,97,0.35)")
      .style("color","#FDE68A")
      .style("padding","10px 12px")
      .style("border-radius","10px")
      .style("margin","0 0 12px 0")
      .style("font-size","12px")
      .text(bannerMsg);
  }

  function card(parent, title){
    const c = parent.append("div")
      .style("background","rgba(255,255,255,0.03)")
      .style("border","1px solid rgba(255,255,255,0.08)")
      .style("border-radius","12px")
      .style("padding","12px 12px 10px 12px")
      .style("box-sizing","border-box")
      .style("min-height","0");
    c.append("div")
      .style("font-size","12px")
      .style("color","#D1D5DB")
      .style("margin-bottom","8px")
      .text(title);
    return c;
  }

  function htmlTable(parent, cols, rows, maxRows=18, maxHeight=360){
    const wrap = parent.append("div")
      .style("overflow","auto")
      .style("max-height", `${maxHeight}px`)
      .style("border-radius","10px");

    const table = wrap.append("table")
      .style("width","100%")
      .style("border-collapse","collapse")
      .style("font-size","12px")
      .style("color","#E5E7EB");

    const thead = table.append("thead");
    const trh = thead.append("tr");

    cols.forEach(c => trh.append("th")
      .style("position","sticky")
      .style("top","0")
      .style("background","rgba(0,0,0,0.35)")
      .style("backdrop-filter","blur(4px)")
      .style("text-align", c.align || "left")
      .style("padding","8px 8px")
      .style("border-bottom","1px solid rgba(255,255,255,0.10)")
      .text(c.label));

    const tbody = table.append("tbody");
    rows.slice(0,maxRows).forEach((r,i) => {
      const tr = tbody.append("tr")
        .style("background", i%2 ? "rgba(255,255,255,0.02)" : "transparent");
      cols.forEach(c => tr.append("td")
        .style("padding","7px 8px")
        .style("border-bottom","1px solid rgba(255,255,255,0.06)")
        .style("text-align", c.align || "left")
        .text(c.fmt ? c.fmt(r[c.key], r) : (r[c.key] ?? "")));
    });
    return wrap;
  }

  // KPI row
  const kpiRow = root.append("div")
    .style("display","grid")
    .style("grid-template-columns","repeat(8, minmax(120px, 1fr))")
    .style("gap","10px")
    .style("margin","0 0 12px 0");

  const kpis = [
    ["Nodes", totalNodes],
    ["Edges", totalEdges],
    ["L4 (Hard)", levelCounts.get(4) || 0],
    ["L3 (Public)", levelCounts.get(3) || 0],
    ["L2 (Trade)", levelCounts.get(2) || 0],
    ["L1 (Modelled)", levelCounts.get(1) || 0],
    ["Unreviewed", unreviewed],
    ["Missing verification_level", missing["verification_level"]]
  ];

  kpis.forEach(([k,v]) => {
    const c = card(kpiRow, k);
    c.append("div")
      .style("font-size","20px")
      .style("font-weight","700")
      .style("color","#F9FAFB")
      .text(String(v));
  });

  // Two-column layout
  const grid = root.append("div")
    .style("display","grid")
    .style("grid-template-columns","minmax(520px, 1fr) minmax(520px, 1fr)")
    .style("gap","12px");

  const left = grid.append("div")
    .style("display","flex")
    .style("flex-direction","column")
    .style("gap","12px")
    .style("min-height","0");

  const right = grid.append("div")
    .style("display","flex")
    .style("flex-direction","column")
    .style("gap","12px")
    .style("min-height","0");

  // Chart card (SVG inside card)
  const chartCard = card(left, "Edge Distribution by Verification Level");
  const svgW = 520, svgH = 240, pad = {l:34,r:10,t:8,b:28};
  const svg = chartCard.append("svg").attr("viewBox", `0 0 ${svgW} ${svgH}`);

  const data = levels.map(l => ({ level: String(l), count: levelCounts.get(l) || 0 }));
  const x = d3.scaleBand().domain(data.map(d=>d.level)).range([pad.l, svgW-pad.r]).padding(0.22);
  const y = d3.scaleLinear().domain([0, d3.max(data, d=>d.count) || 1]).nice().range([svgH-pad.b, pad.t]);

  svg.append("g")
    .attr("transform", `translate(0,${svgH-pad.b})`)
    .call(d3.axisBottom(x))
    .selectAll("text").attr("fill","#D1D5DB");

  svg.append("g")
    .attr("transform", `translate(${pad.l},0)`)
    .call(d3.axisLeft(y).ticks(5))
    .selectAll("text").attr("fill","#D1D5DB");

  svg.selectAll("rect.bar").data(data).join("rect")
    .attr("x", d=>x(d.level))
    .attr("y", d=>y(d.count))
    .attr("width", x.bandwidth())
    .attr("height", d=>(svgH-pad.b) - y(d.count))
    .attr("fill","rgba(37,99,235,0.9)")
    .attr("stroke","rgba(255,255,255,0.20)");

  svg.selectAll("text.lbl").data(data).join("text")
    .attr("x", d=>x(d.level) + x.bandwidth()/2)
    .attr("y", d=>y(d.count) - 6)
    .attr("text-anchor","middle")
    .attr("fill","#F9FAFB")
    .attr("stroke","rgba(0,0,0,0.85)")
    .attr("stroke-width", 3)
    .attr("paint-order","stroke")
    .style("font-size","11px")
    .text(d=>d.count);

  // Weakest layers table
  const weakCard = card(left, "Weakest Layers (lowest % Verified)");
  htmlTable(weakCard,
    [
      {key:"layer", label:"Layer"},
      {key:"edges", label:"Edges", align:"right"},
      {key:"verified_pct", label:"% Verified", align:"right", fmt:(v)=>pct(v,1)},
      {key:"modelled_pct", label:"% Modelled (L1)", align:"right", fmt:(v)=>pct(v,1)}
    ],
    layersTbl,
    40,
    520
  );

  // OEM table
  const oemCard = card(right, "Top OEMs by % Verified (L3+L4)");
  htmlTable(oemCard,
    [
      {key:"oem", label:"OEM"},
      {key:"edges", label:"Edges", align:"right"},
      {key:"l4", label:"L4", align:"right"},
      {key:"l3", label:"L3", align:"right"},
      {key:"l1", label:"L1", align:"right"},
      {key:"verified_pct", label:"% Verified", align:"right", fmt:(v)=>pct(v,1)}
    ],
    oems,
    40,
    520
  );

  // Evidence status table
  const statusCard = card(right, "Evidence Status (edges)");
  htmlTable(statusCard,
    [
      {key:"status", label:"Status"},
      {key:"count", label:"Count", align:"right"},
      {key:"pct", label:"%", align:"right", fmt:(v)=>pct(v,1)}
    ],
    statusRows,
    10,
    220
  );

  // Missing fields table
  const missCard = card(right, "Top Missing Fields (edges)");
  htmlTable(missCard,
    [
      {key:"field", label:"Field"},
      {key:"missing", label:"Missing", align:"right"},
      {key:"pct", label:"%", align:"right", fmt:(v)=>pct(v,1)}
    ],
    missingRows,
    12,
    260
  );
}


// ----- GRID VIEW -----

function renderGrid(nodes, edges, cols){
  const margin = {top: 30, right: 20, bottom: 20, left: 220};
  const cellW = 240;
  const cellH = 78;

  const w = margin.left + margin.right + cols.length * cellW;
  const h = margin.top + margin.bottom + LAYERS.length * cellH;

  const svg = vizEl.append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  svg.style("touch-action", "none");
  svg.append("rect").attr("width", w).attr("height", h).attr("fill","transparent").style("pointer-events","all");

  const gRoot = svg.append("g");

  const headerSel = gRoot.append("g").selectAll("text")
    .data(cols).join("text")
    .attr("x", (d,i)=> margin.left + i*cellW + 8)
    .attr("y", 20)
    .text(d=>d);
  applyReadableText(headerSel, { size: 13 });

  const rowSel = gRoot.append("g").selectAll("text")
    .data(LAYERS).join("text")
    .attr("x", 12)
    .attr("y", (d,i)=> margin.top + i*cellH + 48)
    .text(d=>d);
  applyReadableText(rowSel, { size: 12, fill: "#D1D5DB", stroke: "rgba(0,0,0,0.9)" });

  const grid = gRoot.append("g").attr("opacity", 0.28);
  for (let r=0; r<LAYERS.length; r++){
    for (let c=0; c<cols.length; c++){
      grid.append("rect")
        .attr("x", margin.left + c*cellW)
        .attr("y", margin.top + r*cellH)
        .attr("width", cellW)
        .attr("height", cellH)
        .attr("fill","none")
        .attr("stroke","rgba(255,255,255,.10)");
    }
  }

  const grouped = d3.group(nodes, d=>d.layer, d=>d.oem_group);
  const pos = new Map();

  for (const [layer, byCol] of grouped){
    const r = LAYERS.indexOf(layer);
    for (const [col, list] of byCol){
      const c = cols.indexOf(col);
      const x0 = margin.left + c*cellW + 10;
      const y0 = margin.top + r*cellH + 10;
      const boxH = 24;
      list.slice(0,3).forEach((n,i)=>{
        pos.set(n.id, {x:x0, y:y0 + i*(boxH+6), w:cellW-20, h:boxH});
      });
    }
  }

  gRoot.append("g").selectAll("path")
    .data(edges).join("path")
    .attr("fill","none")
    .attr("stroke","#9CA3AF")
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.85)
    .style("stroke-dasharray", edgeDash)
    .attr("d", e=>{
      const a = pos.get(e.source), b = pos.get(e.target);
      if (!a || !b) return "";
      const x1 = a.x + a.w, y1 = a.y + a.h/2;
      const x2 = b.x, y2 = b.y + b.h/2;
      const mx = (x1+x2)/2;
      return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    })
    .on("mousemove", showEdgeTip)
    .on("mouseleave", hideTip);

  const visibleNodes = nodes.filter(n=>pos.has(n.id));
  const nodeSel = gRoot.append("g").selectAll("g.node")
    .data(visibleNodes, d=>d.id)
    .join(enter=>{
      const g = enter.append("g").attr("class","node");
      g.append("rect");
      g.append("text");
      return g;
    })
    .attr("transform", d=>{
      const p = pos.get(d.id);
      return `translate(${p.x},${p.y})`;
    });

  nodeSel.select("rect")
    .attr("width", d=>pos.get(d.id).w)
    .attr("height", d=>pos.get(d.id).h)
    .attr("fill", d => (safe(d.evidence_status).toUpperCase()==="VERIFIED") ? "#2563EB" : nodeFill(d))
    .attr("stroke","rgba(255,255,255,.40)")
    .attr("rx", 6);

  const nodeText = nodeSel.select("text")
    .attr("x", 10).attr("y", 16)
    .text(d=>d.label);
  applyReadableText(nodeText, { size: 12 });

  nodeSel.on("mousemove", showTip).on("mouseleave", hideTip);

  const zoom = d3.zoom().scaleExtent([0.6, 3.5]).on("zoom", (event) => gRoot.attr("transform", event.transform));
  svg.call(zoom);
}

// ----- NETWORK VIEW -----

function renderNetwork(nodes, edges){
  const w = 1400;
  const h = 820;

  const svg = vizEl.append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  svg.style("touch-action", "none");
  svg.append("rect").attr("width", w).attr("height", h).attr("fill","transparent").style("pointer-events","all");

  const gRoot = svg.append("g");

  const regions = uniq(nodes.map(d=>d.region));
  const xScale = d3.scalePoint().domain(regions).range([120, w-120]);

  const nodesLocal = nodes.map(d => ({
    ...d,
    x: xScale(d.region) + (Math.random()-0.5)*40,
    y: h/2 + (Math.random()-0.5)*40
  }));

  const nodeById = new Map(nodesLocal.map(d=>[d.id,d]));
  const links = edges.map(e=>({
    ...e,
    source: nodeById.get(e.source),
    target: nodeById.get(e.target)
  })).filter(l=>l.source && l.target);

  const linkSel = gRoot.append("g").selectAll("line")
    .data(links).join("line")
    .attr("stroke", "#9CA3AF")
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.85)
    .style("stroke-dasharray", edgeDash)
    .on("mousemove", (evt, e) => showEdgeTip(evt, e))
    .on("mouseleave", hideTip);

  const nodeSel = gRoot.append("g").selectAll("g")
    .data(nodesLocal, d=>d.id).join("g").attr("class","node")
    .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

  nodeSel.append("circle")
    .attr("r", 7)
    .attr("fill", d => (safe(d.evidence_status).toUpperCase()==="VERIFIED") ? "#2563EB" : nodeFill(d))
    .attr("stroke","rgba(255,255,255,.40)");

  const labelSel = nodeSel.append("text").attr("x", 12).attr("y", 4).text(d=>d.label);
  applyReadableText(labelSel, { size: 12 });

  nodeSel.on("mousemove", showTip).on("mouseleave", hideTip);

  const sim = d3.forceSimulation(nodesLocal)
    .force("link", d3.forceLink(links).distance(90).strength(0.25))
    .force("charge", d3.forceManyBody().strength(-220))
    .force("collide", d3.forceCollide().radius(18))
    .force("x", d3.forceX(d=>xScale(d.region)).strength(0.25))
    .force("y", d3.forceY(h/2).strength(0.08));

  sim.on("tick", () => {
    linkSel.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y);
    nodeSel.attr("transform", d=>`translate(${d.x},${d.y})`);
  });

  function dragstarted(event, d) { if (!event.active) sim.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; }
  function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
  function dragended(event, d) { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }

  const zoom = d3.zoom().scaleExtent([0.6, 3.5]).on("zoom", (event) => gRoot.attr("transform", event.transform));
  svg.call(zoom);
}
