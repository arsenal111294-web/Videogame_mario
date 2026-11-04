"""Окружение «Анакопиа»: предметы, декорации, тайлы и слои фона (Blender)."""
import math
import os
import random

import bpy
from mathutils import Vector

from common import D, box, camera, cone, cyl, empty, lights, material, render, reset_scene, sphere, torus


def shaggy(loc, r, mat, parent=None, scale=(1, 1, 1), strength=0.35, nscale=0.25, seg=24, subsurf=1):
    o = sphere(loc, r, mat, parent, scale=scale, seg=seg)
    tex = bpy.data.textures.new('n_' + o.name, 'CLOUDS')
    tex.noise_scale = nscale * r
    md = o.modifiers.new('disp', 'DISPLACE')
    md.texture = tex
    md.strength = strength * r
    if subsurf:
        o.modifiers.new('sub', 'SUBSURF').levels = subsurf
    return o


# ---------------------------------------------------------------- предметы
def render_items(tmp, k=3):
    files = {}
    def gold():
        return material('gold', (1.0, 0.76, 0.22), rough=0.3, metal=0.45, emit=(0.9, 0.6, 0.1), emit_strength=0.35)

    def gold2():
        return material('gold2', (0.92, 0.58, 0.12), rough=0.35, metal=0.45, emit=(0.6, 0.35, 0.05), emit_strength=0.25)

    def shot(name, w=14, h=14, cz=None):
        camera(0, h / 2 if cz is None else cz, w, h, k)
        files[name] = render(f'{tmp}/{name}.png')

    # монета ахьы (4 кадра вращения)
    reset_scene(); lights()
    c = empty('coin', (0, 0, 7))
    cyl((0, 0, 0), 5.2, 1.2, gold(), c, rot=(D(90), 0, 0), verts=40)
    torus((0, -0.6, 0), 4.3, 0.35, gold2(), c, rot=(D(90), 0, 0))
    box((0, -0.7, 0), (2.2, 0.4, 2.2), gold2(), c, rot=(0, D(45), 0), bevel=0.3)
    camera(0, 7, 14, 14, k)
    for i, a in enumerate((0, 50, 82, 130)):
        c.rotation_euler = (0, 0, D(a))
        files['coin%d' % i] = render(f'{tmp}/coin{i}.png')
    # мёд (кувшин)
    reset_scene(); lights()
    clay = material('clay', (0.70, 0.38, 0.20), rough=0.6, noise=(20, 0.2))
    honey = material('honey', (1.0, 0.65, 0.08), rough=0.15, emit=(0.6, 0.35, 0.0), emit_strength=0.4)
    sphere((0, 0, 5), 4.6, clay, scale=(1, 1, 1.0))
    cyl((0, 0, 9.4), 2.3, 2.4, clay)
    cyl((0, 0, 10.8), 2.9, 0.8, honey)
    for x0 in (-1.5, 1.0):
        sphere((x0, -2.6, 9.6), 0.7, honey, scale=(1, 0.6, 2.0))
    box((0, -4.2, 5), (4.0, 0.5, 2.6), material('label', (0.95, 0.88, 0.6), rough=0.8), bevel=0.3)
    shot('honey', cz=6.5)
    # аџьыка — красный перец
    reset_scene(); lights()
    red = material('pepper', (0.85, 0.06, 0.03), rough=0.25, noise=(10, 0.1))
    for i in range(7):
        t = i / 6
        sphere((math.sin(t * 2.2) * 2.2 - 1, 0, 11 - t * 9), 2.3 * (1 - t * 0.8), red)
    cyl((-1.2, 0, 12.2), 0.5, 2.0, material('stem', (0.2, 0.55, 0.15), rough=0.5), rot=(0, D(-20), 0))
    shot('pepper', cz=7)
    # щит Шьашәы
    reset_scene(); lights()
    wood = material('shieldwood', (0.50, 0.28, 0.13), rough=0.7, noise=(8, 0.3))
    steel = material('steel', (0.80, 0.82, 0.86), rough=0.25, metal=1.0)
    s = empty('sh', (0, 0, 7))
    cyl((0, 0, 0), 5.6, 1.0, wood, s, rot=(D(90), 0, 0), verts=40)
    torus((0, -0.5, 0), 5.5, 0.5, gold(), s, rot=(D(90), 0, 0))
    sphere((0, -0.7, 0), 1.8, steel, s, scale=(1, 0.6, 1))
    s.rotation_euler = (0, 0, D(-20))
    shot('shield')
    # перо Аҩы
    reset_scene(); lights()
    fm = material('feather', (0.92, 0.96, 1.0), rough=0.6, emit=(0.4, 0.65, 1.0), emit_strength=0.6)
    sphere((0.5, 0, 7.5), 1, fm, scale=(1.6, 0.3, 6.0)).rotation_euler = (0, D(-35), 0)
    cyl((-3.4, 0, 2.3), 0.25, 4.0, material('quill', (0.9, 0.8, 0.5)), rot=(0, D(-35), 0))
    shot('feather')
    # сердце
    reset_scene(); lights()
    hm = material('heartm', (0.92, 0.10, 0.18), rough=0.2)
    sphere((-1.6, 0, 7.6), 2.4, hm); sphere((1.6, 0, 7.6), 2.4, hm)
    cone((0, 0, 4.4), 3.4, 0.1, 4.6, hm, rot=(0, D(180), 0), verts=24, scale=(1.05, 0.62, 1))
    shot('heart', 12, 12, cz=6.2)
    # апхьарца
    reset_scene(); lights()
    aw = material('apkh', (0.62, 0.34, 0.14), rough=0.45, noise=(12, 0.25))
    aw2 = material('apkh2', (0.36, 0.18, 0.07), rough=0.5)
    st = material('strings', (1.0, 0.92, 0.55), rough=0.2, metal=1.0, emit=(1.0, 0.8, 0.3), emit_strength=2)
    sphere((0, 0, 4.6), 1, aw, scale=(3.1, 1.3, 3.6))
    cyl((0, 0, 10.4), 0.9, 5.5, aw2)
    box((0, 0, 13.6), (2.2, 1.2, 1.6), aw2, bevel=0.3)
    for x0 in (-0.5, 0.5):
        cyl((x0, -1.4, 8.2), 0.12, 11.0, st)
    shot('string', 12, 16)
    return files


