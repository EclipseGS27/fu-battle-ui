// Act 1: "Every spell. Every strike. Every foe." Each line with the module that does it, then the title over
// the crystal cave. The spell and strike are Battle Animations' pixel effects; the foes are the four the party
// meets later, rising out of the dark (the module animates every attack in the bestiaries).
import React from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { Backdrop } from '../fx/Backdrop';
import { PixelLayer, useStage, Cue } from '../fx/PixelLayer';
import { ambient } from '../fx/pixel-runner.js';
import { pulse, ramp, shakeAt, Shake } from '../fx/impact';
import { ArtName, ArtSprite, GLOWS, Scenery, targetFor } from '../art/art';
import { poseAt } from '../sprites/motion';
import { Kicker, Letters, TitleLockup } from '../ui/Type';
import { C, DISP } from '../theme';

export const OPENING_LEN = 620;
const S = 4;
const W = 480;
const H = 270;
export const T = { spell: 120, strike: 240, foe: 360, title: 480 };

const hero = targetFor('hero-1', 0.5);
const dummy = { w: hero.w, h: hero.h };
const cues: Cue[] = [
	ambient('embers', { at: 0, area: { x: 20, y: 80, w: 440, h: 200 }, density: 0.35 }),
	{ id: 'sf-glyph', at: T.spell + 2, x: 240, y: 132, element: 'light', target: { ...dummy, shape: hero.shape } },
	{ id: 'sf-pillar', at: T.spell + 6, x: 240, y: 132, element: 'light', target: { ...dummy, shape: hero.shape } },
];
// the strike gets pixels twice the size, so the blow fills the frame
const strikeCues: Cue[] = [
	{ id: 'sf-slash-x', at: T.strike + 4, x: 120, y: 74, from: { x: 90, y: 74 }, target: { ...dummy, shape: hero.shape } },
	{ id: 'sf-impact-heavy', at: T.strike + 10, x: 120, y: 74, from: { x: 90, y: 74 }, target: { ...dummy, shape: hero.shape } },
	{ id: 'sf-shockwave', at: T.strike + 10, x: 120, y: 74, target: { ...dummy, shape: hero.shape } },
];
const titleCues: Cue[] = [ambient('fireflies', { at: 0, area: { x: -20, y: 20, w: 520, h: 240 }, density: 0.5 }), ambient('fog', { at: 0, area: { x: -40, y: 160, w: 560, h: 60 }, density: 0.5 })];

// the four foes, left to right, rising out of the dark one after another
const FOES: { n: ArtName; x: number; y: number; k: number; flip: boolean; glow: string; idle: string }[] = [
	{ n: 'phantom-wolf', x: 470, y: 1015, k: 0.72, flip: false, glow: '#5fe0ff', idle: 'battle' },
	{ n: 'wraith', x: 820, y: 985, k: 0.8, flip: false, glow: '#a6ecff', idle: 'ghostly' },
	{ n: 'golem', x: 1130, y: 1020, k: 0.82, flip: true, glow: '#b072ff', idle: 'breathe' },
	{ n: 'dragon', x: 1560, y: 1025, k: 0.86, flip: true, glow: '#62e26a', idle: 'breathe' },
];
const shakes: Shake[] = [{ at: T.strike + 10, power: 1.6, len: 26 }];

/** One "EVERY ..." line: letters rise in, hold, then sweep out */
const Line: React.FC<{ f: number; at: number; text: string; module: string; out: number; top?: number }> = ({ f, at, text, module, out, top = 230 }) => {
	if (f < at - 2 || f > out + 16) return null;
	const k = ramp(f, at + 14, at + 34, Easing.out(Easing.cubic)) * (1 - ramp(f, out, out + 12));
	return (
		<div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
			<div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 190, lineHeight: 1, letterSpacing: '0.08em', color: '#fff', textShadow: '0 6px 0 rgba(0,0,0,0.6), 0 0 50px rgba(5,8,20,0.95)' }}>
				<Letters text={text} f={f} start={at} stagger={2.2} len={18} exit={out} />
			</div>
			<div style={{ marginTop: 18, opacity: k, transform: `translateY(${(1 - k) * 12}px)` }}>
				<Kicker size={34}>{module}</Kicker>
			</div>
		</div>
	);
};

