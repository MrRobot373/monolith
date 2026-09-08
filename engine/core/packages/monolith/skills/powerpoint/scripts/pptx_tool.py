#!/usr/bin/env python3
"""Create, edit, inspect and validate PowerPoint (.pptx) decks.

    python pptx_tool.py create   - out.pptx        < deck.json
    python pptx_tool.py edit     in.pptx out.pptx - < ops.json
    python pptx_tool.py inspect  in.pptx
    python pptx_tool.py validate in.pptx

`-` reads the JSON from stdin, so a deck is one command with no intermediate
file. Every failure prints one line naming the field at fault and exits
non-zero, so the caller can repair its own input.

EDIT MUTATES THE LOADED DECK, so the template, theme, masters and layouts all
survive. Never "edit" a deck by reading its text out and rebuilding it — that
throws away the design the user chose.
"""

import json
import sys
from pathlib import Path

try:
    from pptx import Presentation
    from pptx.util import Pt
except ImportError:
    sys.exit("error: python-pptx is not installed. Run: python -m pip install python-pptx")

MAX_BULLETS = 6


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


def open_deck(path):
    try:
        return Presentation(path)
    except Exception as exc:  # noqa: BLE001 - python-pptx raises varied exceptions
        fail(f"cannot open {path} as .pptx: {exc}")


def add_content_slide(prs, spec, label):
    if not isinstance(spec, dict):
        fail(f"{label} must be an object, got {type(spec).__name__}")
    title = spec.get("title")
    if not title:
        fail(f'{label} is missing "title"')
    bullets = spec.get("bullets") or []
    if not isinstance(bullets, list):
        fail(f'{label}["bullets"] must be a list')
    if len(bullets) > MAX_BULLETS:
        fail(f"{label} has {len(bullets)} bullets; the limit is {MAX_BULLETS}. "
             'Move detail into "notes" or split the slide.')

    slide = prs.slides.add_slide(prs.slide_layouts[1])
    slide.shapes.title.text = str(title)
    body = slide.placeholders[1].text_frame
    body.clear()
    for position, bullet in enumerate(bullets):
        para = body.paragraphs[0] if position == 0 else body.add_paragraph()
        para.text = str(bullet)
        para.level = 0
        para.font.size = Pt(20)
    if spec.get("notes"):
        slide.notes_slide.notes_text_frame.text = str(spec["notes"])
    return slide


# ---------------------------------------------------------------- create ----

def cmd_create(args):
    if len(args) != 2:
        fail("usage: create <deck.json|-> <out.pptx>")
    deck, target = read_json(args[0]), args[1]
    if not isinstance(deck, dict):
        fail("the deck must be a JSON object")
    slides = deck.get("slides")
    if not isinstance(slides, list) or not slides:
        fail('"slides" must be a non-empty list')

    prs = Presentation()
    title_slide = prs.slides.add_slide(prs.slide_layouts[0])
    title_slide.shapes.title.text = str(deck.get("title") or "Untitled")
    if deck.get("subtitle") and len(title_slide.placeholders) > 1:
        title_slide.placeholders[1].text = str(deck["subtitle"])

    for index, spec in enumerate(slides):
        add_content_slide(prs, spec, f"slides[{index}]")

    save(prs, target, f"{len(slides) + 1} slides")


# ------------------------------------------------------------------ edit ----

def iter_text_frames(slide):
    for shape in slide.shapes:
        if shape.has_text_frame:
            yield shape.text_frame


