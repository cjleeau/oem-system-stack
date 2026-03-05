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
  "ADAS & Mapping",
  "Dealer & Retail Tech",
  "Fleet & Commercial",
  "Finance & Insurance",
  "Regulators",
  "Security & Identity",
  "Data Platforms & Analytics",
  "Developer & API Ecosystem",
  "Customer Apps & Portals",
  "Mobility Services"
];

const CONFIDENCE_ENUM = ["hard","high","medium","soft"];

const state = {
  view: "grid", // grid | network | architecture | governance | docs
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
  const fill =
    opts.fill ??
    getComputedStyle(document.documentElement).getPropertyValue("--label")?.trim()
    "#E5E7EB";
  textSel
    .style("font-family", "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif")
    .style("font-size", `${size}px`)
    .style("font-weight", opts.weight ?? 600)
    .style("fill", fill)
    .style("paint-order", "stroke")
    .style("stroke", "rgba(0,0,0,.55)")
    .style("stroke-width", "3px");
}

function clampEnum(v, allowed){
  const s = norm(v);
  if (!s) return "";
  return allowed.includes(s) ? s : "";
}

function hasCol(obj, col){ return obj && Object.prototype.hasOwnProperty.call(obj, col); }

const tip = document.querySelector("#tip");
function showTip(html, x, y){
  if (!tip) return;
  tip.innerHTML = html;
  tip.style.left = `${x+14}px`;
  tip.style.top = `${y+14}px`;
  tip.style.opacity = 1;
}
function hideTip(){
  if (!tip) return;
  tip.style.opacity = 0;
}

function showNodeTip(evt, d){
  const html = `
    <div style="font-weight:700;margin-bottom:6px">${safe(d.label)}</div>
    <div style="opacity:.9">
      <div><span style="opacity:.7">id:</span> ${safe(d.id)}</div>
      <div><span style="opacity:.7">type:</span> ${safe(d.type)}</div>
      <div><span style="opacity:.7">layer:</span> ${safe(d.layer)}</div>
      <div><span style="opacity:.7">region:</span> ${safe(d.region)}</div>
      <div><span style="opacity:.7">oem:</span> ${safe(d.oem_group)}</div>
      ${hasCol(d,"confidence") ? `<div><span style="opacity:.7">confidence:</span> ${safe(d.confidence)}</div>` : ""}
      ${hasCol(d,"control_boundary") ? `<div><span style="opacity:.7">boundary:</span> ${safe(d.control_boundary)}</div>` : ""}
    </div>`;
  showTip(html, evt.clientX, evt.clientY);
}

function showEdgeTip(evt, e){
  const html = `
    <div style="font-weight:700;margin-bottom:6px">${safe(e.relationship) "relationship"}</div>
    <div style="opacity:.9">
      <div><span style="opacity:.7">source:</span> ${safe(e.source)}</div>
      <div><span style="opacity:.7">target:</span> ${safe(e.target)}</div>
      <div><span style="opacity:.7">layer:</span> ${safe(e.layer)}</div>
      <div><span style="opacity:.7">region:</span> ${safe(e.region)}</div>
      <div><span style="opacity:.7">evidence_status:</span> ${safe(e.evidence_status)}</div>
      <div><span style="opacity:.7">verification_level:</span> ${safe(e.verification_level)}</div>
      ${safe(e.source_name) ? `<div style="margin-top:6px"><span style="opacity:.7">source:</span> ${safe(e.source_name)}</div>` : ""}
      ${safe(e.source_url) ? `<div><span style="opacity:.7">url:</span> ${safe(e.source_url)}</div>` : ""}
      ${safe(e.evidence_note) ? `<div style="margin-top:6px;opacity:.85">${safe(e.evidence_note)}</div>` : ""}
    </div>`;
  showTip(html, evt.clientX, evt.clientY);
}

function nodeFill(d){
  const t = norm(d.type);
  if (t.includes("oem")) return "#16A34A";
  if (t.includes("platform") t.includes("software")) return "#8B5CF6";
  if (t.includes("supplier")) return "#F59E0B";
  if (t.includes("cloud")) return "#3B82F6";
  if (t.includes("regulator")) return "#EF4444";
  return "#6B7280";
}

function edgeDash(e){
  const rel = norm(e.relationship);
  if (rel.includes("potential") rel.includes("assumed")) return "6 4";
  const status = norm(e.evidence_status);
  if (status === "inferred" status === "modelled" status === "assumed") return "6 4";
  return null;
}