# ---------------------------------------------------------------- декорации
def render_props(tmp, k=3):
    files = {}

    def shot(name, w, h, foot=0):
        camera(0, h / 2 - foot, w, h, k)
        files[name] = render(f'{tmp}/{name}.png')

    def thatch():
        return material('thatch', (0.80, 0.64, 0.32), rough=0.95, noise=(6, 0.45))

    def wicker():
        return material('wicker', (0.62, 0.45, 0.25), rough=0.9, noise=(3, 0.5))

    def wood():
        return material('wood', (0.45, 0.28, 0.14), rough=0.8, noise=(5, 0.35))

    def darkwood():
        return material('darkwood', (0.28, 0.17, 0.09), rough=0.85, noise=(5, 0.35))

    def stone():
        return material('stone', (0.58, 0.56, 0.52), rough=0.9, noise=(2.5, 0.35))

    def leaf():
        return material('leaf', (0.20, 0.45, 0.16), rough=0.9, noise=(4, 0.4))

    def leaf2():
        return material('leaf2', (0.12, 0.32, 0.14), rough=0.9, noise=(4, 0.4))

    # апацха — абхазский плетёный дом с соломенной крышей
    reset_scene(); lights()
    cyl((0, 0, 9), 21, 18, wicker(), verts=40, scale=(1, 0.75, 1))
    for i in range(24):
        a = i / 24 * math.pi * 2
        cyl((21 * math.cos(a), 15.75 * math.sin(a), 9), 0.7, 18.5, darkwood(), verts=8)
    cone((0, 0, 27), 27, 1.5, 20, thatch(), verts=40, scale=(1, 0.8, 1))
    box((6, -16.2, 7), (9, 1.2, 14), darkwood(), bevel=0.4)
    box((6, -16.9, 7), (7, 0.6, 12), material('door', (0.12, 0.07, 0.04)), bevel=0.2)
    shot('house', 64, 48)
    # шатёр (3 цвета ткани)
    for nm, col in (('tent', (0.85, 0.80, 0.68)), ('tent2', (0.72, 0.66, 0.52)), ('tent3', (0.62, 0.52, 0.48))):
        reset_scene(); lights()
        cloth = material(nm + 'c', col, rough=0.9, noise=(8, 0.3))
        cone((0, 0, 15), 24, 0.6, 30, cloth, verts=6, scale=(1, 0.7, 1))
        cyl((0, 0, 32), 0.6, 6, darkwood())
        box((0, -0.2, 3.5), (8, 25, 9), material('tentdark', (0.10, 0.07, 0.05)), rot=(D(0), D(0), 0), bevel=0.2)
        box((-0.6, 0, 34), (4, 0.2, 2.5), material('pennant', (0.75, 0.1, 0.08)), bevel=0)
        shot(nm, 56, 40)
    # деревья
    reset_scene(); lights()
    cyl((0, 0, 14), 2.2, 28, darkwood(), r2=1.4)
    shaggy((0, 0, 38), 15, leaf(), scale=(1, 0.9, 0.9))
    shaggy((-8, -3, 32), 9, leaf2())
    shaggy((9, -2, 33), 9, leaf())
    shot('tree', 44, 58)
    reset_scene(); lights()
    cyl((0, 0, 4), 1.5, 8, darkwood())
    shaggy((0, 0, 26), 6.5, leaf2(), scale=(1, 1, 3.4), strength=0.25)
    shot('cypress', 20, 52)
    reset_scene(ambient=(0.12, 0.14, 0.25), strength=0.5); lights(key=(0.5, 0.6, 0.9), key_str=1.6, rim_str=2.2)
    cyl((0, 0, 30), 3.0, 60, material('nwood', (0.16, 0.11, 0.10), rough=0.9, noise=(4, 0.4)), r2=2.0)
    for i, (x, z, r) in enumerate(((0, 66, 18), (-14, 56, 12), (14, 58, 12), (-6, 72, 10))):
        shaggy((x, 0, z), r, material('nleaf', (0.07, 0.14, 0.16), rough=0.95, noise=(4, 0.4)))
    shot('darktree', 64, 92)
    # камнемёт (целый и сгоревший)
    for nm, burnt in (('catapult', False), ('catapult_burnt', True)):
        reset_scene(); lights()
        w = material('burnt', (0.08, 0.06, 0.05), rough=0.95, noise=(6, 0.5)) if burnt else wood()
        box((0, 0, 4), (40, 8, 3), w, bevel=0.5)
        for x0 in (-12, 12):
            box((x0, -3, 12), (3, 2, 18), w, rot=(0, D(-10 if x0 < 0 else 10), 0), bevel=0.4)
            box((x0, 3, 12), (3, 2, 18), w, rot=(0, D(-10 if x0 < 0 else 10), 0), bevel=0.4)
        box((0, 0, 20), (28, 9, 2.5), w, bevel=0.4)
        arm = empty('arm', (0, 0, 20))
        box((-8, 0, 10), (2.4, 2.4, 26), w, arm, rot=(0, D(-40 if not burnt else 30), 0), bevel=0.3)
        box((7, 0, -3), (8, 6, 7), material('cw', (0.35, 0.33, 0.32), rough=0.9) if not burnt else w, arm, bevel=0.6)
        for x0 in (-15, 15):
            for yy in (-5, 5):
                cyl((x0, yy, 4), 4, 1.6, darkwood() if not burnt else w, rot=(D(90), 0, 0), verts=16)
        shot(nm, 52, 44)
    # обоз
    reset_scene(); lights()
    box((0, 0, 7), (28, 12, 6), wood(), bevel=0.5)
    sack = material('sack', (0.82, 0.74, 0.55), rough=0.95, noise=(10, 0.3))
    for x0 in (-7, 0, 7):
        shaggy((x0, 0, 13), 4.6, sack, scale=(1, 1, 0.85), strength=0.08)
    for x0 in (-9, 9):
        for yy in (-6.5, 6.5):
            cyl((x0, yy, 4), 4, 1.2, darkwood(), rot=(D(90), 0, 0), verts=16)
    shot('cart', 34, 24)
    # ворота-выход (каменная арка)
    for nm, open_ in (('gate', True), ('gate_closed', False)):
        reset_scene(); lights()
        for i in range(9):
            for side in (-1, 1):
                box((side * 16, 0, 3 + i * 5.6), (9, 9, 5.2), stone(), bevel=0.6)
        for i in range(7):
            a = math.pi * (i + 0.5) / 7
            box((-math.cos(a) * 13, 0, 48 + math.sin(a) * 9), (6, 9.5, 5), stone(), rot=(0, -(a - math.pi / 2), 0), bevel=0.5)
        box((0, 1.5, 24), (22, 2, 46), material('void', (0.05, 0.03, 0.03)), bevel=0)
        if not open_:
            for x0 in range(-9, 10, 4):
                box((x0, -1.5, 18), (3.6, 1.5, 34), wood(), bevel=0.3)
            box((0, -2.3, 22), (22, 0.6, 2), material('iron', (0.35, 0.36, 0.40), rough=0.4, metal=0.9), bevel=0.1)
        shot(nm, 48, 66)
    # жаровня-маяк и табличка
    reset_scene(); lights()
    iron = material('iron', (0.30, 0.30, 0.33), rough=0.45, metal=0.9)
    for a in (0, 120, 240):
        cyl((2.2 * math.cos(D(a)), 2.2 * math.sin(D(a)), 6), 0.45, 12.5, iron, rot=(D(12) * math.sin(D(a)), D(-12) * math.cos(D(a)), 0))
    cone((0, 0, 13.5), 4.5, 3.0, 3.0, iron, rot=(D(180), 0, 0))
    shot('brazier', 16, 24)
    reset_scene(); lights()
    cyl((0, 0, 5), 0.8, 10, wood(), verts=10)
    box((0, 0, 11), (13, 1.5, 7), material('board', (0.70, 0.52, 0.30), rough=0.8, noise=(5, 0.3)), bevel=0.5)
    for zz in (12.5, 10.5):
        box((0, -0.9, zz), (8, 0.3, 0.6), darkwood(), bevel=0.05)
    shot('sign', 16, 16)
    return files


