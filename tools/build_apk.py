#!/usr/bin/env python3
"""Сборка APK «Анакопиа» без Android SDK.

Нужны только JDK и три открытых артефакта с Maven Central:
  * android-all (Robolectric) — классы Android для компиляции (--android-jar)
  * dalvik-dx — компилятор в DEX (--dx-jar)
  * apksig — подпись APK схемой v2 (--apksig-jar)

Бинарный AndroidManifest.xml и resources.arsc кодируются здесь же.
Обычный путь сборки — Gradle (папка android/), этот скрипт — запасной и для CI без SDK.
"""
import argparse
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = 'com.apsny.anakopia'
APP_LABEL = 'Анакопиа'
VERSION_CODE = 2
VERSION_NAME = '1.1'
MIN_SDK = 24
TARGET_SDK = 34
ANDROID_NS = 'http://schemas.android.com/apk/res/android'

# Идентификаторы атрибутов android.R.attr (сверены с android-all 14)
ATTR = {
    'theme': 0x01010000, 'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003,
    'exported': 0x01010010, 'launchMode': 0x0101001d, 'screenOrientation': 0x0101001e,
    'configChanges': 0x0101001f, 'minSdkVersion': 0x0101020c, 'versionCode': 0x0101021b,
    'versionName': 0x0101021c, 'targetSdkVersion': 0x01010270, 'allowBackup': 0x01010280,
    'hardwareAccelerated': 0x010102d3, 'isGame': 0x010103f4,
}
THEME_BLACK_NOTITLE_FULLSCREEN = 0x0103000a
ICON_RES_ID = 0x7f010000  # пакет 0x7f, тип 1 (mipmap), запись 0
DENSITIES = [('mdpi', 160), ('hdpi', 240), ('xhdpi', 320), ('xxhdpi', 480), ('xxxhdpi', 640)]

T_REF, T_STR, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12


def pad4(b):
    return b + b'\x00' * ((4 - len(b) % 4) % 4)


def len8(n):
    return bytes([n]) if n < 0x80 else bytes([(n >> 8) | 0x80, n & 0xff])


def string_pool(strings):
    """Пул строк ResStringPool в UTF-8."""
    data, offs = b'', []
    for s in strings:
        offs.append(len(data))
        b = s.encode('utf-8')
        data += len8(len(s.encode('utf-16-le')) // 2) + len8(len(b)) + b + b'\x00'
    data = pad4(data)
    start = 28 + 4 * len(strings)
    hdr = struct.pack('<HHIIIIII', 0x0001, 28, start + len(data), len(strings), 0, 0x100, start, 0)
    return hdr + b''.join(struct.pack('<I', o) for o in offs) + data


# ---------------------------------------------------------------- бинарный XML
def encode_axml(tree):
    """tree = (тег, [(ns|None, имя, тип, значение)], [дети])"""
    res_names, other = [], []

    def walk(node):
        tag, attrs, kids = node
        for ns, nm, _t, v in attrs:
            if ns:
                if nm not in res_names:
                    res_names.append(nm)
            elif nm not in other:
                other.append(nm)
            if _t == 'str' and v not in other:
                other.append(v)
        if tag not in other:
            other.append(tag)
        for k in kids:
            walk(k)

    walk(tree)
    res_names.sort(key=lambda n: ATTR[n])
    for extra in ('android', ANDROID_NS):
        if extra not in other:
            other.append(extra)
    strings = res_names + [s for s in other if s not in res_names]
    idx = {s: i for i, s in enumerate(strings)}
    NONE = 0xFFFFFFFF
    chunks = []
    line = [1]

    def start_el(tag, attrs):
        recs = []
        def key(a):
            return (0, ATTR[a[1]]) if a[0] else (1, idx[a[1]])
        for ns, nm, t, v in sorted(attrs, key=key):
            raw = NONE
            if t == 'str':
                dtype, data, raw = T_STR, idx[v], idx[v]
            elif t == 'int':
                dtype, data = T_DEC, v
            elif t == 'hex':
                dtype, data = T_HEX, v
            elif t == 'bool':
                dtype, data = T_BOOL, 0xFFFFFFFF if v else 0
            elif t == 'ref':
                dtype, data = T_REF, v
            else:
                raise ValueError(t)
            recs.append(struct.pack('<IIIHBBI', idx[ANDROID_NS] if ns else NONE, idx[nm], raw, 8, 0, dtype, data))
        body = struct.pack('<IIIIHHHHHH', line[0], NONE, NONE, idx[tag], 20, 20, len(recs), 0, 0, 0) + b''.join(recs)
        chunks.append(struct.pack('<HHI', 0x0102, 16, 8 + len(body)) + body)
        line[0] += 1

    def end_el(tag):
        chunks.append(struct.pack('<HHIIIII', 0x0103, 16, 24, line[0], NONE, NONE, idx[tag]))
        line[0] += 1

    def emit(node):
        tag, attrs, kids = node
        start_el(tag, attrs)
        for k in kids:
            emit(k)
        end_el(tag)

    chunks.append(struct.pack('<HHIIIII', 0x0100, 16, 24, 1, NONE, idx['android'], idx[ANDROID_NS]))
    emit(tree)
    chunks.append(struct.pack('<HHIIIII', 0x0101, 16, 24, line[0], NONE, idx['android'], idx[ANDROID_NS]))
    pool = string_pool(strings)
    resmap = struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(res_names)) + b''.join(struct.pack('<I', ATTR[n]) for n in res_names)
    body = pool + resmap + b''.join(chunks)
    return struct.pack('<HHI', 0x0003, 8, 8 + len(body)) + body


