#!/usr/bin/env python3
"""Recover data from damaged .docx / .xlsx / .pptx files.

    python repair_office.py diagnose in.docx
    python repair_office.py rezip    in.docx out.docx
    python repair_office.py text     in.docx
    python repair_office.py sheets   in.xlsx outdir

Order of attack, cheapest first:

  1. `diagnose` - say precisely what is wrong before changing anything.
  2. `text` / `sheets` - get the CONTENT out. Often this is all anyone needs,
     and it works on files no library will open.
  3. `rezip` - rebuild the container, dropping unreadable parts. This produces
     a file that opens, at the cost of whatever was in those parts.

Never start with `rezip`. Recovering content you can verify beats producing a
file that opens but has silently lost a section.
"""

import re
import shutil
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

MAIN_PART = {
    ".docx": "word/document.xml",
    ".xlsx": "xl/workbook.xml",
    ".pptx": "ppt/presentation.xml",
}


def fail(message):
    sys.exit(f"error: {message}")


def require(path):
    p = Path(path)
    if not p.exists():
        fail(f"{p} does not exist")
    return p


def strip_tags(xml_bytes):
    """Pull readable text out of OOXML even when the XML will not parse.

    Tries a real parse first (correct paragraph boundaries); falls back to a
    tag strip, which is lossy on ordering but survives malformed XML.
    """
    try:
        root = ET.fromstring(xml_bytes)
        texts = [node.text for node in root.iter() if node.tag.endswith("}t") and node.text]
        if texts:
            return "\n".join(texts)
    except ET.ParseError:
        pass
    text = re.sub(rb"<[^>]+>", b" ", xml_bytes).decode("utf-8", "replace")
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def cmd_diagnose(args):
    if len(args) != 1:
        fail("usage: diagnose <file>")
    path = require(args[0])
    print(f"file: {path.resolve()}  ({path.stat().st_size:,} bytes)")

    head = path.read_bytes()[:4]
    if head != b"PK\x03\x04":
        if head[:4] == b"%PDF":
            fail("this is a PDF, not an Office file - use the pdf skill")
        if head.startswith(b"\xd0\xcf\x11\xe0"):
            fail("this is a legacy OLE2 file (.doc/.xls/.ppt). Convert it: "
                 "libreoffice --headless --convert-to docx <file>")
        fail("not a zip container - the file is truncated, encrypted, or not "
             "an Office file at all")

    try:
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            broken = archive.testzip()
            print(f"  parts: {len(names)}")
            if broken:
                print(f"  CORRUPT entry: {broken}")
            expected = MAIN_PART.get(path.suffix.lower())
            if expected and expected not in names:
                print(f"  MISSING main part: {expected}")
                print("  -> content may still be recoverable with `text`")
            bad = []
            for name in names:
                if not name.endswith(".xml"):
                    continue
                try:
                    ET.fromstring(archive.read(name))
                except (ET.ParseError, KeyError, zipfile.BadZipFile):
                    bad.append(name)
            if bad:
                print(f"  malformed XML in {len(bad)} part(s): {', '.join(bad[:5])}")
            if not broken and not bad:
                print("  container and XML parse cleanly - if it still will not "
                      "open, the problem is application-level, not structural")
    except zipfile.BadZipFile as exc:
        print(f"  container is damaged: {exc}")
        print("  -> try `rezip`")


def cmd_text(args):
    if len(args) != 1:
        fail("usage: text <file>")
    path = require(args[0])
    wanted = {
        ".docx": ["word/document.xml"],
        ".pptx": None,   # every slide
        ".xlsx": ["xl/sharedStrings.xml"],
    }.get(path.suffix.lower(), ["word/document.xml"])

    try:
        archive = zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        fail(f"cannot open the container ({exc}); try `rezip` first")

    with archive:
        names = archive.namelist()
        if wanted is None:
            wanted = sorted(n for n in names if re.match(r"ppt/slides/slide\d+\.xml$", n))
        found = False
        for name in wanted:
            if name not in names:
                continue
            found = True
            print(f"--- {name} ---")
            print(strip_tags(archive.read(name)))
        if not found:
            fail(f"none of the expected parts are present. Parts: {', '.join(names[:12])}")


def cmd_sheets(args):
    if len(args) != 2:
        fail("usage: sheets <in.xlsx> <outdir>")
    path = require(args[0])
    outdir = Path(args[1]).resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    try:
        from openpyxl import load_workbook
    except ImportError:
        fail("openpyxl is not installed. Run: python -m pip install openpyxl")
    import csv

    try:
        book = load_workbook(path, data_only=True, read_only=True)
    except Exception as exc:  # noqa: BLE001
        fail(f"openpyxl cannot open it ({exc}); try `text` or `rezip`")

    written = 0
    for sheet in book.worksheets:
        target = outdir / f"{sheet.title}.csv"
        with open(target, "w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            for row in sheet.iter_rows(values_only=True):
                writer.writerow(["" if v is None else v for v in row])
        written += 1
        print(f"wrote {target}")
    print(f"{written} sheet(s) recovered to {outdir}")


def cmd_rezip(args):
    if len(args) != 2:
        fail("usage: rezip <in> <out>")
    path = require(args[0])
    out = Path(args[1]).resolve()
    if out == path.resolve():
        fail("refusing to overwrite the damaged original; choose a new output path")
    out.parent.mkdir(parents=True, exist_ok=True)

    kept, dropped = 0, []
    try:
        source = zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        fail(f"the container cannot be opened at all ({exc}). "
             "Nothing to rebuild from - restore from a backup.")
    with source, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as target:
        for info in source.infolist():
            try:
                target.writestr(info, source.read(info.filename))
                kept += 1
            except (zipfile.BadZipFile, RuntimeError, OSError) as exc:
                dropped.append(f"{info.filename} ({exc})")

    print(f"wrote {out}")
    print(f"  kept {kept} part(s)")
    if dropped:
        print(f"  DROPPED {len(dropped)} unreadable part(s):")
        for item in dropped:
            print(f"    {item}")
        print("  Open the result and check for missing content before trusting it.")
    else:
        print("  no parts were dropped - the container was simply badly written")


COMMANDS = {
    "diagnose": cmd_diagnose,
    "text": cmd_text,
    "sheets": cmd_sheets,
    "rezip": cmd_rezip,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        sys.exit(f"usage: repair_office.py <{'|'.join(COMMANDS)}> ...")
    COMMANDS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