# ---------------------------------------------------------------- тайлы
GROUND = {
    'village': dict(dirt=(0.50, 0.32, 0.18), grass=(0.30, 0.62, 0.20), top='grass'),
    'gorge': dict(dirt=(0.34, 0.33, 0.31), grass=(0.30, 0.55, 0.20), top='grass', rocky=True),
    'forest': dict(dirt=(0.24, 0.19, 0.26), grass=(0.15, 0.38, 0.26), top='grass'),
    'fortress': dict(dirt=(0.42, 0.36, 0.30), grass=(0.36, 0.58, 0.24), top='grass', rocky=True),
    'cave': dict(dirt=(0.27, 0.22, 0.31), grass=(0.38, 0.32, 0.45), top='rock', rocky=True),
    'camp': dict(dirt=(0.30, 0.23, 0.18), grass=(0.20, 0.34, 0.18), top='grass'),
    'rain': dict(dirt=(0.24, 0.20, 0.17), grass=(0.18, 0.32, 0.18), top='grass'),
    'tower': dict(dirt=(0.40, 0.27, 0.16), grass=(0.52, 0.36, 0.20), top='plank'),
    'gates': dict(dirt=(0.30, 0.27, 0.24), grass=(0.25, 0.37, 0.20), top='grass', rocky=True),
}


