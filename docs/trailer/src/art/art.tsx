// The trailer's own art (art-src/, prepared by scripts/prepare-art.py): the three heroes, the four foes and the
// three battle backdrops. Sprites are posed by Living Sprites' engine and wear the Battle UI's turn glow.
import React from 'react';
import { Img, staticFile } from 'remotion';
import meta from './meta.json';
import { Pose } from '../sprites/motion';
import { Backdrop } from '../fx/Backdrop';

export type ArtName = 'hero-1' | 'hero-2' | 'hero-3' | 'golem' | 'dragon' | 'wraith' | 'phantom-wolf';
type Info = { file: string; face: string | null; w: number; h: number; feetX: number; feetY: number; headY: number; cx: number; cy: number; cell: number; maskW: number; maskH: number; mask: string };
export const ART = (meta as unknown as { sprites: Record<ArtName, Info> }).sprites;
export const BACKDROPS = (meta as unknown as { backdrops: Record<string, { file: string }> }).backdrops;

export const artUrl = (n: ArtName) => staticFile(ART[n].file);
export const faceUrl = (n: ArtName) => staticFile(ART[n].face ?? ART[n].file);

/**
 * Where a sprite's image sits when its feet are at (x, y) on screen, drawn at scale k (mirrored with flip).
 * Effects anchor on the image's centre, like the module anchors them on a token's centre.
 */
export function boxOf(n: ArtName, x: number, y: number, k: number, flip = false) {
	const a = ART[n];
	const left = flip ? x - (a.w - a.feetX) * k : x - a.feetX * k;
	const top = y - a.feetY * k;
	return { left, top, w: a.w * k, h: a.h * k, cx: left + (a.w * k) / 2, cy: top + (a.h * k) / 2, head: top + a.headY * k };
}

const decoded = new Map<string, Uint8Array>();
function maskBytes(n: ArtName) {
	let m = decoded.get(n);
	if (!m) {
		const bin = atob(ART[n].mask);
		m = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) m[i] = bin.charCodeAt(i);
		decoded.set(n, m);
	}
	return m;
}

/**
 * The sprite as a pixel-effect target in art pixels (artPx screen pixels each): its size and a silhouette with
 * its own colours, which effects such as frozen, burning and electrified draw around.
 */
export function targetFor(n: ArtName, k: number, flip = false, artPx = 4) {
	const a = ART[n];
	const w = Math.max(4, Math.round((a.w * k) / artPx));
	const h = Math.max(4, Math.round((a.h * k) / artPx));
	const src = maskBytes(n);
	const data = new Uint32Array(w * h);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const ix = Math.min(a.maskW - 1, Math.floor(((flip ? w - 1 - x : x) + 0.5) * (a.maskW / w)));
			const iy = Math.min(a.maskH - 1, Math.floor((y + 0.5) * (a.maskH / h)));
			const j = (iy * a.maskW + ix) * 4;
			if (src[j + 3] > 128) data[y * w + x] = ((255 << 24) | (src[j + 2] << 16) | (src[j + 1] << 8) | src[j]) >>> 0;
		}
	return { w, h, shape: { w, h, data } };
}

/* ---------------- turn glow (Battle UI scripts/glow.mjs defaults) ---------------- */

export type Glow = { style: 'soft' | 'pulse' | 'energy' | 'flicker'; color: string; strength: number; size: number; speed: number };
export const GLOWS: Record<string, Glow> = {
	hero: { style: 'soft', color: '#5aa9ff', strength: 1, size: 1, speed: 1 },
	heroCrisis: { style: 'pulse', color: '#ff5a64', strength: 1.3, size: 1.15, speed: 1.3 },
	foe: { style: 'soft', color: '#ff5a6e', strength: 1.3, size: 1.1, speed: 1 },
	foeCrisis: { style: 'flicker', color: '#ff3b3b', strength: 1.3, size: 1.1, speed: 1 },
	boss: { style: 'energy', color: '#b072ff', strength: 1.8, size: 1.9, speed: 1 },
	bossCrisis: { style: 'energy', color: '#ff2a55', strength: 2.3, size: 2.2, speed: 1.6 },
};

/** Strength and reach of a glow at time t, after glow.mjs #tick (its random flicker drop left out, to stay deterministic) */
function glowAt(g: Glow, t0: number) {
	const t = t0 * g.speed;
	let strength = g.strength;
	let reach = g.size;
	if (g.style === 'soft') strength *= 0.85 + 0.15 * Math.sin(t * 1.8);
	else if (g.style === 'pulse') {
		const k = 0.5 + 0.5 * Math.sin(t * 3.4);
		strength *= 0.5 + 0.65 * k;
		reach *= 0.85 + 0.3 * k;
	} else if (g.style === 'energy') {
		reach *= 1.15;
		strength *= 0.9 + 0.12 * Math.sin(t * 5);
	} else strength *= Math.min(1.15, Math.max(0.15, 0.62 + 0.24 * Math.sin(t * 13.7) + 0.14 * Math.sin(t * 31.1 + 1.3)));
	return { strength, reach };
}

