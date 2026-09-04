---
name: pdf
description: Create print-ready PDFs, and extract text, merge, split or validate existing ones. Use for reports meant to be printed or shared read-only, and for pulling content out of PDFs the user supplies.
whenToUse: The user wants a PDF produced, or wants text, tables or pages out of an existing PDF.
metadata:
  category: documents
  version: 1.0.0
  license: MIT
---

# PDF files

One tool: `{{SKILL_DIR}}/scripts/pdf_tool.py`. That path is absolute and already
correct - **use it exactly as written**, never shortened.

## Create a report

```bash
python "{{SKILL_DIR}}/scripts/pdf_tool.py" create - report.pdf <<'JSON'
{
  "title": "Quarterly Report",
  "subtitle": "Prepared for the board",
  "sections": [
    {"heading": "Summary",
     "paragraphs": ["Revenue grew 14% year over year."],
     "bullets": ["Retention improved", "Churn fell to 3%"]},
    {"heading": "Numbers",
     "table": {"headers": ["Metric", "Q1", "Q2"],
               "rows": [["Revenue", "1.2M", "1.35M"]]}}
  ]
}
JSON
```

## Choose the format deliberately

PDF is a **print** format - fixed pages, no reflow, awkward to edit. Produce a
PDF when the document is final, must print predictably, or must not be edited.
If the user will keep working on it, produce `.docx` instead and let them export.

## Read an existing PDF

```bash
python "{{SKILL_DIR}}/scripts/pdf_tool.py" extract theirs.pdf --pages 1-5
python "{{SKILL_DIR}}/scripts/pdf_tool.py" tables theirs.pdf
```

`extract` gives reading-order text per page. `tables` preserves line layout,
which is what you need to reconstruct a table by eye.

**Scanned PDFs contain no text.** The tool says so per page rather than
returning empty strings. Do not report "the document is empty" - report that it
is a scan and needs OCR.

## Combine and separate

```bash
python "{{SKILL_DIR}}/scripts/pdf_tool.py" merge out.pdf a.pdf b.pdf
python "{{SKILL_DIR}}/scripts/pdf_tool.py" split in.pdf pages/
```

## Validate

Checks the `%PDF` header, page count, encryption, and which pages lack a text
layer. Run it before promising a user you can read their file.

## Related

- `docx` when the document should stay editable
- `office-inspect` to identify an unknown file first
