"""Synthesizes the trailer's score and sound effects (nothing sampled, nothing downloaded).

  public/audio/score.wav      90 s, 120 BPM, D minor, in five sections that follow the acts:
                              0-10 intro, 10-30 battle, 30-57 features, 57-76.5 showcase, 76.5-90 finale
  public/audio/sfx/*.wav      impacts, whooshes, slashes, magic, ice, fire, heals, risers...

The Battle UI's own menu sounds (public/sounds/ui/ff13, synced from the module) cover the UI cues.
Needs numpy and scipy. Run: python3 scripts/make-audio.py
"""
import os
import wave

import numpy as np
from scipy import signal

SR = 44100
BPM = 120
BEAT = 60 / BPM
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'public', 'audio')
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def env(n, a=0.01, d=0.1, s=0.7, r=0.2, hold=None):
    """ADSR over n samples; hold = seconds before release (default: until the release fits)"""
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    h = n - a - d - r if hold is None else int(hold * SR) - a - d
    h = max(0, h)
    e = np.concatenate([np.linspace(0, 1, max(1, a)), np.linspace(1, s, max(1, d)), np.full(h, s), np.linspace(s, 0, max(1, r))])
    if len(e) < n:
        e = np.concatenate([e, np.zeros(n - len(e))])
    return e[:n]


def saw(f, tt, phase=0.0):
    x = (tt * f + phase) % 1.0
    return 2 * x - 1


def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def sweep_lp(x, f0, f1):
    """A low-pass whose cutoff moves from f0 to f1, in blocks"""
    out = np.zeros_like(x)
    n = len(x)
    blk = 512
    zi = None
    for i in range(0, n, blk):
        k = i / max(1, n - 1)
        fc = f0 * (f1 / f0) ** k
        sos = signal.butter(2, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        y, zi = signal.sosfilt(sos, x[i:i + blk], zi=zi)
        out[i:i + blk] = y
    return out


class Track:
    def __init__(self, seconds):
        self.n = int(seconds * SR)
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)

    def add(self, at, x, gain=1.0, pan=0.0):
        i = int(at * SR)
        if i >= self.n:
            return
        x = x[: self.n - i]
        l = np.cos((pan + 1) * np.pi / 4) * gain
        r = np.sin((pan + 1) * np.pi / 4) * gain
        self.L[i:i + len(x)] += x * l
        self.R[i:i + len(x)] += x * r

    def stereo(self):
        return np.stack([self.L, self.R])


def reverb(st, seconds=2.4, mix=0.3, damp=4500):
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    out = []
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-tt * 6.9 / seconds)
        ir = lp(ir, damp)
        ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        ir /= np.sqrt((ir ** 2).sum())
        wet = signal.fftconvolve(st[ch], ir)[: st.shape[1]]
        out.append(st[ch] * (1 - mix) + wet * mix * 1.6)
    return np.stack(out)


def write(path, st, peak=0.89):
    st = np.atleast_2d(st)
    if st.shape[0] == 1:
        st = np.vstack([st, st])
    m = np.abs(st).max() or 1
    st = st / m * peak
    data = (st.T * 32767).astype('<i2')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


# ---------------------------------------------------------------- instruments

def supersaw(f, dur, voices=7, detune=0.012, bright=2400, a=0.6, r=1.2):
    tt = t_(dur)
    x = np.zeros(len(tt))
    for v in range(voices):
        d = 1 + detune * (v - voices // 2) / (voices // 2)
        x += saw(f * d, tt, rng.random())
    x = lp(x / voices, bright)
    return x * env(len(tt), a, 0.3, 0.85, r)


def brass(f, dur, open_=3200):
    tt = t_(dur)
    x = sum(saw(f * d, tt, rng.random()) for d in (0.997, 1.0, 1.004)) / 3
    x = sweep_lp(x, 500, open_)
    return x * env(len(tt), 0.04, 0.2, 0.75, 0.25)


def string_note(f, dur, bright=3000):
    tt = t_(dur)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * tt)
    ph = np.cumsum(f * vib) / SR
    x = (2 * (ph % 1) - 1) * 0.6 + (2 * ((ph * 1.003) % 1) - 1) * 0.4
    x = lp(x, bright)
    return x * env(len(tt), 0.008, 0.08, 0.6, 0.08)


