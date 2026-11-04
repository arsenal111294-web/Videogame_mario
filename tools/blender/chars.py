"""Персонажи «Анакопиа»: модели из примитивов, позы и кадры анимации."""
import math

import bpy

from common import D, box, camera, cone, cyl, empty, lights, limb, material, render, reset_scene, sphere, torus

SKIN = (0.93, 0.68, 0.50)
SKIN_D = (0.80, 0.56, 0.40)

SPECS = {
    'astamur': dict(coat=(0.62, 0.13, 0.09), sleeve=(0.55, 0.11, 0.08), pants=(0.16, 0.13, 0.18), boots=(0.10, 0.07, 0.05),
                    belt=(0.88, 0.66, 0.22), skirt='coat', hat='hood', hat_col=(0.74, 0.50, 0.26), dagger=True, hair=(0.14, 0.08, 0.05), brows=(0.12, 0.07, 0.04)),
    'amra': dict(coat=(0.13, 0.46, 0.27), sleeve=(0.11, 0.40, 0.24), pants=(0.25, 0.18, 0.14), boots=(0.30, 0.18, 0.10),
                 belt=(0.50, 0.30, 0.14), skirt='dress', hat='scarf', hat_col=(0.95, 0.92, 0.84), braid=(0.16, 0.09, 0.05), quiver=True),
    'soldier': dict(coat=(0.90, 0.87, 0.78), sleeve=(0.84, 0.80, 0.70), pants=(0.32, 0.27, 0.22), boots=(0.14, 0.11, 0.09),
                    belt=(0.18, 0.40, 0.56), skirt='tunic', hat='helmet', hat_col=(0.66, 0.69, 0.74), beard=(0.14, 0.09, 0.07)),
    'spear': dict(coat=(0.82, 0.74, 0.52), sleeve=(0.76, 0.68, 0.46), pants=(0.32, 0.27, 0.22), boots=(0.14, 0.11, 0.09),
                  belt=(0.55, 0.20, 0.13), skirt='tunic', hat='helmet', hat_col=(0.62, 0.65, 0.70), beard=(0.12, 0.08, 0.06)),
    'archer': dict(coat=(0.66, 0.78, 0.62), sleeve=(0.60, 0.72, 0.56), pants=(0.32, 0.27, 0.22), boots=(0.20, 0.13, 0.08),
                   belt=(0.40, 0.24, 0.10), skirt='tunic', hat='cap', hat_col=(0.78, 0.62, 0.34), beard=(0.14, 0.09, 0.07), quiver=True),
    'shield': dict(coat=(0.86, 0.82, 0.73), sleeve=(0.80, 0.76, 0.66), pants=(0.24, 0.24, 0.28), boots=(0.12, 0.11, 0.10),
                   belt=(0.14, 0.27, 0.40), skirt='tunic', hat='helmet', hat_col=(0.52, 0.55, 0.60), beard=(0.12, 0.08, 0.06), armor=(0.55, 0.57, 0.62)),
    'guard': dict(coat=(0.48, 0.48, 0.60), sleeve=(0.42, 0.42, 0.54), pants=(0.22, 0.22, 0.26), boots=(0.12, 0.11, 0.10),
                  belt=(0.32, 0.14, 0.38), skirt='tunic', hat='helmet', hat_col=(0.55, 0.58, 0.63), beard=(0.12, 0.08, 0.06)),
    'master': dict(coat=(0.36, 0.18, 0.12), sleeve=(0.30, 0.15, 0.10), pants=(0.16, 0.13, 0.15), boots=(0.09, 0.07, 0.06),
                   belt=(0.80, 0.62, 0.25), skirt='tunic', hat='helmet', hat_col=(0.30, 0.30, 0.34), beard=(0.06, 0.04, 0.03),
                   armor=(0.32, 0.32, 0.36), eyes=(1.0, 0.25, 0.1), bulky=1.25),
    'marwan': dict(coat=(0.58, 0.07, 0.07), sleeve=(0.50, 0.06, 0.06), pants=(0.18, 0.12, 0.12), boots=(0.10, 0.06, 0.05),
                   belt=(0.95, 0.75, 0.25), skirt='robe', hat='helmet', hat_col=(0.95, 0.72, 0.22), hat_metal=0.9, plume=(0.85, 0.08, 0.06),
                   beard=(0.05, 0.03, 0.03), cape=(0.42, 0.04, 0.05), armor=(0.92, 0.70, 0.25)),
    'leon': dict(coat=(0.36, 0.17, 0.50), sleeve=(0.30, 0.14, 0.44), pants=(0.16, 0.13, 0.18), boots=(0.25, 0.15, 0.08),
                 belt=(0.95, 0.75, 0.25), skirt='robe', hat='crown', hat_col=(0.97, 0.76, 0.22), hair=(0.25, 0.15, 0.09),
                 beard=(0.30, 0.18, 0.10), cape=(0.55, 0.10, 0.12)),
    'daur': dict(coat=(0.42, 0.29, 0.18), sleeve=(0.38, 0.26, 0.16), pants=(0.16, 0.13, 0.18), boots=(0.22, 0.14, 0.08),
                 belt=(0.30, 0.20, 0.12), skirt='coat', hat='felt', hat_col=(0.38, 0.34, 0.31), beard=(0.95, 0.94, 0.90), long_beard=True,
                 hair=(0.92, 0.91, 0.88), staff=True),
    'oldamra': dict(coat=(0.22, 0.22, 0.30), sleeve=(0.20, 0.20, 0.28), pants=(0.25, 0.18, 0.14), boots=(0.30, 0.18, 0.10),
                    belt=(0.50, 0.30, 0.14), skirt='dress', hat='scarf', hat_col=(0.18, 0.16, 0.20), braid=(0.82, 0.80, 0.78), old=True),
}


