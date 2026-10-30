// Sprite motion from Living Sprites' engine (scripts/engine.js): idle loops and one-shot actions,
// layered the way the module layers them, at a time in seconds.
import { ACTIONS, IDLE, MOVE, combine, pose } from '../vendor/fu-living-sprites/scripts/engine.js';

export type Pose = { gx: number; gy: number; px: number; py: number; lift: number; sx: number; sy: number; rot: number; alpha: number; tint: number; tintAmt: number };
export type Act = { id: 'attack' | 'hurt' | 'cast' | 'heal' | 'dodge' | 'jump' | 'victory' | 'collapse'; at: number; travelX?: number; travelY?: number; ko?: boolean; k?: number };

export const ACTION_DUR: Record<string, number> = Object.fromEntries(Object.entries(ACTIONS).map(([k, v]) => [k, (v as { duration: number }).duration]));

/**
 * @param t seconds
 * @param idle an IDLE preset (breathe, bob, bounce, battle, sway, hover, ghostly, nervous, knockedOut, none)
 * @param k strength
 * @param dir +1 facing right, -1 facing left
 * @param acts actions, each starting at `at` seconds; a collapse with ko stays down
 */
export function poseAt(t: number, idle: string, k: number, dir: number, acts: Act[] = [], phase = 0): Pose {
	let p = pose((IDLE as Record<string, { fn: (t: number, k: number, c: object) => object }>)[idle]?.fn(t + phase, k, { dir }) ?? {});
	for (const a of acts) {
		const d = (ACTIONS as Record<string, { duration: number; fn: (p: number, k: number, c: object) => object }>)[a.id];
		let q = (t - a.at) / d.duration;
		if (q < 0) continue;
		if (q > 1) {
			if (!(a.id === 'collapse' && a.ko)) continue;
			q = 1;
		}
		p = combine(p, d.fn(q, a.k ?? k, { dir, travelX: a.travelX ?? 0, travelY: a.travelY ?? 0, ko: !!a.ko }));
	}
	return p as Pose;
}

/** Is a knocked-out collapse finished (so the idle should stop)? */
export const downAfter = (acts: Act[]) => acts.find((a) => a.id === 'collapse' && a.ko)?.at;

/** A Living Sprites movement preset (Hop, Waddle, March, Glide, Fly) at time t, while walking toward dir */
export function movePose(id: string, t: number, dir: number, k = 1): Pose {
	return pose((MOVE as Record<string, { fn: (t: number, k: number, c: object) => object }>)[id]?.fn(t, k, { dir }) ?? {}) as Pose;
}