def bell(f, dur, index=3.0, ratio=3.5):
    tt = t_(dur)
    e = np.exp(-tt * 2.2)
    mod = np.sin(2 * np.pi * f * ratio * tt) * index * np.exp(-tt * 3.5)
    return np.sin(2 * np.pi * f * tt + mod) * e * env(len(tt), 0.002, 0.05, 1, 0.05)


def pluck(f, dur, bright=0.5):
    """Karplus-Strong"""
    n = int(dur * SR)
    p = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, p)
    buf = lp(buf, 2000 + 6000 * bright)
    out = np.zeros(n)
    for i in range(0, n, p):
        seg = buf[: min(p, n - i)]
        out[i:i + len(seg)] = seg
        buf = 0.996 * 0.5 * (buf + np.roll(buf, -1))
    return out * env(n, 0.001, 0.02, 1, 0.05)


def bass(f, dur):
    tt = t_(dur)
    x = lp(saw(f, tt), 700) * 0.7 + np.sin(2 * np.pi * f * tt) * 0.6
    return x * env(len(tt), 0.005, 0.1, 0.8, 0.06)


def kick(power=1.0):
    tt = t_(0.5)
    f = 45 + 110 * np.exp(-tt * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7 / power)
    x += lp(rng.standard_normal(len(tt)), 3000) * np.exp(-tt * 90) * 0.4
    return x


def taiko(power=1.0):
    tt = t_(1.4)
    f = 52 + 70 * np.exp(-tt * 14)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 3.2 / power)
    skin = lp(rng.standard_normal(len(tt)), 900) * np.exp(-tt * 9) * 0.9
    return (body + skin) * 1.1


def snare():
    tt = t_(0.35)
    n = bp(rng.standard_normal(len(tt)), 900, 8000) * np.exp(-tt * 16)
    tone = np.sin(2 * np.pi * 185 * tt) * np.exp(-tt * 25)
    return n * 0.8 + tone * 0.5


def hat(open_=False):
    tt = t_(0.25 if open_ else 0.06)
    return lp(hp(rng.standard_normal(len(tt)), 7000), 11000) * np.exp(-tt * (18 if open_ else 70))


def crash(dur=2.6):
    tt = t_(dur)
    x = lp(hp(rng.standard_normal(len(tt)), 3500), 10000) * np.exp(-tt * 2.4) * 0.5
    return x + bp(rng.standard_normal(len(tt)), 400, 2500) * np.exp(-tt * 6) * 0.3


def riser(dur):
    tt = t_(dur)
    k = tt / dur
    noise = rng.standard_normal(len(tt))
    out = np.zeros(len(tt))
    blk = 1024
    for i in range(0, len(tt), blk):
        fc = 300 * (40 ** k[i])
        out[i:i + blk] = bp(noise[i:i + blk + 2048], fc * 0.7, fc * 1.4)[:len(out[i:i + blk])]
    ph = np.cumsum(110 * 2 ** (k * 3)) / SR
    tone = (2 * (ph % 1) - 1) * 0.25
    return (out * 0.8 + lp(tone, 4000)) * k ** 2


# ---------------------------------------------------------------- score

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}


def n(name, octave):
    return 12 * (octave + 1) + NOTE[name]


CHORDS = {
    'Dm': ['D', 'F', 'A'],
    'Bb': ['Bb', 'D', 'F'],
    'F': ['F', 'A', 'C'],
    'C': ['C', 'E', 'G'],
    'Gm': ['G', 'Bb', 'D'],
    'A': ['A', 'C#', 'E'],
    'D': ['D', 'F#', 'A'],
}


def chord_notes(c, octave=3):
    root = CHORDS[c][0]
    out = []
    for name in CHORDS[c]:
        o = octave + (1 if NOTE[name] < NOTE[root] else 0)
        out.append(n(name, o))
    return out