export const Opening: React.FC = () => {
	const f = useCurrentFrame();
	const stage = useStage(W, H, cues);
	const strike = useStage(240, 135, strikeCues);
	const tstage = useStage(W, H, titleCues);
	const sh = shakeAt(f, shakes);
	const flash = pulse(f, T.title - 2, 26, 1) + pulse(f, T.strike + 10, 10, 0.35);
	const titleK = ramp(f, T.title - 2, T.title + 10);
	const t = f / 60;
	const tf = Math.max(0, f - T.title + 60);
	// the camera drifts down onto the battlefield under the title
	const drift = ramp(f, T.title - 10, OPENING_LEN, Easing.inOut(Easing.quad));
	return (
		<AbsoluteFill className="trailer-root" style={{ background: '#03050b' }}>
			{/* the three lines */}
			<AbsoluteFill style={{ opacity: 1 - titleK, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
				<div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: 0.55 * ramp(f, 0, 110), transform: `scale(${1.08 - 0.06 * ramp(f, 0, T.title)})`, transformOrigin: '50% 70%' }}>
					<Backdrop w={W} h={H} ground={H} scale={S} />
				</div>
				<AbsoluteFill style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 60%, rgba(40,58,110,0.35), transparent 70%)' }} />
				<div style={{ position: 'absolute', left: 0, top: 0 }}>
					<PixelLayer stage={stage} step={f} layer="back" scale={S} />
					<PixelLayer stage={stage} step={f} layer="front" scale={S} />
				</div>
				<div style={{ position: 'absolute', left: 0, top: 0 }}>
					<PixelLayer stage={strike} step={f} layer="back" scale={8} />
					<PixelLayer stage={strike} step={f} layer="front" scale={8} />
				</div>
				{f >= T.foe - 10 && f < T.title + 10
					? FOES.map((F, i) => {
							const at = T.foe + 18 + i * 14;
							const lit = ramp(f, at, at + 26, Easing.out(Easing.cubic));
							const rise = 60 * (1 - ramp(f, at - 10, at + 20, Easing.out(Easing.cubic)));
							return (
								<ArtSprite
									key={F.n}
									n={F.n}
									x={F.x}
									y={F.y + rise}
									k={F.k}
									flip={F.flip}
									p={{ ...poseAt(t, F.idle, 1.4, F.flip ? -1 : 1, [], i * 0.7), tint: 0x05070f, tintAmt: 1 - lit * 0.85 }}
									alpha={ramp(f, at - 12, at + 4)}
									glow={{ style: 'energy', color: F.glow, strength: 1.4 * lit, size: 1.6, speed: 1 }}
									t={t}
									shadow={false}
								/>
							);
						})
					: null}
				<Line f={f} at={T.spell + 8} text="EVERY SPELL." module="Battle Animations" out={T.strike - 14} />
				<Line f={f} at={T.strike + 8} text="EVERY STRIKE." module="Battle Animations" out={T.foe - 14} />
				<Line f={f} at={T.foe + 4} text="EVERY FOE." module="611 bestiary attacks animated" out={T.title - 10} top={150} />
			</AbsoluteFill>
			{/* title over the battlefield */}
			{f >= T.title - 4 ? (
				<AbsoluteFill style={{ opacity: titleK }}>
					<div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '50% 80%', transform: `translateY(${110 - 40 * drift}px) scale(${1.14 - 0.05 * drift})` }}>
						<Scenery kind="cave" />
						<PixelLayer stage={tstage} step={tf} layer="back" scale={S} />
						<ArtSprite n="hero-2" x={575} y={712} k={0.72} p={poseAt(t, 'battle', 1, 1, [], 0.4)} t={t} />
						<ArtSprite n="hero-1" x={700} y={838} k={0.74} flip p={poseAt(t, 'battle', 1, 1)} t={t} />
						<ArtSprite n="hero-3" x={880} y={768} k={0.74} flip p={poseAt(t, 'battle', 1, 1, [], 0.8)} t={t} />
						<ArtSprite n="golem" x={1240} y={800} k={1.1} flip p={poseAt(t, 'breathe', 1.6, -1)} glow={GLOWS.boss} t={t} shadowW={0.7} />
						<PixelLayer stage={tstage} step={tf} layer="front" scale={S} />
					</div>
					<AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(3,5,11,0.95) 0%, rgba(3,5,11,0.7) 38%, rgba(3,5,11,0.1) 70%)' }} />
					<div style={{ position: 'absolute', left: 0, right: 0, top: 90, display: 'flex', justifyContent: 'center' }}>
						<TitleLockup f={f} start={T.title + 2} />
					</div>
				</AbsoluteFill>
			) : null}
			<AbsoluteFill style={{ background: C.goldHi, opacity: Math.min(1, flash), mixBlendMode: 'screen' }} />
		</AbsoluteFill>
	);
};
