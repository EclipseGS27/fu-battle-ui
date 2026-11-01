"""Prepares the trailer's own art (art-src/) for the video.

Sprites: trimmed to their visible pixels and saved to public/art/<name>.png, with src/art/meta.json describing
each one: size, where its feet and head are, its body centre, and a coarse colour mask (one cell per 4 image
pixels) that the pixel effects use as the target's silhouette (frozen outlines, burning, ground hits...).

Backdrops (art-src/bg-*.png, any size): scaled to cover 1920 x 1080 and saved as public/art/bg-*.png.

Needs ffmpeg and numpy. Run: python3 scripts/prepare-art.py
"""
import base64
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'art-src')
OUT = os.path.join(ROOT, 'public', 'art')
META = os.path.join(ROOT, 'src', 'art', 'meta.json')
CELL = 4  # image pixels per mask cell

# Portrait crops for the Battle UI's diamond faces: x, y, size in trimmed-image pixels, picked by eye
FACES = {
    'hero-1': (195, 2, 90),
    'hero-2': (115, 8, 84),
    'hero-3': (95, 4, 84),
    'golem': (150, 18, 100),
    'dragon': (300, 30, 130),
    'wraith': (165, 30, 100),
    'phantom-wolf': (380, 40, 120),
}


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout
    w, h = out.strip().split(',')[:2]
    return int(w), int(h)


def read_rgba(path):
    w, h = probe(path)
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 4).copy()


def write_png(path, rgba):
    h, w = rgba.shape[:2]
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{w}x{h}', '-i', '-', '-compression_level', '9', path], input=rgba.tobytes(), check=True)


def sprite(name, path):
    a = read_rgba(path)
    alpha = a[:, :, 3]
    ys, xs = np.where(alpha > 8)
    pad = 4
    x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + 1 + pad)
    y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + 1 + pad)
    t = a[y0:y1, x0:x1]
    write_png(os.path.join(OUT, f'{name}.png'), t)
    h, w = t.shape[:2]
    solid = t[:, :, 3] > 128
    rows = np.where(solid.sum(1) >= 2)[0]
    head, feet = int(rows.min()), int(rows.max())
    band = solid[max(head, feet - max(6, (feet - head) // 16)):feet + 1]
    bx = np.where(band.any(0))[0]
    feet_x = float(bx.mean())
    yy, xx = np.where(solid)
    # coarse colour mask: one cell per CELL x CELL pixels, solid where most of the cell is
    mh, mw = (h + CELL - 1) // CELL, (w + CELL - 1) // CELL
    padded = np.zeros((mh * CELL, mw * CELL, 4), np.float32)
    padded[:h, :w] = t
    cells = padded.reshape(mh, CELL, mw, CELL, 4)
    al = cells[..., 3].mean(axis=(1, 3))
    wsum = np.maximum(cells[..., 3].sum(axis=(1, 3)), 1)
    rgb = (cells[..., :3] * cells[..., 3:4]).sum(axis=(1, 3)) / wsum[..., None]
    mask = np.zeros((mh, mw, 4), np.uint8)
    on = al > 110
    mask[on, :3] = np.clip(rgb[on], 0, 255).astype(np.uint8)
    mask[on, 3] = 255
    face = None
    if name in FACES:
        fx, fy, fs = FACES[name]
        face = f'art/{name}-face.png'
        write_png(os.path.join(ROOT, 'public', face), np.ascontiguousarray(t[fy:fy + fs, fx:fx + fs]))
    return {
        'file': f'art/{name}.png',
        'face': face,
        'w': int(w),
        'h': int(h),
        'feetX': round(feet_x, 1),
        'feetY': feet + 1,
        'headY': head,
        'cx': round(float(xx.mean()), 1),
        'cy': round(float(yy.mean()), 1),
        'cell': CELL,
        'maskW': int(mw),
        'maskH': int(mh),
        'mask': base64.b64encode(mask.tobytes()).decode('ascii'),
    }


# Where to cut each backdrop's 16:9 band, as a fraction of the scaled image's spare height (0 top, 1 bottom)
BAND = {'bg-field': 0.28, 'bg-aurora': 0.3, 'bg-cave': 0.3}


def backdrop(name, path):
    w, h = probe(path)
    out = os.path.join(OUT, f'{name}.jpg')
    sh = round(h * 1920 / w)
    y = round(max(0, sh - 1080) * BAND.get(name, 0.5))
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', path, '-vf', f'scale=1920:{sh}:flags=lanczos,crop=1920:1080:0:{y}', '-q:v', '2', out], check=True)
    return {'file': f'art/{name}.jpg', 'srcW': w, 'srcH': h}


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(os.path.dirname(META), exist_ok=True)
    meta = {'sprites': {}, 'backdrops': {}}
    for f in sorted(os.listdir(SRC)):
        if not f.lower().endswith(('.png', '.jpg', '.jpeg')):
            continue
        name = os.path.splitext(f)[0]
        path = os.path.join(SRC, f)
        if name.startswith('bg-'):
            meta['backdrops'][name[3:]] = backdrop(name, path)
        else:
            meta['sprites'][name] = sprite(name, path)
        print('prepared', name)
    with open(META, 'w') as fh:
        json.dump(meta, fh, indent=1)
    print('wrote', os.path.relpath(META, ROOT), 'sprites:', len(meta['sprites']), 'backdrops:', len(meta['backdrops']))


if __name__ == '__main__':
    sys.exit(main())
