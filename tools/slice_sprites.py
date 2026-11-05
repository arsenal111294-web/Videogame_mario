#!/usr/bin/env python3
"""Нарезка рисованных спрайт-листов (персонаж в N позах на пурпурном фоне) в атласы игры.

python3 tools/slice_sprites.py <лист.png> <имя> <кадры через запятую> <ячейка ШxВ> <высота персонажа> [--ox N --oy N --foot N]
Фон #FF00FF вырезается, кадры находятся как связные области по столбцам, масштабируются одинаково
(по высоте первого кадра), выравниваются по ногам и центру нижней части силуэта.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'game', 'assets')
CACHE = os.path.join(OUT, 'manifest.json.cache')
K = 4  # пикселей на игровую единицу (совпадает с G.RES)
OUTLINE = (30, 20, 26)


def key_magenta(im):
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.minimum(r, b) - g                      # «пурпурность»
    alpha = np.clip(1 - (m - 30) / 45, 0, 1)      # m<30 — персонаж, m>75 — фон
    k = np.clip((m - 20) / 60, 0, 1) * 0.8         # подавление пурпурной каймы
    a[..., 0] = r - (r - g) * k
    a[..., 2] = b - (b - g) * k
    a[..., 3] = alpha * 255
    return a.astype(np.uint8)


def slots(mask, n):
    """Разрезы между n фигурами: минимумы плотности около равномерных границ."""
    cols = mask.sum(axis=0)
    xs = np.where(cols > 0)[0]
    x0, x1 = xs[0], xs[-1]
    step = (x1 - x0) / n
    cuts = [x0]
    for i in range(1, n):
        c = x0 + i * step
        lo, hi = int(c - step * 0.38), int(c + step * 0.38)
        win = cols[lo:hi]
        cuts.append(lo + int(np.argmin(win + np.linspace(0, 0.01, len(win)))))
    cuts.append(x1 + 1)
    return list(zip(cuts[:-1], cuts[1:]))


def figure(arr, x0, x1):
    """Фигура в полосе [x0,x1): крупнейшая связная область и её детали, без обрывков соседей."""
    sub = arr[:, x0:x1]
    mask = sub[..., 3] > 110
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return None
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    big = int(np.argmax(sizes)) + 1
    ys, xs = np.where(lab == big)
    by0, by1, bx0, bx1 = ys.min(), ys.max(), xs.min(), xs.max()
    keep = np.zeros_like(mask)
    for i in range(1, n + 1):
        if sizes[i - 1] < sizes[big - 1] * 0.015:
            continue
        yy, xx = np.where(lab == i)
        cy, cx = yy.mean(), xx.mean()
        inside = bx0 <= cx <= bx1 and by0 <= cy <= by1 and xx.min() > 1 and xx.max() < mask.shape[1] - 2
        if i == big or inside:
            keep |= lab == i
    keep = ndimage.binary_dilation(keep, iterations=2)
    out = sub.copy()
    out[..., 3] = np.where(keep, out[..., 3], 0)
    ys, xs = np.where(out[..., 3] > 40)
    return Image.fromarray(out[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('name')
    ap.add_argument('frames')
    ap.add_argument('cell')
    ap.add_argument('height', type=float, help='высота персонажа в игровых единицах')
    ap.add_argument('--ox', type=float, default=-4)
    ap.add_argument('--oy', type=float, default=-4)
    ap.add_argument('--foot', type=float, default=1, help='отступ ног от низа ячейки, ед.')
    ap.add_argument('--flip', default='', help='номера кадров, которые надо отразить (через запятую)')
    ap.add_argument('--skip', default='', help='номера найденных областей, которые пропустить')
    ap.add_argument('--fitw', type=float, default=0, help='масштаб по ширине первого кадра (ед.) вместо высоты')
    ap.add_argument('--alias', default='', help='доп. кадры: новое=старое[~], через запятую (~ — отразить)')
    a = ap.parse_args()
    names = a.frames.split(',')
    cw, ch = [float(v) for v in a.cell.split('x')]
    arr = key_magenta(Image.open(a.sheet))
    n_total = len(names) + len([v for v in a.skip.split(',') if v])
    sl = slots(arr[..., 3] > 110, n_total)
    skip = {int(v) for v in a.skip.split(',') if v}
    sl = [s_ for i, s_ in enumerate(sl) if i not in skip]
    print('полосы:', sl)
    crops = [figure(arr, x0, x1) for x0, x1 in sl[:len(names)]]
    crops = [c for c in crops if c is not None]
    if len(crops) < len(names):
        raise SystemExit('мало кадров: %d < %d' % (len(crops), len(names)))
    base_h = crops[0].height
    scale = a.height * K / base_h if not a.fitw else a.fitw * K / crops[0].width
    flips = {int(v) for v in a.flip.split(',') if v}
    W, H = int(cw * K), int(ch * K)
    frames = []
    for i, c in enumerate(crops[:len(names)]):
        if i in flips:
            c = c.transpose(Image.FLIP_LEFT_RIGHT)
        c = c.resize((max(1, round(c.width * scale)), max(1, round(c.height * scale))), Image.LANCZOS)
        # якорь по X — центр нижней четверти силуэта (ноги)
        al = c.split()[3]
        low = al.crop((0, int(c.height * 0.75), c.width, c.height)).point(lambda v: 255 if v > 60 else 0)
        lb = low.getbbox() or (0, 0, c.width, 1)
        anchor = (lb[0] + lb[2]) / 2
        dx = int(round(W / 2 - anchor))
        dy = int(round(H - a.foot * K - c.height))
        frame = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        frame.paste(c, (dx, dy), c)
        # тонкий тёмный контур
        big = frame.split()[3].filter(ImageFilter.MaxFilter(3)).point(lambda v: 255 if v > 90 else 0)
        o = Image.new('RGBA', frame.size, OUTLINE + (0,))
        o.putalpha(big)
        o.alpha_composite(frame)
        frames.append(o)
    pref = names[0].rsplit('_', 1)[0] + '_' if '_' in names[0] else ''
    for al in [v for v in a.alias.split(',') if v]:
        new, old = al.split('=')
        fl = old.endswith('~')
        old = old.rstrip('~')
        src = frames[names.index(pref + old)]
        frames.append(src.transpose(Image.FLIP_LEFT_RIGHT) if fl else src)
        names.append(pref + new)
    sheet = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
    for i, o in enumerate(frames):
        sheet.paste(o, (i * W, 0))
    os.makedirs(os.path.join(OUT, 'paint'), exist_ok=True)
    rel = f'paint/spr_{a.name}.webp'
    sheet.save(os.path.join(OUT, rel), 'WEBP', lossless=True, method=6)
    man = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    man.setdefault('paint', {}).setdefault('atlases', {})[a.name] = dict(file=rel, cell=[cw, ch], k=K, ox=a.ox, oy=a.oy, names=names)
    json.dump(man, open(CACHE, 'w'), ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, 'manifest.js'), 'w') as f:
        f.write('/* Создано tools/blender/build_assets.py, tools/import_paintings.py, tools/slice_sprites.py */\n')
        f.write('window.ANAKOPIA_ASSETS = ' + json.dumps(man, ensure_ascii=False) + ';\n')
    print('OK', rel, sheet.size)


if __name__ == '__main__':
    main()
