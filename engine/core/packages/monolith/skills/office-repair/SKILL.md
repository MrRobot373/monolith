---
name: office-repair
description: Diagnose and recover damaged or unopenable Word, Excel and PowerPoint files - corrupt containers, malformed XML, truncated downloads. Recovers text and sheet data even from files no library will open.
whenToUse: A .docx, .xlsx or .pptx will not open, or a document tool failed with a container or XML error.
metadata:
  category: documents
  version: 1.0.0
  license: MIT
---

# Recover a damaged Office file

```bash
python "{{SKILL_DIR}}/scripts/repair_office.py" diagnose broken.docx
```

That path is absolute and already correct - **use it exactly as written**.

## Work in this order

Cheapest and least destructive first. Do not skip ahead.

| Step | Command | Gets you |
|---|---|---|
| 1 | `diagnose <file>` | precisely what is wrong, changing nothing |
| 2 | `text <file>` | the readable content, even from a file that will not open |
| 3 | `sheets <file> <outdir>` | every worksheet as CSV |
| 4 | `rezip <in> <out>` | a file that opens, minus any unreadable parts |

**Never start with `rezip`.** Recovering content you can verify beats producing
a file that opens but has silently lost a section - and the user will not know
which section.

## Reading the diagnosis

| Message | Meaning | Next |
|---|---|---|
| `not a zip container` | not an Office file, or truncated | `office-inspect` to identify it |
| `legacy OLE2` | a real `.doc`/`.xls`/`.ppt` | convert with libreoffice |
| `CORRUPT entry: <part>` | one part unreadable | `text` first, then `rezip` |
| `MISSING main part` | the document body is gone | `text` may still find fragments |
| `malformed XML in N parts` | structure damaged | `text`, then `rezip` |
| `parses cleanly` | structurally fine | the problem is application-level, not the file |

## After a rezip

The output lists every dropped part. **Say which parts were dropped when you
report back** - "recovered, but the styles and one image were lost" is a
truthful result; "fixed" is not.

## What this cannot do

- Encrypted or password-protected files - no password, no recovery
- Files truncated so badly the zip directory is gone; `diagnose` says so
- Scanned PDFs - that is OCR, not repair

Say so plainly rather than producing an empty file and calling it recovered.

## Related

- `office-inspect` to identify the file first
- `docx` / `xlsx` / `powerpoint` once the file opens again
