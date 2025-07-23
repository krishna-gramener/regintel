export function updateSankey(data) {
  if (!data?.length) {
    d3.select('#sankey-chart')
      .html('<div class="alert alert-warning">No data available for Sankey diagram</div>');
    return;
  }

  // Setup dimensions
  const container = document.getElementById('sankey-chart');
  const width = Math.min(container.clientWidth, 1600);
  const height = 1100;
  const margin = { top: 50, right: 420, bottom: 50, left: 270 };
  const effectiveWidth = width - margin.left - margin.right - 25;
  const effectiveHeight = height - margin.top - margin.bottom;

  // Define columns and initialize Sets for each type
  const uniqueValues = {
    categories: new Set(),
    subcategories: new Set(),
    indications: new Set(),
    years: new Set(),
    companies: new Set()
  };
  const links = [];

  // Process data
  data.forEach(d => {
    uniqueValues.companies.add(d.companyName);
    uniqueValues.indications.add(d.indication || 'Not Specified');
    uniqueValues.years.add(d.year.toString());

    d.issueCategories?.forEach(cat => {
      if (cat?.category) {
        uniqueValues.categories.add(cat.category);

        cat.subcategories?.forEach(sub => {
          if (sub) {
            uniqueValues.subcategories.add(sub);
            // New flow: category → subcategory → indication (therapeutic area) → year → company
            addOrUpdateLink(links, `category-${cat.category}`, `subcategory-${sub}`);
            addOrUpdateLink(links, `subcategory-${sub}`, `indication-${d.indication || 'Not Specified'}`);
            addOrUpdateLink(links, `indication-${d.indication || 'Not Specified'}`, `year-${d.year}`);
            addOrUpdateLink(links, `year-${d.year}`, `company-${d.companyName}`);
          }
        });
      }
    });
  });

  // Create nodes
  const nodeTypes = [
    { type: 'category', values: uniqueValues.categories },
    { type: 'subcategory', values: uniqueValues.subcategories },
    { type: 'indication', values: uniqueValues.indications },
    { type: 'year', values: uniqueValues.years },
    { type: 'company', values: uniqueValues.companies }
  ];
  
  const nodes = nodeTypes.flatMap(({ type, values }, column) => 
    Array.from(values).map(name => ({
      id: `${type}-${name}`,
      originalName: name,
      type,
      column
    }))
  );

  // Setup SVG
  d3.select('#sankey-chart').selectAll('*').remove();
  const svg = d3.select('#sankey-chart')
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);



  // Create Sankey layout with fixed node heights
  const fixedNodeHeight = 22; // Height for rectangle nodes
  const sankey = d3.sankey()
    .nodeWidth(15)  // Slightly thinner rectangles
    .nodePadding(45)  // Even more padding for better label visibility
    .nodeSort(null)  // Preserve original order
    .nodeId(d => d.id)
    .nodeAlign(d => d.column)  // Left-to-right alignment
    .extent([[0, 0], [effectiveWidth, effectiveHeight]]);

  // Apply layout
  const sankeyData = sankey({
    nodes: nodes.filter(n => n?.id),
    links: links.filter(l => l?.source && l?.target).map(l => ({ ...l, value: l.value || 1 }))
  });

  // Create gradient definitions
  const defs = svg.append('defs');
  sankeyData.links.forEach((d, i) => {
    const gradient = defs.append('linearGradient')
      .attr('id', `link-gradient-${i}`)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', d.source.x1)
      .attr('x2', d.target.x0);

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', getNodeColor(d.source.type));

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', getNodeColor(d.target.type));
  });

  // Draw links with reduced width
  const links_g = svg.append('g')
    .attr('class', 'links')
    .attr('fill', 'none')
    .selectAll('path')
    .data(sankeyData.links)
    .enter()
    .append('g')
    .attr('transform', 'translate(0, -5)')
    .append('path')
    .attr('d', d3.sankeyLinkHorizontal())
    .attr('stroke', (d, i) => `url(#link-gradient-${i})`)
    .attr('stroke-width', d => Math.max(1, Math.min(d.width, 3))) // Reduced max width
    .attr('fill', 'none')
    .attr('stroke-opacity', 0.35)
    .style('mix-blend-mode', 'multiply')
    .attr('stroke-width', d => Math.max(1, Math.min(d.width, 3)))
    .attr('stroke-opacity', 0.35)
  // Draw nodes
  const nodes_g = svg.append('g')
    .attr('class', 'nodes')
    .selectAll('.node')
    .data(sankeyData.nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  // Add rectangular nodes
  nodes_g.append('rect')
    .attr('height', fixedNodeHeight)
    .attr('width', d => d.x1 - d.x0)
    .attr('y', d => (d.y1 - d.y0 - fixedNodeHeight) / 2)
    .attr('fill', d => getNodeColor(d.type))
    .attr('opacity', 0.9)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this)
        .attr('opacity', 1)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);
      
      // Highlight connected links
      links_g.selectAll('path')
        .attr('stroke-opacity', l => 
          l.source.id === d.id || l.target.id === d.id ? 0.7 : 0.1
        );


    })
    .on('mouseout', function(event, d) {
      d3.select(this)
        .attr('opacity', 0.9)
        .attr('stroke', 'none');
      
      // Reset link opacity
      links_g.selectAll('path')
        .attr('stroke-opacity', 0.35);

    })
    .on('click', handleSankeyClick);

  // Add node labels with improved spacing
  const labelPadding = 12;
  nodes_g.append('text')
    .attr('x', d => -labelPadding)
    .attr('y', d => (d.y1 - d.y0 - fixedNodeHeight) / 2 + fixedNodeHeight/2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => d.x0 < width / 2 ? 'end' : 'start')
    .text(d => d.originalName.length>20?d.originalName.slice(0, 20)+'..':d.originalName)
    .style('font-weight','400')
    .style('font-size', '11px')
    .style('fill', '#333')
    .style('pointer-events', 'none');
}

