#!/usr/bin/env python3
"""
Make the web copies of the site's photos.

For every JPG in assets/img/people/ this writes three WebP copies next to it:
  <name>-720.webp   for smaller phones (a 360px screen at 2x needs 720px)
  <name>-960.webp   for most phones (375-430px screens at 2-2.5x)
  <name>-1200.webp  for tablets and desktops
The JPG stays as the fallback. photos.js serves them with srcset, so each
browser downloads only the size it needs.

Run it after adding or replacing a photo:
  python tools/optimize_images.py           # only photos whose copies are missing or older
  python tools/optimize_images.py --force   # rebuild every copy

Needs Pillow (pip install pillow).
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "assets" / "img" / "people"
WIDTHS = (720, 960, 1200)
QUALITY = 80  # visually the same as the source JPGs at these sizes


def build(src: Path, force: bool) -> list[str]:
    made = []
    im = None
    for w in WIDTHS:
        out = src.with_name(f"{src.stem}-{w}.webp")
        if not force and out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            continue
        if im is None:
            im = Image.open(src).convert("RGB")
        copy = im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        copy.save(out, "WEBP", quality=QUALITY, method=6)
        made.append(f"{out.name} ({out.stat().st_size // 1024} KB)")
    return made


def main():
    force = "--force" in sys.argv
    total = 0
    for src in sorted(PHOTOS.glob("*.jpg")):
        made = build(src, force)
        total += len(made)
        if made:
            print(f"{src.name}: " + ", ".join(made))
    print(f"{total} file(s) written." if total else "All copies up to date.")


if __name__ == "__main__":
    main()
