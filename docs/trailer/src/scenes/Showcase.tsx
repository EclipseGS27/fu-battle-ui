// Act 4: the showcase. Two fast fights with the Battle UI's panels hidden (its "mini" mode: turn track and party
// cards only), then a wall of the module's effects.
// Flower field: the Phantom Wolf bites, Ren's crossbow answers, the Wraith drains Mira (a drain heals its user),
// Mira's Lux smites it, Kael finishes the wolf.
// Aurora: the Verdant Wyrm's Venom Breath poisons the party, Mira heals, then her Heroic Skill Cleansing
// Moonlight (cut-in, pillar of light).
import React from 'react';
import { AbsoluteFill, Easing, Img, Sequence, useCurrentFrame } from 'remotion';
import { useStage, Cue } from '../fx/PixelLayer';
import { ambient } from '../fx/pixel-runner.js';
import { camAt, CamKey, Freeze, pulse, ramp, sceneFrame, Shake, shakeAt } from '../fx/impact';
import { artUrl, GLOWS } from '../art/art';
import { Banner, Card, Hud, Slot } from '../ui/Hud';
import { Num } from '../ui/Numbers';
import { CutIn } from '../ui/CutIn';
import { Caption, Stat } from '../ui/Type';
import { FxPreview } from '../ui/Editor';
import { statusTint } from '../ui/StatusLoop';
import { BattleWorld, Fighter, place } from './battle';
import { people } from './cast';
import { C, DISP } from '../theme';
import { Pose } from '../sprites/motion';

export const FIELD_LEN = 440;
export const AURORA_LEN = 460;
export const WALL_LEN = 270;
export const SHOWCASE_LEN = FIELD_LEN + AURORA_LEN + WALL_LEN;

const party = (acts: Record<string, Fighter['acts']>, hits: Record<string, number[]>): Fighter[] => [
	{ key: 'mira', n: 'hero-2', x: 575, y: 712, k: 0.72, dir: 1, idle: 'battle', phase: 0.4, acts: acts.mira ?? [], hits: hits.mira ?? [], kb: -24 },
	{ key: 'kael', n: 'hero-1', x: 700, y: 838, k: 0.74, flip: true, dir: 1, idle: 'battle', acts: acts.kael ?? [], hits: hits.kael ?? [], kb: -28 },
	{ key: 'ren', n: 'hero-3', x: 880, y: 768, k: 0.74, flip: true, dir: 1, idle: 'battle', phase: 0.8, acts: acts.ren ?? [], hits: hits.ren ?? [], kb: -24 },
];

const hpOf = (r: number, start: number, steps: [number, number][]) => steps.reduce((hp, [at, v]) => (r >= at ? v : hp), start);
const bn = (r: number, at: number, len: number, b: Omit<Banner, 'k'>) => (r >= at && r <= at + len ? { ...b, k: (r - at) / len } : null);
const mini = (r: number, len: number) => ({ top: ramp(r, 4, 24, Easing.out(Easing.cubic)), left: 0, right: 0, bottom: ramp(r, 10, 30, Easing.out(Easing.cubic)) * (1 - ramp(r, len - 16, len)) });

/* ---------------- the flower field: Wraith and Phantom Wolf ---------------- */

export const FB = { bite: 40, shot: 116, drain: 196, lux: 272, finish: 352, end: FIELD_LEN };
const fFreezes: Freeze[] = [{ at: FB.lux + 40, len: 8 }, { at: FB.finish + 26, len: 10 }];
const fsc = (r: number) => sceneFrame(r, fFreezes);