class Rig:
    pass


def build_human(name, sp):
    """Модель смотрит вдоль +X, ноги на z=0. Возвращает словарь суставов."""
    k = sp.get('bulky', 1.0)
    m = {key: material(name + '_' + key, col, rough=0.75, noise=(18, 0.25)) for key, col in sp.items()
         if key in ('coat', 'sleeve', 'pants', 'cape') and isinstance(col, tuple)}
    skin = material(name + '_skin', SKIN_D if sp.get('old') else SKIN, rough=0.55)
    boots = material(name + '_boots', sp['boots'], rough=0.5)
    belt = material(name + '_belt', sp['belt'], rough=0.4, metal=0.6 if sum(sp['belt']) > 1.6 else 0.0)
    dark = material('eye_dark', (0.05, 0.03, 0.03), rough=0.3)
    R = Rig()
    root = empty(name + '_root', (0, 0, 0))
    body = empty(name + '_body', (0, 0, 0), root)
    R.root, R.body = root, body
    # ноги
    R.legs = []
    for side, yy in (('L', 1.0 * k), ('R', -1.0 * k)):
        hip, knee_end = limb(name + '_hip' + side, body, (0, yy, 5.4), 2.6, 0.85 * k, m['pants'])
        knee, ankle = limb(name + '_knee' + side, knee_end, (0, 0, 0), 2.5, 0.72 * k, m['pants'])
        box((0.55, 0, -0.35), (2.5 * k, 1.45 * k, 1.35), boots, ankle, bevel=0.35)
        cyl((0, 0, 0.4), 0.8 * k, 1.4, boots, ankle, verts=14)
        R.legs.append((hip, knee))
    # туловище
    cone((0, 0, 7.9), 2.0 * k, 2.35 * k, 4.6, m['coat'], body, scale=(1, 0.82, 1))
    if sp['skirt'] == 'coat':
        cone((0, 0, 4.8), 2.75 * k, 2.0 * k, 2.6, m['coat'], body, scale=(1, 0.85, 1))
    elif sp['skirt'] == 'dress':
        cone((0, 0, 3.9), 3.3 * k, 2.0 * k, 4.4, m['coat'], body, scale=(1, 0.9, 1))
    elif sp['skirt'] == 'robe':
        cone((0, 0, 3.6), 3.4 * k, 2.1 * k, 5.0, m['coat'], body, scale=(1, 0.9, 1))
    else:
        cone((0, 0, 5.0), 2.55 * k, 2.0 * k, 2.2, m['coat'], body, scale=(1, 0.85, 1))
    if sp.get('armor'):
        arm_m = material(name + '_armor', sp['armor'], rough=0.35, metal=0.85, noise=(40, 0.15))
        cone((0.15, 0, 8.6), 2.15 * k, 2.45 * k, 3.0, arm_m, body, scale=(1, 0.86, 1))
    torus((0, 0, 6.1), 2.05 * k, 0.32, belt, body, scale=(1, 0.84, 1))
    sphere((1.95 * k, -0.2, 6.1), 0.45, belt, body)
    if sp.get('dagger'):
        box((1.6 * k, -0.9, 5.2), (0.5, 0.35, 2.0), material('dagger', (0.25, 0.18, 0.12), rough=0.5), body, rot=(0, D(-20), 0), bevel=0.1)
    if sp.get('cape'):
        cm = m.get('cape') or material(name + '_capem', sp['cape'], rough=0.8)
        box((-1.9 * k, 0, 6.6), (0.6, 3.6 * k, 7.6), cm, body, rot=(0, D(10), 0), bevel=0.3)
    if sp.get('quiver'):
        qm = material('quiver', (0.42, 0.25, 0.12), rough=0.6)
        cyl((-2.0, 0.6, 8.6), 0.7, 4.0, qm, body, rot=(D(0), D(25), 0))
        for i in range(3):
            cyl((-2.6 - i * 0.2, 0.6 + (i - 1) * 0.3, 10.9), 0.12, 1.4, material('fletch', (0.92, 0.9, 0.85)), body, rot=(0, D(25), 0))
    # руки
    R.arms = []
    for side, yy in (('L', 2.25 * k), ('R', -2.25 * k)):
        sh, el_end = limb(name + '_sh' + side, body, (0, yy, 9.6), 2.7, 0.64 * k, m['sleeve'])
        el, wrist = limb(name + '_el' + side, el_end, (0, 0, 0), 2.4, 0.58 * k, m['sleeve'], end_mat=skin, end_r=0.75 * k)
        R.arms.append((sh, el))
    sphere((0, 2.2 * k, 9.7), 0.95 * k, m['coat'], body)
    sphere((0, -2.2 * k, 9.7), 0.95 * k, m['coat'], body)
    # шея и голова
    neck = empty(name + '_neck', (0, 0, 10.2), body)
    R.neck = neck
    cyl((0, 0, 0.5), 0.85, 1.2, skin, neck)
    head = empty(name + '_head', (0.25, 0, 2.6), neck)
    sphere((0, 0, 0), 2.55, skin, head, scale=(1.0, 0.95, 1.02))
    # лицо: глаза, нос, брови
    ecol = material(name + '_eye', sp['eyes'], emit=sp['eyes'], emit_strength=4) if sp.get('eyes') else dark
    for ey in (-0.95, 0.95):
        sphere((2.15, ey, 0.25), 0.42, ecol, head, seg=12)
    sphere((2.55, 0, -0.35), 0.5, skin, head, seg=12)
    bc = sp.get('brows') or sp.get('beard') or (0.12, 0.07, 0.04)
    bm = material(name + '_brow', bc if sum(bc) < 2.5 else (0.6, 0.6, 0.6), rough=0.8)
    for ey in (-0.95, 0.95):
        box((2.05, ey, 0.95), (0.6, 0.9, 0.28), bm, head, rot=(0, D(-15), 0), bevel=0.08)
    if sp.get('old'):
        for ey in (-0.95, 0.95):
            box((2.2, ey, -0.25), (0.15, 0.8, 0.1), material('wrinkle', SKIN_D), head, bevel=0.02)
    # волосы/борода
    if sp.get('beard'):
        bmat = material(name + '_beard', sp['beard'], rough=0.9, noise=(30, 0.3))
        if sp.get('long_beard'):
            sphere((1.5, 0, -1.9), 1.7, bmat, head, scale=(0.9, 1.25, 1.5))
        else:
            sphere((1.55, 0, -1.55), 1.35, bmat, head, scale=(0.85, 1.25, 1.0))
        box((2.35, 0, -0.95), (0.4, 1.8, 0.35), bmat, head, bevel=0.1)
    if sp.get('hair'):
        sphere((-0.5, 0, 0.6), 2.5, material(name + '_hair', sp['hair'], rough=0.85, noise=(25, 0.3)), head)
    # головной убор
    hm = material(name + '_hat', sp['hat_col'], rough=0.35 if sp['hat'] in ('helmet', 'crown') else 0.85,
                  metal=sp.get('hat_metal', 0.8 if sp['hat'] in ('helmet', 'crown') else 0.0), noise=(22, 0.2))
    hat = sp['hat']
    if hat == 'hood':  # башлык: заострённый капюшон с концами-завязками
        sphere((-0.4, 0, 0.45), 2.74, hm, head, scale=(1.0, 1.04, 1.04))
        cone((-1.3, 0, 2.9), 1.9, 0.15, 2.6, hm, head, rot=(0, D(-38), 0))
        torus((1.2, 0, 0.1), 2.0, 0.42, hm, head, rot=(0, D(80), 0), scale=(1, 1.15, 1.1))
        for yy in (-0.9, 0.9):
            box((0.6, yy, -2.7), (0.6, 0.9, 2.6), hm, head, rot=(D(20 if yy > 0 else -20), D(10), 0), bevel=0.2)
    elif hat == 'scarf':
        sphere((-0.5, 0, 0.3), 2.75, hm, head, scale=(1.0, 1.05, 1.06))
        box((-1.2, 0, -2.4), (1.6, 3.0, 2.6), hm, head, bevel=0.5)
        if sp.get('braid'):
            brm = material(name + '_braid', sp['braid'], rough=0.8, noise=(30, 0.3))
            for i in range(5):
                sphere((-2.4 - i * 0.12, 0.3, -1.8 - i * 1.0), 0.62 - i * 0.05, brm, head, seg=12)
    elif hat == 'helmet':
        cone((0, 0, 2.1), 2.75, 0.25, 3.3, hm, head)
        torus((0, 0, 1.0), 2.62, 0.3, hm, head)
        mail = material(name + '_mail', (0.45, 0.47, 0.52), rough=0.5, metal=0.7, noise=(70, 0.5))
        sphere((-0.75, 0, -0.5), 2.7, mail, head, scale=(0.82, 1.06, 0.95))
        if sp.get('plume'):
            sphere((-0.5, 0, 4.0), 0.9, material(name + '_plume', sp['plume'], rough=0.9), head, scale=(1.6, 0.6, 1.0))
    elif hat == 'cap':
        sphere((-0.1, 0, 0.9), 2.65, hm, head, scale=(1.0, 1.0, 0.75))
    elif hat == 'crown':
        cyl((0, 0, 1.9), 2.35, 1.0, hm, head)
        for i in range(6):
            a = i * math.pi / 3
            cone((2.3 * math.cos(a), 2.3 * math.sin(a), 2.8), 0.4, 0.05, 1.0, hm, head)
        sphere((2.35, 0, 1.9), 0.38, material('ruby', (0.8, 0.05, 0.1), rough=0.1, emit=(0.6, 0.0, 0.05), emit_strength=0.5), head)
    elif hat == 'felt':
        cyl((-0.2, 0, 1.9), 2.4, 1.4, hm, head)
        cyl((-0.2, 0, 1.25), 2.85, 0.3, hm, head)
    if sp.get('staff'):
        sm = material('staff', (0.42, 0.28, 0.15), rough=0.7, noise=(10, 0.3))
        R.staff = cyl((1.3, -2.4, 5.0), 0.32, 13.5, sm, body)
    R.k = k
    return R