def cmd_edit(args):
    if len(args) != 3:
        fail("usage: edit <in.pptx> <out.pptx> <ops.json|->")
    source, target = args[0], args[1]
    payload = read_json(args[2])
    ops = payload.get("ops") if isinstance(payload, dict) else payload
    if not isinstance(ops, list) or not ops:
        fail('"ops" must be a non-empty list')

    prs = open_deck(source)
    applied = []
    for index, op in enumerate(ops):
        if not isinstance(op, dict):
            fail(f"ops[{index}] must be an object")
        kind = op.get("op")

        if kind == "replace":
            find, repl = op.get("find"), op.get("replace")
            if find is None or repl is None:
                fail(f'ops[{index}] "replace" needs "find" and "replace"')
            hits = 0
            for slide in prs.slides:
                for frame in iter_text_frames(slide):
                    for para in frame.paragraphs:
                        for run in para.runs:
                            if find in run.text:
                                run.text = run.text.replace(str(find), str(repl))
                                hits += 1
            if hits == 0 and op.get("required", True):
                fail(f'ops[{index}]: {find!r} not found. Run `inspect` to see the '
                     'real text, or set "required": false.')
            applied.append(f"replace x{hits}")
        elif kind == "add_slide":
            add_content_slide(prs, op, f"ops[{index}]")
            applied.append("add_slide")
        elif kind == "delete_slide":
            number = op.get("index")
            if not isinstance(number, int):
                fail(f'ops[{index}] "delete_slide" needs an integer "index"')
            slides = prs.slides._sldIdLst  # noqa: SLF001 - the only supported route
            entries = list(slides)
            if number < 0 or number >= len(entries):
                fail(f"ops[{index}]: slide {number} is out of range (0..{len(entries) - 1})")
            slides.remove(entries[number])
            applied.append(f"delete_slide {number}")
        elif kind == "set_notes":
            number = op.get("index")
            if not isinstance(number, int) or number >= len(prs.slides._sldIdLst):  # noqa: SLF001
                fail(f'ops[{index}] "set_notes" needs a valid slide "index"')
            list(prs.slides)[number].notes_slide.notes_text_frame.text = str(op.get("notes", ""))
            applied.append(f"set_notes {number}")
        else:
            fail(f"ops[{index}]: unknown op {kind!r}. Supported: replace, "
                 "add_slide, delete_slide, set_notes")

    save(prs, target, "; ".join(applied))


# --------------------------------------------------------------- inspect ----

def cmd_inspect(args):
    if len(args) != 1:
        fail("usage: inspect <in.pptx>")
    prs = open_deck(args[0])
    slides = list(prs.slides)
    print(f"slides: {len(slides)}")
    for number, slide in enumerate(slides):
        title = slide.shapes.title.text if slide.shapes.title is not None else "(no title)"
        print(f"--- [{number}] {title[:80]}")
        for frame in iter_text_frames(slide):
            for para in frame.paragraphs:
                text = para.text.strip()
                if text and text != title:
                    print(f"      - {text[:90]}")
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text.strip()
            if notes:
                print(f"      notes: {notes[:80]}")


# -------------------------------------------------------------- validate ----

def cmd_validate(args):
    if len(args) != 1:
        fail("usage: validate <in.pptx>")
    path = Path(args[0])
    if not path.exists():
        fail(f"{path} does not exist")

    import zipfile
    if not zipfile.is_zipfile(path):
        fail(f"{path} is not a zip container, so it is not a real .pptx")
    with zipfile.ZipFile(path) as archive:
        broken = archive.testzip()
        if broken:
            fail(f"corrupt entry in archive: {broken}")
        if "ppt/presentation.xml" not in archive.namelist():
            fail("missing ppt/presentation.xml — not a valid presentation")

    prs = open_deck(path)
    slides = list(prs.slides)
    print(f"valid: {path.resolve()}")
    print(f"  slides: {len(slides)}")
    for number, slide in enumerate(slides):
        if slide.shapes.title is None or not slide.shapes.title.text.strip():
            print(f"  warning: slide {number} has no title")
        for frame in iter_text_frames(slide):
            bullets = [p for p in frame.paragraphs if p.text.strip()]
            if len(bullets) > MAX_BULLETS + 1:
                print(f"  warning: slide {number} has {len(bullets)} lines in one "
                      "frame — consider splitting it")
                break


# ------------------------------------------------------------------------ --

def save(prs, target, summary):
    out = Path(target).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    try:
        prs.save(out)
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
        sys.exit(f"usage: pptx_tool.py <{'|'.join(COMMANDS)}> ...")
    COMMANDS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
