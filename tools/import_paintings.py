#!/usr/bin/env python3
"""Импорт рисованных фонов и портретов (сгенерированы в Figma) в game/assets/paint/.

Запуск: python3 tools/import_paintings.py <папка с PNG>
Ожидаемые файлы: coast, gorge, forest, fortress, cave, camp, rain, tower, gates, title (.png, 16:9)
и p_astamur, p_amra, p_narrator, p_leon, p_daur, p_marwan, p_master, p_abnauaiu (.png, квадрат).
Обновляет game/assets/manifest.js (раздел paint).
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'game', 'assets')
CACHE = os.path.join(OUT, 'manifest.json.cache')
BG = ['coast', 'gorge', 'forest', 'fortress', 'cave', 'camp', 'rain', 'tower', 'gates']
PORTRAITS = ['astamur', 'amra', 'narrator', 'leon', 'daur', 'marwan', 'master', 'abnauaiu']


def trim_dark_bottom(im, thresh=14):
    """Срезает почти чёрную полосу снизу (генератор иногда оставляет пустую плашку)."""
    g = im.convert('L')
    w, h = g.size
    y = h - 1
    while y > h * 0.55:
        row = g.crop((0, y, w, y + 1)).resize((1, 1), Image.BOX).getpixel((0, 0))
        if row > thresh:
            break
        y -= 1
    if y < h - 4:
        im = im.crop((0, 0, w, y + 1))
        # вернуть пропорцию 16:9 обрезкой по ширине
        nw = int((y + 1) * 16 / 9)
        x0 = (w - nw) // 2
        im = im.crop((x0, 0, x0 + nw, y + 1))
    return im


def main():
    src = sys.argv[1]
    os.makedirs(os.path.join(OUT, 'paint'), exist_ok=True)
    man = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    paint = {'bg': {}, 'portraits': {}}
    for n in BG + ['title']:
        p = os.path.join(src, n + '.png')
        if not os.path.exists(p):
            continue
        im = trim_dark_bottom(Image.open(p).convert('RGB'))
        im = im.resize((1280, 720), Image.LANCZOS)
        rel = f'paint/{n}.webp'
        im.save(os.path.join(OUT, rel), 'WEBP', quality=82, method=6)
        if n == 'title':
            paint['title'] = rel
        else:
            paint['bg'][n] = rel
        print(n, os.path.getsize(os.path.join(OUT, rel)) // 1024, 'KB')
    for n in PORTRAITS:
        p = os.path.join(src, 'p_' + n + '.png')
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGB')
        w, h = im.size
        if n == 'abnauaiu':  # внизу у картинки лишняя рамка — берём верхнюю часть
            s = int(h * 0.74)
            im = im.crop(((w - s) // 2, 0, (w - s) // 2 + s, s))
        im = im.resize((256, 256), Image.LANCZOS)
        rel = f'paint/p_{n}.webp'
        im.save(os.path.join(OUT, rel), 'WEBP', quality=85, method=6)
        paint['portraits'][n] = rel
    man['paint'] = paint
    json.dump(man, open(CACHE, 'w'), ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, 'manifest.js'), 'w') as f:
        f.write('/* Создано tools/blender/build_assets.py и tools/import_paintings.py */\n')
        f.write('window.ANAKOPIA_ASSETS = ' + json.dumps(man, ensure_ascii=False) + ';\n')
    print('portraits:', ', '.join(paint['portraits']))


if __name__ == '__main__':
    main()