def render_ground(theme, tmp, k=3):
    """Блок 4×4 тайла (бесшовность доводится в PIL) и полоса верхней кромки."""
    g = GROUND[theme]
    files = {}
    reset_scene(samples=16, ambient=(0.38, 0.38, 0.42), strength=0.6); lights(key_str=3.0, rim_str=1.0)
    dirt = material(theme + 'dirt', g['dirt'], rough=0.95, noise=(0.35, 0.55))
    box((32, 0, 32), (64, 4, 64), dirt, bevel=0)
    rnd = random.Random(hash(theme) & 0xffff)
    pebble = material(theme + 'peb', tuple(min(1, c * 1.35) for c in g['dirt']), rough=0.8, noise=(3, 0.3))
    pebble2 = material(theme + 'peb2', tuple(c * 0.7 for c in g['dirt']), rough=0.9)
    for i in range(46 if g.get('rocky') else 26):
        x, z = rnd.uniform(2, 62), rnd.uniform(2, 62)
        r = rnd.uniform(1.0, 3.2 if g.get('rocky') else 2.0)
        sphere((x, -2.2, z), r, pebble if i % 3 else pebble2, scale=(1, 0.5, 0.75), seg=12)
    camera(32, 32, 64, 64, k)
    files['body'] = render(f'{tmp}/tile_{theme}_body.png')
    # кромка
    reset_scene(samples=16, ambient=(0.38, 0.38, 0.42), strength=0.6); lights(key_str=3.2, rim_str=1.2)
    if g['top'] == 'grass':
        gm = material(theme + 'grass', g['grass'], rough=0.8, noise=(1.5, 0.35))
        gm2 = material(theme + 'grass2', tuple(c * 0.72 for c in g['grass']), rough=0.8)
        box((32, 0, 12.5), (64, 4, 7), gm, bevel=0.8)
        for i in range(70):
            x = rnd.uniform(0, 64)
            h = rnd.uniform(2.0, 5.0)
            cone((x, -1.5 - rnd.uniform(0, 1.5), 15 + h / 2), 0.7, 0.05, h, gm if i % 2 else gm2, rot=(0, D(rnd.uniform(-20, 20)), 0), verts=6)
        for i in range(10):
            x = rnd.uniform(0, 64)
            sphere((x, -2, 9.5), rnd.uniform(1.2, 2.2), gm2, scale=(1.4, 0.6, 0.8), seg=10)
    elif g['top'] == 'rock':
        rm = material(theme + 'rtop', g['grass'], rough=0.85, noise=(1.0, 0.5))
        box((32, 0, 13), (64, 4, 6), rm, bevel=1.0)
        for i in range(14):
            sphere((rnd.uniform(0, 64), -1.8, 12.5), rnd.uniform(1.5, 3.0), rm, scale=(1.3, 0.6, 0.7), seg=12)
    else:
        pm = material(theme + 'plank', g['grass'], rough=0.7, noise=(0.6, 0.4))
        for i in range(4):
            box((8 + i * 16, 0, 13), (15.6, 4, 5), pm, bevel=0.6)
    camera(32, 8, 64, 16, k)
    files['top'] = render(f'{tmp}/tile_{theme}_top.png')
    return files


