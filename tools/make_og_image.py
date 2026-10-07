"""Build the 1200x630 link-preview image (Open Graph) shown when the site URL is
pasted into WhatsApp, Telegram, LinkedIn, Slack, iMessage etc.

    python3 tools/make_og_image.py

Needs static TTFs cut from the self-hosted variable fonts — pass their folder as
FONT_DIR (see the fontTools instancer snippet in DEPLOY.md), or it falls back to
PIL's default font.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'assets', 'img')
FONT_DIR = os.environ.get('FONT_DIR', '')
W, H = 1200, 630

NAVY = (22, 35, 58)
INK_SOFT = (58, 74, 99)
BLUE = (38, 100, 155)
ORANGE = (245, 124, 0)


def font(name, size):
    path = os.path.join(FONT_DIR, name)
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def cover(im, w, h):
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


# Singapore skyline on the right, fading into a warm white panel on the left —
# same idea as the site's hero: the city is there, the words are readable.
photo = cover(Image.open(os.path.join(IMG, 'sgimg.jpg')).convert('RGB'), W, H)
canvas = photo.copy()
wash = Image.new('RGB', (W, H), (250, 247, 242))
mask = Image.new('L', (W, H))
md = ImageDraw.Draw(mask)
for x in range(W):
    t = x / W
    a = 255 if t < 0.46 else max(0, int(255 * (1 - (t - 0.46) / 0.30)))
    md.line([(x, 0), (x, H)], fill=a)
canvas = Image.composite(wash, canvas, mask)

d = ImageDraw.Draw(canvas)

# logo
logo = Image.open(os.path.join(IMG, 'eutility-logo.png')).convert('RGBA')
lw = 240
logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
canvas.paste(logo, (72, 64), logo)

# headline
serif = font('newsreader-var-500.ttf', 76)
y = 196
for line in ['Stop overpaying', 'for electricity.']:
    d.text((72, y), line, font=serif, fill=NAVY)
    y += 86

# sub line
sans = font('inter-var-500.ttf', 29)
d.text((72, y + 22), 'Compare every Singapore home plan', font=sans, fill=INK_SOFT)
d.text((72, y + 60), 'in a minute. Switch on WhatsApp.', font=sans, fill=INK_SOFT)

# brand rule
d.rounded_rectangle((72, H - 72, 72 + 96, H - 66), radius=3, fill=ORANGE)
bold = font('inter-var-700.ttf', 22)
d.text((72 + 112, H - 82), 'Independent energy experts since 1979', font=bold, fill=BLUE)

out = os.path.join(IMG, 'og-image.jpg')
canvas.save(out, 'JPEG', quality=86, optimize=True, progressive=True)
print('wrote', out, os.path.getsize(out) // 1024, 'KB')
