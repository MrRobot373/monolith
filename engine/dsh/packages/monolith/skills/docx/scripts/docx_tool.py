#!/usr/bin/env python3
"""Create, edit, inspect and validate Word (.docx) documents.

    python docx_tool.py create   - out.docx      < spec.json
    python docx_tool.py edit     in.docx out.docx - < ops.json
    python docx_tool.py inspect  in.docx
    python docx_tool.py validate in.docx

`-` means "read the JSON from stdin", so a document can be produced in one
command with no intermediate file. Every failure prints one line naming the
field at fault and exits non-zero, so the caller can repair its own input.

EDIT PRESERVES FORMATTING. Edits run against the loaded document and mutate
runs in place, so fonts, styles, numbering and section setup survive. Never
"edit" by reading text out and re-creating the file — that silently discards
every style in the document.
"""

import json
import sys
from pathlib import Path

try:
    import docx
    from docx import Document
    from docx.shared import Pt
except ImportError:
    sys.exit("error: python-docx is not installed. Run: python -m pip install python-docx")


def fail(message):
    sys.exit(f"error: {message}")


def read_json(source):
    raw = sys.stdin.read() if source == "-" else None
    if raw is None:
        try:
            raw = Path(source).read_text(encoding="utf-8")
        except OSError as exc:
            fail(f"cannot read {source}: {exc}")
    if not raw.strip():
        fail("no JSON received; pipe it in on stdin or pass a file path")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        fail(f"input is not valid JSON: {exc}")


def open_doc(path):
    try:
        return Document(path)
    except Exception as exc:  # noqa: BLE001 - python-docx raises bare exceptions
        fail(f"cannot open {path} as .docx: {exc}")


# ---------------------------------------------------------------- create ----

def add_table(doc, spec, index):
    headers = spec.get("headers") or []
    rows = spec.get("rows") or []
    if not headers:
        fail(f"sections[{index}].table needs \"headers\"")
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    for cell, text in zip(table.rows[0].cells, headers):
        cell.text = str(text)
        for para in cell.paragraphs:
            for run in para.runs:
                run.bold = True
    for row in rows:
        cells = table.add_row().cells
        for cell, value in zip(cells, row):
            cell.text = "" if value is None else str(value)
    doc.add_paragraph()


def cmd_create(args):
    if len(args) != 2:
        fail("usage: create <spec.json|-> <out.docx>")
    spec, target = read_json(args[0]), args[1]
    if not isinstance(spec, dict):
        fail("the spec must be a JSON object")
    sections = spec.get("sections")
    if not isinstance(sections, list) or not sections:
        fail('"sections" must be a non-empty list')

    doc = Document()
    if spec.get("title"):
        doc.add_heading(str(spec["title"]), level=0)
    if spec.get("subtitle"):
        para = doc.add_paragraph(str(spec["subtitle"]))
        para.runs[0].italic = True

    for index, section in enumerate(sections):
        if not isinstance(section, dict):
            fail(f"sections[{index}] must be an object")
        if section.get("heading"):
            doc.add_heading(str(section["heading"]), level=int(section.get("level", 1)))
        for text in section.get("paragraphs") or []:
            doc.add_paragraph(str(text))
        for text in section.get("bullets") or []:
            doc.add_paragraph(str(text), style="List Bullet")
        for text in section.get("numbered") or []:
            doc.add_paragraph(str(text), style="List Number")
        if section.get("table"):
            add_table(doc, section["table"], index)
        if section.get("page_break"):
            doc.add_page_break()

    save(doc, target, f"{len(sections)} section(s)")


# ------------------------------------------------------------------ edit ----

def replace_everywhere(doc, find, repl):
    """Replace across runs without dropping run-level formatting.

    A run is the unit that carries formatting, so text is replaced inside each
    run that contains it. Text split across runs by Word's own chunking is
    handled by falling back to a paragraph-level rewrite that keeps the FIRST
    run's formatting — the closest faithful result available.
    """
    count = 0
    targets = list(doc.paragraphs)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                targets.extend(cell.paragraphs)

    for para in targets:
        if find not in para.text:
            continue
        handled = False
        for run in para.runs:
            if find in run.text:
                run.text = run.text.replace(find, repl)
                handled = True
                count += 1
        if not handled and para.runs:
            para.runs[0].text = para.text.replace(find, repl)
            for run in para.runs[1:]:
                run.text = ""
            count += 1
    return count