const rgba = (hex: string | number, a: number) => {
	const n = typeof hex === 'number' ? hex : parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
};

/**
 * A sprite standing with its feet at (x, y), posed by Living Sprites (lift, squash, lean, tint, around the feet),
 * with its soft oval shadow, the Battle UI turn glow, and a white flash when hit.
 */
export const ArtSprite: React.FC<{
	n: ArtName;
	x: number;
	y: number;
	k: number;
	flip?: boolean;
	p: Pose;
	flash?: number;
	glow?: Glow | null;
	t?: number;
	shadow?: boolean;
	alpha?: number;
	shadowW?: number;
	z?: number;
}> = ({ n, x, y, k, flip = false, p, flash = 0, glow = null, t = 0, shadow = true, alpha = 1, shadowW, z }) => {
	const a = ART[n];
	const w = a.w * k;
	const h = a.h * k;
	const fx = a.feetX * k;
	const fy = a.feetY * k;
	const sh = (a.feetY - a.headY) * k; // the figure's height, which Living Sprites' offsets are fractions of
	const dx = p.gx * sh + p.px;
	const dy = p.gy * sh + p.py;
	const lift = p.lift * sh;
	let filter = 'drop-shadow(0 6px 6px rgba(0,0,0,0.35))';
	if (glow) {
		const g = glowAt(glow, t);
		const r = Math.max(6, Math.min(w, h) * 0.06) * g.reach;
		const al = Math.min(1, 0.6 * g.strength);
		filter = `drop-shadow(0 0 ${r * 0.4}px ${rgba(glow.color, al)}) drop-shadow(0 0 ${r}px ${rgba(glow.color, al * 0.8)})`;
		if (glow.style === 'energy') filter += ` drop-shadow(0 0 ${r * 1.8}px ${rgba(glow.color, al * 0.5)})`;
	}
	const url = artUrl(n);
	const mask: React.CSSProperties = { position: 'absolute', inset: 0, WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' };
	const shadowScale = Math.max(0.35, 1 - p.lift * 3);
	const sw = (shadowW ?? 0.5) * Math.min(w, sh * 1.2);
	const centerShift = (flip ? -1 : 1) * (a.cx - a.feetX) * k * 0.6;
	return (
		<div style={{ position: 'absolute', left: x + dx, top: y + dy, width: 0, height: 0, zIndex: z }}>
			{shadow ? (
				<div style={{ position: 'absolute', left: centerShift - (sw * shadowScale) / 2, top: -sh * 0.03, width: sw * shadowScale, height: sh * 0.07, borderRadius: '50%', background: `radial-gradient(closest-side, rgba(5,6,14,${0.6 * alpha * p.alpha}), rgba(5,6,14,0))` }} />
			) : null}
			<div
				style={{
					position: 'absolute',
					left: -fx,
					top: -fy - lift,
					width: w,
					height: h,
					transformOrigin: `${fx}px ${fy}px`,
					transform: `rotate(${p.rot}rad) scale(${p.sx * (flip ? -1 : 1)}, ${p.sy})`,
					opacity: Math.max(0, Math.min(1, p.alpha * alpha)),
					filter,
				}}
			>
				<Img src={url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
				{p.tintAmt > 0.01 ? <div style={{ ...mask, background: rgba(p.tint, 1), mixBlendMode: 'multiply', opacity: Math.min(1, p.tintAmt) }} /> : null}
				{flash > 0.01 ? <div style={{ ...mask, background: '#ffffff', opacity: Math.min(1, flash) }} /> : null}
			</div>
		</div>
	);
};

/* ---------------- backdrops ---------------- */

const FALLBACK_TINT: Record<string, string> = { cave: 'rgba(40, 190, 200, 0.22)', field: 'rgba(80, 200, 160, 0.2)', aurora: 'rgba(140, 90, 255, 0.22)' };

/**
 * A battle backdrop (flower field, aurora or crystal cave) at 1920 x 1080. Until its image is in art-src/, the module's own pixel
 * backdrop stands in, tinted.
 */
export const Scenery: React.FC<{ kind: 'field' | 'aurora' | 'cave' }> = ({ kind }) => {
	const b = BACKDROPS[kind];
	if (b) return <Img src={staticFile(b.file)} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />;
	return (
		<>
			<Backdrop w={480} h={270} ground={170} scale={4} />
			<div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, background: FALLBACK_TINT[kind], mixBlendMode: 'screen' }} />
		</>
	);
};
