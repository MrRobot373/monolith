#!/usr/bin/env python3
"""Identify any document or data file and say which tool handles it.

    python inspect_file.py <path> [<path> ...]
    python inspect_file.py <directory>

Reports the REAL type from magic bytes, not the extension, flags a mismatch
between the two, and names the skill to use next. Run this first whenever a
file's provenance is unknown — the commonest failure with user-supplied files
is a .xls or .csv wearing a .xlsx extension, which every OOXML library rejects
with an unhelpful error.
"""

import sys
import zipfile
from pathlib import Path

# (magic prefix, label) - checked in order, longest-first where they overlap.
MAGIC = [
    (b"%PDF", "pdf"),
    (b"PK\x03\x04", "zip-container"),
    (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "ole2-legacy-office"),
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpeg"),
    (b"GIF8", "gif"),
    (b"RIFF", "riff (webp/wav/avi)"),
    (b"\x1f\x8b", "gzip"),
    (b"{", "json-ish"),
    (b"<?xml", "xml"),
]

# Which OOXML part identifies which format once we know it is a zip.
OOXML = [
    ("word/document.xml", "docx", "docx"),
    ("xl/workbook.xml", "xlsx", "xlsx"),
    ("ppt/presentation.xml", "pptx", "powerpoint"),
]

LEGACY = {
    ".doc": ("legacy Word (.doc)", "convert first: libreoffice --headless --convert-to docx <file>"),
    ".xls": ("legacy Excel (.xls)", "convert first: libreoffice --headless --convert-to xlsx <file>"),
    ".ppt": ("legacy PowerPoint (.ppt)", "convert first: libreoffice --headless --convert-to pptx <file>"),
}

NEXT_TOOL = {
    "docx": "docx skill - docx_tool.py inspect|edit|validate",
    "xlsx": "xlsx skill - xlsx_tool.py inspect|edit|validate",
    "powerpoint": "powerpoint skill - pptx_tool.py inspect|edit|validate",
    "pdf": "pdf skill - pdf_tool.py extract|validate",
    "csv": "data-analysis skill - analyze.py profile",
    "image": "image-edit skill - image_tool.py info|convert",
}


def sniff(path):
    head = path.read_bytes()[:16]
    for prefix, label in MAGIC:
        if head.startswith(prefix):
            return label
    if head.strip()[:1] in (b"#", b"-") or b"," in head:
        return "text"
    return "unknown"


def describe_zip(path):
    """A zip may be OOXML, an epub, a jar, or just a zip."""
    try:
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
            broken = archive.testzip()
    except zipfile.BadZipFile as exc:
        return "corrupt-zip", f"the container is damaged ({exc})", None
    for part, label, skill in OOXML:
        if part in names:
            note = f"{len(names)} parts"
            if broken:
                note += f"; CORRUPT entry {broken}"
            return label, note, skill
    if "mimetype" in names:
        return "epub-or-odf", f"{len(names)} parts", None
    return "zip", f"{len(names)} entries", None


def report(path):
    if not path.exists():
        print(f"{path}: does not exist")
        return
    if path.is_dir():
        for child in sorted(path.iterdir()):
            if child.is_file():
                report(child)
        return

    size = path.stat().st_size
    ext = path.suffix.lower()
    kind = sniff(path)
    detail = ""
    skill = None

    if kind == "zip-container":
        kind, detail, skill = describe_zip(path)
    elif kind == "ole2-legacy-office":
        label, advice = LEGACY.get(ext, ("legacy OLE2 Office file", "convert with libreoffice"))
        kind, detail = label, advice
    elif kind == "pdf":
        skill = "pdf"
    elif kind in ("png", "jpeg", "gif"):
        skill = "image"
    elif kind in ("text", "json-ish") and ext in (".csv", ".tsv"):
        kind, skill = "csv", "csv"

    print(f"{path.name}")
    print(f"  size    : {size:,} bytes")
    print(f"  detected: {kind}" + (f"  ({detail})" if detail else ""))

    expected = {".docx": "docx", ".xlsx": "xlsx", ".pptx": "pptx", ".pdf": "pdf"}.get(ext)
    if expected and kind != expected:
        print(f"  MISMATCH: the extension says {ext} but the bytes say {kind}.")
        print("            Fix the extension or convert the file; OOXML libraries "
              "will reject it as-is.")
    if skill and skill in NEXT_TOOL:
        print(f"  use     : {NEXT_TOOL[skill]}")


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: inspect_file.py <path> [<path> ...]")
    for raw in sys.argv[1:]:
        report(Path(raw))


if __name__ == "__main__":
    main()
