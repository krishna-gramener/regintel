
let instances = null;

export function initSankey(choicesInstances) {
  instances = choicesInstances;
}

export function updateSankey(data) {
  if (!data || data.length === 0) {
    d3.select("#sankey-chart").html('<div class="alert alert-warning">No data available for Sankey diagram</div>');
    return;
  }

  const width = document.getElementById("sankey").clientWidth;
  const height = 400;
  const margin = { top: 10, right: 10, bottom: 10, left: 10 };

  // Clear previous diagram
  d3.select("#sankey-chart").html("");

  // Create SVG
  const svg = d3.select("#sankey-chart").append("svg").attr("width", width).attr("height", height);

  // Prepare data for Sankey
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  // Helper function to get node index
  function getNodeIndex(name, type) {
    const key = `${type}-${name}`;
    if (!nodeMap.has(key)) {
      const node = { name, type };
      nodeMap.set(key, nodes.length);
      nodes.push(node);
    }
    return nodeMap.get(key);
  }

  // Create links
  data.forEach((item) => {
    // Company -> Indication
    let sourceIndex = getNodeIndex(item.companyName, "company");
    let targetIndex = getNodeIndex(item.indication, "indication");
    addOrUpdateLink(links, sourceIndex, targetIndex);

    // Indication -> Drug
    sourceIndex = targetIndex;
    targetIndex = getNodeIndex(item.drugName, "drug");
    addOrUpdateLink(links, sourceIndex, targetIndex);

    // Drug -> Year
    sourceIndex = targetIndex;
    targetIndex = getNodeIndex(item.year.toString(), "year");
    addOrUpdateLink(links, sourceIndex, targetIndex);
  });

  // Create Sankey generator
  const sankey = d3
    .sankey()
    .nodeWidth(15)
    .nodePadding(10)
    .extent([
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom],
    ]);

  // Generate layout
  const { nodes: sankeyNodes, links: sankeyLinks } = sankey({
    nodes: nodes.map((d) => Object.assign({}, d)),
    links: links,
  });

  // Add links
  svg
    .append("g")
    .selectAll("path")
    .data(sankeyLinks)
    .join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("fill", "none")
    .attr("stroke", "#ccc")
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .attr("opacity", 0.3)
    .style("cursor", "pointer")
    .on("mouseover", function () {
      d3.select(this)
        .attr("opacity", 0.7)
        .attr("stroke-width", (d) => Math.max(2, d.width));
    })
    .on("mouseout", function () {
      d3.select(this)
        .attr("opacity", 0.3)
        .attr("stroke-width", (d) => Math.max(1, d.width));
    })
    .on("click", handleSankeyClick);

  // Add nodes
  const nodes_g = svg.append("g").selectAll("rect").data(sankeyNodes).join("g");

  nodes_g
    .append("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("fill", (d) => getNodeColor(d.type))
    .style("cursor", "pointer")
    .on("click", handleSankeyClick)
    .on("mouseover", function () {
      d3.select(this).attr("fill", (d) => d3.color(getNodeColor(d.type)).brighter(0.3));
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", (d) => getNodeColor(d.type));
    });

  // Add labels
  nodes_g
    .append("text")
    .attr("x", (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
    .attr("y", (d) => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.x0 < width / 2 ? "start" : "end"))
    .text((d) => d.name)
    .style("font-size", "10px")
    .style("fill", "#666")
    .style("cursor", "pointer")
    .on("click", handleSankeyClick);
}

function getNodeColor(type) {
  const colors = {
    company: "#1f77b4",
    indication: "#2ca02c",
    drug: "#ff7f0e",
    year: "#d62728",
  };
  return colors[type] || "#999";
}

function addOrUpdateLink(links, source, target) {
  const existingLink = links.find((l) => l.source === source && l.target === target);
  if (existingLink) {
    existingLink.value++;
  } else {
    links.push({ source, target, value: 1 });
  }
}

function handleSankeyClick(event, d) {
  if (!instances) return;

  // Clear all filters first
  Object.values(instances).forEach(instance => instance?.removeActiveItems());

  // Set the appropriate filter based on node type
  if (d.type === "company") {
    instances.companyFilter.setChoiceByValue(d.name);
  } else if (d.type === "indication") {
    instances.indicationFilter.setChoiceByValue(d.name);
  } else if (d.type === "drug") {
    instances.drugFilter.setChoiceByValue(d.name);
  } else if (d.type === "year") {
    instances.yearFilter.setChoiceByValue(d.name);
  }

  // Trigger search
  document.getElementById('searchBtn').click();
}
