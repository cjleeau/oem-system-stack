// Global OEM System Stack — D3 (Grid + Network) — CSV driven
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

function initSelect(selector, values, onChange) {
  const sel = d3.select(selector);
  sel.selectAll("option").remove();
  sel.append("option").attr("value","all").text("All");
  values.forEach(v => sel.append("option").attr("value", v).text(v));
  sel.on("change", function(){ onChange(this.value); });
}

function norm(s){ return (s ?? "").toString().trim().toLowerCase(); }

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
  return edges.filter(e => nodeById.has(e.source) && nodeById.has(e.target))
              .filter(e => !state.telemetryOnly || TELEMETRY_RELATIONS.has((e.relation||"").trim()));
}

function showTip(evt, d) {
  tooltip.style("display","block")
    .style("left", (evt.pageX + 12) + "px")
    .style("top", (evt.pageY + 12) + "px")
    .html(`
      <div><strong>${d.label}</strong></div>
      <div style="opacity:.8">${d.region} • ${d.layer}</div>
      <div style="opacity:.8">${d.node_type} • ${d.control_boundary} • ${d.confidence}</div>
      ${d.notes ? `<div style="margin-top:6px;opacity:.75">${d.notes}</div>` : ""}
    `);
}
function hideTip(){ tooltip.style("display","none"); }