const fieldRaw: Fighter[] = [
	...party(
		{
			ren: [{ id: 'hurt', at: (FB.bite + 30) / 60 }, { id: 'attack', at: FB.shot / 60, travelX: 0, k: 0.8 }, { id: 'attack', at: (FB.shot + 16) / 60, travelX: 0, k: 0.8 }, { id: 'victory', at: (FB.end - 40) / 60 }],
			mira: [{ id: 'hurt', at: (FB.drain + 20) / 60 }, { id: 'cast', at: FB.lux / 60 }, { id: 'victory', at: (FB.end - 46) / 60 }],
			kael: [{ id: 'attack', at: FB.finish / 60, travelX: 330, travelY: -10, k: 1.3 }, { id: 'victory', at: (FB.end - 34) / 60 }],
		},
		{ ren: [FB.bite + 30], mira: [FB.drain + 20] },
	),
	{
		key: 'wolf',
		n: 'phantom-wolf',
		x: 1260,
		y: 842,
		k: 0.8,
		flip: true,
		dir: -1,
		idle: 'battle',
		idleK: 1.4,
		acts: [{ id: 'attack', at: FB.bite / 60, travelX: -190, travelY: -40, k: 1 }, { id: 'hurt', at: (FB.shot + 14) / 60 }, { id: 'hurt', at: (FB.shot + 30) / 60 }, { id: 'hurt', at: (FB.finish + 26) / 60 }, { id: 'collapse', at: (FB.finish + 40) / 60, ko: true }],
		hits: [FB.shot + 14, FB.shot + 30, FB.finish + 26],
		kb: 30,
		shadowW: 0.6,
	},
	{
		key: 'wraith',
		n: 'wraith',
		x: 1560,
		y: 700,
		k: 0.82,
		flip: true,
		dir: -1,
		idle: 'ghostly',
		idleK: 1.2,
		acts: [{ id: 'cast', at: FB.drain / 60 }, { id: 'hurt', at: (FB.lux + 40) / 60 }, { id: 'collapse', at: (FB.lux + 60) / 60, ko: true }],
		hits: [FB.lux + 40],
		kb: 30,
	},
];
const fieldF = fieldRaw.map((F) => ({ ...F, acts: F.acts.map((a) => ({ ...a, at: fsc(a.at * 60) / 60 })), hits: F.hits.map(fsc) }));
const FP = Object.fromEntries(fieldRaw.map((F) => [F.key, place(F)])) as Record<string, ReturnType<typeof place>>;
const fieldCues: Cue[] = [
	ambient('fireflies', { at: 0, area: { x: -20, y: 10, w: 520, h: 260 }, density: 0.7 }),
	{ id: 'sf-bite', at: FB.bite + 16, ...FP.ren.art, target: FP.ren.target },
	{ id: 'sf-arrow', at: FB.shot + 2, ...FP.wolf.art, from: FP.ren.art, target: FP.wolf.target, source: FP.ren.target },
	{ id: 'sf-impact', at: FB.shot + 14, ...FP.wolf.art, from: FP.ren.art, target: FP.wolf.target },
	{ id: 'sf-arrow', at: FB.shot + 18, ...FP.wolf.art, from: FP.ren.art, target: FP.wolf.target, source: FP.ren.target, seed: 9 },
	{ id: 'sf-impact', at: FB.shot + 30, ...FP.wolf.art, from: FP.ren.art, target: FP.wolf.target, seed: 9 },
	{ id: 'sf-tether', at: FB.drain + 10, ...FP.mira.art, from: FP.wraith.art, element: 'dark', target: FP.mira.target, source: FP.wraith.target },
	{ id: 'sf-heal', at: FB.drain + 34, ...FP.wraith.art, target: FP.wraith.target },
	{ id: 'sf-glyph', at: FB.lux, ...FP.mira.art, element: 'light', target: FP.mira.target },
	{ id: 'sf-bolt', at: FB.lux + 20, ...FP.wraith.art, from: FP.mira.art, element: 'light', target: FP.wraith.target, source: FP.mira.target },
	{ id: 'sf-smite', at: FB.lux + 40, ...FP.wraith.art, element: 'light', target: FP.wraith.target },
	{ id: 'sf-smoke', at: FB.lux + 70, ...FP.wraith.art, target: FP.wraith.target },
	{ id: 'sf-slash-combo', at: FB.finish + 20, ...FP.wolf.art, from: { x: FP.wolf.art.x - 40, y: FP.wolf.art.y }, target: FP.wolf.target },
].map((c) => ({ ...c, at: fsc(c.at) }));
const fieldNumsRaw: Num[] = [
	{ at: FB.bite + 31, ...FP.ren.over, text: '18' },
	{ at: FB.shot + 15, ...FP.wolf.over, text: '17' },
	{ at: FB.shot + 31, ...FP.wolf.over, text: '19', side: 0.3 },
	{ at: FB.drain + 21, ...FP.mira.over, text: '22' },
	{ at: FB.drain + 36, ...FP.wraith.over, text: '+22', heal: true },
	{ at: FB.lux + 42, ...FP.wraith.over, text: '41', kind: 'weak', sub: 'LIGHT · VULNERABLE' },
	{ at: FB.finish + 27, ...FP.wolf.over, text: '44', crit: true },
];
const fieldNums: Num[] = fieldNumsRaw.map((n) => ({ ...n, y: n.y + 60, at: fsc(n.at) }));

