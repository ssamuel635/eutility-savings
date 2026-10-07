"""Generates the blurred background images used behind page openings and navy surfaces.
Source: assets/img/sgimg.jpg (swap in any Singapore photo and re-run).

    python3 tools/make_blur_bg.py [source.jpg]
"""
import sys
from PIL import Image, ImageFilter, ImageEnhance

src_path = sys.argv[1] if len(sys.argv) > 1 else 'assets/img/sgimg.jpg'
src = Image.open(src_path).convert('RGB')
w = 1600
base = src.resize((w, int(w * src.height / src.width)), Image.LANCZOS)

light = ImageEnhance.Brightness(ImageEnhance.Color(base.filter(ImageFilter.GaussianBlur(38))).enhance(0.72)).enhance(1.12)
light.save('assets/img/bg-blur-light.jpg', quality=62, optimize=True, progressive=True)

dark = ImageEnhance.Brightness(ImageEnhance.Color(base.filter(ImageFilter.GaussianBlur(44))).enhance(0.85)).enhance(0.82)
dark.save('assets/img/bg-blur-dark.jpg', quality=62, optimize=True, progressive=True)
print('wrote assets/img/bg-blur-light.jpg and bg-blur-dark.jpg')
