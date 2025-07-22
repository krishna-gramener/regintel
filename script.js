import { updateSankey} from './sankey.js';

let pdfData = [];
let token = null;
const filters = ['companyFilter', 'categoryFilter', 'subcategoryFilter', 'indicationFilter', 'monthFilter', 'yearFilter'];

// LLM API helper functions
async function init() {
  try {
    const response = await fetch("https://llmfoundry.straive.com/token", { credentials: "include" });
    const data = await response.json();
    token = data.token;
  } catch (error) {
    console.error('Token initialization error:', error);
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
    updateSankey(pdfData);
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
}

// Generate LLM summary for filtered documents
async function generateDocumentSummary(filteredResults) {
  const summarySection = document.getElementById('summarySection');
  const summaryLoading = document.getElementById('summaryLoading');
  const summaryContent = document.getElementById('summaryContent');
  
  // Check if we have filters applied and results
  const hasFilters = Object.values(selectedValues).some(set => set.size > 0);
  
  if (!hasFilters || filteredResults.length === 0) {
    summarySection.classList.add('d-none');
    return;
  }
  
  // Show summary section and loading state
  summarySection.classList.remove('d-none');
  summaryLoading.classList.remove('d-none');
  summaryContent.innerHTML = '';
  
  try {
    // Collect summaries from filtered documents
    const documentSummaries = filteredResults
      .filter(doc => doc.summary && doc.summary.trim())
      .map(doc => `Company: ${doc.companyName}\nDocument: ${doc.fileName}\nSummary: ${doc.summary}`);
    
    if (documentSummaries.length === 0) {
      summaryContent.innerHTML = '<p class="text-muted">No document summaries available for the filtered results.</p>';
      summaryLoading.classList.add('d-none');
      return;
    }
    
    const systemPrompt = `You are an expert regulatory affairs analyst. You will be provided with summaries of FDA regulatory documents (Complete Response Letters, Warning Letters, etc.). Your task is to create a comprehensive, well-structured summary that identifies:

1. Key regulatory issues and deficiencies across all documents
2. Common themes and patterns
3. Companies most affected
4. Critical areas of concern
5. Regulatory trends and implications

Provide a clear, professional summary that would be valuable for regulatory professionals. Use bullet points and clear headings where appropriate.`;
    
    const userMessage = `Please analyze and summarize the following ${documentSummaries.length} FDA regulatory document summaries:\n\n${documentSummaries.join('\n\n---\n\n')}`;
    
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

// Placeholder function for similarity API call
async function searchDocumentsSimilarity(query) {
  // TODO: Implement LLM Foundry similarity API call
  // This function will send the query and all documents to the similarity API
  // and return the most relevant documents based on semantic similarity
  
  console.log('Searching documents with query:', query);
  console.log('Total documents to search:', pdfData.length);
  
  try {
    // Placeholder for actual API call
    // const response = await fetch('LLM_FOUNDRY_SIMILARITY_API_ENDPOINT', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': 'Bearer YOUR_API_KEY'
    //   },
    //   body: JSON.stringify({
    //     query: query,
    //     documents: pdfData,
    //     top_k: 10 // Number of most similar documents to return
    //   })
    // });
    // 
    // const results = await response.json();
    // return results.similar_documents;
    
    // For now, return a mock response
    return {
      success: true,
      query: query,
      results: pdfData.slice(0, 5), // Return first 5 documents as mock results
      message: 'Similarity search not yet implemented. Showing sample results.'
    };
  } catch (error) {
    console.error('Error in similarity search:', error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

// Handle document search
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
  searchBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Searching...';
  
  try {
    const searchResults = await searchDocumentsSimilarity(query);
    
    if (searchResults.success) {
      // Display search results
      displayResults(searchResults.results);
      document.getElementById('noOfElementsFound').innerHTML = 
        `Documents Found: ${searchResults.results.length} (Similarity Search: "${query}")`;
      
      // Show message if it's a mock response
      if (searchResults.message) {
        const resultsContainer = document.getElementById('results');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'alert alert-info mb-3';
        messageDiv.innerHTML = `<i class="bi bi-info-circle me-2"></i>${searchResults.message}`;
        resultsContainer.insertBefore(messageDiv, resultsContainer.firstChild);
      }
    } else {
      // Handle error
      document.getElementById('results').innerHTML = 
        `<div class="alert alert-danger">Search failed: ${searchResults.error}</div>`;
    }
  } catch (error) {
    console.error('Search error:', error);
    document.getElementById('results').innerHTML = 
      `<div class="alert alert-danger">An error occurred during search. Please try again.</div>`;
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

// Add Enter key support for document search
document.getElementById('documentSearchInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    handleDocumentSearch();
  }
});

// Begin button handler
document.addEventListener('DOMContentLoaded', function() {
  const beginBtn = document.getElementById('beginBtn');
  if (beginBtn) {
    beginBtn.addEventListener('click', showMainApp);
  }
});
