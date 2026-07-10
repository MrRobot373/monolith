---
name: read-office-file
description: Read and analyze Microsoft Office documents (.xlsx, .docx) from the terminal. Use when the user asks to analyze, view, or read content from Excel spreadsheets or Word files.
---

# Read Office File (.xlsx, .docx)

Use this skill to view the structure, worksheets, headings, tables, or raw cell contents of Excel sheets and Word files.

Run the helper script via the Bash/CMD tool:

### 1. Get structural metadata and sheet/outline info:
```bash
python .opencode/skills/read-office-file/read_office.py info "<FILE_PATH>"
```
*(If `python` is not found, try `python3` instead)*

### 2. Read contents of the file:
* **For Word documents (.docx):**
  ```bash
  python .opencode/skills/read-office-file/read_office.py read "<FILE_PATH>"
  ```
* **For Excel sheets (.xlsx) - read default/first worksheet:**
  ```bash
  python .opencode/skills/read-office-file/read_office.py read "<FILE_PATH>"
  ```
* **For Excel sheets (.xlsx) - read a specific sheet by name or index, limiting row count:**
  ```bash
  python .opencode/skills/read-office-file/read_office.py read "<FILE_PATH>" "<SHEET_NAME_OR_INDEX>" [MAX_ROWS]
  ```

### Guidelines:
1. Always run the `info` command first on large Excel files to understand what sheets are present and see column headers.
2. Excel sheets are returned formatted as clean markdown tables, and Word document headers/tables are converted to markdown.
3. Be mindful of token limits; set a reasonable row limit (e.g. 50 or 100 rows) when reading large spreadsheets.
