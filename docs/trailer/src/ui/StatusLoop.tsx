// Conditions on the map, after Fabula Ultima Battle Animations' scripts/statuses.mjs: the same tiny pixel
// sprites (bubbles, stars, sweat drop, arrows, anger mark, Zs, ripples), colors and timings, drawn as SVG
// rectangles instead of PIXI graphics.
import React from 'react';

const ART: Record<string, string[]> = {
	bubble: ['.##.', '#o.#', '#..#', '.##.'],
	star: ['..#..', '.###.', '##o##', '.###.', '.#.#.'],
	drop: ['.#.', '.#.', '#o#', '###', '.#.'],
	arrow: ['.###.', '.###.', '#####', '.###.', '..#..'],
	anger: ['.#...#.', '##...##', '.......', '.......', '.......', '##...##', '.#...#.'],
	z: ['####', '..#.', '.#..', '####'],
	shakeL: ['.#', '#.', '#.', '.#'],
	shakeR: ['#.', '.#', '.#', '#.'],
};

export const LOOKS: Record<string, { tint?: number; strength?: number; color: string; light?: string }> = {
	poisoned: { tint: 0x7fe05a, strength: 0.32, color: '#8ee65a', light: '#d8ffb0' },
	dazed: { color: '#ffe14d', light: '#ffffff' },
	shaken: { color: '#9fd0ff', light: '#ffffff' },
	slow: { tint: 0x6fb4ff, strength: 0.28, color: '#8fd8ff' },
	weak: { tint: 0x9a8fb8, strength: 0.42, color: '#c7a6ff', light: '#f0e6ff' },
	enraged: { tint: 0xff4a4a, strength: 0.38, color: '#ff5a5a', light: '#ffd0d0' },
	sleep: { tint: 0x5a6aa8, strength: 0.18, color: '#bfd6ff', light: '#ffffff' },
};

const frac = (v: number) => v - Math.floor(v);

type Box = { x: number; y: number; hw: number; top: number; bottom: number; p: number; q: number };

function sprite(out: React.ReactNode[], art: string, x: number, y: number, p: number, color: string, light: string | undefined, alpha: number) {
	const rows = ART[art];
	const w = rows[0].length;
	const h = rows.length;
	const x0 = Math.round(x / p - w / 2) * p;
	const y0 = Math.round(y / p - h / 2) * p;
	rows.forEach((row, r) =>
		[...row].forEach((ch, c) => {
			if (ch === '.') return;
			out.push(<rect key={out.length} x={x0 + c * p} y={y0 + r * p} width={p} height={p} fill={ch === 'o' ? (light ?? color) : color} opacity={alpha} />);
		}),
	);
}

const DRAW: Record<string, (o: React.ReactNode[], b: Box, t: number, seed: number) => void> = {
	poisoned: (o, b, t, seed) => {
		for (let i = 0; i < 4; i++) {
			const k = frac(t / 2.2 + i / 4 + seed);
			const x = b.x + Math.sin(seed * 9 + i * 2.3) * b.hw * 0.55 + Math.sin(t * 3 + i) * b.p * 2;
			const y = b.y + b.bottom * 0.3 - k * (b.bottom * 0.3 - b.top - b.p * 6);
			const a = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
			sprite(o, 'bubble', x, y, b.q, LOOKS.poisoned.color, LOOKS.poisoned.light, a * 0.9);
		}
	},
	dazed: (o, b, t) => {
		for (let i = 0; i < 3; i++) {
			const ang = t * 3.2 + (i * Math.PI * 2) / 3;
			sprite(o, 'star', b.x + Math.cos(ang) * b.hw * 0.5, b.y + b.top - b.p * 3 + Math.sin(ang) * b.p * 3, b.q, LOOKS.dazed.color, LOOKS.dazed.light, Math.sin(ang) < 0 ? 0.75 : 1);
		}
	},
	shaken: (o, b, t) => {
		const jitter = Math.round(Math.sin(t * 40)) * b.p;
		if (frac(t * 1.4) < 0.7) {
			const y = b.y + b.top * 0.35;
			sprite(o, 'shakeL', b.x - b.hw * 0.62 + jitter, y, b.p, LOOKS.shaken.color, undefined, 0.9);
			sprite(o, 'shakeR', b.x + b.hw * 0.62 - jitter, y, b.p, LOOKS.shaken.color, undefined, 0.9);
		}
		const k = frac(t / 1.8);
		sprite(o, 'drop', b.x + b.hw * 0.35, b.y + b.top + b.p * 3 + k * b.p * 8, b.q, LOOKS.shaken.color, LOOKS.shaken.light, k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8);
	},
	slow: (o, b, t) => {
		for (let i = 0; i < 2; i++) {
			const k = frac(t / 2.6 + i / 2);
			const rx = b.hw * (0.35 + k * 0.6);
			o.push(<ellipse key={o.length} cx={b.x} cy={b.y + b.bottom - b.p} rx={rx} ry={rx * 0.3} fill="none" stroke={LOOKS.slow.color} strokeWidth={b.p} opacity={(1 - k) * 0.8} />);
		}
	},
	weak: (o, b, t) => {
		for (let i = 0; i < 2; i++) {
			const k = frac(t / 1.9 + i / 2);
			const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
			sprite(o, 'arrow', b.x + (i ? 1 : -1) * b.hw * 0.62, b.y + b.top * 0.6 + k * b.p * 12, b.q, LOOKS.weak.color, LOOKS.weak.light, a * 0.9);
		}
	},
	enraged: (o, b, t) => {
		const big = frac(t * 1.6) < 0.18;
		sprite(o, 'anger', b.x + b.hw * 0.42, b.y + b.top + b.p * 2, Math.round(b.q * (big ? 1.35 : 1)), LOOKS.enraged.color, LOOKS.enraged.light, 1);
	},
	sleep: (o, b, t) => {
		for (let i = 0; i < 3; i++) {
			const k = frac(t / 2.4 + i / 3);
			sprite(o, 'z', b.x + b.hw * 0.3 + k * b.p * 6 + Math.sin(k * 6) * b.p * 1.5, b.y + b.top - k * b.p * 12, Math.max(1, Math.round(b.q * (0.7 + k * 0.5))), LOOKS.sleep.color, undefined, Math.sin(Math.PI * k));
		}
	},
};

/** The tint strength a condition puts on the sprite at time t (one condition: a gentle breathing of its strength) */
export const statusTint = (kind: string, t: number) => {
	const L = LOOKS[kind];
	if (L?.tint == null) return null;
	const phase = (t % 1.6) / 1.6;
	return { tint: L.tint, tintAmt: (L.strength ?? 0.3) * (0.65 + 0.35 * Math.sin(phase * Math.PI * 2)) };
};

/**
 * A condition loop on a sprite. (x, y): the sprite's centre on screen; hw: half its width; top / bottom: how far
 * its head and feet are from the centre (negative up); p: one art pixel on screen.
 */
export const StatusLoop: React.FC<{ kind: string; x: number; y: number; hw: number; top: number; bottom?: number; p: number; t: number; seed?: number }> = ({ kind, x, y, hw, top, bottom = -top, p, t, seed = 0.3 }) => {
	const out: React.ReactNode[] = [];
	DRAW[kind]?.(out, { x, y, hw, top, bottom, p, q: Math.max(2, Math.round(p * 1.5)) }, t, seed);
	return (
		<svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} width={1} height={1} shapeRendering="crispEdges">
			{out}
		</svg>
	);
};
