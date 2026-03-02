// Global OEM System Stack — D3 (Grid + Network)
// Phase 5 — Evidence Mode Enabled

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
  telemetryOnly: false,
  evidenceOnly: false
};

function safe(v){ return (v ?? "").toString().trim(); }
function norm(s){ return safe(s).toLowerCase(); }

function matchesNodeFilters(n) {
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
    .filter(e => !state.telemetryOnly || TELEMETRY_RELATIONS.has(e.relation))
    .filter(e => !state.evidenceOnly || e.evidence_status === "VERIFIED");
}

function filterNodesByEvidence(nodes, edges) {
  if (!state.evidenceOnly) return nodes;

  const connected = new Set();
  edges.forEach(e => {
    connected.add(e.source);
    connected.add(e.target);
  });

  return nodes.filter(n => connected.has(n.id));
}

function showTip(evt, d) {
  tooltip.style("display","block")
    .style("left", (evt.pageX + 12) + "px")
    .style("top", (evt.pageY + 12) + "px")
    .html(`
      <div><strong>${safe(d.label)}</strong></div>
      <div>${safe(d.region)} • ${safe(d.layer)}</div>
      <div>${safe(d.node_type)} • ${safe(d.control_boundary)}</div>
      <div style="margin-top:6px;">Confidence: ${safe(d.confidence)}</div>
      <div>Evidence: ${safe(d.evidence_status)}</div>
      ${d.source_name ? `<div style="margin-top:6px;">Source: ${safe(d.source_name)}</div>` : ""}
      ${d.source_url ? `<div style="font-size:11px;opacity:.7">${safe(d.source_url)}</div>` : ""}
    `);
}

function hideTip(){ tooltip.style("display","none"); }

Promise.all([
  d3.csv("data/nodes.csv", d3.autoType),
  d3.csv("data/edges.csv", d3.autoType)
]).then(([nodesRaw, edgesRaw]) => {

  const nodesAll = nodesRaw.map(d => ({
    ...d,
    layerIndex: LAYERS.indexOf(d.layer)
  })).filter(d => d.layerIndex >= 0);

  const edgesAll = edgesRaw;

  d3.select("#telemetryOnly").on("change", function(){
    state.telemetryOnly = this.checked;
    render(nodesAll, edgesAll);
  });

  d3.select("#evidenceOnly").on("change", function(){
    state.evidenceOnly = this.checked;
    render(nodesAll, edgesAll);
  });

  render(nodesAll, edgesAll);
});

function render(nodesAll, edgesAll) {

  vizEl.selectAll("*").remove();

  let nodes = nodesAll.filter(matchesNodeFilters);
  const nodeById = new Map(nodes.map(d => [d.id, d]));

  let edges = filterEdges(edgesAll, nodeById);
  nodes = filterNodesByEvidence(nodes, edges);

  if (state.view === "network") renderNetwork(nodes, edges);
  else renderGrid(nodes, edges);
}

// GRID VIEW (unchanged except evidence-aware tooltips)

function renderGrid(nodes, edges){

  const width = 1800;
  const height = 1200;

  const svg = vizEl.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const cols = [...new Set(nodes.map(d=>d.oem_group))];

  const cellW = 240;
  const cellH = 70;
  const left = 240;

  const pos = new Map();

  nodes.forEach(n=>{
    const r = LAYERS.indexOf(n.layer);
    const c = cols.indexOf(n.oem_group);
    if (r < 0 || c < 0) return;

    const x = left + c * cellW + 10;
    const y = 40 + r * cellH + 10;

    pos.set(n.id, {x,y});
  });

  // Edges
  svg.selectAll("path")
    .data(edges)
    .enter()
    .append("path")
    .attr("fill","none")
    .attr("stroke","#9CA3AF")
    .attr("stroke-dasharray", e => e.evidence_status === "VERIFIED" ? "0" : "5 4")
    .attr("d", e=>{
      const a = pos.get(e.source);
      const b = pos.get(e.target);
      if (!a || !b) return "";
      return `M${a.x},${a.y} L${b.x},${b.y}`;
    });

  // Nodes
  svg.selectAll("rect")
    .data(nodes)
    .enter()
    .append("rect")
    .attr("x", d=>pos.get(d.id)?.x ?? 0)
    .attr("y", d=>pos.get(d.id)?.y ?? 0)
    .attr("width", 180)
    .attr("height", 24)
    .attr("fill", d => d.evidence_status === "VERIFIED" ? "#2563EB" : "#6C8CFF")
    .attr("rx", 4)
    .on("mousemove", showTip)
    .on("mouseleave", hideTip);

  svg.selectAll("text")
    .data(nodes)
    .enter()
    .append("text")
    .attr("x", d=>pos.get(d.id)?.x + 8 ?? 0)
    .attr("y", d=>pos.get(d.id)?.y + 16 ?? 0)
    .attr("fill","#F9FAFB")
    .attr("font-size",12)
    .text(d=>d.label);
}

// NETWORK (kept simple)

function renderNetwork(nodes, edges){

  const width = 1400;
  const height = 800;

  const svg = vizEl.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d=>d.id).distance(80))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width/2, height/2));

  const link = svg.append("g")
    .selectAll("line")
    .data(edges)
    .enter().append("line")
    .attr("stroke","#9CA3AF")
    .attr("stroke-dasharray", e => e.evidence_status === "VERIFIED" ? "0" : "5 4");

  const node = svg.append("g")
    .selectAll("circle")
    .data(nodes)
    .enter().append("circle")
    .attr("r", 6)
    .attr("fill", d => d.evidence_status === "VERIFIED" ? "#2563EB" : "#6C8CFF")
    .on("mousemove", showTip)
    .on("mouseleave", hideTip)
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended)
    );

  simulation.on("tick", ()=>{
    link
      .attr("x1", d=>d.source.x)
      .attr("y1", d=>d.source.y)
      .attr("x2", d=>d.target.x)
      .attr("y2", d=>d.target.y);

    node
      .attr("cx", d=>d.x)
      .attr("cy", d=>d.y);
  });

  function dragstarted(event,d){
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx=d.x; d.fy=d.y;
  }
  function dragged(event,d){ d.fx=event.x; d.fy=event.y; }
  function dragended(event,d){
    if (!event.active) simulation.alphaTarget(0);
    d.fx=null; d.fy=null;
  }
}