def cmd_edit(args):
    if len(args) != 3:
        fail("usage: edit <in.docx> <out.docx> <ops.json|->")
    source, target = args[0], args[1]
    payload = read_json(args[2])
    ops = payload.get("ops") if isinstance(payload, dict) else payload
    if not isinstance(ops, list) or not ops:
        fail('"ops" must be a non-empty list')

    doc = open_doc(source)
    applied = []
    for index, op in enumerate(ops):
        if not isinstance(op, dict):
            fail(f"ops[{index}] must be an object")
        kind = op.get("op")
        if kind == "replace":
            if "find" not in op or "replace" not in op:
                fail(f'ops[{index}] "replace" needs "find" and "replace"')
            hits = replace_everywhere(doc, str(op["find"]), str(op["replace"]))
            if hits == 0 and op.get("required", True):
                fail(f'ops[{index}]: {op["find"]!r} not found. '
                     'Run `inspect` to see the real text, or set "required": false.')
            applied.append(f"replace x{hits}")
        elif kind == "append_paragraph":
            doc.add_paragraph(str(op.get("text", "")), style=op.get("style") or None)
            applied.append("append_paragraph")
        elif kind == "append_heading":
            doc.add_heading(str(op.get("text", "")), level=int(op.get("level", 1)))
            applied.append("append_heading")
        elif kind == "append_bullets":
            for text in op.get("items") or []:
                doc.add_paragraph(str(text), style="List Bullet")
            applied.append("append_bullets")
        elif kind == "page_break":
            doc.add_page_break()
            applied.append("page_break")
        else:
            fail(f"ops[{index}]: unknown op {kind!r}. "
                 "Supported: replace, append_paragraph, append_heading, "
                 "append_bullets, page_break")

    save(doc, target, "; ".join(applied))


# --------------------------------------------------------------- inspect ----

def cmd_inspect(args):
    if len(args) != 1:
        fail("usage: inspect <in.docx>")
    doc = open_doc(args[0])
    print(f"paragraphs: {len(doc.paragraphs)}  tables: {len(doc.tables)}")
    print("--- outline ---")
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        style = para.style.name if para.style is not None else ""
        if style.startswith("Heading") or style == "Title":
            print(f"  [{style}] {text[:90]}")
    print("--- first lines ---")
    shown = 0
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            print(f"  {text[:110]}")
            shown += 1
        if shown >= 15:
            break
    for number, table in enumerate(doc.tables):
        header = [cell.text for cell in table.rows[0].cells] if table.rows else []
        print(f"--- table {number}: {len(table.rows)}x{len(table.columns)} {header}")


# -------------------------------------------------------------- validate ----

def cmd_validate(args):
    if len(args) != 1:
        fail("usage: validate <in.docx>")
    path = Path(args[0])
    if not path.exists():
        fail(f"{path} does not exist")

    import zipfile
    if not zipfile.is_zipfile(path):
        fail(f"{path} is not a zip container, so it is not a real .docx "
             "(a file renamed to .docx will do this)")
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        broken = archive.testzip()
        if broken:
            fail(f"corrupt entry in archive: {broken}")
        required = ["[Content_Types].xml", "word/document.xml"]
        missing = [name for name in required if name not in names]
        if missing:
            fail(f"missing required part(s): {', '.join(missing)}")

    doc = open_doc(path)
    print(f"valid: {path.resolve()}")
    print(f"  parts: {len(names)}  paragraphs: {len(doc.paragraphs)}  tables: {len(doc.tables)}")


# ------------------------------------------------------------------------ --

def save(doc, target, summary):
    out = Path(target).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    try:
        doc.save(out)
    except OSError as exc:
        fail(f"cannot write {out}: {exc}")
    print(f"wrote {out} ({summary})")


COMMANDS = {
    "create": cmd_create,
    "edit": cmd_edit,
    "inspect": cmd_inspect,
    "validate": cmd_validate,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        sys.exit(f"usage: docx_tool.py <{'|'.join(COMMANDS)}> ...")
    COMMANDS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