def score():
    T = Track(90.0)
    bar = 4 * BEAT

    # ---- intro 0-10: drone, swelling pad, taiko on the three lines, riser, title hit at 8.0
    tt = t_(8.4)
    drone = (np.sin(2 * np.pi * midi(n('D', 1)) * tt) * 0.7 + lp(saw(midi(n('D', 2)), tt), 300) * 0.4) * np.minimum(1, tt / 2.5)
    T.add(0, drone * env(len(tt), 2.0, 0.1, 1, 0.4), 0.3)
    for i, c in enumerate(['Dm', 'Dm', 'Bb', 'Bb']):
        for m in chord_notes(c, 3):
            T.add(i * 2.0, supersaw(midi(m), 2.3, bright=900 + 400 * i, a=0.8), 0.055, pan=0.25 * ((m % 3) - 1))
    for at, p in [(2.0, 1.0), (4.0, 1.2), (4.17, 1.0), (6.0, 1.3)]:
        T.add(at, taiko(p), 0.7)
    motif = [(2.05, 'D', 5), (2.55, 'A', 4), (3.05, 'F', 5), (3.55, 'E', 5), (4.2, 'D', 5), (4.7, 'C', 5), (5.2, 'A', 4), (6.05, 'Bb', 4), (6.55, 'A', 4), (7.05, 'C#', 5)]
    for at, nm, o in motif:
        T.add(at, bell(midi(n(nm, o)), 2.2), 0.18, pan=0.3)
    T.add(6.3, riser(1.7), 0.35)
    # title hit
    T.add(8.0, taiko(1.8), 1.0)
    T.add(8.0, kick(1.5), 0.6)
    T.add(8.0, crash(3.0), 0.45)
    for m in chord_notes('Dm', 3) + [n('D', 4), n('A', 4)]:
        T.add(8.0, brass(midi(m), 1.9, 3600), 0.12)
    for m in [n('D', 2)]:
        T.add(8.0, bass(midi(m), 2.0), 0.4)
    # pickup arps 8-10
    for i in range(16):
        m = chord_notes('Dm', 4)[i % 3] + (12 if i % 6 >= 3 else 0)
        T.add(8.0 + i * BEAT / 2, pluck(midi(m), 0.4), 0.16 * (0.4 + i / 16), pan=-0.3)

    # ---- battle 10-30: i-VI-III-VII, driving
    prog = ['Dm', 'Bb', 'F', 'C']
    for b in range(10):
        t0 = 10 + b * bar
        c = prog[b % 4]
        cn = chord_notes(c, 3)
        for m in cn:
            T.add(t0, supersaw(midi(m), bar + 0.2, bright=1600, a=0.15, r=0.3), 0.06)
        # string ostinato, 16ths
        arp = [cn[0] + 12, cn[1] + 12, cn[2] + 12, cn[1] + 12]
        for i in range(16):
            T.add(t0 + i * BEAT / 4, string_note(midi(arp[i % 4]), BEAT / 4), 0.07, pan=0.35)
        # bass 8ths
        for i in range(8):
            T.add(t0 + i * BEAT / 2, bass(midi(cn[0] - 12), BEAT / 2 * 0.9), 0.28)
        # drums
        for i in range(4):
            T.add(t0 + i * BEAT, kick(), 0.55)
            if i % 2 == 1:
                T.add(t0 + i * BEAT, snare(), 0.32)
        for i in range(8):
            T.add(t0 + i * BEAT / 2, hat(i % 2 == 1), 0.08, pan=0.4)
        T.add(t0, taiko(1.0), 0.35)
        T.add(t0 + 3.5 * BEAT, taiko(0.8), 0.25)
        # brass stabs on the chord change
        for m in cn:
            T.add(t0, brass(midi(m + 12), 0.45), 0.07)
    melody = [(0, 1, 'D', 5), (1, 0.5, 'F', 5), (1.5, 0.5, 'E', 5), (2, 1, 'D', 5), (3, 1, 'A', 4),
              (4, 1, 'Bb', 4), (5, 1, 'D', 5), (6, 1.5, 'F', 5), (7.5, 0.5, 'E', 5),
              (8, 1, 'F', 5), (9, 1, 'A', 5), (10, 1, 'G', 5), (11, 1, 'F', 5),
              (12, 1.5, 'E', 5), (13.5, 0.5, 'D', 5), (14, 1, 'C', 5), (15, 1, 'E', 5)]
    for rep in range(2):
        for b0, d, nm, o in melody:
            T.add(18 + rep * 8 + b0 * BEAT, brass(midi(n(nm, o)), d * BEAT * 0.95, 2800), 0.13, pan=-0.15)
    T.add(28.0, riser(2.0), 0.25)

    # ---- features 30-57: lighter, bells and plucks, steady pulse
    prog2 = ['Bb', 'F', 'Dm', 'C']
    for b in range(int(27 / bar) + 1):
        t0 = 30 + b * bar
        if t0 >= 57:
            break
        c = prog2[b % 4]
        cn = chord_notes(c, 3)
        for m in cn:
            T.add(t0, supersaw(midi(m), bar + 0.4, bright=1300, a=0.4, r=0.6), 0.104)
        for i in range(8):
            m = cn[i % 3] + 12 + (12 if i >= 4 else 0)
            T.add(t0 + i * BEAT / 2, pluck(midi(m), 0.6, 0.6), 0.228, pan=0.3 * (1 if i % 2 else -1))
        T.add(t0, bass(midi(cn[0] - 12), bar * 0.95), 0.418)
        T.add(t0, kick(0.8), 0.798)
        T.add(t0 + 2 * BEAT, kick(0.8), 0.684)
        T.add(t0 + 1 * BEAT, snare(), 0.266)
        T.add(t0 + 3 * BEAT, snare(), 0.266)
        for i in range(8):
            T.add(t0 + i * BEAT / 2, hat(), 0.114, pan=-0.4)
        if b % 2 == 0:
            T.add(t0, bell(midi(cn[2] + 24), 2.5, 2.0), 0.152, pan=0.4)
    T.add(55.0, riser(2.0), 0.608)

    # ---- showcase 57-76.5: everything, double-time
    prog3 = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C', 'A']
    for b in range(10):
        t0 = 57 + b * bar
        if t0 >= 76.5:
            break
        c = prog3[b % len(prog3)]
        cn = chord_notes(c, 3)
        for m in cn:
            T.add(t0, supersaw(midi(m), bar + 0.2, bright=2400, a=0.05, r=0.3), 0.07)
            T.add(t0, supersaw(midi(m + 12), bar + 0.2, bright=3000, a=0.05, r=0.3), 0.035)
        arp = [cn[0] + 12, cn[2] + 12, cn[1] + 24, cn[2] + 12]
        for i in range(16):
            T.add(t0 + i * BEAT / 4, string_note(midi(arp[i % 4]), BEAT / 4, 3800), 0.08, pan=0.35)
        for i in range(8):
            T.add(t0 + i * BEAT / 2, bass(midi(cn[0] - 12), BEAT / 2 * 0.9), 0.3)
            T.add(t0 + i * BEAT / 2, kick(), 0.48 if i % 2 == 0 else 0.3)
        for i in range(4):
            if i % 2 == 1:
                T.add(t0 + i * BEAT, snare(), 0.36)
        for i in range(16):
            T.add(t0 + i * BEAT / 4, hat(i % 4 == 2), 0.06, pan=0.4)
        T.add(t0, taiko(1.2), 0.45)
        T.add(t0 + 2.5 * BEAT, taiko(0.9), 0.3)
        for m in cn:
            T.add(t0, brass(midi(m + 12), 0.4), 0.08)
            T.add(t0 + 1.5 * BEAT, brass(midi(m + 12), 0.3), 0.05)
    hero = [(0, 2, 'A', 5), (2, 1, 'G', 5), (3, 1, 'F', 5), (4, 2, 'D', 6), (6, 1, 'C', 6), (7, 1, 'Bb', 5),
            (8, 1.5, 'Bb', 5), (9.5, 0.5, 'A', 5), (10, 1, 'G', 5), (11, 1, 'Bb', 5), (12, 3, 'A', 5), (15, 1, 'C#', 6)]
    for rep in range(2):
        for b0, d, nm, o in hero:
            at = 61 + rep * 8 + b0 * BEAT
            if at < 76.3:
                T.add(at, brass(midi(n(nm, o)), d * BEAT * 0.95, 3600), 0.13, pan=-0.15)
                T.add(at, string_note(midi(n(nm, o) - 12), d * BEAT * 0.95, 2500) * env(int(d * BEAT * 0.95 * SR), 0.05, 0.1, 1, 0.1), 0.06)
    T.add(74.5, riser(2.0), 0.4)

    # ---- finale 76.5-90: the hit, then the anthem and a long tail
    T.add(76.5, taiko(2.0), 1.0)
    T.add(76.5, kick(1.6), 0.6)
    T.add(76.5, crash(3.5), 0.5)
    fin = [('Bb', 76.5, 2.0), ('C', 78.5, 2.0), ('Dm', 80.5, 2.0), ('F', 82.5, 2.0), ('Bb', 84.5, 1.5), ('C', 86.0, 1.0), ('D', 87.0, 3.0)]
    for c, at, d in fin:
        for m in chord_notes(c, 3):
            T.add(at, supersaw(midi(m), d + 0.6, bright=2200, a=0.2, r=1.2 if c == 'D' else 0.5), 0.09)
            T.add(at, brass(midi(m + 12), d * 0.95, 3000), 0.07)
        T.add(at, bass(midi(chord_notes(c, 2)[0]), d), 0.3)
        T.add(at, taiko(1.0 if c != 'D' else 2.0), 0.4 if c != 'D' else 0.8)
    for i, (nm, o) in enumerate([('D', 5), ('F', 5), ('A', 5), ('D', 6)]):
        T.add(87.0 + i * 0.12, bell(midi(n(nm, o)), 3.0), 0.14)
    T.add(87.0, crash(3.0), 0.35)

    mix = reverb(T.stereo(), 2.6, 0.28)
    # glue: a gentle compressor and a soft limiter
    level = np.maximum(np.abs(mix[0]), np.abs(mix[1]))
    envf = signal.lfilter([0.002], [1, -0.998], level)
    thr = np.percentile(envf, 90)
    gain = np.where(envf > thr, (thr / np.maximum(envf, 1e-9)) ** 0.4, 1.0)
    mix = mix * gain
    mix = np.tanh(mix / np.abs(mix).max() * 1.6) / np.tanh(1.6)
    fade = np.ones(mix.shape[1])
    fl = int(1.5 * SR)
    fade[-fl:] = np.linspace(1, 0, fl)
    return mix * fade


