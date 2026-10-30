// Act 3: the features, one slide each, every claim taken from the modules' READMEs.
import React from 'react';
import { AbsoluteFill, Easing, Sequence, useCurrentFrame } from 'remotion';
import { PixelLayer, useStage } from '../fx/PixelLayer';
import { ambient } from '../fx/pixel-runner.js';
import { ramp } from '../fx/impact';
import { Shot } from '../ui/Shot';
import { Caption, Kicker, Letters } from '../ui/Type';
import { PartySheet, PartyMember } from '../ui/PartySheet';
import { Creator } from '../ui/Creator';
import { CommandPanel, COMMANDS, Hud, Target } from '../ui/Hud';
import { Cursor, EditorState, EditorWindow, PickerWindow } from '../ui/Editor';
import { ART, ArtName, ArtSprite, GLOWS, Scenery } from '../art/art';
import { movePose, poseAt } from '../sprites/motion';
import { GOLEM_ABILITIES, GOLEM_AFF, people } from './cast';
import { C, DISP, TEXT } from '../theme';

export const SLIDES = [
	{ id: 'sheets', len: 180 },
	{ id: 'npc', len: 150 },
	{ id: 'preview', len: 250 },
	{ id: 'party', len: 180 },
	{ id: 'creator', len: 180 },
	{ id: 'menus', len: 150 },
	{ id: 'customize', len: 290 },
	{ id: 'sprites', len: 240 },
];
export const FEATURES_LEN = SLIDES.reduce((s, x) => s + x.len, 0);

const outE = Easing.bezier(0.16, 1, 0.3, 1);