def pose(R, legs=(0, 0), knees=(0, 0), arms=(0, 0), elbows=(0, 0), bob=0.0, lean=0.0, yaw=-28, head=0.0, arms_side=(0, 0)):
    """Углы в градусах: положительный — вперёд (к +X)."""
    R.root.rotation_euler = (0, 0, D(yaw))
    R.body.location = (0, 0, bob)
    R.body.rotation_euler = (0, D(lean), 0)
    for (hip, knee), a, kb in zip(R.legs, legs, knees):
        hip.rotation_euler = (0, -D(a), 0)
        knee.rotation_euler = (0, D(kb), 0)
    for (sh, el), a, eb, s in zip(R.arms, arms, elbows, arms_side):
        sh.rotation_euler = (D(s), -D(a), 0)
        el.rotation_euler = (0, -D(eb), 0)
    R.neck.rotation_euler = (0, D(head), 0)


HUMAN_POSES = {
    'stand': dict(legs=(4, -4), knees=(4, 6), arms=(8, -10), elbows=(18, 12)),
    'run1': dict(legs=(38, -32), knees=(12, 55), arms=(-38, 40), elbows=(55, 70), bob=0.2, lean=6),
    'run2': dict(legs=(8, -14), knees=(10, 85), arms=(-12, 14), elbows=(60, 60), bob=0.75, lean=6),
    'run3': dict(legs=(-32, 38), knees=(55, 12), arms=(40, -38), elbows=(70, 55), bob=0.2, lean=6),
    'run4': dict(legs=(-14, 8), knees=(85, 10), arms=(14, -12), elbows=(60, 60), bob=0.75, lean=6),
    'jump': dict(legs=(42, -22), knees=(70, 40), arms=(-45, 120), elbows=(40, 20), bob=0.6, lean=4),
    'attack': dict(legs=(26, -22), knees=(18, 20), arms=(-35, 95), elbows=(30, 5), lean=8),
    'attackj': dict(legs=(42, -22), knees=(70, 40), arms=(-35, 95), elbows=(30, 5), bob=0.6, lean=6),
    'climb1': dict(legs=(40, -5), knees=(80, 20), arms=(165, 120), elbows=(10, 40), yaw=-70, bob=0.4),
    'climb2': dict(legs=(-5, 40), knees=(20, 80), arms=(120, 165), elbows=(40, 10), yaw=-70, bob=0.4),
    'hurt': dict(legs=(-10, 20), knees=(30, 20), arms=(-60, -40), elbows=(30, 30), lean=-14),
}
ENEMY_FRAMES = ['stand', 'run1', 'run2', 'run3', 'run4', 'jump', 'attack']
HERO_FRAMES = ['stand', 'run1', 'run2', 'run3', 'run4', 'jump', 'attack', 'attackj', 'climb1', 'climb2', 'hurt']


