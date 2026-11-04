"""Сборка всех 3D-ассетов «Анакопиа»: python3 tools/blender/build_assets.py [--force] [группы...]

Рендерит в Blender (bpy, Cycles), уменьшает с суперсэмплингом, добавляет контур,
собирает атласы WebP и пишет game/assets/manifest.js.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageChops, ImageFilter  # noqa: E402

import chars  # noqa: E402
import env  # noqa: E402
from common import OUT, TMP  # noqa: E402

FORCE = '--force' in sys.argv
GROUPS = [a for a in sys.argv[1:] if not a.startswith('--')] or ['chars', 'horses', 'beasts', 'items', 'props', 'tiles', 'bg', 'portraits']
OUTLINE = (27, 18, 24)
MAN_PATH = os.path.join(OUT, 'manifest.json.cache')
os.makedirs(OUT, exist_ok=True)
man = json.load(open(MAN_PATH)) if os.path.exists(MAN_PATH) else {}


def finish(path, ss=2, outline=True):
    im = Image.open(path).convert('RGBA')
    if ss > 1:
        im = im.resize((im.width // ss, im.height // ss), Image.LANCZOS)
    if outline:
        a = im.split()[3]
        big = a.filter(ImageFilter.MaxFilter(3)).point(lambda v: 255 if v > 70 else 0)
        out = Image.new('RGBA', im.size, OUTLINE + (0,))
        out.putalpha(big)
        out.alpha_composite(im)
        im = out
    return im


def atlas(name, frames, cell, k, ox=0, oy=0, outline=True, folder='sprites'):
    """frames: [(имя_кадра, путь)] → одна полоса WebP."""
    ims = [finish(p, outline=outline) for _n, p in frames]
    cw, ch = ims[0].size
    sheet = Image.new('RGBA', (cw * len(ims), ch), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        sheet.paste(im, (i * cw, 0))
    os.makedirs(os.path.join(OUT, folder), exist_ok=True)
    rel = f'{folder}/{name}.webp'
    sheet.save(os.path.join(OUT, rel), 'WEBP', lossless=True, quality=100, method=6)
    return dict(file=rel, cell=list(cell), k=k, ox=ox, oy=oy, names=[n for n, _p in frames])


def want(g):
    return g in GROUPS


def save_man():
    json.dump(man, open(MAN_PATH, 'w'), ensure_ascii=False, indent=1)


t0 = time.time()
K = 3
man.setdefault('atlases', {})

if want('chars'):
    for name in ('astamur', 'amra'):
        fs = chars.render_human(name, chars.HERO_FRAMES, tmp=TMP)
        man['atlases'][name] = atlas(name, [(f'{name}_{f}', p) for f, p in zip(chars.HERO_FRAMES, fs)], (24, 20), K, -4, -4)
        print(name, round(time.time() - t0), 's'); save_man()
    for name in ('soldier', 'spear', 'archer', 'shield', 'guard', 'leon', 'daur'):
        fs = chars.render_human(name, chars.ENEMY_FRAMES, tmp=TMP)
        man['atlases'][name] = atlas(name, [(f'{name}_{f}', p) for f, p in zip(chars.ENEMY_FRAMES, fs)], (24, 20), K, -4, -4)
        print(name, round(time.time() - t0), 's'); save_man()
    for name in ('master', 'marwan'):
        fr = chars.ENEMY_FRAMES
        fs = chars.render_human(name, fr, cell=(48, 40), scale=2.0, foot=2.0, tmp=TMP)
        man['atlases'][name] = atlas(name, [(f'{name}_{f}', p) for f, p in zip(fr, fs)], (48, 40), K, -8, -8)
        print(name, round(time.time() - t0), 's'); save_man()

if want('horses'):
    hf = chars.render_horses(TMP)
    man['atlases']['rider'] = atlas('rider', [(n, hf[n]) for n in ('rider_a', 'rider_b', 'rider_c', 'rider_stand', 'rider_attack')], (32, 28), K, -4, -12)
    man['atlases']['horse'] = atlas('horse', [(n, hf[n]) for n in ('horse_a', 'horse_b', 'horse_c', 'horse_stand')], (32, 28), K, -4, -12)
    man['atlases']['marwanhorse'] = atlas('marwanhorse', [(n, hf[n]) for n in ('marwanhorse_a', 'marwanhorse_b', 'marwanhorse_c', 'marwanhorse_stand', 'marwanhorse_rear')], (64, 56), K, -8, -24)
    print('horses', round(time.time() - t0), 's'); save_man()

if want('beasts'):
    bf = chars.render_beasts(TMP)
    man['atlases']['bat'] = atlas('bat', [('bat1', bf['bat1']), ('bat2', bf['bat2'])], (18, 12), K, -2, -3)
    man['atlases']['boar'] = atlas('boar', [('boar1', bf['boar1']), ('boar2', bf['boar2'])], (24, 16), K, -2, -4)
    af = chars.render_abnauaiu(TMP)
    man['atlases']['abnauaiu'] = atlas('abnauaiu', [(n, af[n]) for n in sorted(af)], (56, 72), K, 0, 0)
    print('beasts', round(time.time() - t0), 's'); save_man()

if want('items'):
    it = env.render_items(TMP)
    for n in ('coin0', 'coin1', 'coin2', 'coin3', 'honey', 'pepper', 'shield', 'feather'):
        pass
    man['atlases']['coins'] = atlas('coins', [(f'coin{i}', it[f'coin{i}']) for i in range(4)], (14, 14), K, -1, -1)
    for n in ('honey', 'pepper', 'shield', 'feather'):
        man['atlases'][n] = atlas(n, [(n, it[n])], (14, 14), K, -1, -1)
    man['atlases']['heart'] = atlas('heart', [('heart', it['heart'])], (12, 12), K, -2, -2)
    man['atlases']['string'] = atlas('string', [('string', it['string'])], (12, 16), K, 0, 0)
    os.makedirs(os.path.join(OUT, 'ui'), exist_ok=True)
    for n in ('heart', 'coin0', 'string', 'pepper'):
        finish(it[n]).save(os.path.join(OUT, 'ui', n + '.png'))
    man['ui'] = {'heart': 'ui/heart.png', 'coin': 'ui/coin0.png', 'string': 'ui/string.png', 'pepper': 'ui/pepper.png'}
    print('items', round(time.time() - t0), 's'); save_man()

if want('props'):
    pf = env.render_props(TMP)
    sizes = {'house': (64, 48), 'tent': (56, 40), 'tent2': (56, 40), 'tent3': (56, 40), 'tree': (44, 58), 'cypress': (20, 52),
             'darktree': (64, 92), 'catapult': (52, 44), 'catapult_burnt': (52, 44), 'cart': (34, 24), 'gate': (48, 66),
             'gate_closed': (48, 66), 'brazier': (16, 24), 'sign': (16, 16)}
    man['props'] = {}
    for n, (w, h) in sizes.items():
        a = atlas('prop_' + n, [('prop_' + n, pf[n])], (w, h), K, 0, 0, folder='props')
        man['props'][n] = a
    print('props', round(time.time() - t0), 's'); save_man()

if want('tiles'):
    def seamless(im, horiz=True, vert=True):
        w, h = im.size
        res = im
        if horiz:
            sh = ImageChops.offset(res, w // 2, 0)
            mask = Image.linear_gradient('L').rotate(90).resize((w, h))
            m = Image.new('L', (w, h))
            for x in range(w):
                v = int(255 * max(0, 1 - abs(x - w / 2) / (w / 2)))
                m.paste(v, (x, 0, x + 1, h))
            res = Image.composite(res, sh, m)
        if vert:
            sh = ImageChops.offset(res, 0, h // 2)
            m = Image.new('L', (w, h))
            for y in range(h):
                v = int(255 * max(0, 1 - abs(y - h / 2) / (h / 2)))
                m.paste(v, (0, y, w, y + 1))
            res = Image.composite(res, sh, m)
        return res
    os.makedirs(os.path.join(OUT, 'tiles'), exist_ok=True)
    man['tiles'] = {'k': K, 'ground': {}, 'common': {}}
    for theme in env.GROUND:
        gf = env.render_ground(theme, TMP)
        body = seamless(finish(gf['body'], outline=False))
        top = seamless(finish(gf['top'], outline=False), vert=False)
        body.save(os.path.join(OUT, 'tiles', f'{theme}_body.webp'), 'WEBP', quality=88)
        top.save(os.path.join(OUT, 'tiles', f'{theme}_top.webp'), 'WEBP', lossless=True)
        man['tiles']['ground'][theme] = {'body': f'tiles/{theme}_body.webp', 'top': f'tiles/{theme}_top.webp'}
        print('tile', theme, round(time.time() - t0), 's')
    tf = env.render_tiles(TMP)
    for n, p in tf.items():
        finish(p, outline=False).save(os.path.join(OUT, 'tiles', n + '.webp'), 'WEBP', lossless=True)
        man['tiles']['common'][n] = 'tiles/' + n + '.webp'
    save_man()

if want('bg'):
    os.makedirs(os.path.join(OUT, 'bg'), exist_ok=True)
    bfs = env.render_backgrounds(TMP)
    man.setdefault('bg', {})
    for n, p in sorted(bfs.items()):
        im = Image.open(p).convert('RGBA')
        im.save(os.path.join(OUT, 'bg', n + '.webp'), 'WEBP', quality=86, method=6)
        man['bg'][n] = 'bg/' + n + '.webp'
        print('bg', n, round(time.time() - t0), 's')
    save_man()

if want('portraits'):
    os.makedirs(os.path.join(OUT, 'portraits'), exist_ok=True)
    man['portraits'] = {}
    for name, key in (('astamur', 'astamur'), ('amra', 'amra'), ('leon', 'leon'), ('daur', 'daur'), ('marwan', 'marwan'), ('master', 'master'), ('oldamra', 'narrator')):
        p = chars.render_portrait(name, TMP)
        im = Image.open(p).convert('RGBA')
        im.save(os.path.join(OUT, 'portraits', key + '.webp'), 'WEBP', quality=90)
        man['portraits'][key] = 'portraits/' + key + '.webp'
    af = os.path.join(OUT, 'sprites', 'abnauaiu.webp')
    if os.path.exists(af):
        sheet = Image.open(af)
        cw = sheet.width // 4
        fr = sheet.crop((0, 0, cw, int(cw * 0.75)))
        fr.resize((256, 192), Image.LANCZOS).save(os.path.join(OUT, 'portraits', 'abnauaiu.webp'), 'WEBP', quality=90)
        man['portraits']['abnauaiu'] = 'portraits/abnauaiu.webp'
    print('portraits', round(time.time() - t0), 's'); save_man()

with open(os.path.join(OUT, 'manifest.js'), 'w') as f:
    f.write('/* Создано tools/blender/build_assets.py — 3D-ассеты, отрендеренные в Blender */\n')
    f.write('window.ANAKOPIA_ASSETS = ' + json.dumps(man, ensure_ascii=False) + ';\n')
print('done', round(time.time() - t0), 's')
