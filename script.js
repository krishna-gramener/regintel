import { updateSankey} from './sankey.js';

let pdfData = [];
let token = '';
const filters = ['companyFilter', 'categoryFilter', 'subcategoryFilter', 'indicationFilter', 'monthFilter', 'yearFilter'];

// LLM API helper functions
async function init() {
  try {
    const response = await fetch("https://llmfoundry.straive.com/token", { credentials: "include" });
    const data = await response.json();
    token = data.token;
  } catch (error) {
    console.error('Token initialization Nerror:', error);
  }
}

async function callLLM(systemPrompt, userMessage) {
  try {
    const response = await fetch("https://llmfoundry.straive.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}:regIntel`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || "API error occurred");
    }
    return data.choices?.[0]?.message?.content || "No response received";
  } catch (error) {
    console.error(error);
    throw new Error(`API call failed: ${error.message}`);
  }
}

// Extract keywords from user query using LLM
async function extractKeywords(userQuery) {
  const systemPrompt = `You are a keyword extraction assistant for regulatory documents. 
Extract the most relevant keywords and phrases from the user's query that would be useful for searching through FDA regulatory documents.
Return only a JSON array of keywords/phrases, nothing else. Focus on:
- Medical/pharmaceutical terms
- Company names
- Drug names
- Regulatory terms
- Issue categories
- Therapeutic areas

Example: ["manufacturing", "quality control", "labeling", "clinical deficiencies"]`;
  
  try {
    const response = await callLLM(systemPrompt, userQuery);
    // Parse the JSON response
    const keywords = JSON.parse(response.trim());
    return Array.isArray(keywords) ? keywords : [];
  } catch (error) {
    console.error('Keyword extraction error:', error);
    // Fallback: return simple word extraction
    return userQuery.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  }
}

// Search documents using Fuse.js with extracted keywords
function searchWithFuse(keywords, documents) {
  // Configure Fuse.js options for searching through document content
  console.log(documents)
  const fuseOptions = {
    keys: [
      { name: 'pdfName', weight: 0.3 },
      { name: 'companyName', weight: 0.2 },
      { name: 'drugName', weight: 0.2 },
      { name: 'indication', weight: 0.2 },
      { name: 'outcome', weight: 0.1 },
      { name: 'issueCategories.category', weight: 0.15 },
      { name: 'issueCategories.subcategories', weight: 0.1 }
    ],
    threshold: 0.3, // Lower threshold for more matches
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true
  };

  const fuse = new Fuse(documents, fuseOptions);
  const allResults = new Map();

  // Search for each keyword and combine results
  keywords.forEach(keyword => {
    const results = fuse.search(keyword);
    results.forEach(result => {
      // Only include documents with score < 0.6(better matches)
      if (result.score < 0.6) {
        const docId = result.item.pdfName;
        if (!allResults.has(docId)) {
          allResults.set(docId, {
            item: result.item,
            score: result.score,
            matches: result.matches || [],
            matchedKeywords: [keyword]
          });
        } else {
          // Combine scores (lower is better in Fuse.js)
          const existing = allResults.get(docId);
          existing.score = Math.min(existing.score, result.score);
          existing.matches = [...existing.matches, ...(result.matches || [])];
          existing.matchedKeywords.push(keyword);
        }
      }
    });
  });

  // Convert map to array and sort by score (lower is better)
  const combinedResults = Array.from(allResults.values())
    .sort((a, b) => a.score - b.score)
    .slice(0, 20); // Limit to top 20 results

  return combinedResults;
}

// Track selected values for each filter
window.selectedValues = {
  companyFilter: new Set(),
  categoryFilter: new Set(),
  subcategoryFilter: new Set(),
  indicationFilter: new Set(),
  monthFilter: new Set(),
  yearFilter: new Set()
};
const selectedValues = window.selectedValues;

// Function to create a checkbox option
function createCheckboxOption(value, containerId) {
  const div = document.createElement('div');
  div.className = 'px-3 py-1';
  
  const formCheck = document.createElement('div');
  formCheck.className = 'form-check';
  
  const input = document.createElement('input');
  input.className = 'form-check-input';
  input.type = 'checkbox';
  input.value = value;
  input.id = `${containerId}-${value.replace(/\s+/g, '-').toLowerCase()}`;
  
  const label = document.createElement('label');
  label.className = 'form-check-label';
  label.htmlFor = input.id;
  label.textContent = value;
  
  formCheck.appendChild(input);
  formCheck.appendChild(label);
  div.appendChild(formCheck);
  
  return div;
}