function isTelemetryEdge(e){
  const rel = norm(e.relationship);
  return rel.includes("telemetry") rel.includes("ingest") rel.includes("v2c") rel.includes("vehicle-to-cloud");
}

function isEvidencePass(e){
  const status = safe(e.evidence_status).toUpperCase();
  const verifiedBool = (e.verified_edge === true) (safe(e.verified_edge).toLowerCase() === "true");
  const lvl = Number(safe(e.verification_level));
  const hasLvl = Number.isFinite(lvl);
  return status === "VERIFIED" verifiedBool (hasLvl && lvl >= 3);
}

const root = d3.select(document.documentElement);

const vizEl = d3.select("#viz");

const selRegion = document.querySelector("#sel-region");
const selOEM = document.querySelector("#sel-oem");
const selLayer = document.querySelector("#sel-layer");
const selType = document.querySelector("#sel-type");
const selConfidence = document.querySelector("#sel-confidence");
const inpSearch = document.querySelector("#inp-search");
const chkTelemetry = document.querySelector("#chk-telemetry");
const chkEvidence = document.querySelector("#chk-evidence");
const btnReset = document.querySelector("#btn-reset");

let _nodesAll = [];
let _edgesAll = [];
let _oems = [];
let _regions = [];
let _types = [];
let _layers = [];

function setDisabled(selectEl, disabled){
  if (!selectEl) return;
  selectEl.disabled = !!disabled;
  selectEl.classList.toggle("disabled", !!disabled);
}

function setOptionDisabled(selectEl, value, disabled){
  if (!selectEl) return;
  const opt = Array.from(selectEl.options).find(o => o.value === value);
  if (!opt) return;
  opt.disabled = !!disabled;
}

function rebuildDependentDropdowns(nodes){
  // Grey-out dropdowns/options that have no data in current filtered set.
  // Build availability sets based on current filters except the dropdown being rebuilt.

  const regionVals = new Set(nodes.map(d => safe(d.region)));
  const oemVals = new Set(nodes.map(d => safe(d.oem_group)));
  const layerVals = new Set(nodes.map(d => safe(d.layer)));
  const typeVals = new Set(nodes.map(d => safe(d.type)));
  const confVals = new Set(nodes.map(d => safe(d.confidence)));

  // Disable whole dropdown if only "all" would remain
  const regionHas = regionVals.size > 0;
  const oemHas = oemVals.size > 0;
  const layerHas = layerVals.size > 0;
  const typeHas = typeVals.size > 0;
  const confHas = confVals.size > 0;

  setDisabled(selRegion, !regionHas);
  setDisabled(selOEM, !oemHas);
  setDisabled(selLayer, !layerHas);
  setDisabled(selType, !typeHas);

  // Confidence may not exist in schema; guard
  if (selConfidence) setDisabled(selConfidence, !confHas);

  // Grey-out options
  if (selRegion) {
    Array.from(selRegion.options).forEach(o => {
      if (o.value === "all") return;
      o.disabled = !regionVals.has(o.value);
    });
  }
  if (selOEM) {
    Array.from(selOEM.options).forEach(o => {
      if (o.value === "all") return;
      o.disabled = !oemVals.has(o.value);
    });
  }
  if (selLayer) {
    Array.from(selLayer.options).forEach(o => {
      if (o.value === "all") return;
      o.disabled = !layerVals.has(o.value);
    });
  }
  if (selType) {
    Array.from(selType.options).forEach(o => {
      if (o.value === "all") return;
      o.disabled = !typeVals.has(o.value);
    });
  }
  if (selConfidence) {
    Array.from(selConfidence.options).forEach(o => {
      if (o.value === "all") return;
      o.disabled = !confVals.has(o.value);
    });
  }
}

function populateSelect(selectEl, values){
  if (!selectEl) return;
  const cur = selectEl.value "all";
  selectEl.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All";
  selectEl.appendChild(optAll);
  values.forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    selectEl.appendChild(o);
  });
  selectEl.value = Array.from(selectEl.options).some(o => o.value === cur) ? cur : "all";
}

function matchesNodeFilters(n){
  if (state.region !== "all" && safe(n.region) !== state.region) return false;
  if (state.oem !== "all" && safe(n.oem_group) !== state.oem) return false;
  if (state.layer !== "all" && safe(n.layer) !== state.layer) return false;
  if (state.type !== "all" && safe(n.type) !== state.type) return false;
  if (state.confidence !== "all" && safe(n.confidence) !== state.confidence) return false;
  if (state.search) {
    const hay = `${safe(n.label)} ${safe(n.description)} ${safe(n.id)} ${safe(n.oem_group)} ${safe(n.layer)} ${safe(n.type)}`.toLowerCase();
    if (!hay.includes(state.search.toLowerCase())) return false;
  }
  return true;
}