def render_human(name, frames, cell=(24, 20), k=3, scale=1.0, foot=1.0, tmp='/tmp'):
    reset_scene()
    lights()
    R = build_human(name, SPECS[name])
    R.root.scale = (scale, scale, scale)
    w, h = cell
    camera(0, h / 2 - foot, w, h, k)
    out = []
    for f in frames:
        p = dict(HUMAN_POSES[f])
        if name in ('leon', 'daur') and f == 'stand':
            p['arms'] = (20, -5)
        pose(R, **p)
        out.append(render(f'{tmp}/{name}_{f}.png'))
    return out


def render_portrait(name, tmp, px=256):
    reset_scene(samples=48, ambient=(0.45, 0.42, 0.40), strength=0.7)
    lights(key_str=3.8, rim_str=3.2, key_rot=(D(55), D(-15), D(-55)))
    R = build_human(name, SPECS[name])
    pose(R, **HUMAN_POSES['stand'], yaw=-58)
    camera(0.6, 11.6, 9.5, 9.5, px / 9.5, ss=1)
    return render(f'{tmp}/portrait_{name}.png')


# ---------------------------------------------------------------- конь
def build_horse(name, coat, mane, white_socks=False):
    m = material(name + '_coat', coat, rough=0.55, noise=(14, 0.18))
    mm = material(name + '_mane', mane, rough=0.9, noise=(30, 0.3))
    hoof = material('hoof', (0.12, 0.1, 0.09), rough=0.4)
    R = Rig()
    root = empty(name + '_root', (0, 0, 0))
    body = empty(name + '_body', (0, 0, 0), root)
    R.root, R.body = root, body
    sphere((0, 0, 9.6), 1, m, body, scale=(6.4, 2.5, 2.8))
    sphere((4.3, 0, 9.9), 2.9, m, body, scale=(1, 0.95, 1))
    sphere((-4.6, 0, 9.9), 3.0, m, body, scale=(1, 0.95, 1))
    neck = empty(name + '_neck', (5.6, 0, 11.0), body)
    R.neck = neck
    cone((1.6, 0, 1.9), 1.75, 1.15, 4.8, m, neck, rot=(0, D(42), 0))
    sphere((1.2, 0, 2.6), 1.0, mm, neck, scale=(2.6, 0.5, 0.9))
    head = empty(name + '_head', (3.4, 0, 4.0), neck)
    sphere((1.2, 0, -0.6), 1, m, head, scale=(2.4, 1.05, 1.15))
    sphere((2.9, 0, -1.4), 0.95, m, head)
    for yy in (-0.55, 0.55):
        cone((-0.2, yy, 0.9), 0.35, 0.05, 1.2, m, head, rot=(0, D(-15), 0))
        sphere((1.4, yy * 1.6, -0.2), 0.3, material('eye_dark', (0.05, 0.03, 0.03), rough=0.3), head, seg=10)
    tail = empty(name + '_tail', (-7.2, 0, 11.0), body)
    R.tail = tail
    cone((-0.8, 0, -2.6), 1.0, 0.3, 6.0, mm, tail, rot=(0, D(-25), 0))
    R.legs = []
    for side, x0, yy in (('FL', 4.4, 1.25), ('FR', 4.4, -1.25), ('BL', -4.6, 1.25), ('BR', -4.6, -1.25)):
        up, up_end = limb(name + '_leg' + side, body, (x0, yy, 8.2), 4.2, 0.85, m, r_end=0.55)
        lo, foot = limb(name + '_low' + side, up_end, (0, 0, 0), 3.6, 0.5, m)
        if white_socks:
            cyl((0, 0, 0.8), 0.55, 1.4, material('sock', (0.95, 0.95, 0.92)), foot)
        box((0.2, 0, -0.1), (1.3, 1.1, 0.9), hoof, foot, bevel=0.2)
        R.legs.append((up, lo))
    return R


