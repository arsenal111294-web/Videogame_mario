#!/usr/bin/env python3
"""Рисует пиксельную иконку «Анакопиа» (крепость на горе на закате) во всех плотностях Android."""
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
SIZES = {'mdpi': 2, 'hdpi': 3, 'xhdpi': 4, 'xxhdpi': 6, 'xxxhdpi': 8}  # база 24×24


def base_icon():
    im = Image.new('RGBA', (24, 24))
    d = ImageDraw.Draw(im)
    sky = ['#7a2a3a', '#a33a3a', '#c8503a', '#e07040', '#f09050', '#f8b060', '#fcd088']
    for y in range(24):
        d.line([(0, y), (23, y)], fill=sky[min(len(sky) - 1, y * len(sky) // 20)])
    d.ellipse([2, 3, 7, 8], fill='#fff0c0')                     # солнце
    d.polygon([(0, 24), (0, 17), (5, 13), (9, 10), (12, 9), (15, 10), (19, 13), (24, 16), (24, 24)], fill='#4a2a44')
    d.polygon([(0, 24), (0, 20), (6, 18), (12, 19), (18, 18), (24, 20), (24, 24)], fill='#2e1a2e')
    # крепость
    d.rectangle([7, 7, 16, 11], fill='#b8b0a0')
    for x in (7, 9, 11, 13, 15):
        d.rectangle([x, 6, x, 6], fill='#b8b0a0')
    d.rectangle([10, 2, 13, 7], fill='#d8d0c0')
    for x in (10, 12):
        d.point((x, 1), fill='#d8d0c0')
    d.point((11, 4), fill='#2e1a2e'); d.point((12, 4), fill='#2e1a2e')
    d.rectangle([11, 9, 12, 11], fill='#2e1a2e')
    d.line([(7, 11), (16, 11)], fill='#8a8070')
    # знамя
    d.line([(13, 0), (13, 2)], fill='#5a3a1a')
    d.polygon([(14, 0), (17, 1), (14, 2)], fill='#e83020')
    # обводка
    out = Image.new('RGBA', (24, 24))
    out.paste(im, (0, 0))
    return out


def main():
    base = base_icon()
    for name, k in SIZES.items():
        folder = os.path.join(RES, 'mipmap-' + name)
        os.makedirs(folder, exist_ok=True)
        base.resize((24 * k, 24 * k), Image.NEAREST).save(os.path.join(folder, 'ic_launcher.png'))
    if len(sys.argv) > 1:  # дополнительный экспорт (например, крупная версия для README)
        base.resize((24 * 16, 24 * 16), Image.NEAREST).save(sys.argv[1])
    print('icons written to', RES)


if __name__ == '__main__':
    main()
