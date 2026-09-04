#!/usr/bin/env python3
"""Create, extract from, combine and validate PDF files.

    python pdf_tool.py create   - out.pdf              < doc.json
    python pdf_tool.py extract  in.pdf [--pages 1-5]
    python pdf_tool.py tables   in.pdf                 (line-oriented text dump)
    python pdf_tool.py merge    out.pdf a.pdf b.pdf ...
    python pdf_tool.py split    in.pdf outdir
    python pdf_tool.py validate in.pdf

`-` reads the JSON from stdin, so a report is one command with no intermediate
file.

A PDF is a PRINT format: it has pages, not a document flow. `extract` returns
text in reading order per page, which is the honest thing a PDF can give — it
is not a faithful .docx conversion, and scanned pages contain no text at all
(this tool says so rather than returning empty strings silently).
"""

import json
import sys
from pathlib import Path

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (ListFlowable, ListItem, PageBreak, Paragraph,
                                    SimpleDocTemplate, Spacer, Table, TableStyle)
    from reportlab.lib import colors
except ImportError:
    sys.exit("error: reportlab is not installed. Run: python -m pip install reportlab")

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    PdfReader = PdfWriter = None


def fail(message):
    sys.exit(f"error: {message}")


def need_pypdf():
    if PdfReader is None:
        fail("pypdf is not installed. Run: python -m pip install pypdf")


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


# ---------------------------------------------------------------- create ----

def cmd_create(args):
    if len(args) != 2:
        fail("usage: create <doc.json|-> <out.pdf>")
    spec, target = read_json(args[0]), args[1]
    sections = spec.get("sections") if isinstance(spec, dict) else None
    if not isinstance(sections, list) or not sections:
        fail('"sections" must be a non-empty list')

    styles = getSampleStyleSheet()
    body = ParagraphStyle("Body", parent=styles["BodyText"], spaceAfter=7, leading=15)
    out = Path(target).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(out), pagesize=A4,
        leftMargin=22 * mm, rightMargin=22 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
        title=str(spec.get("title") or "Document"),
    )

    flow = []
    if spec.get("title"):
        flow += [Paragraph(str(spec["title"]), styles["Title"])]
    if spec.get("subtitle"):
        flow += [Paragraph(str(spec["subtitle"]), styles["Italic"]), Spacer(1, 6)]

    for index, section in enumerate(sections):
        if not isinstance(section, dict):
            fail(f"sections[{index}] must be an object")
        if section.get("heading"):
            level = min(3, max(1, int(section.get("level", 1))))
            flow += [Spacer(1, 8), Paragraph(str(section["heading"]), styles[f"Heading{level}"])]
        for text in section.get("paragraphs") or []:
            flow += [Paragraph(str(text), body)]
        bullets = section.get("bullets") or []
        if bullets:
            flow += [ListFlowable(
                [ListItem(Paragraph(str(b), body)) for b in bullets],
                bulletType="bullet", leftIndent=14,
            )]
        table_spec = section.get("table")
        if table_spec:
            headers = table_spec.get("headers") or []
            if not headers:
                fail(f'sections[{index}].table needs "headers"')
            data = [[str(h) for h in headers]]
            data += [["" if c is None else str(c) for c in row]
                     for row in table_spec.get("rows") or []]
            table = Table(data, hAlign="LEFT")
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DDE5E0")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9AA8A1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
            ]))
            flow += [Spacer(1, 5), table, Spacer(1, 5)]
        if section.get("page_break"):
            flow += [PageBreak()]

    try:
        doc.build(flow)
    except Exception as exc:  # noqa: BLE001 - reportlab raises varied exceptions
        fail(f"could not build the PDF: {exc}")
    print(f"wrote {out} ({len(sections)} section(s))")


# --------------------------------------------------------------- extract ----

def parse_pages(spec, total):
    if not spec:
        return range(total)
    wanted = set()
    for chunk in str(spec).split(","):
        chunk = chunk.strip()
        if "-" in chunk:
            start, _, end = chunk.partition("-")
            try:
                wanted.update(range(int(start) - 1, int(end)))
            except ValueError:
                fail(f"bad page range {chunk!r}; use forms like 1-5 or 2,4,7")
        elif chunk:
            try:
                wanted.add(int(chunk) - 1)
            except ValueError:
                fail(f"bad page number {chunk!r}")
    return sorted(p for p in wanted if 0 <= p < total)