# ---------------------------------------------------------------- sound effects

def sfx():
    S = {}
    def mixin(*xs):
        n = max(len(x) for x in xs)
        return sum(np.pad(x, (0, n - len(x))) for x in xs)

    S['boom'] = mixin(taiko(1.6) * 0.8, kick(1.6) * 0.6)
    S['hit'] = mixin(kick(1.2), bp(rng.standard_normal(int(0.7 * SR)), 300, 4000) * np.exp(-t_(0.7) * 14) * 0.7)
    heavy = taiko(1.4)
    heavy[: int(0.3 * SR)] += bp(rng.standard_normal(int(0.3 * SR)), 200, 6000) * np.exp(-t_(0.3) * 10)
    S['impact'] = heavy
    # whoosh: band-passed noise sweeping up then down
    n = int(0.55 * SR)
    k = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    for i in range(0, n, 512):
        fc = 400 + 2600 * np.sin(np.pi * k[i])
        out[i:i + 512] = bp(noise[i:i + 512 + 2048], fc * 0.6, fc * 1.6)[:len(out[i:i + 512])]
    S['whoosh'] = out * np.sin(np.pi * k) ** 2
    # slash: a fast bright whoosh with a metallic ring
    n = int(0.4 * SR)
    k = np.linspace(0, 1, n)
    sl = hp(rng.standard_normal(n), 2500) * np.exp(-k * 7) * np.sin(np.pi * np.minimum(1, k * 4))
    ring = sum(np.sin(2 * np.pi * f * t_(0.4)) for f in (2100, 3170, 4420)) * np.exp(-t_(0.4) * 9) * 0.15
    S['slash'] = sl + ring
    # explosion
    n = int(1.8 * SR)
    ex = lp(rng.standard_normal(n), 1200) * np.exp(-t_(1.8) * 2.6)
    S['explosion'] = mixin(ex, kick(2.0))
    # ice: crystalline shatter
    n = int(1.0 * SR)
    ice = np.zeros(n)
    for _ in range(26):
        at = int(rng.uniform(0, 0.25) * SR)
        f = rng.uniform(2200, 7000)
        d = int(rng.uniform(0.08, 0.5) * SR)
        seg = np.sin(2 * np.pi * f * t_(d / SR)) * np.exp(-t_(d / SR) * rng.uniform(8, 20))
        ice[at:at + len(seg)] += seg[: n - at] * 0.2
    ice += hp(rng.standard_normal(n), 3000) * np.exp(-t_(1.0) * 12) * 0.4
    S['ice'] = ice
    # magic: rising shimmer of bells
    n = int(1.6 * SR)
    mg = np.zeros(n)
    for i, m in enumerate([62, 65, 69, 74, 77, 81, 86]):
        at = int(i * 0.07 * SR)
        b = bell(midi(m + 12), 1.2, 1.5)
        mg[at:at + len(b)] += b[: n - at] * 0.3
    S['magic'] = mg
    # charge: a rising hum
    n = int(1.2 * SR)
    ph = np.cumsum(120 * 2 ** (t_(1.2) * 2.2)) / SR
    S['charge'] = lp(2 * (ph % 1) - 1, 2500) * np.linspace(0, 1, n) ** 1.5 * 0.6 + riser(1.2) * 0.5
    # fire hit: a burst of crackle
    n = int(0.9 * SR)
    fh = bp(rng.standard_normal(n), 300, 5000) * np.exp(-t_(0.9) * 5)
    crack = (rng.random(n) > 0.997) * rng.uniform(-1, 1, n)
    S['fire'] = mixin(fh + lp(crack, 6000) * 3 * np.exp(-t_(0.9) * 3), S['hit'] * 0.6)
    # heal: soft rising chime
    n = int(1.6 * SR)
    hl = np.zeros(n)
    for i, m in enumerate([74, 78, 81, 86]):
        at = int(i * 0.1 * SR)
        b = bell(midi(m), 1.3, 0.8, 2.0)
        hl[at:at + len(b)] += b[: n - at] * 0.35
    S['heal'] = hl
    # bite: a snap
    n = int(0.35 * SR)
    S['bite'] = bp(rng.standard_normal(n), 600, 3500) * np.exp(-t_(0.35) * 30) + np.sin(2 * np.pi * 140 * t_(0.35)) * np.exp(-t_(0.35) * 20) * 0.6
    # arrow / bolt release
    n = int(0.3 * SR)
    S['arrow'] = hp(rng.standard_normal(n), 3000) * np.exp(-t_(0.3) * 18) * 0.6 + np.sin(2 * np.pi * np.cumsum(900 - 600 * t_(0.3) / 0.3) / SR) * np.exp(-t_(0.3) * 14) * 0.3
    # dark drain: a falling warble
    n = int(1.0 * SR)
    ph = np.cumsum(260 * (1 - 0.5 * t_(1.0)) * (1 + 0.05 * np.sin(2 * np.pi * 9 * t_(1.0)))) / SR
    S['drain'] = lp(2 * (ph % 1) - 1, 1500) * env(n, 0.05, 0.2, 0.7, 0.4) * 0.6
    # poison: bubbling
    n = int(1.0 * SR)
    pz = np.zeros(n)
    for _ in range(18):
        at = int(rng.uniform(0, 0.7) * SR)
        f0 = rng.uniform(300, 900)
        d = 0.08
        seg = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 2 * t_(d) / d)) / SR) * np.exp(-t_(d) * 30)
        pz[at:at + len(seg)] += seg[: n - at] * 0.3
    S['poison'] = pz + lp(rng.standard_normal(n), 800) * env(n, 0.05, 0.2, 0.4, 0.5) * 0.4
    S['riser'] = riser(1.6)
    S['crash'] = crash(2.4)
    # meteor: a falling roar
    n = int(0.9 * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    k = np.linspace(0, 1, n)
    for i in range(0, n, 512):
        fc = 3000 * (0.15 ** k[i])
        out[i:i + 512] = bp(noise[i:i + 512 + 2048], fc * 0.5, fc * 1.5)[:len(out[i:i + 512])]
    S['meteor'] = out * np.linspace(0.2, 1, n)
    # holy pillar: a choir-like chord swell
    n = int(2.0 * SR)
    ch = sum(supersaw(midi(m), 2.0, bright=3000, a=0.3, r=0.8) for m in [62, 66, 69, 74, 78])
    S['holy'] = mixin(ch * 0.4, S['magic'] * 0.5)
    for name, x in S.items():
        st = reverb(np.stack([x, x]), 1.2, 0.18)
        write(os.path.join(OUT, 'sfx', f'{name}.wav'), st)
        print('sfx', name, f'{len(x) / SR:.2f}s')


if __name__ == '__main__':
    sfx()
    write(os.path.join(OUT, 'score.wav'), score(), 0.84)
    print('score written')