def manifest_tree():
    A = ANDROID_NS
    return ('manifest', [(None, 'package', 'str', PKG), (A, 'versionCode', 'int', VERSION_CODE), (A, 'versionName', 'str', VERSION_NAME)], [
        ('uses-sdk', [(A, 'minSdkVersion', 'int', MIN_SDK), (A, 'targetSdkVersion', 'int', TARGET_SDK)], []),
        ('uses-permission', [(A, 'name', 'str', 'android.permission.VIBRATE')], []),
        ('application', [
            (A, 'theme', 'ref', THEME_BLACK_NOTITLE_FULLSCREEN), (A, 'label', 'str', APP_LABEL), (A, 'icon', 'ref', ICON_RES_ID),
            (A, 'allowBackup', 'bool', True), (A, 'hardwareAccelerated', 'bool', True), (A, 'isGame', 'bool', True)], [
            ('activity', [
                (A, 'name', 'str', PKG + '.MainActivity'), (A, 'exported', 'bool', True), (A, 'launchMode', 'int', 2),
                (A, 'screenOrientation', 'int', 6), (A, 'configChanges', 'hex', 0x0fb0)], [
                ('intent-filter', [], [
                    ('action', [(A, 'name', 'str', 'android.intent.action.MAIN')], []),
                    ('category', [(A, 'name', 'str', 'android.intent.category.LAUNCHER')], []),
                ]),
            ]),
        ]),
    ])


# ---------------------------------------------------------------- resources.arsc
def config(density, sdk):
    c = bytearray(64)
    struct.pack_into('<I', c, 0, 64)
    struct.pack_into('<H', c, 14, density)
    struct.pack_into('<H', c, 24, sdk)
    return bytes(c)


def encode_arsc(icon_paths):
    """Таблица ресурсов: один тип mipmap с записью ic_launcher в нескольких плотностях."""
    gpool = string_pool([p for _d, p in icon_paths])
    tpool = string_pool(['mipmap'])
    kpool = string_pool(['ic_launcher'])
    spec = struct.pack('<HHIBBHI', 0x0202, 16, 20, 1, 0, 0, 1) + struct.pack('<I', 0x0100)  # CONFIG_DENSITY
    types = b''
    for i, (dens, _p) in enumerate(icon_paths):
        entry = struct.pack('<HHI', 8, 0, 0) + struct.pack('<HBBI', 8, 0, T_STR, i)
        hdr_size = 20 + 64
        entries_start = hdr_size + 4
        body = struct.pack('<BBHII', 1, 0, 0, 1, entries_start) + config(dens, 4) + struct.pack('<I', 0) + entry
        types += struct.pack('<HHI', 0x0201, hdr_size, 8 + len(body)) + body
    name = PKG.encode('utf-16-le').ljust(256, b'\x00')
    pkg_hdr_size = 288
    pkg_body = struct.pack('<I', 0x7f) + name + struct.pack('<IIIII', pkg_hdr_size, 1, pkg_hdr_size + len(tpool), 1, 0)
    pkg_rest = tpool + kpool + spec + types
    pkg = struct.pack('<HHI', 0x0200, pkg_hdr_size, pkg_hdr_size + len(pkg_rest)) + pkg_body + pkg_rest
    assert len(pkg_body) + 8 == pkg_hdr_size
    body = struct.pack('<I', 1) + gpool + pkg
    return struct.pack('<HHI', 0x0002, 12, 8 + len(body)) + body


