// Global OEM System Stack — D3 (Grid + Network) — CSV driven
// Evidence-aware tooltips for nodes + edges

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
  "HOSTS TELEMETRY","DATA LOCALIZATION REQUIRED","MANDATORY REPORTING"
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
  telemetryOnly: false
};

function uniq(arr) { return Array.from(new Set(arr)).sort((a,b)=>a.localeCompare(b)); }
function norm(s){ return (s ?? "").toString().trim().toLowerCase(); }

function initSelect(selector, values, onChange) {
  const sel = d3.select(selector);
  sel.selectAll("option").remove();
  sel.append("option").attr("value","all").text("All");
  values.forEach(v => sel.append("option").attr("value", v).text(v));
  sel.on("change", function(){ onChange(this.value); });
}

function matchesFilters(n) {
  if (state.region !== "all" && n.region !== state.region) return false;
  if (state.oem !== "all" && n.oem_group !== state.oem) return false;
  if (state.layer !== "all" && n.layer !== state.layer) return false;
  if (state.type !== "all" && n.node_type !== state.type) return false;
  if (state.confidence !== "all" && n.confidence !== state.confidence) return false;
  if (state.search) {
    const q = norm(state.search);
    const hay = norm(`${n.label} ${n.id} ${n.notes ?? ""}`);
    if (!hay.includes(q)) return false;
  }
  return true;
}

function filterEdges(edges, nodeById) {
  return edges
    .filter(e => nodeById.has(e.source) && nodeById.has(e.target))
    .filter(e => !state.telemetryOnly || TELEMETRY_RELATIONS.has((e.relation||"").trim()));
}

function nodeFill(d){
  if (d.control_boundary === "regulatory") return "#F4A261";
  if (d.control_boundary === "external") return "#6C8CFF";
  return "#3B82F6";
}
function edgeDash(e){ return (e.confidence === "hard") ? "0" : "5 4"; }

function applyReadableText(textSel, opts = {}) {
  const size = opts.size ?? 12;
  const fill = opts.fill ?? "#F9FAFB";
  const stroke = opts.stroke ?? "rgba(0,0,0,0.85)";
  const strokeWidth = opts.strokeWidth ?? 3;

  textSel
    .attr("font-size", size)
    .attr("opacity", 1)
    .attr("fill", fill)
    .attr("stroke", stroke)
    .attr("stroke-width", strokeWidth)
    .attr("paint-order", "stroke");
}

function safe(v){ return (v ?? "").toString().trim(); }