Promise.all([
  d3.csv("data/nodes.csv", d3.autoType),
  d3.csv("data/edges.csv", d3.autoType)
]).then(([nodesRaw, edgesRaw]) => {
  // Normalize
  const nodesAll = nodesRaw.map(d => ({
    ...d,
    region: (d.region ?? "").toString().trim(),
    layer: (d.layer ?? "").toString().trim(),
    oem_group: (d.oem_group ?? "").toString().trim(),
    node_type: (d.node_type ?? "").toString().trim(),
    control_boundary: (d.control_boundary ?? "").toString().trim(),
    confidence: (d.confidence ?? "").toString().trim(),
    notes: d.notes ?? ""
  })).map(d => ({...d, layerIndex: LAYERS.indexOf(d.layer)}))
    .filter(d => d.layerIndex >= 0);

  const edgesAll = edgesRaw.map(e => ({
    ...e,
    source: (e.source ?? "").toString().trim(),
    target: (e.target ?? "").toString().trim(),
    relation: (e.relation ?? "").toString().trim(),
    confidence: (e.confidence ?? "").toString().trim(),
    region: (e.region ?? "").toString().trim(),
    notes: e.notes ?? ""
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

  if (state.view === "network") {
    renderNetwork(nodes, edges);
  } else {
    renderGrid(nodes, edges, cols);
  }
}

function nodeFill(d){
  if (d.control_boundary === "regulatory") return "rgba(255,170,80,.35)";
  if (d.control_boundary === "external") return "rgba(140,160,255,.18)";
  return "rgba(80,140,255,.30)";
}

function edgeDash(e){
  return (e.confidence === "hard") ? "0" : "5 4";
}

// GRID VIEW
function renderGrid(nodes, edges, cols){
  const margin = {top: 30, right: 20, bottom: 20, left: 220};
  const cellW = 240;
  const cellH = 78;

  const width = margin.left + margin.right + cols.length * cellW;
  const height = margin.top + margin.bottom + LAYERS.length * cellH;

  const svg = vizEl.append("svg").attr("viewBox", `0 0 ${width} ${height}`);

  // Column headers
  svg.append("g").selectAll("text")
    .data(cols).join("text")
    .attr("x", (d,i)=> margin.left + i*cellW + 8)
    .attr("y", 20).attr("class","cell-label")
    .text(d=>d);

  // Row labels
  svg.append("g").selectAll("text")
    .data(LAYERS).join("text")
    .attr("x", 12)
    .attr("y", (d,i)=> margin.top + i*cellH + 48)
    .attr("class","cell-label")
    .text(d=>d);

  // Grid
  const grid = svg.append("g").attr("opacity", 0.25);
  for (let r=0; r<LAYERS.length; r++){
    for (let c=0; c<cols.length; c++){
      grid.append("rect")
        .attr("x", margin.left + c*cellW)
        .attr("y", margin.top + r*cellH)
        .attr("width", cellW)
        .attr("height", cellH)
        .attr("fill","none")
        .attr("stroke","rgba(255,255,255,.08)");
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
      const boxH = 18;

      list.slice(0,3).forEach((n,i)=>{
        pos.set(n.id, {x:x0, y:y0 + i*(boxH+6), w:cellW-20, h:boxH});
      });
    }
  }

  // Edge layer
  const edgeSel = svg.append("g").selectAll("path")
    .data(edges).join("path")
    .attr("class","edge")
    .attr("fill","none")
    .attr("stroke","rgba(200,200,200,.8)")
    .attr("stroke-width", 1)
    .style("stroke-dasharray", edgeDash)
    .attr("d", e=>{
      const a = pos.get(e.source), b = pos.get(e.target);
      if (!a || !b) return "";
      const x1 = a.x + a.w, y1 = a.y + a.h/2;
      const x2 = b.x, y2 = b.y + b.h/2;
      const mx = (x1+x2)/2;
      return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    });

  // Node layer
  const visibleNodes = nodes.filter(n=>pos.has(n.id));
  const nodeSel = svg.append("g").selectAll("g.node")
    .data(visibleNodes, d=>d.id)
    .join(enter=>{
      const g = enter.append("g").attr("class","node");
      g.append("rect").attr("class","node-rect");
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
    .attr("fill", nodeFill)
    .attr("stroke","rgba(255,255,255,.14)");

  nodeSel.select("text")
    .attr("x", 10).attr("y", 13)
    .attr("font-size", 10).attr("opacity", .92)
    .text(d=>d.label);

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
      const y = margin.top + r*cellH + 10 + 3*(18+6) + 10;
      svg.append("text")
        .attr("x", x).attr("y", y)
        .attr("font-size", 10).attr("opacity", .6)
        .text(`+${list.length-3} more`);
    }
  }

  // Small legend
  svg.append("text")
    .attr("x", width-260)
    .attr("y", height-12)
    .attr("class","legend")
    .text("Tip: hover a node to highlight relationships. Use filters + telemetry toggle.");
}

// NETWORK VIEW
function renderNetwork(nodes, edges){
  const width = 1400;
  const height = 820;

  const svg = vizEl.append("svg").attr("viewBox", `0 0 ${width} ${height}`);

  // Shallow clustering by region (x bands)
  const regions = uniq(nodes.map(d=>d.region));
  const xScale = d3.scalePoint().domain(regions).range([120, width-120]);

  nodes = nodes.map(d => ({
    ...d,
    x: xScale(d.region) + (Math.random()-0.5)*40,
    y: height/2 + (Math.random()-0.5)*40
  }));

  const nodeById = new Map(nodes.map(d=>[d.id,d]));
  const links = edges.map(e=>({
    ...e,
    source: nodeById.get(e.source),
    target: nodeById.get(e.target)
  })).filter(l=>l.source && l.target);

  const linkSel = svg.append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", "rgba(200,200,200,.7)")
    .attr("stroke-width", 1)
    .style("stroke-dasharray", edgeDash)
    .attr("class","edge");

  const nodeSel = svg.append("g")
    .selectAll("g")
    .data(nodes, d=>d.id)
    .join("g")
    .attr("class","node")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended)
    );

  nodeSel.append("circle")
    .attr("r", 6)
    .attr("fill", nodeFill)
    .attr("stroke","rgba(255,255,255,.18)");

  nodeSel.append("text")
    .attr("x", 10)
    .attr("y", 4)
    .attr("font-size", 10)
    .attr("opacity", 0.8)
    .text(d=>d.label);

  nodeSel
    .on("mousemove", showTip)
    .on("mouseleave", hideTip);

  // Region labels
  svg.append("g")
    .selectAll("text")
    .data(regions)
    .join("text")
    .attr("x", d=>xScale(d))
    .attr("y", 24)
    .attr("text-anchor","middle")
    .attr("font-size", 11)
    .attr("opacity", 0.7)
    .text(d=>d.toUpperCase());

  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).distance(80).strength(0.25))
    .force("charge", d3.forceManyBody().strength(-180))
    .force("collide", d3.forceCollide().radius(16))
    .force("x", d3.forceX(d=>xScale(d.region)).strength(0.25))
    .force("y", d3.forceY(height/2).strength(0.08));

  sim.on("tick", () => {
    linkSel
      .attr("x1", d=>d.source.x)
      .attr("y1", d=>d.source.y)
      .attr("x2", d=>d.target.x)
      .attr("y2", d=>d.target.y);

    nodeSel.attr("transform", d=>`translate(${d.x},${d.y})`);
  });

  // Hover highlight (network)
  const linked = new Map();
  links.forEach(l=>{
    const a = l.source.id, b = l.target.id;
    if (!linked.has(a)) linked.set(a, new Set());
    if (!linked.has(b)) linked.set(b, new Set());
    linked.get(a).add(b); linked.get(b).add(a);
  });

  nodeSel.on("mouseenter", (evt,d)=>{
    const nbrs = linked.get(d.id) || new Set();
    nodeSel.classed("dim", n => n.id!==d.id && !nbrs.has(n.id));
    linkSel.classed("dim", l => !(l.source.id===d.id || l.target.id===d.id))
           .classed("highlight", l => (l.source.id===d.id || l.target.id===d.id));
  }).on("mouseleave.highlight", ()=>{
    nodeSel.classed("dim", false);
    linkSel.classed("dim", false).classed("highlight", false);
  });

  function dragstarted(event, d) {
    if (!event.active) sim.alphaTarget(0.25).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x; d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) sim.alphaTarget(0);
    d.fx = null; d.fy = null;
  }

  svg.append("text")
    .attr("x", width-520)
    .attr("y", height-12)
    .attr("class","legend")
    .text("Tip: drag nodes. Filters + telemetry toggle also apply in Network view.");
}