// Function to update dropdown button text
function updateDropdownText(filterId) {
  const selected = selectedValues[filterId];
  const button = document.querySelector(`#${filterId} button`);
  const baseText = button.textContent.split('(')[0].trim();
  
  if (selected.size === 0) {
    button.textContent = baseText;
  } else {
    button.textContent = `${baseText} (${selected.size})`;
  }
}

// Fetch and load PDF metadata
async function loadPDFData() {
  try {
    // Initialize LLM token for summary functionality
    await init();
    
    const res = await fetch('data.json');
    pdfData = await res.json();
    populateFilters(pdfData);
    displayResults(pdfData);
    // updateSankey(pdfData);
  } catch (error) {
    console.error('Error during initialization:', error);
    document.getElementById('results').innerHTML = `
      <div class="alert alert-danger">
        Error initializing application. Please refresh the page.
        ${error.message}
      </div>
    `;
  }
}

// Populate dropdown filters using unique values
function populateFilters(data) {
  const unique = (arr) => [...new Set(arr)];

  const MONTH_ORDER = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const sortMonths = (months) => {
    return MONTH_ORDER.filter(month => months.includes(month));
  };

  filters.forEach(id => {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    const optionsContainer = dropdown.querySelector(`.${id.replace('Filter', '-options')}`);
    if (!optionsContainer) return;

    // Clear existing options
    optionsContainer.innerHTML = '';
    
    let values = [];

    // Get values based on filter type
    if (id === 'categoryFilter') {
      values = unique(data.flatMap(item => 
        item.issueCategories?.map(cat => cat.category) || []
      )).filter(Boolean).sort();
    } 
    else if (id === 'subcategoryFilter') {
      values = unique(data.flatMap(item => 
        item.issueCategories?.flatMap(cat => cat.subcategories || []) || []
      )).filter(cat => cat !== 'Not applicable').sort();
    }
    else if (id === 'companyFilter') {
      values = unique(data.map(d => d.companyName).filter(Boolean));
    }
    else if (id === 'indicationFilter') {
      values = unique(data.map(d => d.indication).filter(Boolean));
    }
    else if (id === 'monthFilter') {
      values = sortMonths(unique(data.map(d => d.month).filter(Boolean)));
    }
    else if (id === 'yearFilter') {
      values = unique(data.map(d => d.year?.toString()).filter(Boolean)).sort((a, b) => a - b);
    }

    // Create and append checkbox options
    values.forEach(value => {
      const option = createCheckboxOption(value, id);
      optionsContainer.appendChild(option);

      // Add change event listener to checkbox
      const checkbox = option.querySelector('input');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedValues[id].add(value);
        } else {
          selectedValues[id].delete(value);
        }
        updateDropdownText(id);
        filterResults();
        updateSelectedFiltersDisplay();
      });
    });

    // Handle select all checkbox
    const selectAllCheckbox = document.getElementById(`${id}SelectAll`);
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
          checkbox.checked = e.target.checked;
          if (e.target.checked) {
            selectedValues[id].add(checkbox.value);
          } else {
            selectedValues[id].delete(checkbox.value);
          }
        });
        updateDropdownText(id);
        filterResults();
        updateSelectedFiltersDisplay();
      });
    }

    // Initialize dropdown text
    updateDropdownText(id);
    // updateSankey(data);
  });
}

// Get all selected values from a filter
function getSelectedValues(filterId) {
  return Array.from(selectedValues[filterId]);
}

// Update selected filters display
function updateSelectedFiltersDisplay() {
  const container = document.getElementById('selectedFilters');
  const tagsContainer = document.getElementById('selectedFilterTags');
  if (!container || !tagsContainer) return;

  // Clear existing tags
  tagsContainer.innerHTML = '';

  // Map filter IDs to their display names and types
  const filterInfo = {
    companyFilter: { name: 'Company', type: 'company' },
    indicationFilter: { name: 'Indication', type: 'indication' },
    categoryFilter: { name: 'Category', type: 'category' },
    subcategoryFilter: { name: 'Subcategory', type: 'subcategory' },
    yearFilter: { name: 'Year', type: 'year' }
  };

  // Track if we have any selected filters
  let hasSelectedFilters = false;

  // Create tags for each selected filter
  Object.entries(selectedValues).forEach(([filterId, values]) => {
    if (values.size > 0 && filterInfo[filterId]) {
      hasSelectedFilters = true;
      values.forEach(value => {
        const tag = document.createElement('span');
        tag.className = `filter-tag ${filterInfo[filterId].type}`;
        tag.textContent = `${filterInfo[filterId].name}: ${value}`;
        tagsContainer.appendChild(tag);
      });
    }
  });

  // Show/hide the container based on whether we have selected filters
  container.classList.toggle('d-none', !hasSelectedFilters);
}