function evidenceBlock(d){
  const src = safe(d.source_name);
  const date = safe(d.source_date);
  const note = safe(d.evidence_note);
  const url = safe(d.source_url);

  if (!src && !date && !note && !url) return "";

  const rows = [];
  if (src) rows.push(`<div><strong>Source:</strong> ${src}</div>`);
  if (date) rows.push(`<div><strong>Date:</strong> ${date}</div>`);
  if (note) rows.push(`<div style="opacity:.9"><strong>Evidence:</strong> ${note}</div>`);
  if (url) rows.push(`<div style="opacity:.8"><strong>URL:</strong> ${url}</div>`);
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
      ${safe(d.notes) ? `<div style="margin-top:6px;opacity:.8">${safe(d.notes)}</div>` : ""}
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
      ${safe(e.notes) ? `<div style="margin-top:6px;opacity:.8">${safe(e.notes)}</div>` : ""}
      ${evidenceBlock(e)}
    `);
}

function hideTip(){ tooltip.style("display","none"); }

// ----- LOAD DATA -----

Promise.all([
  d3.csv("data/nodes.csv", d3.autoType),
  d3.csv("data/edges.csv", d3.autoType)
]).then(([nodesRaw, edgesRaw]) => {

  const nodesAll = nodesRaw.map(d => ({
    ...d,
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
  }))
  .map(d => ({...d, layerIndex: LAYERS.indexOf(d.layer)}))
  .filter(d => d.layerIndex >= 0);

  const edgesAll = edgesRaw.map(e => ({
    ...e,
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
  }));

  // Controls
  initSelect("#region", uniq(nodesAll.map(d => d.region)), v => { state.region=v; render(nodesAll, edgesAll); });
  initSelect("#oem", uniq(nodesAll.map(d => d.oem_group)), v => { state.oem=v; render(nodesAll, edgesAll); });
  initSelect("#layer", LAYERS, v => { state.layer=v; render(nodesAll, edgesAll); });
  initSelect("#type", uniq(nodesAll.map(d => d.node_type)), v => { state.type=v; render(nodesAll, edgesAll); });
  initSelect("#confidence", uniq(nodesAll.map(d => d.confidence)), v => { state.confidence=v; render(nodesAll, edgesAll); });

  d3.select("#search").on("input", function(){ state.search=this.value; render(nodesAll, edgesAll); });
  d3.select("#telemetryOnly").on("change", function(){ state.telemetryOnly=this.checked; render(nodesAll, edgesAll); });

  d3.select("#reset").on("click", () => {
    Object.assign(state, { region:"all", oem:"all", layer:"all", type:"all", confidence:"all", search:"", telemetryOnly:false });
    d3.select("#region").property("value","all");
    d3.select("#oem").property("value","all");
    d3.select("#layer").property("value","all");
    d3.select("#type").property("value","all");
    d3.select("#confidence").property("value","all");
    d3.select("#search").property("value","");
    d3.select("#telemetryOnly").property("checked", false);
    render(nodesAll, edgesAll);
  });

  // Tabs
  function setView(v){
    state.view = v;
    d3.select("#tab-grid").classed("active", v==="grid");
    d3.select("#tab-network").classed("active", v==="network");
    render(nodesAll, edgesAll);
  }
  d3.select("#tab-grid").on("click", ()=>setView("grid"));
  d3.select("#tab-network").on("click", ()=>setView("network"));

  render(nodesAll, edgesAll);
});

function render(nodesAll, edgesAll) {
  vizEl.selectAll("*").remove();

  const nodes = nodesAll.filter(matchesFilters);
  const cols = uniq(nodes.map(d => d.oem_group));

  const nodeById = new Map(nodes.map(d => [d.id, d]));
  const edges = filterEdges(edgesAll, nodeById);

  if (state.view === "network") renderNetwork(nodes, edges);
  else renderGrid(nodes, edges, cols);
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

  // hit area behind content
  svg.append("rect")
    .attr("width", w)
    .attr("height", h)
    .attr("fill", "transparent")
    .style("pointer-events", "all");

  const gRoot = svg.append("g");

  // Column headers
  const headerSel = gRoot.append("g").selectAll("text")
    .data(cols).join("text")
    .attr("x", (d,i)=> margin.left + i*cellW + 8)
    .attr("y", 20)
    .text(d=>d);
  applyReadableText(headerSel, { size: 13 });

  // Row labels
  const rowSel = gRoot.append("g").selectAll("text")
    .data(LAYERS).join("text")
    .attr("x", 12)
    .attr("y", (d,i)=> margin.top + i*cellH + 48)
    .text(d=>d);
  applyReadableText(rowSel, { size: 12, fill: "#D1D5DB", stroke: "rgba(0,0,0,0.9)" });

  // Grid
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

  // Cell stacking positions
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

  // Edges
  const edgeSel = gRoot.append("g").selectAll("path")
    .data(edges).join("path")
    .attr("class","edge")
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

  // Nodes
  const visibleNodes = nodes.filter(n=>pos.has(n.id));
  const nodeSel = gRoot.append("g").selectAll("g.node")
    .data(visibleNodes, d=>d.id)
    .join(enter=>{
      const g = enter.append("g").attr("class","node");
      g.append("rect").attr("class","node-rect");
      g.append("text").attr("class","node-label");
      return g;
    })
    .attr("transform", d=>{
      const p = pos.get(d.id);
      return `translate(${p.x},${p.y})`;
    });

  nodeSel.select("rect")
    .attr("width", d=>pos.get(d.id).w)
    .attr("height", d=>pos.get(d.id).h)
    .attr("fill", nodeFill)
    .attr("stroke","rgba(255,255,255,.40)")
    .attr("rx", 6);

  const nodeText = nodeSel.select("text")
    .attr("x", 10).attr("y", 16)
    .text(d=>d.label);
  applyReadableText(nodeText, { size: 12 });

  // Hover highlight
  const edgesByNode = new Map();
  edges.forEach(e=>{
    if (!edgesByNode.has(e.source)) edgesByNode.set(e.source, []);
    if (!edgesByNode.has(e.target)) edgesByNode.set(e.target, []);
    edgesByNode.get(e.source).push(e);
    edgesByNode.get(e.target).push(e);
  });

  nodeSel
    .on("mousemove", showTip)
    .on("mouseleave", hideTip)
    .on("mouseenter", (evt,d)=>{
      const related = new Set([d.id]);
      (edgesByNode.get(d.id)||[]).forEach(e=>{ related.add(e.source); related.add(e.target); });

      nodeSel.classed("dim", n=>!related.has(n.id));
      edgeSel.classed("dim", e=>!(related.has(e.source)&&related.has(e.target)))
             .classed("highlight", e=>related.has(e.source)&&related.has(e.target));
    })
    .on("mouseleave.highlight", ()=>{
      nodeSel.classed("dim", false);
      edgeSel.classed("dim", false).classed("highlight", false);
    });

  // +N markers
  for (const [layer, byCol] of grouped){
    const r = LAYERS.indexOf(layer);
    for (const [col, list] of byCol){
      if (list.length<=3) continue;
      const c = cols.indexOf(col);
      const x = margin.left + c*cellW + 14;
      const y = margin.top + r*cellH + 10 + 3*(24+6) + 10;

      const moreText = gRoot.append("text")
        .attr("x", x).attr("y", y)
        .text(`+${list.length-3} more`);
      applyReadableText(moreText, { size: 11, fill: "#D1D5DB", stroke: "rgba(0,0,0,0.9)" });
    }
  }

  // Zoom/pan
  const zoom = d3.zoom()
    .scaleExtent([0.6, 3.5])
    .on("zoom", (event) => gRoot.attr("transform", event.transform));
  svg.call(zoom);
}

// ----- NETWORK VIEW -----

function renderNetwork(nodes, edges){
  const w = 1400;
  const h = 820;

  const svg = vizEl.append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  svg.style("touch-action", "none");

  svg.append("rect")
    .attr("width", w)
    .attr("height", h)
    .attr("fill", "transparent")
    .style("pointer-events", "all");

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

  const linkSel = gRoot.append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", "#9CA3AF")
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.85)
    .style("stroke-dasharray", edgeDash)
    .attr("class","edge")
    .on("mousemove", (evt, e) => showEdgeTip(evt, e))
    .on("mouseleave", hideTip);

  const nodeSel = gRoot.append("g")
    .selectAll("g")
    .data(nodesLocal, d=>d.id)
    .join("g")
    .attr("class","node")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended)
    );

  nodeSel.append("circle")
    .attr("r", 7)
    .attr("fill", nodeFill)
    .attr("stroke","rgba(255,255,255,.40)");

  const labelSel = nodeSel.append("text")
    .attr("x", 12)
    .attr("y", 4)
    .text(d=>d.label);
  applyReadableText(labelSel, { size: 12 });

  nodeSel.on("mousemove", showTip).on("mouseleave", hideTip);

  const regionText = gRoot.append("g")
    .selectAll("text")
    .data(regions)
    .join("text")
    .attr("x", d=>xScale(d))
    .attr("y", 24)
    .attr("text-anchor","middle")
    .text(d=>d.toUpperCase());
  applyReadableText(regionText, { size: 12, fill: "#D1D5DB", stroke: "rgba(0,0,0,0.9)" });

  const sim = d3.forceSimulation(nodesLocal)
    .force("link", d3.forceLink(links).distance(90).strength(0.25))
    .force("charge", d3.forceManyBody().strength(-220))
    .force("collide", d3.forceCollide().radius(18))
    .force("x", d3.forceX(d=>xScale(d.region)).strength(0.25))
    .force("y", d3.forceY(h/2).strength(0.08));

  sim.on("tick", () => {
    linkSel
      .attr("x1", d=>d.source.x)
      .attr("y1", d=>d.source.y)
      .attr("x2", d=>d.target.x)
      .attr("y2", d=>d.target.y);

    nodeSel.attr("transform", d=>`translate(${d.x},${d.y})`);
  });

  function dragstarted(event, d) {
    if (!event.active) sim.alphaTarget(0.25).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
  function dragended(event, d) {
    if (!event.active) sim.alphaTarget(0);
    d.fx = null; d.fy = null;
  }

  const zoom = d3.zoom()
    .scaleExtent([0.6, 3.5])
    .on("zoom", (event) => gRoot.attr("transform", event.transform));
  svg.call(zoom);
}
