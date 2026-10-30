// The impact layer from Fabula Ultima Battle Animations (scripts/impact.mjs), as pure functions of the frame:
// hit freezes, screen shake, camera pushes, flashes and knockback.
import { Easing, interpolate } from 'remotion';

export type Freeze = { at: number; len: number };

/**
 * Scene time with hit freezes: the effects and fighters hold for a moment when a blow lands
 * (the module freezes its own clock the same way), while the camera and shake keep running.
 */
export function sceneFrame(f: number, freezes: Freeze[]): number {
	let out = f;
	for (const z of freezes) out -= Math.max(0, Math.min(f - z.at, z.len));
	return out;
}

export type Shake = { at: number; power: number; len?: number };

/** Screen shake: a decaying wobble per event (impact.mjs shake(power, ms)) */
export function shakeAt(f: number, shakes: Shake[]): { x: number; y: number } {
	let x = 0;
	let y = 0;
	for (const s of shakes) {
		const len = s.len ?? 16;
		const k = (f - s.at) / len;
		if (k < 0 || k > 1) continue;
		const a = s.power * 14 * Math.pow(1 - k, 2);
		x += a * Math.sin((f - s.at) * 2.9 + s.at);
		y += a * Math.cos((f - s.at) * 3.7 + s.at * 0.7);
	}
	return { x, y };
}

/** A quick flash that peaks at `at` and fades over `len` frames */
export const pulse = (f: number, at: number, len: number, peak = 1) => (f < at || f > at + len ? 0 : peak * Math.pow(1 - (f - at) / len, 2));

/** Knockback along x: out fast, back slow (impact.mjs stagger) */
export const knock = (f: number, at: number, dist: number, len = 24) => {
	const k = (f - at) / len;
	if (k < 0 || k > 1) return 0;
	return dist * (k < 0.2 ? Easing.out(Easing.cubic)(k / 0.2) : 1 - Easing.inOut(Easing.cubic)((k - 0.2) / 0.8));
};

export type Cam = { x: number; y: number; zoom: number };
export type CamKey = { f: number; cam: Cam; ease?: (t: number) => number };

/** Camera from keyframes: each move eases from the previous key */
export function camAt(f: number, keys: CamKey[]): Cam {
	if (f <= keys[0].f) return keys[0].cam;
	for (let i = 1; i < keys.length; i++) {
		const a = keys[i - 1];
		const b = keys[i];
		if (f <= b.f) {
			const t = interpolate(f, [a.f, b.f], [0, 1], { easing: b.ease ?? Easing.inOut(Easing.cubic) });
			return { x: a.cam.x + (b.cam.x - a.cam.x) * t, y: a.cam.y + (b.cam.y - a.cam.y) * t, zoom: a.cam.zoom * Math.pow(b.cam.zoom / a.cam.zoom, t) };
		}
	}
	return keys[keys.length - 1].cam;
}

/** CSS transform that puts world point (cam.x, cam.y) at the screen centre */
export const camTransform = (c: Cam, W = 1920, H = 1080, shake = { x: 0, y: 0 }) => `translate(${W / 2 - c.x * c.zoom + shake.x}px, ${H / 2 - c.y * c.zoom + shake.y}px) scale(${c.zoom})`;

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const ramp = (f: number, a: number, b: number, ease: (t: number) => number = Easing.inOut(Easing.cubic)) => ease(clamp01((f - a) / (b - a)));