// Filter data based on selected dropdown values
window.filterResults = function filterResults() {
  const companies = getSelectedValues('companyFilter');
  const categories = getSelectedValues('categoryFilter');
  const subcategories = getSelectedValues('subcategoryFilter');
  const indications = getSelectedValues('indicationFilter');
  const months = getSelectedValues('monthFilter');
  const years = getSelectedValues('yearFilter');

  const filtered = pdfData.filter(item => {
    return (
      (companies.length === 0 || companies.includes(item.companyName)) &&
      (indications.length === 0 || indications.includes(item.indication)) &&
      (months.length === 0 || months.includes(item.month)) &&
      (years.length === 0 || years.includes(item.year.toString())) &&
      (categories.length === 0 || categories.some(cat => 
        item.issueCategories?.some(ic => ic.category === cat)
      )) &&
      (subcategories.length === 0 || subcategories.some(sub => 
        item.issueCategories?.some(ic => ic.subcategories.includes(sub))
      ))
    );
  });

  displayResults(filtered);
  updateSelectedFiltersDisplay();
  
  // Generate summary for filtered results
  generateDocumentSummary(filtered);
  // updateSankey(filtered);
}

// Generate LLM summary for filtered documents
async function generateDocumentSummary(filteredResults, userQuery = null) {
  
  const summarySection = document.getElementById('summarySection');
  const summaryLoading = document.getElementById('summaryLoading');
  const summaryContent = document.getElementById('summaryContent');

  
  if (!summarySection || !summaryLoading || !summaryContent) {
    console.error('Summary elements not found in DOM');
    return;
  }
  
  // Show summary section and loading state
  summarySection.classList.remove('d-none');
  summaryLoading.classList.remove('d-none');
  summaryContent.innerHTML = '';
  
  try {
    // Collect all document details for comprehensive analysis
    const documentSummaries = filteredResults
      .filter(doc => doc.summary && doc.summary.trim())
      .map(doc => {
        const issueDetails = doc.issueCategories?.map(cat => {
          const subcats = cat.subcategories?.length > 0 ? ` (${cat.subcategories.join(', ')})` : '';
          return `${cat.category}${subcats}`;
        }).join('; ') || 'No specific issues listed';
        
        return `Company: ${doc.companyName}
Drug: ${doc.drugName || 'N/A'}
Indication: ${doc.indication}
Outcome: ${doc.outcome}
Date: ${doc.month} ${doc.year}
Document: ${doc.pdfName || 'N/A'}
Issue Categories: ${issueDetails}
Summary: ${doc.summary}`;
      });
    
    if (documentSummaries.length === 0) {
      summaryContent.innerHTML = '<p class="text-muted">No document summaries available for the filtered results.</p>';
      summaryLoading.classList.add('d-none');
      return;
    }
    
    const systemPrompt = `You are an expert regulatory affairs analyst. You will be provided with detailed information about FDA regulatory documents (Complete Response Letters, Warning Letters, etc.). Your task is to create a comprehensive, well-structured analysis.

${userQuery ? `The user has asked: "${userQuery}"
Please focus your analysis on addressing this question while providing comprehensive insights.` : ''}

Provide a clear, professional analysis that would be valuable for regulatory professionals. Use bullet points and clear headings where appropriate. Make sure the headings are not very big. Include insights about patterns, trends, and key regulatory issues.`;
    
    const userMessage = `Please analyze the following FDA regulatory documents with complete details:\n\n${documentSummaries.join('\n\n---\n\n')}\n\n${userQuery ? `\nSpecifically address this question: "${userQuery}"` : ''}`;
    
    const summary = await callLLM(systemPrompt, userMessage);
    
    // Use marked.parse to render markdown content
    const htmlSummary = marked.parse(summary);
    summaryContent.innerHTML = `<div class="summary-text">${htmlSummary}</div>`;
    
  } catch (error) {
    console.error('Summary generation error:', error);
    summaryContent.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-2"></i>Unable to generate summary: ${error.message}</div>`;
  } finally {
    summaryLoading.classList.add('d-none');
  }
}

