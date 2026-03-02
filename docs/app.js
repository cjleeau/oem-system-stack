const width = 1400;
const height = 900;

const vizEl = d3.select("#viz");
let allNodes = [];
let allEdges = [];

Promise.all([
  d3.csv("data/nodes.csv"),
  d3.csv("data/edges.csv")
]).then(([nodes, edges]) => {
  allNodes = nodes;
  allEdges = edges;
  render();
});

function render() {
  const view = document.querySelector(".view-toggle .active")?.dataset.view || "grid";
  vizEl.selectAll("*").remove();
  if (view === "network") renderNetwork();
  else renderGrid();
}

/* -------------------------
   NODE COLOR
-------------------------- */

function nodeFill(d){
  if (d.control_boundary === "regulatory") return "#F4A261";
  if (d.control_boundary === "external") return "#6C8CFF";
  return "#3B82F6";
}

/* -------------------------
   GRID VIEW
-------------------------- */

function renderGrid(){

  const svg = vizEl.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const gRoot = svg.append("g");

  const regions = [...new Set(allNodes.map(d => d.region))];
  const oemGroups = [...new Set(allNodes.map(d => d.oem_group))];
  const layers = [...new Set(allNodes.map(d => d.layer))];

  const colWidth = 240;
  const rowHeight = 70;

  const colX = {};
  oemGroups.forEach((g,i)=> colX[g] = 200 + i * colWidth);

  const rowY = {};
  layers.forEach((l,i)=> rowY[l] = 120 + i * rowHeight);

  // Layer labels
  layers.forEach(l=>{
    gRoot.append("text")
      .attr("x", 20)
      .attr("y", rowY[l] + 30)
      .attr("fill", "#9CA3AF")
      .attr("font-size", 12)
      .text(l);
  });

  // OEM headers
  oemGroups.forEach(g=>{
    gRoot.append("text")
      .attr("x", colX[g])
      .attr("y", 70)
      .attr("fill", "#F9FAFB")
      .attr("font-size", 14)
      .attr("font-weight", 600)
      .text(g);
  });

  const nodes = gRoot.selectAll(".node")
    .data(allNodes)
    .enter()
    .append("g")
    .attr("class","node")
    .attr("transform", d => 
      `translate(${colX[d.oem_group]}, ${rowY[d.layer]})`
    );

  const boxW = 200;
  const boxH = 24;

  nodes.append("rect")
    .attr("width", boxW)
    .attr("height", boxH)
    .attr("rx", 6)
    .attr("fill", d => nodeFill(d))
    .attr("stroke", "rgba(255,255,255,.35)");

  nodes.append("text")
    .attr("x", 10)
    .attr("y", 16)
    .attr("font-size", 12)
    .attr("fill", "#F9FAFB")
    .attr("stroke", "rgba(0,0,0,0.75)")
    .attr("stroke-width", 3)
    .attr("paint-order", "stroke")
    .text(d => d.label);

  svg.call(
    d3.zoom()
      .scaleExtent([0.6, 3.5])
      .on("zoom", (event) => gRoot.attr("transform", event.transform))
  );
}

/* -------------------------
   NETWORK VIEW
-------------------------- */

function renderNetwork(){

  const svg = vizEl.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const gRoot = svg.append("g");

  const link = gRoot.append("g")
    .attr("stroke", "#9CA3AF")
    .attr("stroke-width", 1.5)
    .selectAll("line")
    .data(allEdges)
    .enter()
    .append("line");

  const node = gRoot.append("g")
    .selectAll("g")
    .data(allNodes)
    .enter()
    .append("g");

  node.append("circle")
    .attr("r", 7)
    .attr("fill", d => nodeFill(d));

  node.append("text")
    .attr("x", 10)
    .attr("y", 4)
    .attr("font-size", 12)
    .attr("fill", "#F9FAFB")
    .attr("stroke", "rgba(0,0,0,0.75)")
    .attr("stroke-width", 3)
    .attr("paint-order", "stroke")
    .text(d => d.label);

  const simulation = d3.forceSimulation(allNodes)
    .force("link", d3.forceLink(allEdges).id(d => d.id).distance(80))
    .force("charge", d3.forceManyBody().strength(-220))
    .force("center", d3.forceCenter(width / 2, height / 2));

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  svg.call(
    d3.zoom()
      .scaleExtent([0.6, 3.5])
      .on("zoom", (event) => gRoot.attr("transform", event.transform))
  );
}

/* -------------------------
   VIEW TOGGLE
-------------------------- */

document.querySelectorAll(".view-toggle button").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".view-toggle button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    render();
  });
});