def render_tiles(tmp, k=3):
    """Тайлы, общие для всех тем: камень, кирпич, тайник, доски, лестница, колья, бревно, стена башни."""
    files = {}
    T = 16

    def shot(name, w=T, h=T):
        camera(w / 2, h / 2, w, h, k)
        files[name] = render(f'{tmp}/tile_{name}.png')

    # кладка крепости 2×2 тайла
    reset_scene(samples=16); lights()
    st = material('fstone', (0.60, 0.58, 0.53), rough=0.9, noise=(1.2, 0.35))
    st2 = material('fstone2', (0.52, 0.50, 0.46), rough=0.9, noise=(1.2, 0.35))
    box((16, 3, 16), (32, 2, 32), material('mortar', (0.30, 0.28, 0.26)), bevel=0)
    for row in range(4):
        off = 0 if row % 2 == 0 else 8
        for i in range(-1, 3):
            x0 = i * 16 + off
            box((x0 + 8, 0, row * 8 + 4), (15.2, 4, 7.2), st if (i + row) % 2 else st2, bevel=1.0)
    shot('stone', 32, 32)
    # кирпич
    reset_scene(samples=16); lights()
    bm = material('brick', (0.70, 0.36, 0.20), rough=0.85, noise=(1.5, 0.3))
    box((8, 3, 8), (16, 2, 16), material('bmortar', (0.32, 0.18, 0.10)), bevel=0)
    for row in range(4):
        off = 0 if row % 2 == 0 else 4
        for i in range(-1, 3):
            box((i * 8 + off + 4, 0, row * 4 + 2), (7.4, 4, 3.4), bm, bevel=0.4)
    shot('brick')
    # тайник-амфора (золотой блок с орнаментом) и пустой блок
    reset_scene(samples=20); lights()
    gm = material('blockgold', (1.0, 0.70, 0.20), rough=0.35, metal=0.35, noise=(2, 0.15), emit=(0.7, 0.4, 0.05), emit_strength=0.3)
    orn = material('orn', (0.50, 0.18, 0.06), rough=0.5)
    box((8, 0, 8), (15.6, 6, 15.6), gm, bevel=1.4)
    for (x, z) in ((8, 13), (5, 10), (11, 10), (3, 8), (13, 8), (5, 6), (11, 6), (8, 3)):
        box((x, -3.2, z), (2.0, 0.6, 2.0), orn, rot=(0, D(45), 0), bevel=0.2)
    sphere((8, -3.2, 8), 1.3, material('ruby2', (0.85, 0.12, 0.08), rough=0.2), scale=(1, 0.5, 1))
    shot('block')
    reset_scene(samples=16); lights()
    um = material('used', (0.48, 0.34, 0.24), rough=0.9, noise=(1.5, 0.3))
    box((8, 0, 8), (15.6, 6, 15.6), um, bevel=1.2)
    for (x, z) in ((3, 3), (13, 3), (3, 13), (13, 13)):
        sphere((x, -3.2, z), 0.9, material('rivet', (0.3, 0.3, 0.32), metal=0.8, rough=0.4), seg=10)
    shot('used')
    # доска-платформа
    reset_scene(samples=16); lights()
    pw = material('plat', (0.66, 0.44, 0.22), rough=0.75, noise=(0.8, 0.35))
    box((8, 0, 13.5), (16, 5, 5), pw, bevel=0.6)
    for x in (3, 13):
        box((x, 0.5, 9), (2, 3, 6), material('platleg', (0.38, 0.24, 0.12)), bevel=0.3)
    shot('plank')
    # лестница
    reset_scene(samples=16); lights()
    lw = material('ladder', (0.55, 0.36, 0.18), rough=0.8, noise=(1, 0.3))
    for x in (3, 13):
        box((x, 0, 8), (2.2, 2.2, 16.2), lw, bevel=0.4)
    for z in (4, 12):
        cyl((8, 0, z), 0.9, 11, lw, rot=(0, D(90), 0), verts=10)
    shot('ladder')
    # колья
    reset_scene(samples=16); lights()
    sw = material('stake', (0.72, 0.56, 0.36), rough=0.7, noise=(1, 0.3))
    for i in range(4):
        cone((2 + i * 4, 0, 6.5), 1.5, 0.1, 9, sw, verts=8)
    box((8, 0, 1.5), (16, 4, 3), material('stakebase', (0.35, 0.24, 0.14)), bevel=0.4)
    shot('spikes')
    # бревно / ящик
    reset_scene(samples=16); lights()
    cm = material('crate', (0.56, 0.36, 0.18), rough=0.8, noise=(0.8, 0.35))
    box((8, 0, 8), (15.6, 6, 15.6), cm, bevel=0.8)
    for (rx, ry) in ((0, 45), (0, -45)):
        box((8, -3.1, 8), (19, 0.6, 2.2), material('cratebar', (0.36, 0.22, 0.10)), rot=(0, D(ry), 0), bevel=0.2)
    shot('crate')
    # стена осадной башни (доски)
    reset_scene(samples=16); lights()
    tw = material('towerwall', (0.085, 0.048, 0.024), rough=0.85, noise=(0.5, 0.45))
    for i in range(2):
        box((4 + i * 8, 0, 8), (7.6, 5, 16), tw, bevel=0.5)
    box((8, -2.6, 8), (16, 1.0, 2.6), material('towerbeam', (0.045, 0.026, 0.013), rough=0.8), bevel=0.3)
    for z in (4, 12):
        sphere((4, -2.6, z), 0.6, material('nail', (0.2, 0.2, 0.22), metal=0.8), seg=8)
        sphere((12, -2.6, z), 0.6, material('nail', (0.2, 0.2, 0.22), metal=0.8), seg=8)
    shot('towerwall')
    return files