// Display filtered PDF results
function displayResults(results) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (results.length === 0) {
    container.innerHTML = `<div class="alert alert-warning">No matching documents found.</div>`;
    document.getElementById("noOfElementsFound").innerHTML=" ";
    return;
  }
  document.getElementById("noOfElementsFound").innerHTML=`Documents Found : ${results.length}`;
  results.forEach(item => {
    const link = document.createElement('a');
    link.href = `docs/${item.pdfName}`;
    link.target = '_blank';
    link.className = 'list-group-item list-group-item-action';
    link.innerHTML = `
      <h5 class="mb-1">${item.pdfName}</h5>
      <p class="mb-1">${item.companyName} | ${item.indication}</p>
      <small>${item.month} ${item.year} | ${item.outcome}</small>
    `;
    container.appendChild(link);
  });
}

// Clear all filters and reset dropdowns
function clearAllFilters() {
  filters.forEach(id => {
    // Clear selected values
    selectedValues[id].clear();
    
    // Uncheck all checkboxes
    const optionsContainer = document.querySelector(`#${id} .${id.replace('Filter', '-options')}`);
    if (optionsContainer) {
      optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });
    }
    
    // Reset select all checkbox
    const selectAllCheckbox = document.getElementById(`${id}SelectAll`);
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
    }
    
    // Update dropdown text
    updateDropdownText(id);
  });
  
  filterResults();
  updateSelectedFiltersDisplay();
}

// Landing page functionality
function showMainApp() {
  const landingPage = document.getElementById('landingPage');
  const mainApp = document.getElementById('mainApp');
  
  if (landingPage && mainApp) {
    landingPage.classList.add('d-none');
    mainApp.classList.remove('d-none');
    // Initial load
    loadPDFData();
  }
}

// Handle document search using keyword extraction + Fuse.js approach
async function handleDocumentSearch() {
  const searchInput = document.getElementById('documentSearchInput');
  const searchBtn = document.getElementById('documentSearchBtn');
  const query = searchInput.value.trim();
  
  if (!query) {
    alert('Please enter a search query.');
    return;
  }
  
  // Show loading state
  const originalBtnText = searchBtn.innerHTML;
  searchBtn.disabled = true;
  searchBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Extracting keywords...';
  
  try {
    // Step 1: Extract keywords from user query using LLM
    const keywords = await extractKeywords(query);
    
    if (keywords.length === 0) {
      throw new Error('No keywords could be extracted from your query.');
    }
    
    // Update loading message
    searchBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Searching documents...';
    
    // Step 2: Use Fuse.js to search through document content with keywords
    const fuseResults = searchWithFuse(keywords, pdfData);
    
    if (fuseResults.length === 0) {
      document.getElementById('results').innerHTML = 
        `<div class="alert alert-warning">No documents found matching the keywords: ${keywords.join(', ')}</div>`;
      document.getElementById('noOfElementsFound').innerHTML = 'Documents Found: 0';
      return;
    }
    
    // Step 3: Extract just the document items for display and summary
    const matchedDocuments = fuseResults.map(result => ({
      ...result.item,
      fuseScore: result.score,
      matchedKeywords: result.matchedKeywords,
      matches: result.matches
    }));
    
    // Update loading message
    searchBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Generating summary...';
    
    // Step 4: Generate summary of matched documents
    await generateDocumentSummary(matchedDocuments, query);
    
    // Step 5: Display results
    displayResults(matchedDocuments);
    
    // Update results count
    document.getElementById('noOfElementsFound').innerHTML = 
      `Documents Found: ${matchedDocuments.length} `;
    
  } catch (error) {
    console.error('Search error:', error);
    document.getElementById('results').innerHTML = 
      `<div class="alert alert-danger">Search failed: ${error.message}</div>`;
    document.getElementById('noOfElementsFound').innerHTML = '';
  } finally {
    // Restore button state
    searchBtn.disabled = false;
    searchBtn.innerHTML = originalBtnText;
  }
}

// Button handlers
document.getElementById('searchBtn').addEventListener('click', filterResults);
document.getElementById('clearBtn').addEventListener('click', clearAllFilters);
document.getElementById('documentSearchBtn').addEventListener('click', handleDocumentSearch);

// Begin button handler
document.addEventListener('DOMContentLoaded', function() {
  const beginBtn = document.getElementById('beginBtn');
  if (beginBtn) {
    beginBtn.addEventListener('click', showMainApp);
  }
});
