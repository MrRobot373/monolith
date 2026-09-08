#!/usr/bin/env python3
"""Inspect and transform images for documents, decks and the web.

    python image_tool.py info      in.png
    python image_tool.py convert   in.png out.jpg [--quality 85]
    python image_tool.py resize    in.png out.png --width 1200
    python image_tool.py thumbnail in.png out.png --max 400
    python image_tool.py crop      in.png out.png --box 10,10,300,200
    python image_tool.py contact   outdir/sheet.png img1.png img2.png ...

`resize` keeps the aspect ratio: give --width or --height, not both. Squashing
an image to fit a box is a defect, not a resize.

Run `info` before converting. A PNG screenshot re-saved as JPEG at low quality
turns crisp text into mush, and the damage is not reversible.
"""

import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("error: Pillow is not installed. Run: python -m pip install Pillow")


def fail(message):
    sys.exit(f"error: {message}")


def take_flag(args, name, default=None):
    if name in args:
        at = args.index(name)
        if at + 1 >= len(args):
            fail(f"{name} needs a value")
        return args[at + 1], args[:at] + args[at + 2:]
    return default, args


def open_image(path_str):
    path = Path(path_str)
    if not path.exists():
        fail(f"{path} does not exist")
    try:
        image = Image.open(path)
        image.load()
        return image, path
    except Exception as exc:  # noqa: BLE001 - Pillow raises varied exceptions
        fail(f"cannot open {path} as an image: {exc}")


def save(image, target, quality=None):
    out = Path(target).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    suffix = out.suffix.lower()
    if suffix in (".jpg", ".jpeg") and image.mode in ("RGBA", "P", "LA"):
        # JPEG has no alpha channel; flatten onto white rather than failing.
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.convert("RGBA").split()[-1])
        image = background
    options = {}
    if suffix in (".jpg", ".jpeg"):
        options = {"quality": int(quality or 88), "optimize": True, "progressive": True}
    elif suffix == ".png":
        options = {"optimize": True}
    try:
        image.save(out, **options)
    except (OSError, ValueError) as exc:
        fail(f"cannot write {out}: {exc}")
    print(f"wrote {out} ({image.width}x{image.height}, "
          f"{out.stat().st_size / 1024:.0f} KB)")


def cmd_info(args):
    if len(args) != 1:
        fail("usage: info <image>")
    image, path = open_image(args[0])
    print(f"{path.name}")
    print(f"  size   : {image.width} x {image.height} px")
    print(f"  mode   : {image.mode}   format: {image.format}")
    print(f"  bytes  : {path.stat().st_size:,}")
    if image.width > 3000 or image.height > 3000:
        print("  note   : very large - resize before putting it in a deck or doc")
    if image.mode == "RGBA":
        print("  note   : has transparency; converting to JPEG will flatten it onto white")


def cmd_convert(args):
    quality, args = take_flag(args, "--quality")
    if len(args) != 2:
        fail("usage: convert <in> <out> [--quality 85]")
    image, _ = open_image(args[0])
    save(image, args[1], quality)


def cmd_resize(args):
    width, args = take_flag(args, "--width")
    height, args = take_flag(args, "--height")
    quality, args = take_flag(args, "--quality")
    if len(args) != 2:
        fail("usage: resize <in> <out> --width N | --height N")
    if bool(width) == bool(height):
        fail("give exactly one of --width or --height so the aspect ratio is kept")
    image, _ = open_image(args[0])
    if width:
        target_w = int(width)
        target_h = max(1, round(image.height * target_w / image.width))
    else:
        target_h = int(height)
        target_w = max(1, round(image.width * target_h / image.height))
    save(image.resize((target_w, target_h), Image.LANCZOS), args[1], quality)


def cmd_thumbnail(args):
    longest, args = take_flag(args, "--max", "400")
    if len(args) != 2:
        fail("usage: thumbnail <in> <out> [--max 400]")
    image, _ = open_image(args[0])
    copy = image.copy()
    copy.thumbnail((int(longest), int(longest)), Image.LANCZOS)
    save(copy, args[1])


def cmd_crop(args):
    box, args = take_flag(args, "--box")
    if len(args) != 2 or not box:
        fail("usage: crop <in> <out> --box left,top,right,bottom")
    try:
        left, top, right, bottom = (int(v) for v in box.split(","))
    except ValueError:
        fail("--box needs four integers: left,top,right,bottom")
    image, _ = open_image(args[0])
    if right <= left or bottom <= top:
        fail("--box must have right > left and bottom > top")
    if right > image.width or bottom > image.height:
        fail(f"--box exceeds the image ({image.width}x{image.height})")
    save(image.crop((left, top, right, bottom)), args[1])


def cmd_contact(args):
    """A single sheet of thumbnails - the fastest way to see many images at once."""
    if len(args) < 2:
        fail("usage: contact <out.png> <img> [<img> ...]")
    target, sources = args[0], args[1:]
    cell, columns = 220, min(4, len(sources))
    rows = (len(sources) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell, rows * cell), (245, 245, 245))
    for index, source in enumerate(sources):
        image, _ = open_image(source)
        tile = ImageOps.contain(image.convert("RGB"), (cell - 10, cell - 10), Image.LANCZOS)
        x = (index % columns) * cell + (cell - tile.width) // 2
        y = (index // columns) * cell + (cell - tile.height) // 2
        sheet.paste(tile, (x, y))
    save(sheet, target)


COMMANDS = {
    "info": cmd_info, "convert": cmd_convert, "resize": cmd_resize,
    "thumbnail": cmd_thumbnail, "crop": cmd_crop, "contact": cmd_contact,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        sys.exit(f"usage: image_tool.py <{'|'.join(COMMANDS)}> ...")
    COMMANDS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