function filterEdges(edgesAll, nodeById){
  return edgesAll
    .filter(e => nodeById.get(e.source) && nodeById.get(e.target))
    .filter(e => state.region==="all" safe(e.region)===state.region)
    .filter(e => state.layer==="all" safe(e.layer)===state.layer)
    .filter(e => !state.telemetryOnly isTelemetryEdge(e))
    .filter(e => !state.evidenceOnly isEvidencePass(e));
}

function restrictNodesToEdges(nodes, edges){
  const keep = new Set();
  edges.forEach(e => { keep.add(e.source); keep.add(e.target); });
  return nodes.filter(n => keep.has(n.id));
}

function resetUI(){
  state.view = "grid";
  state.region = "all";
  state.oem = "all";
  state.layer = "all";
  state.type = "all";
  state.confidence = "all";
  state.search = "";
  state.telemetryOnly = false;
  state.evidenceOnly = false;

  if (selRegion) selRegion.value = "all";
  if (selOEM) selOEM.value = "all";
  if (selLayer) selLayer.value = "all";
  if (selType) selType.value = "all";
  if (selConfidence) selConfidence.value = "all";
  if (inpSearch) inpSearch.value = "";
  if (chkTelemetry) chkTelemetry.checked = false;
  if (chkEvidence) chkEvidence.checked = false;
}

function render(){
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
  else if (state.view === "architecture") renderArchitecture(nodes, edges, uniq(nodes.map(d => d.oem_group)));
  else renderGrid(nodes, edges, uniq(nodes.map(d => d.oem_group)));
}

function renderGrid(nodes, edges, oems){
  const w = 1400;
  const h = 820;

  const svg = vizEl.append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  svg.style("touch-action", "none");
  svg.append("rect").attr("width", w).attr("height", h).attr("fill","transparent").style("pointer-events","all");

  const gRoot = svg.append("g");

  const cols = oems.length ? oems : uniq(nodes.map(d => d.oem_group));
  const x = d3.scaleBand().domain(cols).range([40, w-30]).paddingInner(0.18);

  const layers = LAYERS.slice();
  const y = d3.scaleBand().domain(layers).range([40, h-30]).paddingInner(0.12);

  // Lane background
  gRoot.append("g").selectAll("rect").data(layers).join("rect")
    .attr("x", 40)
    .attr("y", d => y(d))
    .attr("width", (w-30) - 40)
    .attr("height", y.bandwidth())
    .attr("fill", "rgba(255,255,255,0.02)")
    .attr("stroke","rgba(255,255,255,0.05)");

  // Layer labels
  const layerLbl = gRoot.append("g").selectAll("text").data(layers).join("text")
    .attr("x", 10).attr("y", d => y(d) + y.bandwidth()/2 + 4)
    .text(d => d);
  applyReadableText(layerLbl, { size: 11 });

  // Column labels
  const colLbl = gRoot.append("g").selectAll("text").data(cols).join("text")
    .attr("x", d => x(d) + x.bandwidth()/2)
    .attr("y", 22)
    .attr("text-anchor","middle")
    .text(d => d);
  applyReadableText(colLbl, { size: 12 });

  // Node positions in grid cells
  const buckets = d3.group(nodes, d => d.layer, d => d.oem_group);
  const placed = [];

  layers.forEach(layer => {
    cols.forEach(col => {
      const list = buckets.get(layer)?.get(col) ? Array.from(buckets.get(layer).get(col)) : [];
      if (!list.length) return;
      list.sort((a,b) => safe(a.label).localeCompare(safe(b.label)));
      const cx = x(col) + x.bandwidth()/2;
      const cy = y(layer) + y.bandwidth()/2;
      const step = 16;
      const start = cy - ((list.length-1)*step)/2;
      list.forEach((d,i)=>{
        placed.push({ ...d, __x: cx, __y: start + i*step });
      });
    });
  });

  const nodeById = new Map(placed.map(d => [d.id, d]));
  const links = edges.map(e=>({
    ...e,
    source: nodeById.get(e.source),
    target: nodeById.get(e.target)
  })).filter(l=>l.source && l.target);

  gRoot.append("g").selectAll("line")
    .data(links).join("line")
    .attr("x1", d => d.source.__x)
    .attr("y1", d => d.source.__y)
    .attr("x2", d => d.target.__x)
    .attr("y2", d => d.target.__y)
    .attr("stroke", "#9CA3AF")
    .attr("stroke-width", 1.2)
    .attr("opacity", 0.55)
    .style("stroke-dasharray", edgeDash)
    .on("mousemove", (evt, e) => showEdgeTip(evt, e))
    .on("mouseleave", hideTip);

  const gNodes = gRoot.append("g").selectAll("g")
    .data(placed, d=>d.id).join("g")
    .attr("transform", d => `translate(${d.__x},${d.__y})`)
    .on("mousemove", (evt, d) => showNodeTip(evt, d))
    .on("mouseleave", hideTip);

  gNodes.append("circle")
    .attr("r", 6)
    .attr("fill", d => (safe(d.evidence_status).toUpperCase()==="VERIFIED") ? "#2563EB" : nodeFill(d))
    .attr("stroke","rgba(255,255,255,.40)");

  const labels = gNodes.append("text")
    .attr("x", 10).attr("y", 4)
    .text(d => d.label);
  applyReadableText(labels, { size: 11 });

  // Zoom/pan
  const zoom = d3.zoom().scaleExtent([0.7, 2.8]).on("zoom", (event) => {
    gRoot.attr("transform", event.transform);
  });
  svg.call(zoom);
  svg.on("dblclick.zoom", null);
}

