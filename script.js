import { updateSankey, initSankey } from './sankey.js';

let pdfData = [];
const filters = ['companyFilter', 'drugFilter', 'indicationFilter', 'monthFilter', 'yearFilter', 'issueFilter'];
const choicesInstances = {};

// Fetch and load PDF metadata
async function loadPDFData() {
  const res = await fetch('data.json');
  pdfData = await res.json();
  populateFilters(pdfData);
  
  // Initialize Sankey with choices instances
  initSankey(choicesInstances);
  
  displayResults(pdfData);
  updateSankey(pdfData);
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
  
    const fieldMap = {
      companyFilter: unique(data.map(d => d.companyName)).sort(),
      drugFilter: unique(data.map(d => d.drugName)).sort(),
      indicationFilter: unique(data.map(d => d.indication)).sort(),
      monthFilter: sortMonths(unique(data.map(d => d.month))),
      yearFilter: unique(data.map(d => d.year.toString())).sort((a, b) => a - b),
    };
  
    filters.forEach(id => {
      const select = document.getElementById(id);
  
      // Skip re-initializing if already exists
      if (choicesInstances[id]) {
        choicesInstances[id].clearChoices();
      }
  
      if (id !== 'issueFilter') {
        const options = fieldMap[id].map(value => ({ value, label: value }));
        if (choicesInstances[id]) {
          choicesInstances[id].setChoices(options, 'value', 'label', true);
        } else {
          choicesInstances[id] = new Choices(select, {
            removeItemButton: true,
            searchEnabled: true,
            shouldSort: false,
            placeholderValue: `Select ${id.replace('Filter', '')}`,
            noResultsText: 'No match found',
          });
          choicesInstances[id].setChoices(options, 'value', 'label', true);
        }
      } else {
        // For issue filter, use the category names from issueCategories
        const issueCategories = unique(data.flatMap(item => item.issueCategories?.map(cat => cat.category) || [])).sort();
        const options = issueCategories.map(value => ({ value, label: value }));
        
        if (!choicesInstances[id]) {
          choicesInstances[id] = new Choices(select, {
            removeItemButton: true,
            searchEnabled: true,
            shouldSort: false,
            placeholderValue: 'Select issues',
            noResultsText: 'No match found',
          });
        } else {
          choicesInstances[id].clearChoices();
        }
        choicesInstances[id].setChoices(options, 'value', 'label', true);
      }
    });
  }
  

// Get all selected values from a multi-select
function getSelectedValues(selectId) {
  return choicesInstances[selectId]
    .getValue()
    .map(choice => choice.value);
}

// Filter data based on selected dropdown values
function filterResults() {
  const companies = getSelectedValues('companyFilter');
  const drugs = getSelectedValues('drugFilter');
  const indications = getSelectedValues('indicationFilter');
  const months = getSelectedValues('monthFilter');
  const years = getSelectedValues('yearFilter');
  const issues = getSelectedValues('issueFilter');

  const filtered = pdfData.filter(item => {
    return (
      (companies.length === 0 || companies.includes(item.companyName)) &&
      (drugs.length === 0 || drugs.includes(item.drugName)) &&
      (indications.length === 0 || indications.includes(item.indication)) &&
      (months.length === 0 || months.includes(item.month)) &&
      (years.length === 0 || years.includes(item.year.toString())) &&
      (issues.length === 0 || issues.some(issue => item.issueCategories?.some(cat => cat.category === issue && cat.subcategories.length > 0)))
    );
  });

  displayResults(filtered);
  updateSankey(filtered);
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
      <p class="mb-1">${item.drugName} | ${item.companyName} | ${item.indication}</p>
      <small>${item.month} ${item.year} | ${item.outcome}</small>
    `;
    container.appendChild(link);
  });
}

// Clear all filters and reset dropdowns
function clearAllFilters() {
  filters.forEach(id => {
    choicesInstances[id]?.removeActiveItems();
  });
  displayResults(pdfData);
  updateSankey(pdfData);
}

// Button handlers
document.getElementById('searchBtn').addEventListener('click', filterResults);
document.getElementById('clearBtn').addEventListener('click', clearAllFilters);

// Initial load
loadPDFData();
