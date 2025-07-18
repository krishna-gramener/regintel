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

// Button handlers
document.getElementById('searchBtn').addEventListener('click', filterResults);
document.getElementById('clearBtn').addEventListener('click', clearAllFilters);

// Initial load
loadPDFData();