const fieldCam: CamKey[] = [
	{ f: 0, cam: { x: 1100, y: 600, zoom: 1.25 } },
	{ f: 70, cam: { x: 1000, y: 600, zoom: 1.12 } },
	{ f: FB.shot + 20, cam: { x: 1080, y: 620, zoom: 1.2 } },
	{ f: FB.drain + 30, cam: { x: 1060, y: 560, zoom: 1.08 } },
	{ f: FB.lux + 44, cam: { x: 1240, y: 520, zoom: 1.22 }, ease: Easing.out(Easing.cubic) },
	{ f: FB.finish + 28, cam: { x: 1150, y: 640, zoom: 1.32 } },
	{ f: FB.end, cam: { x: 960, y: 600, zoom: 1.08 } },
];
const fieldShakes: Shake[] = [{ at: FB.bite + 30, power: 0.8 }, { at: FB.lux + 40, power: 1.3, len: 22 }, { at: FB.finish + 26, power: 1.5, len: 24 }];

const FieldBattle: React.FC = () => {
	const r = useCurrentFrame();
	const P = people();
	const sf = fsc(r);
	const stage = useStage(480, 270, fieldCues);
	const cards: Card[] = [
		{ who: P.kael, cls: 'Weaponmaster 3 · Darkblade 2', hp: 55, hpMax: 55, mp: 30, mpMax: 30, ip: 6, ipMax: 6, fp: 3, active: r >= FB.finish - 20 && r < FB.end - 40 },
		{ who: P.mira, cls: 'Spiritist 3 · Entropist 2', hp: hpOf(r, 52, [[FB.drain + 21, 30]]), hpMax: 60, mp: hpOf(r, 40, [[FB.lux, 30]]), mpMax: 45, ip: 4, ipMax: 6, fp: 3, active: r >= FB.lux - 20 && r < FB.finish - 20 },
		{ who: P.ren, cls: 'Sharpshooter 3 · Rogue 2', hp: hpOf(r, 45, [[FB.bite + 31, 27]]), hpMax: 45, mp: 25, mpMax: 25, ip: 6, ipMax: 6, fp: 2, active: r >= FB.shot - 20 && r < FB.drain - 10 },
	];
	const foeNow = (r >= FB.bite - 30 && r < FB.shot - 20) || (r >= FB.drain - 10 && r < FB.lux - 20);
	const slots: Slot[] = [
		{ who: P.wolf, side: 'foe', state: r < FB.shot - 20 ? 'now' : 'done' },
		{ who: P.ren, side: 'hero', state: r < FB.shot - 20 ? 'next' : r < FB.drain - 10 ? 'now' : 'done' },
		{ who: P.wraith, side: 'foe', state: r < FB.drain - 10 ? 'next' : r < FB.lux - 20 ? 'now' : 'done' },
		{ who: P.mira, side: 'hero', state: r < FB.lux - 20 ? 'next' : r < FB.finish - 20 ? 'now' : 'done' },
		{ who: P.kael, side: 'hero', state: r < FB.finish - 20 ? 'next' : 'now' },
	];
	const banner = bn(r, FB.bite - 14, 40, { side: 'foe', who: 'Phantom Wolf', what: 'Savage Bite', tgt: 'on Ren' }) ?? bn(r, FB.drain - 4, 36, { side: 'foe', who: 'Wraith', what: 'Despair Drain', tgt: 'on Mira' }) ?? bn(r, FB.lux - 6, 40, { side: 'hero', who: 'Mira', what: 'Lux', tgt: 'on Wraith' });
	const whiteout = pulse(r, FB.lux + 40, 16, 0.45) + pulse(r, FB.finish + 26, 12, 0.35);
	return (
		<AbsoluteFill className="trailer-root">
			<BattleWorld
				kind="field"
				cam={camAt(r, fieldCam)}
				shake={shakeAt(r, fieldShakes)}
				stage={stage}
				sf={sf}
				fighters={fieldF}
				numbers={fieldNums}
				extra={(F) => {
					if (F.key === 'wolf') return { glow: r < FB.finish + 26 ? GLOWS.foe : null, idleOff: r >= FB.finish + 40 };
					if (F.key === 'wraith') return { glow: r < FB.lux + 40 ? GLOWS.foe : null, idleOff: r >= FB.lux + 60, alpha: 1 - ramp(r, FB.lux + 64, FB.lux + 96) };
					return { ghosts: F.key === 'kael' && r > FB.finish + 6 && r < FB.finish + 22 };
				}}
			/>
			<div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: Math.min(1, whiteout), mixBlendMode: 'screen' }} />
			<Hud show={mini(r, FIELD_LEN)} round={2} slots={slots} phase={foeNow ? { title: 'Foes’ turn', hint: 'The enemy moves.', color: '#ff8d99' } : { title: 'Heroes’ turn', hint: 'Choose which hero acts.', color: '#9fd0ff' }} cards={cards} banner={banner} bannerTop="31%" />
			<Caption f={r} a={60} b={FB.drain - 14} kicker="Fabula Ultima Battle Animations" title="611 bestiary attacks" size={88} style={{ left: 945, top: 150, transform: 'translateX(-50%)' }} />
			<Caption f={r} a={FB.drain + 40} b={FB.lux - 10} kicker="Battle Animations" title="Drains heal the drainer" size={80} style={{ left: 945, top: 150, transform: 'translateX(-50%)' }} />
		</AbsoluteFill>
	);
};

