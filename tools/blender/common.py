"""Общие функции для рендера ассетов «Анакопиа» в Blender (модуль bpy).

1 единица Blender = 1 игровая единица (тайл = 16). Камера ортографическая, смотрит вдоль +Y.
"""
import math
import os

import bpy
from mathutils import Euler, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'game', 'assets')
TMP = os.environ.get('ANAKOPIA_TMP', '/tmp/anakopia-render')
os.makedirs(TMP, exist_ok=True)

D = math.radians


def reset_scene(samples=24, ambient=(0.42, 0.43, 0.50), strength=0.75):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.cycles.max_bounces = 4
    sc.cycles.diffuse_bounces = 2
    sc.cycles.glossy_bounces = 2
    sc.cycles.transparent_max_bounces = 4
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.threads_mode = 'AUTO'
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (*ambient, 1)
    bg.inputs[1].default_value = strength
    sc.world = world
    return sc


def material(name, color, rough=0.7, metal=0.0, emit=None, emit_strength=0.0, sss=0.0, noise=None):
    """Принципиальный BSDF; noise=(масштаб, сила) добавляет пятнистость цвета."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    col = (*color, 1) if len(color) == 3 else color
    p.inputs['Base Color'].default_value = col
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit is not None:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = emit_strength
    if noise:
        sc, amt = noise
        tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = sc
        tex.inputs['Detail'].default_value = 6
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        dark = tuple(max(0, c * (1 - amt)) for c in col[:3]) + (1,)
        light = tuple(min(1, c * (1 + amt * 0.6)) for c in col[:3]) + (1,)
        ramp.color_ramp.elements[0].color = dark
        ramp.color_ramp.elements[1].color = light
        nt.links.new(tex.outputs['Fac'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
        bump = nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = amt * 0.6
        nt.links.new(tex.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    return m


def _finish(obj, mat, parent, smooth=True, bevel=0.0):
    if mat:
        obj.data.materials.append(mat)
    if smooth and hasattr(obj.data, 'polygons'):
        for poly in obj.data.polygons:
            poly.use_smooth = True
    if bevel > 0:
        md = obj.modifiers.new('bev', 'BEVEL')
        md.width = bevel
        md.segments = 2
    if parent:
        obj.parent = parent
    return obj


def sphere(loc, r, mat=None, parent=None, scale=(1, 1, 1), seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(8, seg // 2), radius=r, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    return _finish(o, mat, parent)


def cyl(loc, r, depth, mat=None, parent=None, rot=(0, 0, 0), scale=(1, 1, 1), verts=20, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = scale
    return _finish(o, mat, parent)


def cone(loc, r1, r2, depth, mat=None, parent=None, rot=(0, 0, 0), scale=(1, 1, 1), verts=20):
    return cyl(loc, r1, depth, mat, parent, rot, scale, verts, r2=r2)


def box(loc, size, mat=None, parent=None, rot=(0, 0, 0), bevel=0.25):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(o, mat, parent, smooth=False, bevel=bevel)


def torus(loc, R, r, mat=None, parent=None, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = scale
    return _finish(o, mat, parent)


def empty(name, loc, parent=None):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    if parent:
        o.parent = parent
    return o


def limb(name, parent, pivot, length, r, mat, r_end=None, end_mat=None, end_r=None):
    """Сустав: пустышка в точке опоры и цилиндр, свисающий вниз (−Z) на length."""
    piv = empty(name, pivot, parent)
    cyl((0, 0, -length / 2), r, length, mat, piv, r2=r_end if r_end else r * 0.9, verts=16)
    sphere((0, 0, 0), r * 1.02, mat, piv, seg=16)
    child = empty(name + '_end', (0, 0, -length), piv)
    if end_mat is not None:
        sphere((0, 0, 0), end_r or r * 1.05, end_mat, child, seg=16)
    return piv, child


def lights(key=(1.0, 0.93, 0.84), key_str=4.6, rim_str=3.0, key_rot=(D(50), D(-20), D(-35)), rim_rot=(D(60), D(10), D(150))):
    def sun(name, rot, col, s):
        L = bpy.data.lights.new(name, 'SUN')
        L.energy = s
        L.color = col
        L.angle = D(8)
        o = bpy.data.objects.new(name, L)
        o.rotation_euler = Euler(rot)
        bpy.context.scene.collection.objects.link(o)
        return o
    sun('key', key_rot, key, key_str)
    sun('rim', rim_rot, (0.85, 0.9, 1.0), rim_str)


def camera(cx, cz, w, h, k, ss=2, y=-200):
    sc = bpy.context.scene
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = max(w, h)
    cam_data.clip_end = 1000
    cam = bpy.data.objects.new('cam', cam_data)
    cam.location = (cx, y, cz)
    cam.rotation_euler = Euler((D(90), 0, 0))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x = int(w * k * ss)
    sc.render.resolution_y = int(h * k * ss)
    sc.render.resolution_percentage = 100
    if w >= h:
        cam_data.sensor_fit = 'HORIZONTAL'
    else:
        cam_data.sensor_fit = 'VERTICAL'
    return cam


def render(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path
