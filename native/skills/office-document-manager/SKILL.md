---
name: office-document-manager
description: Read, write, create, edit, format, check, and manage Microsoft Office files (.xlsx, .docx, .pptx) and PDF files (.pdf) using Python tools in the terminal. Use whenever the user asks to manipulate, read, generate, or test these document types.
---

# Office Document Manager Skill

This skill provides a unified command line tool `office_manager.py` that allows you to inspect, read, generate, or edit Excel, Word, PDF, and PowerPoint documents.

Run the tool via the Bash/CMD tool:

## 1. Inspect File Structure (`info`)
Retrieve details about worksheets, word paragraph counts, PDF metadata, or PowerPoint slide counts:
```bash
python .opencode/skills/office-document-manager/office_manager.py info "<FILE_PATH>"
```
*(If `python` is not found, try `python3` instead)*

## 2. Read File Contents (`read`)
* **Excel (.xlsx):**
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py read "<FILE_PATH>" [SHEET_NAME_OR_INDEX] [MAX_ROWS]
  ```
* **Word (.docx):**
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py read "<FILE_PATH>"
  ```
* **PDF (.pdf):** Extract paragraphs and tables:
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py read "<FILE_PATH>"
  ```
* **PowerPoint (.pptx):** Extract slide text outlines:
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py read "<FILE_PATH>"
  ```

## 3. Create / Generate New Files (`create`)
Create documents using JSON data strings (or paths to JSON files).
* **Excel (.xlsx) - List of rows:**
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py create "<FILE_PATH>" "[{\"Col1\": \"Val1\", \"Col2\": \"Val2\"}, {\"Col1\": \"Val3\", \"Col2\": \"Val4\"}]"
  ```
* **Word (.docx) - Structured headings/paragraphs:**
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py create "<FILE_PATH>" "[{\"type\": \"heading\", \"level\": 1, \"text\": \"Report Title\"}, {\"type\": \"paragraph\", \"text\": \"This is standard text.\"}, {\"type\": \"table\", \"headers\": [\"Header1\", \"Header2\"], \"rows\": [[\"Cell1\", \"Cell2\"]]}]"
  ```
* **PowerPoint (.pptx) - Slides and bullets:**
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py create "<FILE_PATH>" "[{\"title\": \"Introduction\", \"bullets\": [\"First point\", \"Second point\"]}, {\"title\": \"Conclusion\", \"bullets\": [\"Final takeaways\"]}]"
  ```
* **PDF (.pdf) - PDF generation with ReportLab styling:**
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py create "<FILE_PATH>" "{\"title\": \"Report Title\", \"elements\": [{\"type\": \"heading\", \"level\": 1, \"text\": \"Section 1\"}, {\"type\": \"paragraph\", \"text\": \"Paragraph content goes here.\"}]}"
  ```

## 4. Edit Existing Files (`edit`)
Update worksheets, add slides, or append text.
* **Excel (.xlsx) - Update a cell value:**
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py edit "<FILE_PATH>" "{\"action\": \"update_cell\", \"sheet\": \"Sheet1\", \"row\": 0, \"col\": \"Col1\", \"val\": \"NewValue\"}"
  ```
* **Excel (.xlsx) - Append rows:**
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py edit "<FILE_PATH>" "{\"action\": \"append_rows\", \"sheet\": \"Sheet1\", \"rows\": [{\"Col1\": \"NewVal1\", \"Col2\": \"NewVal2\"}]}"
  ```
* **Word (.docx) - Append elements:**
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py edit "<FILE_PATH>" "{\"action\": \"append\", \"elements\": [{\"type\": \"paragraph\", \"text\": \"Appended paragraph text.\"}]}"
  ```
* **Word (.docx) - Replace text instances:**
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py edit "<FILE_PATH>" "{\"action\": \"replace\", \"old_text\": \"placeholder\", \"new_text\": \"actual value\"}"
  ```
* **PowerPoint (.pptx) - Add a slide:**
  ```bash
  python .opencode/skills/office-document-manager/office_manager.py edit "<FILE_PATH>" "{\"action\": \"add_slide\", \"title\": \"New Slide\", \"bullets\": [\"Bullet 1\", \"Bullet 2\"]}"
  ```
