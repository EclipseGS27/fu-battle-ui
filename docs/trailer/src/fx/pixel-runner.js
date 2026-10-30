// Runs Fabula Ultima Battle Animations' pixel effects outside Foundry, one frame at a time.
//
// The effects themselves are the module's own code (src/vendor/fu-animations, synced by
// scripts/sync-assets.mjs). This file adapts the small, engine-free parts of the module's
// scripts/pixel.mjs (placement, PixelRun, soften, the editor preview's 2D canvas drawing) so a
// whole stage can be drawn into one shared pixel buffer and stepped at a fixed 60 steps a second:
// the same frame number always gives the same picture, which is what a video renderer needs.

import { PIXEL, ELEMENT_RAMPS } from '../vendor/fu-animations/scripts/pixelfx.mjs';
import { bayer, hex, resample } from '../vendor/fu-animations/scripts/sf/kit.mjs';
import snow from '../vendor/fu-animations/scripts/sf/snow.mjs';
import embers from '../vendor/fu-animations/scripts/sf/embers.mjs';
import fog from '../vendor/fu-animations/scripts/sf/fog.mjs';
import fireflies from '../vendor/fu-animations/scripts/sf/fireflies.mjs';
import sparkle from '../vendor/fu-animations/scripts/sf/sparkle.mjs';

export { PIXEL };
export const PX = 2; // Sprite Fusion world units per art pixel
export const ORIGIN = 4096; // art pixel where an effect's anchor sits
export const STEP = 1 / 60;

/* ---------------- shapes ---------------- */

/** The lowest solid row of a shape: where its feet are */
function feetRow(shape) {
	if (!shape?.data) return null;
	if (shape.feet !== undefined) return shape.feet;
	let feet = null;
	for (let y = shape.h - 1; y >= 0 && feet == null; y--) {
		let solid = 0;
		for (let x = 0; x < shape.w; x++) if (shape.data[y * shape.w + x] >>> 24 > 96 && ++solid >= 2) break;
		if (solid >= 2) feet = y;
	}
	shape.feet = feet;
	return feet;
}

/* ---------------- placement (from pixel.mjs) ---------------- */

function hexRampOf(hexStr) {
	const n = parseInt(hexStr.slice(1), 16);
	const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	const mix = (to, k) => '#' + c.map((v) => Math.round(v + (to - v) * k).toString(16).padStart(2, '0')).join('');
	return ['#ffffff', mix(255, 0.75), mix(255, 0.5), mix(255, 0.25), mix(255, 0), mix(0, 0.3), mix(0, 0.55), mix(0, 0.78)];
}