/** The text column: module name, feature, one line from the README */
const Copy: React.FC<{ f: number; len: number; kicker: string; title: string[]; body: string }> = ({ f, len, kicker, title, body }) => {
	const out = ramp(f, len - 14, len, Easing.in(Easing.cubic));
	const b = ramp(f, 22, 40, outE);
	const longest = Math.max(...title.map((l) => l.length));
	const size = Math.min(112, 640 / (longest * 0.47));
	return (
		<div style={{ position: 'absolute', left: 110, top: 0, bottom: 0, width: 640, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, opacity: 1 - out, transform: `translateY(${-30 * out}px)` }}>
			<div style={{ opacity: ramp(f, 4, 18), transform: `translateX(${(1 - ramp(f, 4, 22, outE)) * -30}px)` }}>
				<Kicker size={30}>{kicker}</Kicker>
			</div>
			<div style={{ fontFamily: DISP, fontWeight: 700, fontSize: size, lineHeight: 0.98, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.01em', textShadow: '0 5px 0 rgba(0,0,0,0.5)' }}>
				{title.map((line, i) => (
					<div key={i}>
						<Letters text={line} f={f} start={6 + i * 8} stagger={1.4} len={16} />
					</div>
				))}
			</div>
			<div style={{ fontFamily: TEXT, fontSize: 40, lineHeight: 1.3, color: C.ink2, opacity: b, transform: `translateY(${(1 - b) * 16}px)`, maxWidth: 620 }}>{body}</div>
		</div>
	);
};

/** The visual column: slides in from the right with a slight turn, out to the left */
const Visual: React.FC<{ f: number; len: number; children: React.ReactNode; top?: number; left?: number }> = ({ f, len, children, top = 540, left = 1300 }) => {
	const i = ramp(f, 0, 26, outE);
	const o = ramp(f, len - 16, len, Easing.in(Easing.cubic));
	return (
		<div style={{ position: 'absolute', left, top, transform: `translate(-50%, -50%) perspective(1800px) rotateY(${-14 * (1 - i) - 3 + 6 * o}deg) translateX(${(1 - i) * 260 - o * 220}px) scale(${0.94 + 0.06 * i})`, opacity: i * (1 - o) }}>{children}</div>
	);
};

const Sheets: React.FC<{ f: number; len: number }> = ({ f, len }) => {
	const wipe = ramp(f, 92, 122, Easing.inOut(Easing.cubic));
	return (
		<>
			<Copy f={f} len={len} kicker="Fabula Ultima Battle UI" title={['Character', 'sheets']} body="The battle screen’s look on every hero. The whole sheet turns red in Crisis." />
			<Visual f={f} len={len}>
				<div style={{ position: 'relative', width: 980, height: 624 }}>
					<Shot name="sheet-crisis" width={980} crop={[0, 22, 880, 538]} zoom={1 + 0.04 * ramp(f, 0, len)} />
					<div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - wipe * 100}% 0 0)` }}>
						<Shot name="sheet-crisis" width={980} crop={[0, 582, 880, 538]} zoom={1 + 0.04 * ramp(f, 0, len)} glow="rgba(255,90,100,0.4)" />
					</div>
					{wipe > 0 && wipe < 1 ? <div style={{ position: 'absolute', top: -20, bottom: -20, left: `${wipe * 100}%`, width: 4, background: '#ff9a6b', boxShadow: '0 0 30px #ff5a64, 0 0 60px #ff5a64' }} /> : null}
				</div>
			</Visual>
		</>
	);
};

const Npc: React.FC<{ f: number; len: number }> = ({ f, len }) => {
	const y = 300 * ramp(f, 20, len - 10, Easing.inOut(Easing.quad));
	return (
		<>
			<Copy f={f} len={len} kicker="Fabula Ultima Battle UI" title={['NPC sheets']} body="Built for adversaries: rank, Affinities, attacks and spells, and a skill point budget." />
			<Visual f={f} len={len}>
				<Shot name="npc-sheet" width={900} crop={[0, y, 860, 640]} glow="rgba(255,107,122,0.3)" />
			</Visual>
		</>
	);
};

const MEMBERS: PartyMember[] = [
	{ art: 'hero-1', name: 'Kael', level: 5, exp: 6, hp: [55, 55], mp: [30, 30], ip: [6, 6], stats: [['DEF', '11'], ['M.DEF', '8'], ['INIT', '+1']], main: 'Weaponmaster', cl: 3, identity: 'Exiled knight of the north', more: 'Darkblade 2', fp: 3 },
	{ art: 'hero-2', name: 'Mira', level: 5, exp: 10, hp: [52, 60], mp: [40, 45], ip: [4, 6], stats: [['DEF', '10'], ['M.DEF', '9'], ['INIT', '+0']], main: 'Spiritist', cl: 3, identity: 'Last Oracle of Vel', more: 'Entropist 2', fp: 3 },
	{ art: 'hero-3', name: 'Ren', level: 5, exp: 4, hp: [21, 45], mp: [25, 25], ip: [4, 6], stats: [['DEF', '9'], ['M.DEF', '8'], ['INIT', '+2']], main: 'Sharpshooter', cl: 3, identity: 'Wandering crossbow scout', more: 'Rogue 2', fp: 2, crisis: true, chips: [['Weak', '#ff9a6b']] },
];

const Party: React.FC<{ f: number; len: number }> = ({ f, len }) => {
	const cursor = f < 90 ? 0 : f < 110 ? 1 : f < 128 ? 2 : 0;
	return (
		<>
			<Copy f={f} len={len} kicker="Fabula Ultima Battle UI" title={['A JRPG', 'party menu']} body="Laid out like a JRPG main menu, with a tall card for every hero." />
			<Visual f={f} len={len}>
				<div style={{ transform: 'scale(1.18)' }}>
					<PartySheet w={900} h={640} members={MEMBERS} cursor={cursor} rise={(i) => (1 - ramp(f, 14 + i * 7, 40 + i * 7, outE)) * 240} glowLv={0.5 + 0.5 * Math.sin(f / 6)} />
				</div>
			</Visual>
		</>
	);
};

const CreatorSlide: React.FC<{ f: number; len: number }> = ({ f, len }) => {
	const step = f < 104 ? 1 : 3;
	const k = step === 1 ? ramp(f, 26, 92, Easing.linear) : ramp(f, 112, 186, Easing.linear);
	return (
		<>
			<Copy f={f} len={len} kicker="Character Creator" title={['A hero', 'in six steps']} body="A step-by-step wizard. Classes, Skills, spells and gear come straight from your compendiums." />
			<Visual f={f} len={len}>
				<div style={{ transform: 'scale(1.16)' }}>
					<Creator w={880} h={640} step={step} k={k} />
				</div>
			</Visual>
		</>
	);
};

const Menus: React.FC<{ f: number; len: number }> = ({ f, len }) => {
	const a = ramp(f, 10, 36, outE);
	const b = ramp(f, 40, 66, outE);
	return (
		<>
			<Copy f={f} len={len} kicker="Fabula Ultima Battle UI" title={['Point menus', '& Opportunity']} body="Spend Fabula, Ultima and Inventory Points, and pick an Opportunity on every critical." />
			<Visual f={f} len={len}>
				<div style={{ position: 'relative', width: 1000, height: 760 }}>
					<div style={{ position: 'absolute', left: 0, top: 30, opacity: a, transform: `translateY(${(1 - a) * 40}px) rotate(-2deg)` }}>
						<Shot name="point-menus" width={1000} crop={[0, 0, 900, 365]} />
					</div>
					<div style={{ position: 'absolute', left: 300, top: 300, opacity: b, transform: `translateY(${(1 - b) * 60}px) rotate(2deg)` }}>
						<Shot name="opportunity" width={420} crop={[44, 38, 362, 480]} glow="rgba(242,196,90,0.45)" />
					</div>
				</div>
			</Visual>
		</>
	);
};

/* ---------------- Battle UI: preview the player view, resize ---------------- */

const fitAt = (size: number) => Math.min(Math.max(Math.min(1080 / 800, 1920 / 1180), 0.7), 3) * size;
const toolAt = (which: 'eye' | 'minus' | 'plus', size: number) => {
	const f = fitAt(size);
	return { x: 1920 - ({ eye: 101, minus: 67, plus: 33 } as const)[which] * f, y: 31 * f };
};
export const PV = { eye: 64, plus1: 118, plus2: 142, minus: 196 };

const Preview: React.FC<{ f: number; len: number }> = ({ f, len }) => {
	const P = people();
	const t = f / 60;
	const eye = f >= PV.eye + 2;
	const size = 0.9 + 0.1 * ramp(f, PV.plus1, PV.plus1 + 8) + 0.1 * ramp(f, PV.plus2, PV.plus2 + 8) - 0.1 * ramp(f, PV.minus, PV.minus + 8);
	// the pointer: to the eye, then A+ twice, then A−
	const path: [number, { x: number; y: number }][] = [
		[0, { x: 1380, y: 520 }],
		[PV.eye - 8, toolAt('eye', 0.9)],
		[PV.eye + 20, toolAt('eye', 0.9)],
		[PV.plus1 - 8, toolAt('plus', 0.9)],
		[PV.plus2 - 6, toolAt('plus', 1.0)],
		[PV.plus2 + 20, toolAt('plus', 1.1)],
		[PV.minus - 8, toolAt('minus', 1.1)],
		[len, toolAt('minus', 1.0)],
	];
	let cur = path[0][1];
	for (let i = 1; i < path.length; i++) {
		const [a, pa] = path[i - 1];
		const [b, pb] = path[i];
		if (f >= a) {
			const k = ramp(f, a, b, Easing.inOut(Easing.cubic));
			cur = { x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k };
		}
	}
	const click = [PV.eye, PV.plus1, PV.plus2, PV.minus].map((c) => (f >= c && f < c + 16 ? (f - c) / 16 : 0)).find((v) => v > 0) ?? 0;
	const hot = f >= PV.eye - 10 && f < PV.eye + 20 ? 'eye' : f >= PV.plus1 - 10 && f < PV.plus2 + 20 ? 'plus' : f >= PV.minus - 10 ? 'minus' : undefined;
	const flip: Record<string, number> = Object.fromEntries(Object.keys(GOLEM_AFF).map((k) => [k, k === 'fire' ? 1 : 0]));
	const target: Target = { name: 'Frost Golem', level: 20, villain: 'minor', tags: ['Champion (2)', 'Construct'], hp: 140, hpMax: 180, ultima: 5, ultimaMax: 5, tier: eye ? 1 : 3, aff: GOLEM_AFF, flip: eye ? flip : undefined, details: ['DEX d8 · INS d8 · MIG d10 · WLP d8', 'DEF 9 · M.DEF 8'], traits: 'slow, sturdy, ancient', abilities: GOLEM_ABILITIES, turns: '2 turns per round' };
	const fade = ramp(f, 0, 16) * (1 - ramp(f, len - 14, len));
	const tip = f >= PV.plus1 && f < PV.minus + 30 ? `${f >= PV.minus ? 'Smaller' : 'Bigger'} (${Math.round(size * 100)}%)` : eye && f < PV.plus1 - 10 ? 'Preview what players see' : null;
	return (
		<AbsoluteFill style={{ opacity: fade }}>
			<div style={{ position: 'absolute', inset: 0, transform: 'scale(1.06)', transformOrigin: '50% 60%' }}>
				<Scenery kind="cave" />
			</div>
			<ArtSprite n="hero-2" x={575} y={712} k={0.72} p={poseAt(t, 'battle', 1, 1, [], 0.4)} glow={GLOWS.hero} t={t} />
			<ArtSprite n="hero-1" x={700} y={838} k={0.74} flip p={poseAt(t, 'battle', 1, 1)} t={t} />
			<ArtSprite n="hero-3" x={880} y={768} k={0.74} flip p={poseAt(t, 'battle', 1, 1, [], 0.8)} t={t} />
			<ArtSprite n="golem" x={1240} y={800} k={1.1} flip p={poseAt(t, 'breathe', 1.6, -1)} glow={GLOWS.boss} t={t} shadowW={0.7} />
			<Hud
				size={size}
				tools={{ eye, hot }}
				gm={eye ? undefined : { tier: 1, shown: ['fire'] }}
				round={1}
				slots={[
					{ who: P.kael, side: 'hero', state: 'done' },
					{ who: P.golem, side: 'foe', state: 'done' },
					{ who: P.mira, side: 'hero', state: 'now' },
					{ who: P.golem, side: 'foe', state: 'next' },
					{ who: P.ren, side: 'hero', state: 'next' },
				]}
				phase={{ title: 'Heroes’ turn', hint: 'Mira is acting.', color: '#9fd0ff' }}
				target={target}
				roster={[{ name: 'Frost Golem', used: '1/2 turns', on: true }]}
				right={<CommandPanel m={{ who: P.mira, title: 'Choose an action', fp: 3, rows: COMMANDS.map(([id, label]) => ({ id, label, meta: ['spell', 'skill', 'inventory', 'objective'].includes(id) ? '›' : '' })), on: 'study', help: COMMANDS[6][2] }} />}
				cards={[
					{ who: P.kael, cls: 'Weaponmaster 3 · Darkblade 2', hp: 55, hpMax: 55, mp: 30, mpMax: 30, ip: 6, ipMax: 6, fp: 3, did: true },
					{ who: P.mira, cls: 'Spiritist 3 · Entropist 2', hp: 52, hpMax: 60, mp: 40, mpMax: 45, ip: 4, ipMax: 6, fp: 3, active: true },
					{ who: P.ren, cls: 'Sharpshooter 3 · Rogue 2', hp: 42, hpMax: 45, mp: 25, mpMax: 25, ip: 6, ipMax: 6, fp: 2 },
				]}
			/>
			{tip ? <div style={{ position: 'absolute', left: Math.min(1640, cur.x - 120), top: cur.y + 46, padding: '6px 12px', borderRadius: 4, background: 'rgba(5,8,18,0.92)', border: '1px solid rgba(159,208,255,0.4)', fontFamily: TEXT, fontSize: 24, color: C.ink, whiteSpace: 'nowrap', zIndex: 199 }}>{tip}</div> : null}
			<Cursor x={cur.x} y={cur.y} click={click} />
			<Caption f={f} a={10} b={PV.plus1 - 16} kicker="Battle UI · Game master" title="See what your players see" size={80} style={{ left: 945, top: 150, transform: 'translateX(-50%)' }} />
			<Caption f={f} a={PV.plus1 - 4} b={len - 6} kicker="Battle UI" title="Size it for your table" size={80} style={{ left: 945, top: 230, transform: 'translateX(-50%)' }} />
		</AbsoluteFill>
	);
};

/* ---------------- Battle Animations: make an ability yours ---------------- */

export const CZ = { pick: 40, open: 58, hoverX: 92, choose: 112, close: 126, color: 160, colorSet: 172, sound: 202, soundSet: 212, play: 226, save: 254, saved: 262 };

const Customize: React.FC<{ f: number; len: number }> = ({ f, len }) => {
	const chosen = f >= CZ.choose;
	const fire = f >= CZ.colorSet;
	const st: EditorState = {
		name: 'Nether Slash',
		source: 'Using the built-in animation for this ability (Original preset).',
		hit: chosen ? 'sf-slash-x' : 'sf-slash-heavy',
		hitLabel: chosen ? 'Cross slash' : 'Heavy cleave',
		element: fire ? 'fire' : 'dark',
		elementLabel: fire ? 'Fire' : 'From damage type',
		castSound: 'Automatic',
		hitSound: f >= CZ.soundSet ? 'Fire Hit' : 'Automatic',
		hot: f >= CZ.pick && f < CZ.close ? 'hit' : f >= CZ.color && f < CZ.colorSet + 12 ? 'color' : f >= CZ.sound && f < CZ.play ? 'sound' : f >= CZ.play && f < CZ.play + 16 ? 'play' : f >= CZ.save ? 'save' : undefined,
		saved: f >= CZ.saved,
		f: f - (chosen ? (fire ? CZ.colorSet : CZ.choose) : 0),
		key: `${chosen}-${fire}`,
	};
	const pick = ramp(f, CZ.open, CZ.open + 12, outE) * (1 - ramp(f, CZ.close - 8, CZ.close));
	// the pointer, in the editor window's own pixels (read off the rendered window), then placed on screen
	const W0 = { x: 900, y: 46, k: 1.4 };
	const local: [number, { x: number; y: number }][] = [
		[0, { x: 440, y: 560 }],
		[CZ.pick - 6, { x: 268, y: 224 }],
		[CZ.open + 6, { x: 268, y: 224 }],
		[CZ.hoverX - 10, { x: 262, y: 288 }],
		[CZ.choose - 4, { x: 412, y: 288 }],
		[CZ.color - 8, { x: 181, y: 288 }],
		[CZ.sound - 8, { x: 368, y: 338 }],
		[CZ.play - 4, { x: 518, y: 338 }],
		[CZ.save - 8, { x: 560, y: 652 }],
		[len, { x: 560, y: 652 }],
	];
	const at = local.map(([fr, p]): [number, { x: number; y: number }] => [fr, { x: W0.x + p.x * W0.k, y: W0.y + p.y * W0.k }]);
	let cur = at[0][1];
	for (let i = 1; i < at.length; i++) {
		const [a, pa] = at[i - 1];
		const [b, pb] = at[i];
		if (f >= a) {
			const k = ramp(f, a, b, Easing.inOut(Easing.cubic));
			cur = { x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k };
		}
	}
	const click = [CZ.pick, CZ.choose, CZ.color, CZ.sound, CZ.play, CZ.save].map((c) => (f >= c && f < c + 16 ? (f - c) / 16 : 0)).find((v) => v > 0) ?? 0;
	const vis = ramp(f, 0, 24, outE) * (1 - ramp(f, len - 14, len));
	return (
		<>
			<Copy f={f} len={len} kicker="Fabula Ultima Battle Animations" title={['Make every', 'ability yours']} body="Pick the animation, color and sounds of any ability or item, for one character or the whole world." />
			<div style={{ position: 'absolute', left: 900, top: 46, transform: 'scale(1.4)', transformOrigin: '0 0', opacity: vis }}>
				<EditorWindow s={st} w={600} />
			</div>
			{pick > 0 ? (
				<div style={{ position: 'absolute', left: 820, top: 150, transform: `scale(${1.3 * (0.94 + 0.06 * pick)})`, transformOrigin: '0 0', opacity: pick }}>
					<PickerWindow f={f - CZ.open} w={760} h={600} current={f >= CZ.choose ? 'sf-slash-x' : 'sf-slash-heavy'} hover={f >= CZ.hoverX ? 'sf-slash-x' : 'sf-slash-heavy'} element="dark" />
				</div>
			) : null}
			{vis > 0.5 ? <Cursor x={cur.x} y={cur.y} click={click} /> : null}
		</>
	);
};

/* ---------------- Living Sprites ---------------- */

const IDLES: [ArtName, string, string][] = [
	['hero-2', 'breathe', 'Breathe'],
	['hero-3', 'bob', 'Bob'],
	['hero-1', 'bounce', 'Bounce'],
	['phantom-wolf', 'battle', 'Battle Ready'],
	['golem', 'sway', 'Sway'],
	['dragon', 'hover', 'Hover'],
	['wraith', 'ghostly', 'Ghostly'],
	['hero-3', 'nervous', 'Nervous'],
];
const MOVES: [ArtName, string, string][] = [
	['hero-3', 'hop', 'Hop'],
	['hero-2', 'waddle', 'Waddle'],
	['golem', 'march', 'March'],
	['wraith', 'glide', 'Glide'],
	['dragon', 'fly', 'Fly'],
];
// which way each picture faces as drawn
const FACES_RIGHT: Record<ArtName, boolean> = { 'hero-1': false, 'hero-2': true, 'hero-3': false, golem: true, dragon: true, 'phantom-wolf': true, wraith: true };

const Sprites: React.FC<{ f: number; len: number }> = ({ f, len }) => {
	const moving = f >= 120;
	const t = f / 60;
	const list = moving ? MOVES : IDLES;
	return (
		<>
			<Copy f={f} len={len} kicker="Living Sprites" title={['Any token,', 'alive']} body="Idle and walk animations and soft shadows, made from the one image already on the token. No sprite sheets." />
			<Visual f={f} len={len} left={1290}>
				<div style={{ position: 'relative', width: 1040, height: 720, borderRadius: 12, overflow: 'hidden', background: 'radial-gradient(circle at 50% 45%, #1b2742, #070b14 80%)', border: '1px solid rgba(159,208,255,0.3)', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
					{list.map(([n, preset, label], i) => {
						const cols = moving ? 3 : 4;
						const col = i % cols;
						const row = Math.floor(i / cols);
						const cw = 1040 / cols;
						const offset = moving && row === 1 ? cw / 2 : 0;
						const cx = cw * col + cw / 2 + offset;
						const fy = 300 + row * 330;
						const a = ART[n];
						const k = Math.min(230 / (a.feetY - a.headY), (cw - 30) / a.w);
						// heroes face right, foes face left; walkers pace from side to side with the move preset on top
						const home = n.startsWith('hero') ? 1 : -1;
						const pace = moving ? Math.sin(t * 1.4 + i) * 40 : 0;
						const facing = moving ? (Math.cos(t * 1.4 + i) >= 0 ? 1 : -1) : home;
						const flip = (facing === 1) !== FACES_RIGHT[n];
						const mp = moving ? movePose(preset, t + i * 0.3, facing, 1.4) : poseAt(t, preset, 1.5, facing, [], i * 0.37);
						const show = ramp(f, moving ? 120 : 20 + i * 3, moving ? 134 : 34 + i * 3);
						return (
							<React.Fragment key={`${moving}-${i}`}>
								<div style={{ opacity: show }}>
									<ArtSprite n={n} x={cx + pace} y={fy} k={k} flip={flip} p={mp} t={t} />
								</div>
								<div style={{ position: 'absolute', left: cx - 130, width: 260, top: fy + 16, textAlign: 'center', fontFamily: DISP, fontSize: 34, letterSpacing: '0.08em', color: moving ? C.gold : C.sky, textTransform: 'uppercase', opacity: show }}>{label}</div>
							</React.Fragment>
						);
					})}
					<div style={{ position: 'absolute', left: 24, top: 18, fontFamily: DISP, fontSize: 26, letterSpacing: '0.24em', color: C.ink3 }}>{moving ? 'MOVING' : 'STANDING STILL'}</div>
				</div>
			</Visual>
		</>
	);
};

const RENDER: Record<string, React.FC<{ f: number; len: number }>> = { sheets: Sheets, npc: Npc, preview: Preview, party: Party, creator: CreatorSlide, menus: Menus, customize: Customize, sprites: Sprites };

export const Features: React.FC = () => {
	const f = useCurrentFrame();
	const stage = useStage(480, 270, [ambient('fireflies', { at: 0, area: { x: 0, y: 20, w: 480, h: 260 }, density: 0.6 })]);
	let at = 0;
	return (
		<AbsoluteFill className="trailer-root" style={{ background: 'radial-gradient(ellipse 80% 70% at 70% 50%, #15213d, #070b14 75%)' }}>
			<AbsoluteFill style={{ opacity: 0.18, backgroundImage: 'linear-gradient(45deg, rgba(159,208,255,0.35) 1px, transparent 1px), linear-gradient(-45deg, rgba(159,208,255,0.35) 1px, transparent 1px)', backgroundSize: '120px 120px', backgroundPosition: `${f * 0.3}px 0` , maskImage: 'radial-gradient(ellipse 70% 70% at 70% 50%, #000, transparent)' }} />
			<div style={{ position: 'absolute', left: 0, top: 0, opacity: 0.7 }}>
				<PixelLayer stage={stage} step={f} layer="back" scale={4} />
				<PixelLayer stage={stage} step={f} layer="front" scale={4} />
			</div>
			{SLIDES.map((s) => {
				const from = at;
				at += s.len;
				const R = RENDER[s.id];
				return (
					<Sequence key={s.id} from={from} durationInFrames={s.len} name={s.id} layout="none">
						<R f={f - from} len={s.len} />
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};