# ---------------------------------------------------------------- фоны
def _wrap_positions(x, L):
    return (x - L, x, x + L)


def bg_layer(name, tmp, L=512, H=240, k=2, build=None, light=None, ambient=(0.5, 0.55, 0.7), strength=0.9, samples=20):
    reset_scene(samples=samples, ambient=ambient, strength=strength)
    if light:
        light()
    else:
        lights()
    build(L, H)
    camera(L / 2, H / 2, L, H, k, ss=1)
    return render(f'{tmp}/bg_{name}.png')


def mountains(L, z0, amp, col, snow=None, seed=1, count=9, y=60, rough=0.5):
    rnd = random.Random(seed)
    m = material('mtn%d' % seed, col, rough=0.95, noise=(0.03, rough))
    sm = material('snow%d' % seed, (0.95, 0.97, 1.0), rough=0.6) if snow else None
    for i in range(count):
        x = (i + rnd.uniform(-0.3, 0.3)) * L / count
        h = amp * rnd.uniform(0.6, 1.0)
        w = h * rnd.uniform(1.1, 1.7)
        for xx in _wrap_positions(x, L):
            o = cone((xx, y + rnd.uniform(0, 10), z0 + h / 2), w, 1.0, h, m, verts=7)
            tex = bpy.data.textures.new('mt', 'CLOUDS')
            tex.noise_scale = 18
            md = o.modifiers.new('d', 'DISPLACE')
            md.texture = tex
            md.strength = h * 0.12
            o.modifiers.new('s', 'SUBSURF').levels = 2
            if sm:
                cone((xx, y - 1, z0 + h * 0.86), w * 0.14, 0.4, h * 0.26, sm, verts=7)
    box((L / 2, y, z0 - 30), (L * 3, 10, 62), m, bevel=0)


def hills(L, z0, amp, col, seed=2, count=7, y=40):
    rnd = random.Random(seed)
    m = material('hill%d' % seed, col, rough=0.95, noise=(0.05, 0.35))
    for i in range(count):
        x = i * L / count + rnd.uniform(-20, 20)
        r = amp * rnd.uniform(0.8, 1.3)
        for xx in _wrap_positions(x, L):
            shaggy((xx, y, z0), r, m, scale=(1.9, 0.6, 0.55), strength=0.06, nscale=0.4)
    box((L / 2, y, z0 - 40), (L * 3, 10, 80), m, bevel=0)


def treeline(L, z0, col, kind='round', seed=3, step=14, y=20, scale=1.0, col2=None):
    rnd = random.Random(seed)
    m = material('tl%d' % seed, col, rough=0.95, noise=(0.15, 0.4))
    m2 = material('tl2%d' % seed, col2 or tuple(c * 0.75 for c in col), rough=0.95, noise=(0.15, 0.4))
    trunk = material('trunk%d' % seed, tuple(c * 0.5 for c in col), rough=0.9)
    x = 0
    while x < L:
        h = rnd.uniform(26, 48) * scale
        for xx in _wrap_positions(x, L):
            if kind == 'cypress':
                shaggy((xx, y + rnd.uniform(-2, 2), z0 + h * 0.55), h * 0.16, m if rnd.random() < 0.5 else m2, scale=(1, 1, 3.2), strength=0.2, seg=16)
            else:
                cyl((xx, y + 1, z0 + h * 0.3), 1.6 * scale, h * 0.6, trunk, verts=8)
                shaggy((xx, y + rnd.uniform(-2, 2), z0 + h * 0.72), h * 0.32, m if rnd.random() < 0.5 else m2, strength=0.3, seg=16)
        x += step * scale * rnd.uniform(0.6, 1.3)
    box((L / 2, y + 2, z0 - 20), (L * 3, 6, 40), m2, bevel=0)


