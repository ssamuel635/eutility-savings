"""Generates assets/img/skyline.svg — a light, tileable Singapore skyline strip
(HDB slabs with water tanks, shophouses, a few palms) used as a soft band above
the footer and behind section edges. Single colour, set with currentColor-ish fill."""
import random
random.seed(11)
W, H = 1200, 160
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" preserveAspectRatio="none" role="presentation">']
o.append('<g fill="#26649B" fill-opacity="0.10">')
x = 0
def hdb(x, w, h):
    p = [f'<rect x="{x}" y="{H-h}" width="{w}" height="{h}" rx="2"/>']
    p.append(f'<rect x="{x+w*0.25:.0f}" y="{H-h-10}" width="{w*0.5:.0f}" height="10" rx="2"/>')  # roof tank
    rows = max(2, int(h // 22))
    cols = max(2, int(w // 18))
    for r in range(rows):
        for c in range(cols):
            if random.random() < 0.45: continue
            wx = x + 6 + c * (w - 10) / cols
            wy = H - h + 10 + r * (h - 16) / rows
            p.append(f'<rect x="{wx:.0f}" y="{wy:.0f}" width="6" height="8" fill="#fff" fill-opacity="0.75"/>')
    return ''.join(p)
def shophouse(x, w, h):
    return (f'<rect x="{x}" y="{H-h}" width="{w}" height="{h}" rx="1"/>'
            f'<path d="M{x-4} {H-h} L{x+w/2:.0f} {H-h-14} L{x+w+4} {H-h} Z"/>')
def palm(x):
    return (f'<rect x="{x}" y="{H-46}" width="4" height="46"/>'
            f'<path d="M{x+2} {H-46} q-18 -6 -24 4 q14 -2 24 2 z"/>'
            f'<path d="M{x+2} {H-46} q18 -6 24 4 q-14 -2 -24 2 z"/>'
            f'<path d="M{x+2} {H-48} q-6 -16 4 -22 q6 10 2 22 z"/>')
while x < W:
    r = random.random()
    if r < 0.6:
        w = random.randint(70, 130); h = random.randint(70, 140)
        o.append(hdb(x, w, h)); x += w + random.randint(10, 26)
    elif r < 0.85:
        w = random.randint(40, 70); h = random.randint(42, 70)
        o.append(shophouse(x, w, h)); x += w + random.randint(12, 24)
    else:
        o.append(palm(x + 8)); x += 44
o.append('</g></svg>')
open('assets/img/skyline.svg', 'w').write(''.join(o))
print('ok')
