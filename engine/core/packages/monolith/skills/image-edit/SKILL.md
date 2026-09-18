---
name: image-edit
description: Inspect and transform images for documents, decks and the web - resize, convert, crop, thumbnail, contact sheet. Keeps aspect ratio and handles transparency correctly.
whenToUse: An image needs resizing, converting or checking before it goes into a deliverable.
metadata:
  category: data
  version: 1.0.0
  license: MIT
---

# Images

```bash
python "{{SKILL_DIR}}/scripts/image_tool.py" info photo.png
python "{{SKILL_DIR}}/scripts/image_tool.py" resize photo.png web.png --width 1200
```

That path is absolute and already correct - **use it exactly as written**.

## Run `info` first

It reports dimensions, mode, format and size, and warns about the two things
that ruin images silently:

- **Very large images** bloat a deck or document for no visible gain.
- **Transparency**: an RGBA PNG converted to JPEG gets flattened onto white.
  If the image was meant to sit on a coloured background, that is a defect.

## Commands

| Command | Use |
|---|---|
| `info <in>` | dimensions, mode, size, warnings |
| `convert <in> <out> [--quality 85]` | change format |
| `resize <in> <out> --width N` | scale, aspect ratio kept |
| `thumbnail <in> <out> [--max 400]` | fit inside a box |
| `crop <in> <out> --box l,t,r,b` | cut a region |
| `contact <sheet.png> <img> ...` | one sheet of thumbnails to see many at once |

## Aspect ratio is not negotiable

`resize` takes `--width` **or** `--height`, never both - squashing an image to
fit a box is a defect, not a resize. Crop instead if the shape must change.

## Format choice

| Content | Format |
|---|---|
| Screenshots, diagrams, text, logos | PNG - lossless, crisp edges |
| Photographs | JPEG at quality 82-88 |
| Anything needing transparency | PNG |

Never re-save a PNG screenshot as low-quality JPEG. Text turns to mush and the
damage cannot be undone.

## Related

- `chart` to generate a chart image
- `powerpoint`, `docx`, `pdf` to place the result