/* ---------------- the aurora: the Verdant Wyrm ---------------- */

export const AB = { breath: 34, breathHit: 70, heal: 150, shot: 226, cutIn: 278, pillar: 340, pillarHit: 367, collapse: 392, victory: 420, end: AURORA_LEN };
const aFreezes: Freeze[] = [{ at: AB.pillarHit, len: 14 }];
const asc = (r: number) => sceneFrame(r, aFreezes);
const auroraRaw: Fighter[] = [
	...party(
		{
			kael: [{ id: 'hurt', at: AB.breathHit / 60 }, { id: 'victory', at: AB.victory / 60 }],
			mira: [{ id: 'heal', at: AB.heal / 60 }, { id: 'cast', at: AB.pillar / 60 }, { id: 'victory', at: (AB.victory + 8) / 60 }],
			ren: [{ id: 'hurt', at: (AB.breathHit + 4) / 60 }, { id: 'attack', at: AB.shot / 60, travelX: 0, k: 0.8 }, { id: 'victory', at: (AB.victory + 16) / 60 }],
		},
		{ kael: [AB.breathHit], ren: [AB.breathHit + 4] },
	),
	{
		key: 'dragon',
		n: 'dragon',
		x: 1330,
		y: 862,
		k: 1.08,
		flip: true,
		dir: -1,
		idle: 'breathe',
		idleK: 1.5,
		acts: [{ id: 'cast', at: AB.breath / 60 - 0.1, k: 0.8 }, { id: 'hurt', at: (AB.shot + 14) / 60 }, { id: 'hurt', at: AB.pillarHit / 60, k: 1.2 }, { id: 'collapse', at: AB.collapse / 60, ko: true }],
		hits: [AB.shot + 14, AB.pillarHit],
		kb: 40,
		shadowW: 0.7,
	},
];
const auroraF = auroraRaw.map((F) => ({ ...F, acts: F.acts.map((a) => ({ ...a, at: asc(a.at * 60) / 60 })), hits: F.hits.map(asc) }));
const AP = Object.fromEntries(auroraRaw.map((F) => [F.key, place(F)])) as Record<string, ReturnType<typeof place>>;
// the Wyrm's mouth: its head is on the right of the picture, mirrored to the left here
const wyrmMouth = { x: (AP.dragon.left + (477 - 425) * 1.08) / 4, y: (AP.dragon.top + 118 * 1.08) / 4 };
const auroraCues: Cue[] = [
	ambient('fireflies', { at: 0, area: { x: -20, y: 40, w: 520, h: 230 }, density: 0.4 }),
	{ id: 'sf-breath', at: AB.breath + 14, ...AP.kael.art, from: wyrmMouth, element: 'poison', target: AP.kael.target, source: AP.dragon.target },
	{ id: 'sf-poisoned', at: AB.breathHit + 2, ...AP.kael.art, target: AP.kael.target },
	{ id: 'sf-poisoned', at: AB.breathHit + 6, ...AP.ren.art, target: AP.ren.target, seed: 4 },
	{ id: 'sf-twinkle', at: AB.heal, ...AP.mira.art, target: AP.mira.target },
	{ id: 'sf-heal', at: AB.heal + 12, ...AP.kael.art, target: AP.kael.target },
	{ id: 'sf-heal', at: AB.heal + 16, ...AP.ren.art, target: AP.ren.target, seed: 5 },
	{ id: 'sf-arrow', at: AB.shot + 2, ...AP.dragon.art, from: AP.ren.art, target: AP.dragon.target, source: AP.ren.target },
	{ id: 'sf-impact', at: AB.shot + 14, ...AP.dragon.art, from: AP.ren.art, target: AP.dragon.target },
	{ id: 'sf-pillar', at: AB.pillar, ...AP.dragon.art, element: 'light', target: AP.dragon.target },
	{ id: 'sf-death', at: AB.collapse + 10, ...AP.dragon.art, target: AP.dragon.target },
].map((c) => ({ ...c, at: asc(c.at) }));
const auroraNumsRaw: Num[] = [
	{ at: AB.breathHit + 1, ...AP.kael.over, text: '21' },
	{ at: AB.breathHit + 5, ...AP.ren.over, text: '19' },
	{ at: AB.heal + 14, ...AP.kael.over, text: '+40', heal: true },
	{ at: AB.heal + 18, ...AP.ren.over, text: '+40', heal: true },
	{ at: AB.shot + 15, ...AP.dragon.over, text: '16' },
	{ at: AB.pillarHit + 1, ...AP.dragon.over, text: '96', crit: true },
];
const auroraNums: Num[] = auroraNumsRaw.map((n) => ({ ...n, y: n.y + 60, at: asc(n.at) }));
const auroraCam: CamKey[] = [
	{ f: 0, cam: { x: 1160, y: 520, zoom: 1.2 } },
	{ f: AB.breath + 10, cam: { x: 1040, y: 560, zoom: 1.1 } },
	{ f: AB.breathHit + 6, cam: { x: 840, y: 640, zoom: 1.26 } },
	{ f: AB.heal + 30, cam: { x: 800, y: 640, zoom: 1.22 } },
	{ f: AB.shot + 20, cam: { x: 1060, y: 600, zoom: 1.12 } },
	{ f: AB.pillar, cam: { x: 1120, y: 520, zoom: 1.06 } },
	{ f: AB.pillarHit + 6, cam: { x: 1240, y: 580, zoom: 1.3 }, ease: Easing.out(Easing.cubic) },
	{ f: AB.victory, cam: { x: 1100, y: 600, zoom: 1.14 } },
	{ f: AB.end, cam: { x: 820, y: 660, zoom: 1.3 } },
];
const auroraShakes: Shake[] = [{ at: AB.breathHit, power: 0.9 }, { at: AB.shot + 14, power: 0.6 }, { at: AB.pillarHit, power: 2.1, len: 34 }];