HORSE_POSES = {
    'a': dict(legs=(35, 22, -38, -28), knees=(-40, -20, 20, 10), bob=0.0, neck=-6, tail=-20),
    'b': dict(legs=(-10, 5, 25, 32), knees=(-80, -60, 30, 40), bob=1.0, neck=4, tail=-35),
    'c': dict(legs=(-28, -18, 8, -6), knees=(-20, -50, 70, 45), bob=0.4, neck=0, tail=-28),
    'stand': dict(legs=(2, -2, 2, -2), knees=(0, 0, 0, 0), bob=0, neck=0, tail=-10),
    'rear': dict(legs=(60, 45, -10, 5), knees=(-80, -70, 10, 10), bob=0.5, neck=12, tail=-30, pitch=-18),
}


def pose_horse(R, legs, knees, bob=0, neck=0, tail=0, pitch=0, yaw=-22):
    R.root.rotation_euler = (0, D(pitch), D(yaw))
    R.body.location = (0, 0, bob)
    for (up, lo), a, kb in zip(R.legs, legs, knees):
        up.rotation_euler = (0, -D(a), 0)
        lo.rotation_euler = (0, -D(kb), 0)
    R.neck.rotation_euler = (0, -D(neck), 0)
    R.tail.rotation_euler = (0, -D(tail), 0)


