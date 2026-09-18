---
name: office-inspect
description: Identify what a file actually is from its bytes, flag extension mismatches, and name the right tool for it. Run this first on any user-supplied document, spreamonolitheet, deck, PDF or data file of unknown provenance.
whenToUse: A file arrived and you are not certain what it is, or a document tool rejected it with a confusing error.
metadata:
  category: documents
  version: 1.0.0
  license: MIT
---

# Identify a file before you open it

```bash
python "{{SKILL_DIR}}/scripts/inspect_file.py" <path> [<path> ...]
python "{{SKILL_DIR}}/scripts/inspect_file.py" <directory>
```

That path is absolute and already correct - **use it exactly as written**.

## Why this comes first

Extensions lie. The commonest bad input is a `.csv`, `.xls` or `.rtf` wearing a
`.xlsx` or `.docx` extension, and every OOXML library rejects it with an
unhelpful stack trace. This tool reads the magic bytes, so it tells you:

```
notreally.xlsx
  detected: unknown
  MISMATCH: the extension says .xlsx but the bytes say unknown.
```

That is a five-second answer to a problem that otherwise costs several failed
tool calls and a wrong conclusion about "permissions" or "corruption".

## What it reports

- Real type from magic bytes: OOXML (docx/xlsx/pptx), PDF, legacy OLE2, images,
  zip, gzip, XML, JSON, CSV
- Part count for OOXML containers, and any corrupt entry
- A mismatch warning when bytes and extension disagree
- The exact skill and command to use next

## Acting on the result

| Detected | Do this |
|---|---|
| `docx` / `xlsx` / `pptx` | the matching skill's `inspect` command |
| `pdf` | `pdf` skill - `extract` or `validate` |
| `legacy Word/Excel/PowerPoint` | convert first: `libreoffice --headless --convert-to docx <file>` |
| `corrupt-zip` | `office-repair` skill - `diagnose` |
| mismatch | fix the extension or convert; do not force the wrong library |

## Related

- `office-repair` when the container is damaged
- `data-analysis` for CSV and tabular files
