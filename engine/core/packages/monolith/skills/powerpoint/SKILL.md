---
name: powerpoint
description: Create, edit, inspect and validate PowerPoint .pptx decks. Use for any request for a presentation, slide deck, slides, or .pptx - including editing or fixing a deck the user supplies. An outline written into chat is not a deliverable.
whenToUse: The user wants a presentation file they can open in PowerPoint, Google Slides or Keynote, or wants an existing deck changed.
metadata:
  category: documents
  version: 1.0.0
  license: MIT
---

# PowerPoint decks

You produce a **file**. A slide outline pasted into chat is not a deliverable -
the user cannot open it.

One tool does everything: `{{SKILL_DIR}}/scripts/pptx_tool.py`. That path is
absolute and already correct - **use it exactly as written**. Shortening it to
`scripts/pptx_tool.py` resolves against your working directory and fails with
`No such file or directory`.

## Create a deck

```bash
python "{{SKILL_DIR}}/scripts/pptx_tool.py" create - deck.pptx <<'JSON'
{
  "title": "Artificial Intelligence",
  "subtitle": "An introduction for students",
  "slides": [
    {
      "title": "What is AI?",
      "bullets": ["Machines performing tasks that need human intelligence"],
      "notes": "Open with a show of hands: who used AI today?"
    }
  ]
}
JSON
```

Piping on stdin means no intermediate file, so nothing depends on a write tool.

## Change a deck the user gave you

**Always `inspect` first**, then edit. Editing mutates the loaded deck, so the
user's template, theme, fonts and masters survive:

```bash
python "{{SKILL_DIR}}/scripts/pptx_tool.py" inspect theirs.pptx
python "{{SKILL_DIR}}/scripts/pptx_tool.py" edit theirs.pptx out.pptx - <<'JSON'
{"ops": [
  {"op": "replace", "find": "Q3 2025", "replace": "Q1 2026"},
  {"op": "add_slide", "title": "Next steps", "bullets": ["Ship the pilot"]},
  {"op": "set_notes", "index": 2, "notes": "Pause for questions."},
  {"op": "delete_slide", "index": 7}
]}
JSON
```

**Never rebuild a deck to edit it.** Reading the text out and calling `create`
throws away the design the user chose. If `replace` reports the text was not
found, run `inspect` and match the real string - do not fall back to recreating.

## Checking a deck

`validate` confirms the file is real OOXML and warns about untitled slides and
overfull frames. Run it on anything you produce or receive.

## Rules that make a deck usable

- **6 bullets per slide maximum, ~12 words each.** The tool enforces this.
  Detail belongs in `notes`, which becomes the speaker notes.
- 10-15 slides suits a 20-minute talk.
- Write bullets as statements a presenter says aloud, not fragments.

## When something fails

The script prints one line naming the field at fault. Fix that field and re-run;
there is no partial state to clean up.

**Never end by telling the user to copy an outline into PowerPoint themselves.**
If the command genuinely cannot run, say which command you ran and paste its
exact error, then stop. Do not claim a deck is "complete" when no file exists.
Quote the absolute path the script printed.

## Related

- `docx` for prose documents, `pdf` for print-ready output
- `chart` to render a PNG to place on a slide
- `office-repair` if the user's file will not open