# ---------------------------------------------------------------- сборка
def run(cmd, **kw):
    print('$', ' '.join(cmd[:6]) + (' …' if len(cmd) > 6 else ''))
    subprocess.run(cmd, check=True, **kw)


def write_aligned(zf, name, data, compress):
    zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    zi.create_system = 0
    zi.external_attr = 0o644 << 16
    if compress:
        zi.compress_type = zipfile.ZIP_DEFLATED
        zf.writestr(zi, data)
        return
    zi.compress_type = zipfile.ZIP_STORED
    off = zf.fp.tell()
    hdr = 30 + len(name.encode('utf-8'))
    zi.extra = b'\x00' * ((4 - (off + hdr) % 4) % 4)
    zf.writestr(zi, data)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--android-jar', required=True)
    ap.add_argument('--dx-jar', required=True)
    ap.add_argument('--apksig-jar', required=True)
    ap.add_argument('--keystore', default=os.path.expanduser('~/.anakopia/release.p12'))
    ap.add_argument('--storepass', default=os.environ.get('ANAKOPIA_STOREPASS', 'anakopia'))
    ap.add_argument('--alias', default='anakopia')
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist', 'anakopia.apk'))
    a = ap.parse_args()

    tmp = tempfile.mkdtemp(prefix='anakopia-apk-')
    try:
        # 1. Java → class → dex
        classes = os.path.join(tmp, 'classes')
        os.makedirs(classes)
        src = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'java', 'com', 'apsny', 'anakopia', 'MainActivity.java')
        run(['javac', '-nowarn', '-encoding', 'UTF-8', '--release', '8', '-cp', a.android_jar, '-d', classes, src])
        dex = os.path.join(tmp, 'classes.dex')
        run(['java', '-cp', a.dx_jar, 'com.android.dx.command.Main', '--dex', '--min-sdk-version=%d' % MIN_SDK, '--output=' + dex, classes])

        # 2. Подписывающий помощник
        signer_dir = os.path.join(tmp, 'signer')
        os.makedirs(signer_dir)
        run(['javac', '-nowarn', '-cp', a.apksig_jar, '-d', signer_dir, os.path.join(ROOT, 'tools', 'ApkSign.java')])

        # 3. Ключ подписи (создаётся один раз, хранится вне репозитория)
        if not os.path.exists(a.keystore):
            os.makedirs(os.path.dirname(a.keystore) or '.', exist_ok=True)
            run(['keytool', '-genkeypair', '-keystore', a.keystore, '-storetype', 'PKCS12', '-storepass', a.storepass,
                 '-alias', a.alias, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=Anakopia Game'])

        # 4. Архив
        unsigned = os.path.join(tmp, 'unsigned.apk')
        res_dir = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
        icons = []
        with zipfile.ZipFile(unsigned, 'w') as zf:
            write_aligned(zf, 'AndroidManifest.xml', encode_axml(manifest_tree()), True)
            for qual, dens in DENSITIES:
                p = 'res/mipmap-%s-v4/ic_launcher.png' % qual
                icons.append((dens, p))
            write_aligned(zf, 'resources.arsc', encode_arsc(icons), False)
            for (qual, _dens), (_d, p) in zip(DENSITIES, icons):
                with open(os.path.join(res_dir, 'mipmap-' + qual, 'ic_launcher.png'), 'rb') as f:
                    write_aligned(zf, p, f.read(), False)
            with open(dex, 'rb') as f:
                write_aligned(zf, 'classes.dex', f.read(), True)
            game = os.path.join(ROOT, 'game')
            for base, _dirs, files in sorted(os.walk(game)):
                for fn in sorted(files):
                    full = os.path.join(base, fn)
                    rel = os.path.relpath(full, game).replace(os.sep, '/')
                    with open(full, 'rb') as f:
                        write_aligned(zf, 'assets/' + rel, f.read(), not fn.endswith('.png'))

        # 5. Подпись схемой v2 (apksig) — её проверяют Android 7.0+ (minSdk 24)
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        cp = os.pathsep.join([signer_dir, a.apksig_jar])
        opens = []
        for mod in ('sun.security.x509', 'sun.security.pkcs', 'sun.security.util'):
            opens += ['--add-exports', 'java.base/%s=ALL-UNNAMED' % mod]  # apksig 2.x обращается к внутренним классам JDK
        run(['java'] + opens + ['-cp', cp, 'ApkSign', a.keystore, a.storepass, a.alias, unsigned, a.out])
        print('APK:', a.out, os.path.getsize(a.out), 'байт')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
