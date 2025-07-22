import { updateSankey} from './sankey.js';

let pdfData = [];
const filters = ['companyFilter', 'categoryFilter', 'subcategoryFilter', 'indicationFilter', 'monthFilter', 'yearFilter'];

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
