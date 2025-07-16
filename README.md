# 📄 RegIntel

A simple web app to view and filter FDA regulatory PDF documents by company, drug, date, and issue categories.

## 🔍 Features

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

## 📁 Project Structure

```
project-root/
├── index.html
├── script.js
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

Included in `index.html` via CDN.

## 🙋‍♂️ For Users

- Use the filters to narrow down documents of interest
- Click document titles to open PDFs

## 🧑‍💻 For Developers

- Modify filters or behavior in `script.js`
- Add documents to `docs/` and metadata to `data.json`

---

Built by Krishna Kumar. Simple. Searchable. Scalable.
