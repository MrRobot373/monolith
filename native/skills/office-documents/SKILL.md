---
name: Office Documents
description: Read, edit, analyze, write, generate, and manage Excel (.xlsx), Word (.docx), PDF, and PowerPoint (.pptx) files using Python.
---

# Office Documents Processing Skill

You are equipped with the capability to process, analyze, and generate Office documents dynamically using Python shell commands. When the user asks you to read, analyze, generate, edit, format, or manage Excel, Word, PDF, or PowerPoint files, **DO NOT** attempt to read the raw binary file directly. Instead, write and execute a Python script to perform the task.

## Python Environment & Dependencies

Before running your scripts, ensure the necessary libraries are installed. You can install them by running:
```powershell
pip install pandas openpyxl python-docx PyPDF2 pdfplumber python-pptx
```

## Supported Formats & Recommended Libraries

### 1. Excel Files (`.xlsx`, `.xls`, `.csv`)
**Library:** `pandas`, `openpyxl`
**Usage:**
- Use `pandas` for data analysis, aggregations, and tabular manipulations.
- Use `openpyxl` if you need to modify specific cells, styles, or formatting without changing the whole dataframe.
**Example snippet (Reading Excel):**
```python
import pandas as pd
df = pd.read_excel("path/to/file.xlsx", sheet_name=0)
print(df.head())
print(df.info())
```

### 2. Word Documents (`.docx`)
**Library:** `python-docx`
**Usage:**
- Use to read text, headings, and paragraphs.
- Use to generate new documents, add tables, or edit existing `.docx` files.
**Example snippet (Reading Word):**
```python
import docx
doc = docx.Document("path/to/file.docx")
for i, para in enumerate(doc.paragraphs):
    if para.text.strip():
        print(f"Para {i}: {para.text}")
```

### 3. PDF Files (`.pdf`)
**Library:** `PyPDF2` (for basic text/pages) or `pdfplumber` (for tables/layouts)
**Usage:**
- Extract text and metadata. Note that PDF is a static format; if the user wants to "edit" a PDF, you may need to extract the text, modify it, and write it to a new format like Word, or use specialized PDF writing tools.
**Example snippet (Reading PDF):**
```python
import PyPDF2
with open("path/to/file.pdf", "rb") as file:
    reader = PyPDF2.PdfReader(file)
    print(f"Total pages: {len(reader.pages)}")
    print(reader.pages[0].extract_text())
```

### 4. PowerPoint Presentations (`.pptx`)
**Library:** `python-pptx`
**Usage:**
- Read slide text, extract shapes.
- Generate new presentations, add slides, images, and text boxes.
**Example snippet (Reading PPTX):**
```python
from pptx import Presentation
prs = Presentation("path/to/file.pptx")
for i, slide in enumerate(prs.slides):
    print(f"--- Slide {i+1} ---")
    for shape in slide.shapes:
        if hasattr(shape, "text"):
            print(shape.text)
```

## Best Practices

1. **One-Off Scripts:** Write your python script to a temporary file (e.g., `temp_analyze.py`) in the workspace, run it using the shell tool (`python temp_analyze.py`), and then you can read its output from the console.
2. **Chunking Large Data:** For large Excel files, avoid printing the entire dataframe to the console. Print summaries (`df.describe()`, `df.head(20)`), value counts, or specific queries requested by the user.
3. **Paths:** Always use absolute paths or paths relative to the current workspace root when writing your python scripts. Ensure you escape backslashes correctly on Windows (`C:\\path\\to\\file`).
4. **Error Handling:** Include basic try-except blocks in your scripts to catch `FileNotFoundError` or parsing errors and print meaningful messages so you can debug and retry if necessary.