const MiraPortrait: React.FC = () => <Img src={artUrl('hero-2')} style={{ height: '100%', display: 'block' }} />;

const AuroraBattle: React.FC = () => {
	const r = useCurrentFrame();
	const P = people();
	const sf = asc(r);
	const t = sf / 60;
	const stage = useStage(480, 270, auroraCues);
	const poisoned = (key: string) => (key === 'kael' && r >= AB.breathHit + 2) || (key === 'ren' && r >= AB.breathHit + 6);
	const cards: Card[] = [
		{ who: P.kael, cls: 'Weaponmaster 3 · Darkblade 2', hp: hpOf(r, 55, [[AB.breathHit + 1, 34], [AB.heal + 14, 55]]), hpMax: 55, mp: 30, mpMax: 30, ip: 6, ipMax: 6, fp: 3, chips: r >= AB.breathHit + 2 ? ['poisoned'] : [] },
		{ who: P.mira, cls: 'Spiritist 3 · Entropist 2', hp: 52, hpMax: 60, mp: hpOf(r, 40, [[AB.heal, 30], [AB.cutIn, 30]]), mpMax: 45, ip: 4, ipMax: 6, fp: 3, active: (r >= AB.heal - 20 && r < AB.shot - 20) || (r >= AB.cutIn - 10 && r < AB.victory) },
		{ who: P.ren, cls: 'Sharpshooter 3 · Rogue 2', hp: hpOf(r, 45, [[AB.breathHit + 5, 26], [AB.heal + 18, 45]]), hpMax: 45, mp: 25, mpMax: 25, ip: 6, ipMax: 6, fp: 2, active: r >= AB.shot - 20 && r < AB.cutIn - 10, chips: r >= AB.breathHit + 6 ? ['poisoned'] : [] },
	];
	const slots: Slot[] = [
		{ who: P.dragon, side: 'foe', state: r < AB.heal - 20 ? 'now' : 'done' },
		{ who: P.mira, side: 'hero', state: r < AB.heal - 20 ? 'next' : r < AB.shot - 20 ? 'now' : 'done' },
		{ who: P.ren, side: 'hero', state: r < AB.shot - 20 ? 'next' : r < AB.cutIn - 10 ? 'now' : 'done' },
		{ who: P.dragon, side: 'foe', state: 'next' },
		{ who: P.mira, side: 'hero', state: r < AB.cutIn - 10 ? 'next' : 'now' },
	];
	const banner = bn(r, AB.breath - 8, 44, { side: 'foe', who: 'Verdant Wyrm', what: 'Venom Breath', tgt: 'on Kael, Ren' }) ?? bn(r, AB.heal - 6, 40, { side: 'hero', who: 'Mira', what: 'Heal', tgt: 'on Kael, Ren' });
	const whiteout = pulse(r, AB.pillarHit, 24, 0.75);
	const dim = ramp(r, AB.pillar - 6, AB.pillar + 10) * (1 - ramp(r, AB.pillarHit + 30, AB.pillarHit + 60)) * 0.5;
	return (
		<AbsoluteFill className="trailer-root">
			<BattleWorld
				kind="aurora"
				cam={camAt(r, auroraCam)}
				shake={shakeAt(r, auroraShakes)}
				stage={stage}
				sf={sf}
				fighters={auroraF}
				numbers={auroraNums}
				dim={dim}
				extra={(F) => {
					if (F.key === 'dragon') return { glow: r < AB.pillarHit ? GLOWS.boss : null, idleOff: r >= AB.collapse, alpha: 1 - 0.5 * ramp(r, AB.collapse + 30, AB.end) };
					if (poisoned(F.key)) {
						const tint = statusTint('poisoned', t);
						return { status: 'poisoned', pose: (p: Pose) => (tint && p.tintAmt < tint.tintAmt ? { ...p, ...tint } : p) };
					}
					return {};
				}}
			/>
			<div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: Math.min(1, whiteout), mixBlendMode: 'screen' }} />
			<Hud show={mini(r, AURORA_LEN)} round={3} slots={slots} phase={r < AB.heal - 20 ? { title: 'Foes’ turn', hint: 'The enemy moves.', color: '#ff8d99' } : { title: 'Heroes’ turn', hint: 'Choose which hero acts.', color: '#9fd0ff' }} cards={cards} banner={banner} bannerTop="31%" />
			<CutIn f={r - AB.cutIn} len={62} name="Cleansing Moonlight" user="Mira" color="#bfe2ff" portrait={<MiraPortrait />} />
			<Caption f={r} a={AB.breathHit + 16} b={AB.heal + 50} kicker="Battle Animations" title="Conditions you can see" size={84} style={{ left: 945, top: 150, transform: 'translateX(-50%)' }} />
			<Caption f={r} a={AB.victory - 10} b={AB.end - 4} kicker="Battle Animations" title="446 abilities animated" size={84} style={{ left: 945, top: 150, transform: 'translateX(-50%)' }} />
		</AbsoluteFill>
	);
};