function rampOf(element) {
	const r = ELEMENT_RAMPS[element] ?? (/^#[0-9a-f]{6}$/i.test(element ?? '') ? hexRampOf(element) : null);
	return { ramp: (n) => (r ? resample(r.map(hex), n) : undefined), hexRamp: (n) => (r ? resample(r, n) : undefined) };
}

/**
 * Where an effect plays, in Sprite Fusion world units. Positions (anchor, from, aim) are in art pixels.
 * target / source: { w, h, shape? } in art pixels; shape: { w, h, data: Uint32Array (ABGR) }
 */
export function placement(o) {
	const toLocal = (p) => [(ORIGIN + (p.x - o.anchor.x)) * PX, (ORIGIN + (p.y - o.anchor.y)) * PX];
	const [x, y] = toLocal(o.anchor);
	const [fx, fy] = o.from ? toLocal(o.from) : [x, y];
	const dx = x - fx;
	const dy = y - fy;
	const dist = Math.hypot(dx, dy);
	const [ax, ay] = o.aim ? toLocal(o.aim) : [x, y];
	const aimed = dist <= 1 && Math.hypot(ax - x, ay - y) > 1;
	const angle = dist > 1 ? Math.atan2(dy, dx) : aimed ? Math.atan2(ay - y, ax - x) : 0;
	const facing = (dist > 1 ? dx : aimed ? ax - x : 1) < -1 ? -1 : 1;
	const T = o.target ?? { w: 36, h: 36 };
	const S = o.source ?? T;
	const hT = (T.h * PX) / 2;
	const tf = feetRow(T.shape);
	const ground = tf != null ? y + (tf + 1 - T.shape.h / 2) * PX : y + hT * 0.9;
	const sf = feetRow(S.shape);
	const head = y - hT * 0.8;
	const reach = (Math.max(S.w, S.h) * PX) / 2;
	const hand =
		dist > 1
			? { x: fx + Math.cos(angle) * reach * 0.55, y: fy + Math.sin(angle) * reach * 0.55, a: angle }
			: { x: x + Math.cos(angle) * reach * 0.55, y: y + Math.sin(angle) * reach * 0.55, a: angle };
	const shape = T.shape;
	const target = {
		feet: () => [x, ground],
		head: () => [x, head],
		hand: () => ({ x, y, a: angle }),
		silhouette: () => (shape ? { x: Math.round(x / PX - shape.w / 2), y: Math.round(y / PX - shape.h / 2), w: shape.w, h: shape.h, data: shape.data } : null),
	};
	const source = {
		feet: () => [fx, sf != null ? fy + (sf + 1 - S.shape.h / 2) * PX : fy + ((S.h * PX) / 2) * 0.9],
		head: () => [fx, fy - ((S.h * PX) / 2) * 0.8],
		hand: () => hand,
		silhouette: () => null,
	};
	return { x, y, ground, head, from: [fx, fy], to: [x, y], hand, angle, facing, dist, seed: o.seed ?? 1, element: o.element, ...rampOf(o.element), target, source, hook: {}, toLocal };
}

/* ---------------- PixelRun (from pixel.mjs) ---------------- */

export class PixelRun {
	constructor(id, P, { onHit } = {}) {
		this.def = PIXEL[id];
		if (!this.def) throw new Error(`Unknown pixel effect ${id}`);
		this.P = P;
		this.t = 0;
		this.hitDone = false;
		this.hitAt = null;
		this.onHit = onHit;
		const parts = this.def.make(P);
		this.parts = parts.map((p, i) => ({ ...p, i, fx: null, make: p.fx, hitAt: null, started: false }));
		this.main = this.parts.find((p) => p.main) ?? this.parts[0];
		this.stopped = false;
	}
	start(part) {
		part.started = true;
		this.P.hook = { shake: () => this.landed(part), flash: () => this.landed(part), ripple: () => this.landed(part) };
		try {
			part.fx = part.make();
		} catch (err) {
			console.warn('pixel effect', err);
			part.fx = null;
		}
		this.P.hook = {};
	}
	landed(part) {
		if (part.hitAt != null) return;
		part.hitAt = this.t;
		if (part === this.main && this.def.hit === 'hook') this.hit();
	}
	hit() {
		if (this.hitDone) return;
		this.hitDone = true;
		this.hitAt = this.t;
		this.onHit?.(this.t);
	}
	update(dt) {
		this.t += dt;
		const { def, t } = this;
		for (const p of this.parts) {
			if (p.started) continue;
			const after = p.after != null ? this.parts[p.after] : null;
			if (after ? after.hitAt != null : t >= (p.at ?? 0)) this.start(p);
		}
		if (typeof def.hit === 'number' && t >= def.hit) this.hit();
		if (!this.hitDone && t >= def.cap * 0.75) this.hit();
		if (def.stopAt && !this.stopped && t >= def.stopAt) {
			this.stopped = true;
			for (const p of this.parts) p.fx?.stop?.();
		}
		for (const p of this.parts) {
			if (!p.fx) continue;
			try {
				p.tick?.(p.fx, t - (p.at ?? 0));
				p.fx.update(dt);
			} catch (err) {
				console.warn('pixel effect', err);
				p.fx = null;
			}
		}
	}
	draw(back, front) {
		for (const p of this.parts) {
			if (!p.fx) continue;
			try {
				if (back) p.fx.draw(back, 'back');
				p.fx.draw(front, 'front');
			} catch (err) {
				console.warn('pixel effect', err);
				p.fx = null;
			}
		}
	}
	get over() {
		return this.parts.every((p) => p.started && (!p.fx || p.fx.done()));
	}
}

/** Dither away the outer band of a frame (from pixel.mjs) */
export function soften(f, m = 22, lightOnly = false) {
	const { w, h, color, light } = f;
	for (let y = 0; y < h; y++) {
		const dy = Math.min(y, h - 1 - y);
		const band = dy < m;
		for (let x = 0; x < w; x++) {
			const d = band ? Math.min(dy, x, w - 1 - x) : Math.min(x, w - 1 - x);
			if (d >= m) {
				if (w - 1 - m > x) x = w - 1 - m;
				continue;
			}
			if (bayer(x + f.ox, y + f.oy) >= d / m) {
				const i = y * w + x;
				if (!lightOnly) color[i] = 0;
				light[i] = 0;
			}
		}
	}
}

/** The glow buffer as see-through pixels: brightness becomes alpha, so it adds light over anything (from pixel.mjs) */
export function glowPixels(light, out = new Uint8ClampedArray(light.length * 4)) {
	out.fill(0);
	for (let i = 0; i < light.length; i++) {
		const c = light[i];
		if (!c) continue;
		const r = c & 255;
		const g = (c >>> 8) & 255;
		const b = (c >>> 16) & 255;
		const m = Math.max(r, g, b);
		if (!m) continue;
		const k = 255 / m;
		const j = i * 4;
		out[j] = r * k;
		out[j + 1] = g * k;
		out[j + 2] = b * k;
		out[j + 3] = m;
	}
	return out;
}

/* ---------------- a stage of effects ---------------- */

/**
 * One effect on a stage.
 * @typedef {{ id: string, at: number, x: number, y: number, from?: {x:number,y:number}, aim?: {x:number,y:number},
 *   element?: string, seed?: number, target?: object, source?: object, alpha?: number }} Cue
 *   at: the step (1/60 s) it starts on; x, y, from, aim: art pixels on the stage
 */

/**
 * Every cue's run, stepped to `step`. Kept per stage so consecutive frames only step once each;
 * asking for an earlier step starts again from zero, so any frame renders the same either way.
 */
export class Stage {
	constructor(w, h, cues) {
		this.w = w;
		this.h = h;
		this.cues = cues;
		this.reset();
		this.back = { w, h, ox: 0, oy: 0, color: new Uint32Array(w * h), light: new Uint32Array(w * h) };
		this.front = { w, h, ox: 0, oy: 0, color: new Uint32Array(w * h), light: new Uint32Array(w * h) };
	}
	reset() {
		this.step = 0;
		this.live = this.cues.map((c) => ({ cue: c, run: null, age: 0, fade: null, gone: false }));
	}
	advance(to) {
		if (to < this.step) this.reset();
		while (this.step < to) {
			this.step++;
			for (const L of this.live) {
				const c = L.cue;
				if (L.gone || this.step < c.at) continue;
				if (!L.run) {
					if (c.make) L.run = ambientRun(c.make());
					else {
						const P = placement({ anchor: { x: c.x, y: c.y }, from: c.from, aim: c.aim, element: c.element, seed: c.seed ?? 7, target: c.target, source: c.source });
						L.run = new PixelRun(c.id, P);
					}
					continue; // the first update happens on the next step, like a ticker
				}
				if (c.until != null && this.step >= c.until && L.fade == null) L.fade = L.age;
				L.run.update(STEP);
				L.age += STEP;
				const def = L.run.def;
				if (L.fade == null && (L.run.over || L.age >= def.cap)) L.fade = L.run.over ? L.age - 0.25 : L.age;
				if (L.fade != null && (L.age - L.fade) / 0.25 >= 1) L.gone = true;
			}
		}
	}
	/** Draw every live effect into the stage's back and front buffers; returns per-cue alpha for fades */
	draw() {
		for (const f of [this.back, this.front]) {
			f.color.fill(0);
			f.light.fill(0);
		}
		for (const L of this.live) {
			if (!L.run || L.gone) continue;
			const c = L.cue;
			// the buffers are shared; each run sees them through its own origin
			const ox = ORIGIN - Math.round(c.x);
			const oy = ORIGIN - Math.round(c.y);
			const fade = L.fade == null ? 1 : Math.max(0, 1 - (L.age - L.fade) / 0.25);
			const a = (c.alpha ?? 1) * fade;
			if (a <= 0.02) continue;
			const view = (f) => ({ ...f, ox, oy });
			if (a >= 0.999) L.run.draw(view(this.back), view(this.front));
			else {
				// a fading effect: drawn on its own, then dithered in (pixel art fades without transparency)
				const b = { w: this.w, h: this.h, ox, oy, color: new Uint32Array(this.w * this.h), light: new Uint32Array(this.w * this.h) };
				const fr = { ...b, color: new Uint32Array(this.w * this.h), light: new Uint32Array(this.w * this.h) };
				L.run.draw(b, fr);
				for (const [src, dst] of [[b, this.back], [fr, this.front]]) {
					for (let i = 0; i < src.color.length; i++) {
						const x = i % this.w;
						const y = (i / this.w) | 0;
						if (a > bayer(x, y)) {
							if (src.color[i]) dst.color[i] = src.color[i];
						}
						if (src.light[i]) {
							const s = src.light[i];
							const k = a;
							const add = (sh) => Math.min(255, ((dst.light[i] >>> sh) & 255) + ((s >>> sh) & 255) * k);
							dst.light[i] = ((255 << 24) | (add(16) << 16) | (add(8) << 8) | add(0)) >>> 0;
						}
					}
				}
			}
			if (L.run.def.soft) {
				// area effects (weather) fade out at their edges
				soften(this.back, 22);
				soften(this.front, 22);
			}
		}
	}
	/** Advance to a step and draw it, once per step however many layers ask */
	ensure(step) {
		if (this.drawn === step) return;
		this.advance(step);
		this.draw();
		this.drawn = step;
	}
	/** When each cue lands (step number), for timing hits, shakes and sounds */
	hitSteps() {
		return this.live.map((L) => (L.run?.hitAt != null ? L.cue.at + 1 + Math.round(L.run.hitAt / STEP) : null));
	}
}

/* ---------------- ambient weather ---------------- */

/** A raw effect that runs until its cue's `until` (no stop, no cap), wrapped to look like a PixelRun */
function ambientRun(fx) {
	return {
		def: { cap: Infinity, soft: false },
		hitAt: null,
		over: false,
		update(dt) {
			fx.update(dt);
		},
		draw(back, front) {
			fx.draw(back, 'back');
			fx.draw(front, 'front');
		},
	};
}

const MAKERS = { snow, embers, fog, fireflies, sparkle };

/**
 * A full-stage weather cue from the Sprite Fusion effects the module ships (snow, embers, fog, fireflies),
 * anchored at the stage's top-left: stage pixel (x, y) is world ((ORIGIN + x) * PX, (ORIGIN + y) * PX).
 * area and ground are in stage art pixels.
 */
/** @param {string} kind @param {{ at?: number, until?: number, area: { x: number, y: number, w: number, h: number }, ground?: number, seed?: number, [k: string]: any }} o */
export function ambient(kind, { at = 0, until, area, ground, seed = 5, ...opts }) {
	const w = (v) => (ORIGIN + v) * PX;
	return {
		id: `ambient-${kind}`,
		at,
		until,
		x: 0,
		y: 0,
		make: () =>
			MAKERS[kind]({
				area: { x: w(area.x), y: w(area.y), w: area.w * PX, h: area.h * PX },
				...(ground != null ? { ground: w(ground) } : {}),
				seed,
				...opts,
			}),
	};
}

/* ---------------- sprites as effect targets ---------------- */

/** A shape from sprite rows ('.' empty) for silhouettes, feet and heads */
export function shapeFromRows(rows, palette) {
	const w = rows[0].length;
	const h = rows.length;
	const data = new Uint32Array(w * h);
	rows.forEach((r, y) =>
		[...r].forEach((ch, x) => {
			if (ch === '.') return;
			data[y * w + x] = hex(palette[ch] ?? '#808080');
		}),
	);
	return { w, h, data };
}
