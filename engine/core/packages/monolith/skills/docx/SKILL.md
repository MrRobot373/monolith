---
name: docx
description: Create, edit, inspect and validate Word .docx documents - reports, memos, letters, contracts, specs. Use for any request to write, change or check a Word document, including editing a file the user supplies.
whenToUse: The user wants a Word document produced or modified, or wants to know what is inside one.
metadata:
  category: documents
  version: 1.0.0
  license: MIT
---

# Word documents

You produce a **file**. Markdown in chat is not a Word document.

One tool: `{{SKILL_DIR}}/scripts/docx_tool.py`. That path is absolute and
already correct - **use it exactly as written**, never shortened.

## Create

```bash
python "{{SKILL_DIR}}/scripts/docx_tool.py" create - report.docx <<'JSON'
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

Per section: `heading`, `level` (1-3), `paragraphs`, `bullets`, `numbered`,
`table`, `page_break`.

## Edit an existing document

**`inspect` first**, then edit. Edits mutate runs in place, so fonts, styles,
numbering and section setup survive:

```bash
python "{{SKILL_DIR}}/scripts/docx_tool.py" inspect theirs.docx
python "{{SKILL_DIR}}/scripts/docx_tool.py" edit theirs.docx out.docx - <<'JSON'
{"ops": [
  {"op": "replace", "find": "[CLIENT]", "replace": "Acme Ltd"},
  {"op": "replace", "find": "draft", "replace": "final", "required": false},
  {"op": "append_heading", "text": "Appendix", "level": 1},
  {"op": "append_bullets", "items": ["Signed 4 Sep", "Renews annually"]}
]}
JSON
```

`replace` fails loudly when the text is absent, because a silent no-op looks
like success and ships an unchanged document. Set `"required": false` where a
miss is genuinely fine.

**Never "edit" by extracting text and recreating the file.** That discards every
style in the document. Templates especially: you are a form-filler, not a
redesigner - replace the placeholders and leave the formatting alone.

## Legacy `.doc`

The old binary format is not a .docx. Convert first:

```bash
libreoffice --headless --convert-to docx theirs.doc
```

## Validate

`validate` proves the file is a real OOXML container with the required parts.
A `.txt` or `.rtf` renamed to `.docx` is the single most common bad input, and
this catches it with a clear message instead of a library stack trace.

## Related

- `powerpoint` for slides, `pdf` for print-ready or read-only output
- `office-inspect` when you do not yet know what a file is
- `office-repair` when a document will not open