def fortress(x, z, s, mat):
    for i in range(-4, 5):
        box((x + i * 7 * s, 30, z + 6 * s), (6.6 * s, 6 * s, 12 * s), mat, bevel=0.4)
        box((x + i * 7 * s, 30, z + 13.5 * s), (3 * s, 6 * s, 3 * s), mat, bevel=0.3)
    box((x, 30, z + 20 * s), (12 * s, 10 * s, 40 * s), mat, bevel=0.5)
    for xx in (-4, 0, 4):
        box((x + xx * s, 30, z + 42 * s), (2.6 * s, 10 * s, 4 * s), mat, bevel=0.3)
    for side in (-1, 1):
        cyl((x + side * 34 * s, 30, z + 14 * s), 5 * s, 28 * s, mat, verts=12)
        cone((x + side * 34 * s, 30, z + 31 * s), 6 * s, 0.3, 7 * s, material('roof', (0.45, 0.20, 0.14), rough=0.8), verts=12)


def sun_light(rot=(D(55), D(-15), D(-40)), col=(1, 0.93, 0.82), s=4.0, rim=1.5):
    def f():
        lights(key=col, key_str=s, rim_str=rim, key_rot=rot)
    return f


BG = {}


def render_backgrounds(tmp, k=2):
    files = {}
    L, H = 512, 240

    only = [n for n in os.environ.get('ANAKOPIA_BG', '').split(',') if n]

    def add(name, **kw):
        if only and name not in only:
            return
        files[name] = bg_layer(name, tmp, L, H, k, **kw)

    # село (день): горы со снегом, море, холмы, кипарисы
    add('coast_0', build=lambda L, H: mountains(L, 120, 110, (0.36, 0.44, 0.60), snow=True, seed=11), ambient=(0.50, 0.62, 0.80), strength=1.0)
    add('coast_1', build=lambda L, H: (box((L / 2, 50, 140), (L * 3, 4, 24), material('sea', (0.16, 0.42, 0.62), rough=0.25, metal=0.2), bevel=0), hills(L, 120, 46, (0.30, 0.52, 0.24), seed=12)), ambient=(0.5, 0.6, 0.75))
    add('coast_2', build=lambda L, H: treeline(L, 50, (0.13, 0.36, 0.17), 'cypress', seed=13, step=10), ambient=(0.5, 0.6, 0.75))
    # ущелье
    add('gorge_0', build=lambda L, H: mountains(L, 90, 140, (0.36, 0.42, 0.52), snow=True, seed=21, count=7), ambient=(0.50, 0.60, 0.78), strength=1.0)
    add('gorge_1', build=lambda L, H: mountains(L, 40, 150, (0.24, 0.25, 0.24), seed=22, count=6, rough=0.7))
    add('gorge_2', build=lambda L, H: treeline(L, 40, (0.20, 0.38, 0.20), 'round', seed=23, step=16))
    # ночной лес
    night = dict(light=sun_light(rot=(D(60), D(-10), D(30)), col=(0.55, 0.65, 1.0), s=1.6, rim=1.0), ambient=(0.10, 0.13, 0.25), strength=0.7)
    add('forest_0', build=lambda L, H: mountains(L, 100, 80, (0.14, 0.17, 0.30), seed=31), **night)
    add('forest_1', build=lambda L, H: treeline(L, 70, (0.08, 0.13, 0.20), 'round', seed=32, step=13, scale=1.2), **night)
    add('forest_2', build=lambda L, H: treeline(L, 40, (0.05, 0.08, 0.12), 'round', seed=33, step=18, scale=1.6), **night)
    # крепость на закате
    dusk = dict(light=sun_light(rot=(D(80), D(-5), D(-70)), col=(1.0, 0.62, 0.38), s=3.2, rim=2.0), ambient=(0.62, 0.45, 0.50), strength=0.9)
    add('fortress_0', build=lambda L, H: mountains(L, 110, 100, (0.55, 0.42, 0.52), snow=True, seed=41), **dusk)
    add('fortress_1', build=lambda L, H: (cone((L / 2, 30, 60), 150, 30, 110, material('fmtn', (0.40, 0.30, 0.36), rough=0.95, noise=(0.03, 0.4)), verts=9),
                                          fortress(L / 2, 115, 1.0, material('fwall', (0.62, 0.55, 0.50), rough=0.9, noise=(0.3, 0.3)))), **dusk)
    add('fortress_2', build=lambda L, H: treeline(L, 40, (0.30, 0.24, 0.26), 'cypress', seed=43, step=12), **dusk)
    # пещера
    cave = dict(light=sun_light(rot=(D(40), D(0), D(-20)), col=(0.6, 0.55, 0.9), s=1.4, rim=0.6), ambient=(0.12, 0.10, 0.18), strength=0.8)

    def stalag(L, H, seed, col, dy):
        rnd = random.Random(seed)
        m = material('stal%d' % seed, col, rough=0.9, noise=(0.2, 0.4))
        x = 0
        while x < L:
            for xx in _wrap_positions(x, L):
                h = rnd.uniform(30, 90)
                cone((xx, dy, H - h / 2 + 4), rnd.uniform(8, 16), 0.5, h, m, rot=(D(180), 0, 0), verts=8)
                h2 = rnd.uniform(20, 70)
                cone((xx + 7, dy, h2 / 2 - 4), rnd.uniform(8, 16), 0.5, h2, m, verts=8)
            x += rnd.uniform(18, 34)
        for i in range(8):
            xx = rnd.uniform(0, L)
            sphere((xx, dy - 3, rnd.uniform(40, 200)), rnd.uniform(1.5, 3), material('crys%d' % seed, (0.3, 0.85, 1.0), emit=(0.3, 0.85, 1.0), emit_strength=6))
    add('cave_0', build=lambda L, H: stalag(L, H, 51, (0.15, 0.12, 0.20), 40), **cave)
    add('cave_1', build=lambda L, H: stalag(L, H, 52, (0.22, 0.18, 0.28), 20), **cave)
    # лагерь Марвана ночью
    add('camp_0', build=lambda L, H: (mountains(L, 100, 70, (0.10, 0.12, 0.24), seed=61), fortress(L * 0.72, 150, 0.7, material('cfw', (0.14, 0.15, 0.25), rough=0.9))), **night)

    def tents(L, H):
        rnd = random.Random(62)
        cloth = material('tc', (0.45, 0.40, 0.36), rough=0.9)
        fire = material('fire', (1.0, 0.5, 0.1), emit=(1.0, 0.45, 0.08), emit_strength=25)
        x = 10
        while x < L:
            for xx in _wrap_positions(x, L):
                s = rnd.uniform(0.6, 1.1)
                cone((xx, 20, 45 + 14 * s), 22 * s, 0.5, 28 * s, cloth, verts=6, scale=(1, 0.7, 1))
                if rnd.random() < 0.4:
                    sphere((xx + 26, 10, 44), 2.5, fire, scale=(1, 1, 1.6))
            x += rnd.uniform(50, 80)
        box((L / 2, 22, 20), (L * 3, 6, 50), material('cground', (0.08, 0.08, 0.12)), bevel=0)
    add('camp_1', build=tents, light=sun_light(rot=(D(60), D(-10), D(30)), col=(0.55, 0.65, 1.0), s=1.4, rim=1.0), ambient=(0.08, 0.10, 0.20), strength=0.7)
    # дождь, ночь вылазки
    storm = dict(light=sun_light(rot=(D(70), D(-10), D(20)), col=(0.6, 0.68, 0.85), s=1.8, rim=1.2), ambient=(0.18, 0.20, 0.27), strength=0.8)
    add('rain_0', build=lambda L, H: (mountains(L, 100, 90, (0.20, 0.23, 0.30), seed=71), fortress(L * 0.25, 150, 0.6, material('rfw', (0.20, 0.22, 0.28), rough=0.9))), **storm)
    add('rain_1', build=lambda L, H: treeline(L, 50, (0.10, 0.17, 0.14), 'round', seed=72, step=15, scale=1.1), **storm)
    # у ворот (стена крепости)

    def wall(L, H):
        st = material('gwall', (0.32, 0.30, 0.33), rough=0.9, noise=(0.4, 0.3))
        st2 = material('gwall2', (0.26, 0.25, 0.28), rough=0.9, noise=(0.4, 0.3))
        for row in range(14):
            off = 0 if row % 2 == 0 else 10
            for i in range(-2, L // 20 + 3):
                box((i * 20 + off, 30, 10 + row * 12), (19.2, 8, 11.2), st if (i + row) % 2 else st2, bevel=1.2)
        for i in range(-2, L // 24 + 3):
            box((i * 24, 30, 182), (14, 8, 14), st, bevel=1.0)
        box((L / 2, 25, 60), (60, 2, 100), material('gvoid', (0.04, 0.03, 0.04)), bevel=0)
    add('gates_1', build=wall, **storm)
    add('gates_0', build=lambda L, H: mountains(L, 100, 80, (0.18, 0.18, 0.26), seed=81), **storm)
    return files