def seat_rider(H, rider):
    """Сажает всадника на коня: корень всадника — потомок тела коня."""
    rider.root.parent = H.body
    rider.root.location = (-0.6, 0, 8.4)
    rider.root.rotation_euler = (0, 0, 0)


def rider_pose(Rd, attack=False):
    p = dict(legs=(62, 62), knees=(80, 80), arms=(48, 40), elbows=(55, 60), lean=8, yaw=0)
    if attack:
        p.update(arms=(115, 40), elbows=(10, 60), lean=12)
    pose(Rd, **p)
    Rd.root.rotation_euler = (0, 0, 0)


def render_horses(tmp, k=3):
    files = {}
    # Бзоу без всадника и Бзоу с Астамыром
    for with_rider in (False, True):
        reset_scene()
        lights()
        H = build_horse('bzou', (0.40, 0.22, 0.11), (0.08, 0.05, 0.04))
        if with_rider:
            Rd = build_human('astamur', SPECS['astamur'])
            seat_rider(H, Rd)
        H.root.location = (0.8, 0, 0)
        camera(0, 14 - 1, 32, 28, k)
        for f in ('a', 'b', 'c', 'stand'):
            pose_horse(H, **HORSE_POSES[f])
            if with_rider:
                rider_pose(Rd)
                Rd.root.location = (-0.6, 0, 8.4)
            key = ('rider_' if with_rider else 'horse_') + f
            files[key] = render(f'{tmp}/{key}.png')
        if with_rider:
            pose_horse(H, **HORSE_POSES['b'])
            rider_pose(Rd, attack=True)
            Rd.root.location = (-0.6, 0, 8.4)
            files['rider_attack'] = render(f'{tmp}/rider_attack.png')
    # Марван на белом коне (масштаб ×2)
    reset_scene()
    lights()
    H = build_horse('wh', (0.90, 0.88, 0.84), (0.55, 0.52, 0.50), white_socks=False)
    Rd = build_human('marwan', SPECS['marwan'])
    seat_rider(H, Rd)
    H.root.scale = (2, 2, 2)
    H.root.location = (1.6, 0, 0)
    camera(0, 28 - 2, 64, 56, k)
    for f in ('a', 'b', 'c', 'stand', 'rear'):
        pose_horse(H, **HORSE_POSES[f])
        rider_pose(Rd, attack=(f == 'rear'))
        Rd.root.location = (-0.6, 0, 8.4)
        files['marwanhorse_' + f] = render(f'{tmp}/marwanhorse_{f}.png')
    return files