def cmd_extract(args):
    need_pypdf()
    pages_spec = None
    if "--pages" in args:
        at = args.index("--pages")
        pages_spec = args[at + 1] if at + 1 < len(args) else fail("--pages needs a value")
        args = args[:at] + args[at + 2:]
    if len(args) != 1:
        fail("usage: extract <in.pdf> [--pages 1-5]")

    reader = open_reader(args[0])
    wanted = parse_pages(pages_spec, len(reader.pages))
    empty = 0
    for number in wanted:
        text = (reader.pages[number].extract_text() or "").strip()
        print(f"--- page {number + 1} ---")
        if text:
            print(text)
        else:
            empty += 1
            print("(no extractable text - this page is probably a scan or pure image)")
    if empty:
        print(f"\nnote: {empty} of {len(wanted)} page(s) had no text layer. "
              "OCR would be needed to read those.")


def cmd_tables(args):
    """Dump text with line structure kept, which is what table recovery needs."""
    need_pypdf()
    if len(args) != 1:
        fail("usage: tables <in.pdf>")
    reader = open_reader(args[0])
    for number, page in enumerate(reader.pages):
        text = page.extract_text(extraction_mode="layout") or ""
        if not text.strip():
            continue
        print(f"--- page {number + 1} ---")
        for line in text.splitlines():
            if line.strip():
                print(line.rstrip())


# ----------------------------------------------------------- merge/split ----

def cmd_merge(args):
    need_pypdf()
    if len(args) < 3:
        fail("usage: merge <out.pdf> <a.pdf> <b.pdf> [...]")
    target, sources = args[0], args[1:]
    writer = PdfWriter()
    for source in sources:
        reader = open_reader(source)
        for page in reader.pages:
            writer.add_page(page)
    out = Path(target).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "wb") as handle:
        writer.write(handle)
    print(f"wrote {out} ({len(writer.pages)} pages from {len(sources)} file(s))")


def cmd_split(args):
    need_pypdf()
    if len(args) != 2:
        fail("usage: split <in.pdf> <outdir>")
    reader = open_reader(args[0])
    outdir = Path(args[1]).resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    stem = Path(args[0]).stem
    for number, page in enumerate(reader.pages, start=1):
        writer = PdfWriter()
        writer.add_page(page)
        target = outdir / f"{stem}-{number:03d}.pdf"
        with open(target, "wb") as handle:
            writer.write(handle)
    print(f"wrote {len(reader.pages)} file(s) to {outdir}")


# -------------------------------------------------------------- validate ----

def open_reader(path):
    need_pypdf()
    if not Path(path).exists():
        fail(f"{path} does not exist")
    try:
        return PdfReader(path)
    except Exception as exc:  # noqa: BLE001 - pypdf raises varied exceptions
        fail(f"cannot read {path} as a PDF: {exc}")


def cmd_validate(args):
    if len(args) != 1:
        fail("usage: validate <in.pdf>")
    path = Path(args[0])
    header = path.read_bytes()[:5] if path.exists() else b""
    if header[:4] != b"%PDF":
        fail(f"{path} does not start with %PDF, so it is not a PDF")
    reader = open_reader(path)
    if getattr(reader, "is_encrypted", False):
        print(f"warning: {path.resolve()} is encrypted; text extraction may fail")
    textless = sum(1 for page in reader.pages if not (page.extract_text() or "").strip())
    print(f"valid: {path.resolve()}")
    print(f"  pages: {len(reader.pages)}")
    if textless:
        print(f"  warning: {textless} page(s) have no text layer (scanned or image-only)")


COMMANDS = {
    "create": cmd_create,
    "extract": cmd_extract,
    "tables": cmd_tables,
    "merge": cmd_merge,
    "split": cmd_split,
    "validate": cmd_validate,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        sys.exit(f"usage: pdf_tool.py <{'|'.join(COMMANDS)}> ...")
    COMMANDS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