// ----- Architecture View -----
// Lane-based "stack" view: layers as horizontal lanes, OEM groups as columns.
// Designed to be readable + zoom/pan friendly, not a force simulation.

function renderArchitecture(nodes, edges, oemCols){
  const w = 1400;
  const h = 820;

  vizEl.selectAll("*").remove();

  const svg = vizEl.append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  svg.style("touch-action", "none");
  svg.append("rect").attr("width", w).attr("height", h).attr("fill","transparent").style("pointer-events","all");

  const gRoot = svg.append("g");

  const margin = { top: 56, right: 30, bottom: 24, left: 160 };

  const layers = LAYERS.slice(); // fixed order
  const y = d3.scaleBand().domain(layers).range([margin.top, h-margin.bottom]).paddingInner(0.08);

  const cols = (oemCols && oemCols.length) ? oemCols : uniq(nodes.map(d => d.oem_group));
  const x = d3.scaleBand().domain(cols).range([margin.left, w-margin.right]).paddingInner(0.2);

  // Lane backgrounds + labels
  const lanes = gRoot.append("g");
  lanes.selectAll("rect").data(layers).join("rect")
    .attr("x", margin.left)
    .attr("y", d => y(d))
    .attr("width", (w-margin.right) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", "rgba(255,255,255,0.03)")
    .attr("stroke", "rgba(255,255,255,0.06)");

  lanes.selectAll("text").data(layers).join("text")
    .attr("x", margin.left - 14)
    .attr("y", d => y(d) + y.bandwidth()/2 + 4)
    .attr("text-anchor","end")
    .text(d => d)
    .call(sel => applyReadableText(sel, { size: 11 }));

  // Column headers
  const headers = gRoot.append("g");
  headers.selectAll("text").data(cols).join("text")
    .attr("x", d => x(d) + x.bandwidth()/2)
    .attr("y", 28)
    .attr("text-anchor","middle")
    .text(d => d)
    .call(sel => applyReadableText(sel, { size: 12 }));

  // Compute node positions (stack within each lane/col)
  const byBucket = d3.group(nodes, d => d.layer, d => d.oem_group);
  const pos = new Map();

  layers.forEach(layer => {
    cols.forEach(col => {
      const list = (byBucket.get(layer)?.get(col)) ? Array.from(byBucket.get(layer).get(col)) : [];
      if (!list.length) return;

      // Sort for stable layout
      list.sort((a,b) => safe(a.label).localeCompare(safe(b.label)));

      const cx = x(col) + x.bandwidth()/2;
      const baseY = y(layer) + y.bandwidth()/2;

      const step = 16; // vertical separation in bucket
      const start = baseY - ((list.length-1) * step)/2;

      list.forEach((d,i) => {
        pos.set(d.id, { x: cx, y: start + i*step });
      });
    });
  });

  // Build link objects with positions
  const links = edges.map(e => ({
    ...e,
    source: pos.get(e.source),
    target: pos.get(e.target)
  })).filter(l => l.source && l.target);

  // Links
  gRoot.append("g").selectAll("line")
    .data(links).join("line")
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y)
    .attr("stroke", "#9CA3AF")
    .attr("stroke-width", 1.4)
    .attr("opacity", 0.7)
    .style("stroke-dasharray", edgeDash)
    .on("mousemove", (evt, e) => showEdgeTip(evt, e))
    .on("mouseleave", hideTip);

  // Nodes
  const nodeDraw = nodes.map(d => ({...d, __p: pos.get(d.id)})).filter(d => d.__p);
  const gNodes = gRoot.append("g").selectAll("g")
    .data(nodeDraw, d => d.id).join("g")
    .attr("transform", d => `translate(${d.__p.x},${d.__p.y})`)
    .on("mousemove", (evt, d) => showNodeTip(evt, d))
    .on("mouseleave", hideTip);

  gNodes.append("circle")
    .attr("r", 6)
    .attr("fill", d => (safe(d.evidence_status).toUpperCase()==="VERIFIED") ? "#2563EB" : nodeFill(d))
    .attr("stroke", "rgba(255,255,255,.40)");

  const labels = gNodes.append("text")
    .attr("x", 10)
    .attr("y", 4)
    .text(d => d.label);

  applyReadableText(labels, { size: 11 });

  // Zoom/pan
  const zoom = d3.zoom().scaleExtent([0.6, 2.4]).on("zoom", (event) => {
    gRoot.attr("transform", event.transform);
  });
  svg.call(zoom);
  svg.on("dblclick.zoom", null);
}

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

  nodeSel.on("mousemove", (evt, d) => showNodeTip(evt, d)).on("mouseleave", hideTip);

  const sim = d3.forceSimulation(nodesLocal)
    .force("link", d3.forceLink(links).id(d=>d.id).distance(120).strength(0.9))
    .force("charge", d3.forceManyBody().strength(-260))
    .force("center", d3.forceCenter(w/2, h/2))
    .force("collide", d3.forceCollide(26));

  sim.on("tick", () => {
    linkSel
      .attr("x1", d=>d.source.x)
      .attr("y1", d=>d.source.y)
      .attr("x2", d=>d.target.x)
      .attr("y2", d=>d.target.y);

    nodeSel.attr("transform", d=>`translate(${d.x},${d.y})`);
  });

  const zoom = d3.zoom().scaleExtent([0.5, 2.8]).on("zoom", (event) => {
    gRoot.attr("transform", event.transform);
  });
  svg.call(zoom);
  svg.on("dblclick.zoom", null);

  function dragstarted(event){
    if (!event.active) sim.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  function dragged(event){
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  function dragended(event){
    if (!event.active) sim.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
}

// ----- Docs View -----

function renderDocs(){
  // Render a simple docs panel inside #viz using HTML (so it remains readable).
  vizEl.selectAll("*").remove();

  const root = vizEl.append("div")
    .attr("class","docs-root")
    .style("width","100%")
    .style("height","100%")
    .style("overflow","auto")
    .style("padding","18px 18px 28px 18px")
    .style("box-sizing","border-box")
    .style("color","#E5E7EB");

  root.append("div")
    .style("font-size","18px")
    .style("font-weight","800")
    .style("color","#F9FAFB")
    .style("margin","6px 0 10px 0")
    .text("About & Documentation");

  const card = (title) => {
    const c = root.append("div")
      .style("background","rgba(255,255,255,0.03)")
      .style("border","1px solid rgba(255,255,255,0.08)")
      .style("border-radius","12px")
      .style("padding","12px 12px 10px 12px")
      .style("box-sizing","border-box")
      .style("margin","0 0 12px 0");
    c.append("div")
      .style("font-size","12px")
      .style("color","#D1D5DB")
      .style("margin-bottom","8px")
      .style("font-weight","700")
      .text(title);
    return c;
  };

  const c1 = card("What this is");
  c1.append("div")
    .style("font-size","13px")
    .style("line-height","1.5")
    .html("An interactive, CSV-driven map of OEM system stacks and ecosystem relationships (suppliers, platforms, governance and telemetry paths). Use <strong>Grid</strong> for scanability, <strong>Architecture</strong> for stack/lane views, <strong>Network</strong> for relationship shape, and <strong>Governance</strong> for verification coverage.");

  const c2 = card("The structural mistake to avoid");
  c2.append("div")
    .style("font-size","13px")
    .style("line-height","1.5")
    .html("Most ecosystem maps mix <em>commercial relationships</em> with <em>data-flow</em> and <em>control boundaries</em>, then treat them as the same thing. In this project: <ul style='margin:8px 0 0 18px;line-height:1.6'><li><strong>relationship</strong> describes what the edge means (SUPPLIES, HOSTS, USES, INGESTS)</li><li><strong>Telemetry Paths Only</strong> limits to true vehicle→cloud telemetry paths</li><li><strong>verification_level / evidence_status</strong> indicate confidence and evidence type</li></ul>");

  const c3 = card("Where the data lives");
  c3.append("div")
    .style("font-size","13px")
    .style("line-height","1.5")
    .html("The visual loads <code>data/nodes.csv</code> and <code>data/edges.csv</code>. Keep column names stable. Normalise and validate before commit (see your governance docs).");

  const c4 = card("Quick links");
  c4.append("div")
    .style("font-size","13px")
    .style("line-height","1.9")
    .html("<a href='./README.md' target='_blank' style='color:#60A5FA;text-decoration:none'>README.md</a><br/><a href='./CHANGELOG.md' target='_blank' style='color:#60A5FA;text-decoration:none'>CHANGELOG.md</a><br/><span style='opacity:.75'>Tip: GitHub Pages may not render Markdown. If links open raw text, view them in the repo UI.</span>");
}

// ----- Governance View -----

function parseLevel(v){
  const s = safe(v);
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function countBy(arr, keyFn){
  const m = new Map();
  arr.forEach(d=>{
    const k = keyFn(d);
    m.set(k, (m.get(k) 0) + 1);
  });
  return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
}

function renderMiniBarChart(container, items, opts = {}){
  const w = opts.w ?? 260;
  const h = opts.h ?? 88;

  const max = d3.max(items, d=>d.value) 1;
  const x = d3.scaleLinear().domain([0,max]).range([0, w-80]);
  const y = d3.scaleBand().domain(items.map(d=>d.label)).range([0,h]).paddingInner(0.2);

  const svg = container.append("svg").attr("width", w).attr("height", h);

  svg.append("g").selectAll("rect")
    .data(items).join("rect")
    .attr("x", 80)
    .attr("y", d=>y(d.label))
    .attr("width", d=>x(d.value))
    .attr("height", y.bandwidth())
    .attr("fill", "rgba(255,255,255,0.10)");

  const t = svg.append("g").selectAll("text")
    .data(items).join("text")
    .attr("x", 76)
    .attr("y", d=>y(d.label)+y.bandwidth()/2+4)
    .attr("text-anchor","end")
    .text(d=>d.label);
  applyReadableText(t, { size: 10 });

  const v = svg.append("g").selectAll("text.value")
    .data(items).join("text")
    .attr("x", d=>80 + x(d.value) + 6)
    .attr("y", d=>y(d.label)+y.bandwidth()/2+4)
    .text(d=>d.value);
  applyReadableText(v, { size: 10, fill: "rgba(229,231,235,0.85)" });
}

function renderGovernance(nodesAll, edgesAll){
  // HTML-first dashboard to avoid SVG/table overlap
  vizEl.selectAll("*").remove();

  const root = vizEl.append("div")
    .attr("class","gov-root")
    .style("width","100%")
    .style("height","100%")
    .style("overflow","auto")
    .style("padding","14px 14px 24px 14px")
    .style("box-sizing","border-box")
    .style("color","#E5E7EB");

  root.append("div")
    .style("display","flex")
    .style("justify-content","space-between")
    .style("align-items","baseline")
    .style("gap","12px")
    .html(`<div style="font-size:18px;font-weight:800;color:#F9FAFB">Governance & Verification</div>
           <div style="font-size:12px;opacity:.75">Counts reflect currently loaded CSVs.</div>`);

  // Summaries
  const edgesLvl = edgesAll.map(e=>({ lvl: parseLevel(e.verification_level) }));
  const lvlCounts = countBy(edgesLvl, d=>`L${d.lvl}`).map(([k,v])=>({label:k, value:v}));

  const oemCounts = countBy(edgesAll, e=>safe(e.region)+" · "+safe(e.layer)).slice(0,10)
    .map(([k,v])=>({label:k.length>28 ? (k.slice(0,26)+"…") : k, value:v}));

  const row = root.append("div")
    .style("display","grid")
    .style("grid-template-columns","1fr 1fr")
    .style("gap","12px")
    .style("margin","12px 0 12px 0");

  const card = (title) => {
    const c = row.append("div")
      .style("background","rgba(255,255,255,0.03)")
      .style("border","1px solid rgba(255,255,255,0.08)")
      .style("border-radius","12px")
      .style("padding","12px")
      .style("box-sizing","border-box");
    c.append("div").style("font-size","12px").style("opacity",".85").style("margin-bottom","8px").text(title);
    return c;
  };

  renderMiniBarChart(card("Edges by verification level").append("div"), lvlCounts.slice(0,6), { w: 360, h: 120 });
  renderMiniBarChart(card("Top 10 region/layer edge density").append("div"), oemCounts, { w: 420, h: 240 });

  // Tables
  const makeTable = (title, cols, rowsData) => {
    const wrap = root.append("div")
      .style("margin","0 0 14px 0")
      .style("background","rgba(255,255,255,0.03)")
      .style("border","1px solid rgba(255,255,255,0.08)")
      .style("border-radius","12px")
      .style("overflow","hidden");

    wrap.append("div")
      .style("padding","10px 12px")
      .style("font-size","12px")
      .style("font-weight","700")
      .style("border-bottom","1px solid rgba(255,255,255,0.08)")
      .text(title);

    const table = wrap.append("table")
      .style("width","100%")
      .style("border-collapse","collapse")
      .style("font-size","12px");

    const thead = table.append("thead").append("tr");
    thead.selectAll("th").data(cols).join("th")
      .style("text-align","left")
      .style("padding","8px 10px")
      .style("opacity",".75")
      .style("font-weight","700")
      .style("border-bottom","1px solid rgba(255,255,255,0.08)")
      .text(d=>d.label);

    const tbody = table.append("tbody");
    const tr = tbody.selectAll("tr").data(rowsData).join("tr")
      .style("border-bottom","1px solid rgba(255,255,255,0.06)");

    tr.selectAll("td")
      .data(row => cols.map(c => row[c.key]))
      .join("td")
      .style("padding","8px 10px")
      .style("vertical-align","top")
      .style("opacity",".95")
      .text(d=>d);

    return wrap;
  };

  const worst = countBy(edgesAll, e => `${safe(e.oem_group"")}${safe(e.oem_group)? " · ":""}${safe(e.layer)}`)
    .slice(0, 25)
    .map(([k,v]) => ({ key: k, edges: v }));

  makeTable("Highest edge counts by (oem_group · layer)", [
    { key: "key", label: "oem_group · layer" },
    { key: "edges", label: "edge count" }
  ], worst);

  const missingEvidence = edgesAll
    .filter(e => parseLevel(e.verification_level) >= 3)
    .filter(e => !safe(e.source_name) !safe(e.source_url) !safe(e.evidence_note))
    .slice(0, 200)
    .map(e => ({
      source: safe(e.source),
      target: safe(e.target),
      layer: safe(e.layer),
      lvl: `L${parseLevel(e.verification_level)}`,
      missing: [
        !safe(e.source_name) ? "source_name" : "",
        !safe(e.source_url) ? "source_url" : "",
        !safe(e.evidence_note) ? "evidence_note" : ""
      ].filter(Boolean).join(", ")
    }));

  makeTable("Edges (L3/L4) missing required evidence fields (first 200)", [
    { key: "source", label: "source" },
    { key: "target", label: "target" },
    { key: "layer", label: "layer" },
    { key: "lvl", label: "level" },
    { key: "missing", label: "missing fields" }
  ], missingEvidence);

  root.append("div")
    .style("font-size","11px")
    .style("opacity",".65")
    .style("margin-top","10px")
    .html("Tip: Use filters in the header first, then return to Governance to see scoped audit results.");
}

function normaliseRows(nodes, edges){
  const nodesOut = nodes.map(n => {
    const out = { ...n };
    if (hasCol(out,"confidence")) {
      const c = clampEnum(out.confidence, CONFIDENCE_ENUM);
      out.confidence = c out.confidence "";
    }
    return out;
  });

  const edgesOut = edges.map(e => ({
    ...e,
    verification_level: e.verification_level ?? "",
    verification_status: e.verification_status ?? "",
    verification_owner: e.verification_owner ?? "",
    last_reviewed: e.last_reviewed ?? ""
  }));

  // Tabs
  const tabGrid = document.querySelector("#tab-grid");
  const tabNet = document.querySelector("#tab-network");
  const tabArch = document.querySelector("#tab-architecture");
  const tabGov = document.querySelector("#tab-governance");
  const tabDocs = document.querySelector("#tab-docs");

  function setView(v){
    state.view = v;
    if (tabGrid) tabGrid.classList.toggle("active", v==="grid");
    if (tabNet) tabNet.classList.toggle("active", v==="network");
    if (tabArch) tabArch.classList.toggle("active", v==="architecture");
    if (tabGov) tabGov.classList.toggle("active", v==="governance");
    if (tabDocs) tabDocs.classList.toggle("active", v==="docs");
    render();
  }
  if (tabGrid) tabGrid.addEventListener("click", ()=>setView("grid"));
  if (tabNet) tabNet.addEventListener("click", ()=>setView("network"));
  if (tabArch) tabArch.addEventListener("click", ()=>setView("architecture"));
  if (tabGov) tabGov.addEventListener("click", ()=>setView("governance"));
  if (tabDocs) tabDocs.addEventListener("click", ()=>setView("docs"));

  // Wire filter controls
  if (selRegion) selRegion.addEventListener("change", () => { state.region = selRegion.value; render(); });
  if (selOEM) selOEM.addEventListener("change", () => { state.oem = selOEM.value; render(); });
  if (selLayer) selLayer.addEventListener("change", () => { state.layer = selLayer.value; render(); });
  if (selType) selType.addEventListener("change", () => { state.type = selType.value; render(); });
  if (selConfidence) selConfidence.addEventListener("change", () => { state.confidence = selConfidence.value; render(); });
  if (inpSearch) inpSearch.addEventListener("input", () => { state.search = inpSearch.value; render(); });
  if (chkTelemetry) chkTelemetry.addEventListener("change", () => { state.telemetryOnly = chkTelemetry.checked; render(); });
  if (chkEvidence) chkEvidence.addEventListener("change", () => { state.evidenceOnly = chkEvidence.checked; render(); });

  // Reset
  if (btnReset) btnReset.addEventListener("click", () => {
    resetUI();
    // Rebuild dropdown option disabling based on full dataset
    if (state.view !== "governance" && state.view !== "docs") rebuildDependentDropdowns(_nodesAll);
    render();
  });

  return { nodesOut, edgesOut };
}

function init(){
  Promise.all([
    d3.csv("data/nodes.csv", d3.autoType),
    d3.csv("data/edges.csv", d3.autoType)
  ]).then(([nodesRaw, edgesRaw]) => {
    // Ensure expected columns exist; do not invent
    _nodesAll = nodesRaw.map(n => ({
      id: safe(n.id),
      label: safe(n.label),
      type: safe(n.type),
      layer: safe(n.layer),
      region: safe(n.region),
      oem_group: safe(n.oem_group),
      description: safe(n.description),
      confidence: hasCol(n,"confidence") ? clampEnum(n.confidence, CONFIDENCE_ENUM) safe(n.confidence) : safe(n.confidence),
      evidence_status: safe(n.evidence_status),
      control_boundary: safe(n.control_boundary),
      provenance_id: safe(n.provenance_id)
    }));

    _edgesAll = edgesRaw.map(e => ({
      source: safe(e.source),
      target: safe(e.target),
      relationship: safe(e.relationship),
      layer: safe(e.layer),
      region: safe(e.region),
      evidence_status: safe(e.evidence_status),
      verification_level: safe(e.verification_level),
      source_name: safe(e.source_name),
      source_url: safe(e.source_url),
      source_date: safe(e.source_date),
      evidence_note: safe(e.evidence_note),
      provenance_id: safe(e.provenance_id),
      verified_edge: safe(e.verified_edge),
      verification_status: safe(e.verification_status),
      verification_owner: safe(e.verification_owner),
      last_reviewed: safe(e.last_reviewed),
      oem_group: safe(e.oem_group)
    }));

    _oems = uniq(_nodesAll.map(d => d.oem_group).filter(Boolean));
    _regions = uniq(_nodesAll.map(d => d.region).filter(Boolean));
    _types = uniq(_nodesAll.map(d => d.type).filter(Boolean));
    _layers = uniq(_nodesAll.map(d => d.layer).filter(Boolean));

    populateSelect(selRegion, _regions);
    populateSelect(selOEM, _oems);
    populateSelect(selLayer, uniq(LAYERS));
    populateSelect(selType, _types);

    if (selConfidence && _nodesAll.some(n => safe(n.confidence))) {
      populateSelect(selConfidence, uniq(_nodesAll.map(d => d.confidence).filter(Boolean)));
    }

    const { nodesOut, edgesOut } = normaliseRows(_nodesAll, _edgesAll);
    _nodesAll = nodesOut;
    _edgesAll = edgesOut;

    // Initial dependent dropdown disabling based on full dataset
    if (state.view !== "governance" && state.view !== "docs") rebuildDependentDropdowns(_nodesAll);

    render();
  }).catch(err => {
    console.error(err);
    vizEl.append("div")
      .style("padding","18px")
      .style("color","#FCA5A5")
      .style("font-weight","700")
      .text("Failed to load data/nodes.csv or data/edges.csv — check file paths and CSV headers.");
  });
}

init();