function getNodeColor(type) {
  const colors = {
    category: "#f28e2c",  // Orange for categories
    subcategory: "#e15759",  // Red for subcategories
    indication: "#59a14f",  // Green for indications (therapeutic areas)
    year: "#b07aa1",  // Purple for years
    company: "#4e79a7",  // Blue for companies
  };
  return colors[type] || "#999";
}

function addOrUpdateLink(links, source, target) {
  if (!source || !target) return; // Skip if source or target is missing
  
  const existingLink = links.find((l) => l.source === source && l.target === target);
  if (existingLink) {
    existingLink.value = (existingLink.value || 0) + 0.5;
  } else {
    links.push({ source, target, value: 0.5 });
  }
}

function handleSankeyClick(event, d) {
  // Prevent event from bubbling up
  event.stopPropagation();

  // Map node types to filter IDs
  const filterMap = {
    category: 'categoryFilter',
    subcategory: 'subcategoryFilter',
    indication: 'indicationFilter',
    year: 'yearFilter',
    company: 'companyFilter'
  };

  // Get the filter ID for the clicked node
  const filterId = filterMap[d.type];
  if (!filterId) return;

  // Get the clicked value
  const value = d.originalName;
  
  // Check if the value is already selected
  const selectedValues = window.selectedValues[filterId];
  const isSelected = selectedValues?.has(value);

  // Clear only filters that come after the clicked node's type in the flow
  const filterOrder = ['categoryFilter', 'subcategoryFilter', 'indicationFilter', 'yearFilter', 'companyFilter'];
  const clickedFilterIndex = filterOrder.indexOf(filterId);
  
  // Reset downstream filters and their selected values
  filterOrder.forEach((id, index) => {
    if (index > clickedFilterIndex) {
      // Clear selected values for downstream filters
      const values = window.selectedValues[id];
      if (values) {
        values.clear();
      }

      // Clear checkboxes
      const container = document.querySelector(`#${id} .${id.replace('Filter', '-options')}`);
      if (container) {
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
          checkbox.checked = false;
        });
      }

      // Reset select all checkbox
      const selectAllCheckbox = document.getElementById(`${id}SelectAll`);
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
      }

      // Update dropdown text
      const button = document.querySelector(`#${id} button`);
      if (button) {
        button.textContent = button.textContent.split('(')[0].trim();
      }
    }
  });

  // Toggle the clicked node's filter
  const container = document.querySelector(`#${filterId} .${filterId.replace('Filter', '-options')}`);
  if (container) {
    // Find the checkbox for the clicked value
    const checkbox = container.querySelector(`input[value="${value}"]`);
    if (checkbox) {
      // Toggle the checkbox state based on current selection
      checkbox.checked = !isSelected;

      // Update the selected values Set
      if (selectedValues) {
        if (!isSelected) {
          selectedValues.add(value);
        } else {
          selectedValues.delete(value);
        }
      }

      // Update dropdown text
      const button = document.querySelector(`#${filterId} button`);
      if (button) {
        const baseText = button.textContent.split('(')[0].trim();
        const count = selectedValues?.size || 0;
        button.textContent = count > 0 ? `${baseText} (${count})` : baseText;
      }
    }
  }

  // Trigger filter update
  const filterResults = window.filterResults;
  if (typeof filterResults === 'function') {
    filterResults();
  }
}