# ---------------------------------------------------------------- звери
def render_beasts(tmp, k=3):
    files = {}
    # летучая мышь
    reset_scene()
    lights()
    fur = material('batfur', (0.24, 0.17, 0.30), rough=0.8, noise=(30, 0.3))
    wing = material('batwing', (0.32, 0.20, 0.36), rough=0.6)
    root = empty('bat', (0, 0, 0))
    sphere((0, 0, 6), 2.0, fur, root, scale=(1, 0.9, 1.1))
    sphere((0, 0, 8.2), 1.5, fur, root)
    for yy in (-0.6, 0.6):
        sphere((1.3, yy - 0.3, 8.4), 0.35, material('bateye', (1, 0.2, 0.1), emit=(1, 0.15, 0.05), emit_strength=6), root, seg=10)
        cone((0.2, yy, 9.6), 0.5, 0.05, 1.3, fur, root)
    wings = []
    for side in (-1, 1):
        piv = empty('w%d' % side, (0, 0.6 * side, 7), root)
        box((-0.5, 0, 0), (1.2, 0.3, 1.2), wing, piv, bevel=0.1)
        cone((-0.5, 0, 3.2), 2.8, 0.3, 6.0, wing, piv, rot=(D(-90 * side), 0, 0), scale=(1, 0.15, 1))
        wings.append((piv, side))
    root.rotation_euler = (0, 0, D(-80))
    camera(0, 6, 18, 12, k)
    for f, ang in (('bat1', 55), ('bat2', -35)):
        for piv, side in wings:
            piv.rotation_euler = (D(-ang * side), 0, 0)
        files[f] = render(f'{tmp}/{f}.png')
    # кабан
    reset_scene()
    lights()
    bf = material('boarfur', (0.32, 0.22, 0.15), rough=0.9, noise=(25, 0.45))
    snout = material('snout', (0.78, 0.52, 0.48), rough=0.6)
    tusk = material('tusk', (0.96, 0.94, 0.86), rough=0.3)
    root = empty('boar', (0, 0, 0))
    sphere((0, 0, 6.5), 1, bf, root, scale=(7.0, 3.2, 3.6))
    sphere((6.2, 0, 6.2), 2.6, bf, root)
    cyl((8.6, 0, 5.6), 1.1, 1.4, snout, root, rot=(0, D(90), 0))
    for yy in (-0.9, 0.9):
        cone((8.4, yy, 4.6), 0.3, 0.05, 1.6, tusk, root, rot=(0, D(-30), 0))
        sphere((7.3, yy * 1.3, 7.3), 0.32, material('boareye', (0.9, 0.15, 0.05), emit=(0.8, 0.1, 0.0), emit_strength=2), root, seg=10)
        cone((5.6, yy * 1.2, 8.6), 0.6, 0.1, 1.4, bf, root)
    box((0, 0, 10.0), (9.0, 1.0, 1.2), material('bristle', (0.15, 0.10, 0.07), rough=0.95, noise=(40, 0.5)), root, bevel=0.4)
    legs = []
    for x0, yy in ((4.0, 1.5), (4.0, -1.5), (-4.2, 1.5), (-4.2, -1.5)):
        piv, end = limb('bl', root, (x0, yy, 4.0), 3.6, 0.75, bf)
        box((0, 0, -0.1), (1.1, 1.0, 0.7), material('hoof', (0.12, 0.1, 0.09)), end, bevel=0.15)
        legs.append(piv)
    root.rotation_euler = (0, 0, D(-18))
    camera(0, 8 - 1, 24, 16, k)
    for f, a in (('boar1', 28), ('boar2', -28)):
        for i, piv in enumerate(legs):
            piv.rotation_euler = (0, -D(a if i in (0, 3) else -a), 0)
        files[f] = render(f'{tmp}/{f}.png')
    return files


