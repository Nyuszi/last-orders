"""Cut a portrait off a flat magenta (#FF00FF) background and save it for the game.

Usage: python3 -I art/cutout.py <input image> <output .webp> [height=300]

Every magenta pixel goes, including ones seen through glass, so a glass someone is holding
stays see-through. Pink fringe that JPEG compression leaves along edges is trimmed too,
but only where it touches the removed background, so pinks and mauves inside the picture
(cheeks, a feather, a dress) are kept.
"""
import sys
from PIL import Image


def is_key(r, g, b):
    # Strong magenta: red and blue both high, green low.
    return r > 140 and b > 140 and g < 120 and abs(r - b) < 100 and (r + b) / 2 - g > 80


def main(src, dst, height=300):
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    p = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = p[x, y]
            if is_key(r, g, b):
                p[x, y] = (0, 0, 0, 0)
    # Fringe: up to two passes over pixels touching transparency that still lean magenta.
    for _ in range(2):
        kill = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                r, g, b, a = p[x, y]
                if a == 0:
                    continue
                if any(p[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and (r + b) / 2 - g > 55 and b > 90:
                    kill.append((x, y))
        for x, y in kill:
            p[x, y] = (0, 0, 0, 0)
    im = im.crop(im.getbbox())
    out = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    out.save(dst, 'WEBP', quality=88, method=6)
    preview = Image.new('RGBA', out.size, (43, 26, 18, 255))
    preview.alpha_composite(out)
    preview.convert('RGB').save(dst.rsplit('.', 1)[0] + '-preview.png')
    print(dst, out.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 300)
