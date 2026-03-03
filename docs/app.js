// Global OEM System Stack — D3 (Grid + Network) — CSV-driven
// Phase 10 — UX hardening: reset fix, dependent dropdown disabling, greyed-out empty fields

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
  view: "grid",
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
    .filter(e => !state.evidenceOnly || isVerifiedEdge(e));
}

function restrictNodesToEdges(nodes, edges) {
  if (!state.evidenceOnly) return nodes;
  const keep = new Set();
  edges.forEach(e => { keep.add(e.source); keep.add(e.target); });
  return nodes.filter(n => keep.has(n.id));
}

// ---------- Controls: dependent disabling ----------

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
    fieldRow("Source", d.source_name),
    fieldRow("Date", d.source_date),
    fieldRow("Evidence note", d.evidence_note),
    fieldRow("URL", d.source_url),
    fieldRow("Provenance ID", d.provenance_id),
    fieldRow("Citation required", d.citation_required),
    fieldRow("Last validated", d.last_validated_date)
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
    provenance_parent: d.provenance_parent ?? "",
    citation_required: d.citation_required ?? "",
    last_validated_date: d.last_validated_date ?? ""
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
    provenance_parent: e.provenance_parent ?? "",
    citation_required: e.citation_required ?? "",
    last_validated_date: e.last_validated_date ?? ""
  }));

  const regionSel = document.querySelector("#region");
  const oemSel = document.querySelector("#oem");
  const layerSel = document.querySelector("#layer");
  const typeSel = document.querySelector("#type");
  const confSel = document.querySelector("#confidence");

  if (regionSel) regionSel.addEventListener("change", (e)=>{ state.region=e.target.value; render(); });
  if (oemSel) oemSel.addEventListener("change", (e)=>{ state.oem=e.target.value; render(); });
  if (layerSel) layerSel.addEventListener("change", (e)=>{ state.layer=e.target.value; render(); });
  if (typeSel) typeSel.addEventListener("change", (e)=>{ state.type=e.target.value; render(); });
  if (confSel) confSel.addEventListener("change", (e)=>{ state.confidence=e.target.value; render(); });

  const searchEl = document.querySelector("#search");
  if (searchEl) searchEl.addEventListener("input", (e)=>{ state.search=e.target.value; render(); });

  const telem = document.querySelector("#telemetryOnly");
  if (telem) telem.addEventListener("change", (e)=>{ state.telemetryOnly=e.target.checked; render(); });

  const evidence = document.querySelector("#evidenceOnly");
  if (evidence) evidence.addEventListener("change", (e)=>{ state.evidenceOnly=e.target.checked; render(); });

  const tabGrid = document.querySelector("#tab-grid");
  const tabNet = document.querySelector("#tab-network");
  function setView(v){
    state.view = v;
    if (tabGrid) tabGrid.classList.toggle("active", v==="grid");
    if (tabNet) tabNet.classList.toggle("active", v==="network");
    render();
  }
  if (tabGrid) tabGrid.addEventListener("click", ()=>setView("grid"));
  if (tabNet) tabNet.addEventListener("click", ()=>setView("network"));

  // ✅ Reset fix
  const resetBtn = document.querySelector("#reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", ()=>{
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

      render();
    });
  }

  render();
});

function render() {
  if (!_nodesAll || !_edgesAll) return;

  // ✅ Grey out unavailable dropdown options based on current state
  rebuildDependentDropdowns(_nodesAll);

  vizEl.selectAll("*").remove();

  let nodes = _nodesAll.filter(n => matchesNodeFilters(n));
  const nodeById = new Map(nodes.map(d => [d.id, d]));

  let edges = filterEdges(_edgesAll, nodeById);
  nodes = restrictNodesToEdges(nodes, edges);

  if (state.view === "network") renderNetwork(nodes, edges);
  else renderGrid(nodes, edges, uniq(nodes.map(d => d.oem_group)));
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

  for (const [layer, byCol] of grouped){
    const r = LAYERS.indexOf(layer);
    for (const [col, list] of byCol){
      if (list.length<=3) continue;
      const c = cols.indexOf(col);
      const x = margin.left + c*cellW + 14;
      const y = margin.top + r*cellH + 10 + 3*(24+6) + 10;
      const moreText = gRoot.append("text").attr("x", x).attr("y", y).text(`+${list.length-3} more`);
      applyReadableText(moreText, { size: 11, fill: "#D1D5DB", stroke: "rgba(0,0,0,0.9)" });
    }
  }

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

  const regionText = gRoot.append("g").selectAll("text")
    .data(regions).join("text")
    .attr("x", d=>xScale(d)).attr("y", 24).attr("text-anchor","middle")
    .text(d=>d.toUpperCase());
  applyReadableText(regionText, { size: 12, fill: "#D1D5DB", stroke: "rgba(0,0,0,0.9)" });

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
