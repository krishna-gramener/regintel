# 📄 RegIntel

A simple web app to view and filter FDA regulatory PDF documents by company, drug, date, and issue categories.

## 🔍 Features

- Interactive Sankey diagram visualization showing relationships between:
  - Companies
  - Therapeutic Areas
  - Drugs
  - Years
- Click on any node in the Sankey diagram to filter documents
- Multi-select, searchable dropdown filters for:
  - Company Name
  - Drug Name
  - Indication
  - Month and Year
  - Issue Categories (e.g., Manufacturing, Labeling)
- View matched PDFs directly in browser
- Clear All button to reset filters

## 🛠 Tech Stack

- HTML, JavaScript
- Bootstrap 5 for layout and styling
- Choices.js for enhanced dropdowns
- D3.js and D3-Sankey for data visualization

## 📁 Project Structure

```
project-root/
├── index.html
├── script.js
├── sankey.js
├── data.json
├── docs/
│   ├── file1.pdf
│   ├── file2.pdf
│   └── ...
```

## 🚀 Getting Started

1. Clone or download this repo
2. Serve using a local server (e.g., Python or Live Server)

### Using Python

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

## 📦 Dependencies (CDN)

- Bootstrap 5
- Choices.js
- D3.js v7
- D3-Sankey v0.12.3

All included in `index.html` via CDN.

## 🙋‍♂️ For Users

- Use the interactive Sankey diagram to explore relationships between companies, therapeutic areas, drugs, and years
- Click on any node in the Sankey diagram to filter related documents
- Use the dropdown filters to further narrow down documents of interest
- Click document titles to open PDFs

## 🧑‍💻 For Developers

- Modify filters or behavior in `script.js`
- Customize Sankey diagram visualization in `sankey.js`
- Add documents to `docs/` and metadata to `data.json`
- The Sankey module is designed to be reusable and modular

---

Built by Krishna Kumar. Simple. Searchable. Scalable.