/* ---------------- the wall of effects ---------------- */

const WALL: [string, string, string][] = [
	['sf-lightning', 'Lightning strike', 'bolt'],
	['sf-ice-nova', 'Frost nova', 'ice'],
	['sf-explosion', 'Explosion', 'fire'],
	['sf-tornado', 'Whirlwind', 'air'],
	['sf-pillar', 'Pillar of light', 'light'],
	['sf-black-hole', 'Black hole', 'dark'],
	['sf-shield', 'Shield dome', 'none'],
	['sf-poison-cloud', 'Toxic cloud', 'poison'],
	['sf-arc', 'Chain lightning', 'bolt'],
	['sf-meteors', 'Falling barrage', 'fire'],
	['sf-heal-burst', 'Healing burst', 'none'],
	['sf-chains', 'Binding chains', 'none'],
];

const EffectWall: React.FC = () => {
	const f = useCurrentFrame();
	const out = ramp(f, WALL_LEN - 24, WALL_LEN, Easing.in(Easing.cubic));
	return (
		<AbsoluteFill className="trailer-root" style={{ background: 'radial-gradient(ellipse at 50% 50%, #15213d, #05080f 75%)' }}>
			<div style={{ position: 'absolute', left: 60, top: 40, width: 1800, height: 1000, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 18, transform: `scale(${1 + 0.08 * ramp(f, 0, WALL_LEN)})`, opacity: 1 - out }}>
				{WALL.map(([id, label, el], i) => {
					const at = 6 + i * 5;
					const k = ramp(f, at, at + 14, Easing.out(Easing.back(1.4)));
					return (
						<div key={id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(159,208,255,0.25)', background: 'radial-gradient(circle at 50% 55%, #1b2742, #070b14 75%)', opacity: Math.min(1, k * 1.4), transform: `scale(${0.7 + 0.3 * k})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
							<FxPreview id={id} element={el} f={f - at} size={280} art={140} loop={72} seed={i + 1} />
							<div style={{ fontFamily: DISP, fontSize: 30, letterSpacing: '0.06em', color: C.ink2, marginTop: 4 }}>{label}</div>
						</div>
					);
				})}
			</div>
			<AbsoluteFill style={{ background: 'linear-gradient(180deg, transparent 30%, rgba(3,5,11,0.88) 44%, rgba(3,5,11,0.88) 62%, transparent 76%)', opacity: ramp(f, 70, 90) * (1 - out) }} />
			<div style={{ position: 'absolute', left: 0, right: 0, top: 410, display: 'flex', justifyContent: 'center', gap: 220, opacity: 1 - out }}>
				<Stat value={446} label="abilities, spells, items" f={f} start={76} />
				<Stat value={611} label="bestiary attacks" f={f} start={96} />
				<Stat value={96} label="pixel effects" f={f} start={116} />
			</div>
		</AbsoluteFill>
	);
};

export const Showcase: React.FC = () => (
	<AbsoluteFill>
		<Sequence durationInFrames={FIELD_LEN} name="Flower field">
			<FieldBattle />
		</Sequence>
		<Sequence from={FIELD_LEN} durationInFrames={AURORA_LEN} name="Aurora">
			<AuroraBattle />
		</Sequence>
		<Sequence from={FIELD_LEN + AURORA_LEN} durationInFrames={WALL_LEN} name="Effect wall">
			<EffectWall />
		</Sequence>
	</AbsoluteFill>
);