def render_abnauaiu(tmp, k=3):
    """Абнауаю — косматый лесной великан."""
    reset_scene(samples=32)
    lights(key_str=3.0, rim_str=3.5)
    fur = material('abfur', (0.20, 0.14, 0.09), rough=0.95, noise=(9, 0.6))
    fur2 = material('abfur2', (0.30, 0.21, 0.13), rough=0.95, noise=(14, 0.6))
    bone = material('abbone', (0.88, 0.85, 0.74), rough=0.5)
    eye = material('abeye', (1.0, 0.8, 0.1), emit=(1.0, 0.75, 0.05), emit_strength=12)
    root = empty('ab', (0, 0, 0))
    body = empty('abb', (0, 0, 0), root)

    def shaggy(loc, r, mat, parent, scale=(1, 1, 1)):
        o = sphere(loc, r, mat, parent, scale=scale, seg=32)
        tex = bpy.data.textures.new('n' + o.name, 'CLOUDS')
        tex.noise_scale = 0.12 * r
        md = o.modifiers.new('disp', 'DISPLACE')
        md.texture = tex
        md.strength = 0.45 * r
        sub = o.modifiers.new('sub', 'SUBSURF')
        sub.levels = 1
        return o
    shaggy((0, 0, 34), 15, fur, body, scale=(0.95, 0.8, 1.25))
    shaggy((6, 0, 52), 9, fur2, body, scale=(1.0, 0.9, 0.95))
    for yy in (-3.2, 3.2):
        sphere((14.0, yy, 54), 1.4, eye, body, seg=12)
    box((14.2, 0, 47.5), (2.0, 7.0, 2.6), material('abmouth', (0.15, 0.03, 0.03)), body, bevel=0.5)
    for yy in (-2.2, 0, 2.2):
        cone((15.0, yy, 48.6), 0.6, 0.05, 1.8, bone, body, rot=(0, D(180), 0))
    box((12.5, 0, 38), (3.0, 4.0, 10.0), bone, body, rot=(0, D(-12), 0), bevel=1.2)
    arms = []
    for side, yy in ((1, 9), (-1, -9)):
        piv = empty('abarm', (2, yy, 44), body)
        shaggy((0, 0, -10), 4.2, fur, piv, scale=(1, 1, 2.6))
        shaggy((0, 0, -22), 4.6, fur2, piv, scale=(1.2, 1, 1.2))
        arms.append(piv)
    legs = []
    for yy in (-5, 5):
        piv = empty('ableg', (0, yy, 18), body)
        shaggy((0, 0, -9), 4.6, fur, piv, scale=(1, 1, 2.0))
        legs.append(piv)
    root.rotation_euler = (0, 0, D(-25))
    camera(2, 36 - 2, 56, 72, k)
    files = {}
    for i, a in enumerate((25, 5, -20, 5)):
        arms[0].rotation_euler = (0, -D(a + 15), 0)
        arms[1].rotation_euler = (0, -D(-a + 30), 0)
        legs[0].rotation_euler = (0, -D(a * 0.6), 0)
        legs[1].rotation_euler = (0, -D(-a * 0.6), 0)
        body.location = (0, 0, abs(a) * 0.03)
        files['abnauaiu_%d' % i] = render(f'{tmp}/abnauaiu_{i}.png')
    return files
