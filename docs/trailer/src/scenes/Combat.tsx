// Act 2: a conflict on the Battle UI, in the crystal cave. Two rounds, turns alternating hero / foe as the
// module forecasts them:
// Round 1: Mira studies the Frost Golem, the Golem breathes ice, Ren throws an Elemental Shard from the
// Inventory menu (fire: Vulnerable).
// Round 2: Kael's Heroic Skill with a cut-in and a critical, the Golem's Crushing Claw leaves him weak, Mira's
// Comet brings it down. Every effect is the module's own, picked the way its tables pick them.
import React from 'react';
import { AbsoluteFill, Easing, Img, useCurrentFrame } from 'remotion';
import { useStage, Cue } from '../fx/PixelLayer';
import { ambient } from '../fx/pixel-runner.js';
import { camAt, CamKey, Freeze, pulse, ramp, sceneFrame, Shake, shakeAt } from '../fx/impact';
import { artUrl, GLOWS } from '../art/art';
import { Banner, Card, CommandPanel, COMMANDS, Hud, Menu, Slot, Target } from '../ui/Hud';
import { Num } from '../ui/Numbers';
import { CutIn } from '../ui/CutIn';
import { Caption } from '../ui/Type';
import { Shot } from '../ui/Shot';
import { BattleWorld, Fighter, place } from './battle';
import { GOLEM_ABILITIES, GOLEM_AFF, people } from './cast';
import { C } from '../theme';

export const COMBAT_LEN = 1200;

/* ---------------- the beats (frames in this scene) ---------------- */
export const B = {
	// Round 1
	studyCursor: 160,
	studyGo: 210,
	studyReveal: 262,
	foeTurn: 330,
	breathGo: 366,
	breath: 380,
	breathHit: 402,
	renTurn: 500,
	invOpen: 534,
	shardGo: 552,
	bolt: 558,
	shardHit: 578,
	// Round 2
	round2: 690,
	cutIn: 708,
	kaelDash: 786,
	slashHit: 806,
	clawTurn: 866,
	claw: 912,
	clawHit: 926,
	cometTurn: 975,
	glyph: 979,
	meteor: 1003,
	cometHit: 1033,
	collapse: 1059,
	victory: 1100,
};

const freezes: Freeze[] = [
	{ at: B.shardHit, len: 9 },
	{ at: B.slashHit, len: 12 },
	{ at: B.cometHit, len: 14 },
];
/** A real frame on the scene clock (hit freezes hold the scene clock still) */
const sc = (r: number) => sceneFrame(r, freezes);

/* ---------------- the fighters (feet on screen, before the camera) ---------------- */
const rawFighters: Fighter[] = [
	{
		key: 'mira',
		n: 'hero-2',
		x: 575,
		y: 712,
		k: 0.72,
		dir: 1,
		idle: 'battle',
		phase: 0.4,
		acts: [{ id: 'cast', at: (B.studyGo + 2) / 60 }, { id: 'hurt', at: (B.breathHit + 5) / 60 }, { id: 'cast', at: B.glyph / 60 }, { id: 'victory', at: (B.victory + 8) / 60 }],
		hits: [B.breathHit + 5],
		kb: -24,
	},
	{
		key: 'kael',
		n: 'hero-1',
		x: 700,
		y: 838,
		k: 0.74,
		flip: true,
		dir: 1,
		idle: 'battle',
		acts: [
			{ id: 'hurt', at: (B.breathHit + 2) / 60 },
			{ id: 'attack', at: (B.slashHit - 26) / 60, travelX: 240, travelY: -30, k: 1.3 },
			{ id: 'hurt', at: B.clawHit / 60 },
			{ id: 'victory', at: B.victory / 60 },
		],
		hits: [B.breathHit + 2, B.clawHit],
		kb: -28,
	},
	{
		key: 'ren',
		n: 'hero-3',
		x: 880,
		y: 768,
		k: 0.74,
		flip: true,
		dir: 1,
		idle: 'battle',
		phase: 0.8,
		acts: [{ id: 'hurt', at: (B.breathHit + 8) / 60 }, { id: 'attack', at: (B.shardGo - 4) / 60, travelX: 0, k: 0.8 }, { id: 'victory', at: (B.victory + 16) / 60 }],
		hits: [B.breathHit + 8],
		kb: -24,
	},
	{
		key: 'golem',
		n: 'golem',
		x: 1240,
		y: 800,
		k: 1.1,
		flip: true,
		dir: -1,
		idle: 'breathe',
		idleK: 1.6,
		acts: [
			{ id: 'cast', at: B.breath / 60 - 0.15, k: 0.7 },
			{ id: 'hurt', at: B.shardHit / 60, k: 0.8 },
			{ id: 'hurt', at: B.slashHit / 60, k: 0.9 },
			{ id: 'attack', at: (B.claw - 14) / 60, travelX: -220, travelY: 38, k: 0.9 },
			{ id: 'hurt', at: B.cometHit / 60, k: 1 },
			{ id: 'collapse', at: B.collapse / 60, ko: true, k: 1 },
		],
		hits: [B.shardHit, B.slashHit, B.cometHit],
		kb: 40,
		shadowW: 0.7,
	},
];
const fighters: Fighter[] = rawFighters.map((F) => ({ ...F, acts: F.acts.map((a) => ({ ...a, at: sc(a.at * 60) / 60 })), hits: F.hits.map(sc) }));
const P0 = Object.fromEntries(rawFighters.map((F) => [F.key, place(F)])) as Record<string, ReturnType<typeof place>>;
const M = { mira: P0.mira.art, kael: P0.kael.art, ren: P0.ren.art, golem: P0.golem.art };
const TG = { mira: P0.mira.target, kael: P0.kael.target, ren: P0.ren.target, golem: P0.golem.target };
// the Golem's mouth (its face is on the right of the image, mirrored to the left here)
const mouth = { x: (P0.golem.left + (348 - 200) * 1.1) / 4, y: (P0.golem.top + 95 * 1.1) / 4 };

const rawCues: Cue[] = [
	ambient('fireflies', { at: 0, area: { x: -20, y: 20, w: 520, h: 240 }, density: 0.45 }),
	ambient('fog', { at: 0, area: { x: -40, y: 160, w: 560, h: 60 }, density: 0.5 }),
	// Study: ? on the user, ! on the target, then the light bulb (presets.mjs ACTIONS.study)
	{ id: 'sf-sym-question', at: B.studyGo + 2, ...M.mira, target: TG.mira },
	{ id: 'sf-sym-alert', at: B.studyGo + 16, ...M.golem, target: TG.golem },
	{ id: 'sf-sym-bulb', at: B.studyGo + 44, ...M.mira, target: TG.mira },
	// Ice Breath (a bestiary breath: breath, ice)
	{ id: 'sf-breath', at: B.breath, ...M.kael, from: mouth, element: 'ice', target: TG.kael, source: TG.golem },
	{ id: 'sf-ice-crystals', at: B.breathHit + 2, ...M.kael, element: 'ice', target: TG.kael, seed: 3 },
	{ id: 'sf-ice-crystals', at: B.breathHit + 5, ...M.mira, element: 'ice', target: TG.mira, seed: 4 },
	{ id: 'sf-ice-crystals', at: B.breathHit + 8, ...M.ren, element: 'ice', target: TG.ren, seed: 5 },
	// Elemental Shard (abilities.mjs: ranged, an orb, then an explosion) in fire
	{ id: 'sf-bolt', at: B.bolt, ...M.golem, from: M.ren, element: 'fire', target: TG.golem, source: TG.ren },
	{ id: 'sf-explosion', at: B.shardHit, ...M.golem, element: 'fire', target: TG.golem },
	// Nether Slash (Heroic Skill, dark heavy slash) landing as a critical
	{ id: 'sf-slash-heavy', at: B.slashHit - 6, ...M.golem, from: { x: M.golem.x - 40, y: M.golem.y }, element: 'dark', target: TG.golem },
	{ id: 'sf-impact-heavy', at: B.slashHit, ...M.golem, from: { x: M.golem.x - 40, y: M.golem.y }, element: 'dark', target: TG.golem },
	// Crushing Claw (claw), the target suffers weak
	{ id: 'sf-claw', at: B.claw, ...M.kael, from: { x: M.kael.x + 40, y: M.kael.y }, target: TG.kael },
	// Comet (PIXEL_PICKS.comet: rune circle, meteor, shockwave)
	{ id: 'sf-glyph', at: B.glyph, ...M.mira, target: TG.mira },
	{ id: 'sf-meteor', at: B.meteor, ...M.golem, from: M.mira, target: TG.golem, source: TG.mira },
	{ id: 'sf-shockwave', at: B.cometHit, ...M.golem, target: TG.golem },
	{ id: 'sf-ice-shatter', at: B.collapse + 20, ...M.golem, element: 'ice', target: TG.golem },
];
const cues: Cue[] = rawCues.map((c) => ({ ...c, at: sc(c.at) }));
const shakes: Shake[] = [
	{ at: B.breathHit, power: 0.8, len: 18 },
	{ at: B.shardHit, power: 1.2, len: 22 },
	{ at: B.slashHit, power: 1.7, len: 26 },
	{ at: B.clawHit, power: 0.9, len: 16 },
	{ at: B.cometHit, power: 2.2, len: 34 },
];

const D = { x: 960, y: 540, zoom: 1 };
const camKeys: CamKey[] = [
	{ f: 0, cam: { x: 1040, y: 640, zoom: 1.3 } },
	{ f: 150, cam: D },
	{ f: 340, cam: D },
	{ f: 380, cam: { x: 880, y: 620, zoom: 1.2 } },
	{ f: 440, cam: { x: 860, y: 620, zoom: 1.24 } },
	{ f: 470, cam: D },
	{ f: 548, cam: D },
	{ f: 572, cam: { x: 1040, y: 620, zoom: 1.28 } },
	{ f: 630, cam: { x: 1090, y: 620, zoom: 1.34 } },
	{ f: 670, cam: D },
	{ f: 760, cam: D },
	{ f: 790, cam: { x: 1080, y: 640, zoom: 1.38 } },
	{ f: 812, cam: { x: 1150, y: 620, zoom: 1.48 }, ease: Easing.out(Easing.cubic) },
	{ f: 862, cam: { x: 1060, y: 620, zoom: 1.3 } },
	{ f: 884, cam: D },
	{ f: 912, cam: { x: 880, y: 640, zoom: 1.28 } },
	{ f: 960, cam: { x: 900, y: 640, zoom: 1.3 } },
	{ f: 990, cam: { x: 1040, y: 500, zoom: 1.08 } },
	{ f: 1035, cam: { x: 1180, y: 610, zoom: 1.32 }, ease: Easing.in(Easing.cubic) },
	{ f: 1092, cam: { x: 1160, y: 620, zoom: 1.28 } },
	{ f: 1124, cam: { x: 900, y: 620, zoom: 1.18 } },
	{ f: 1200, cam: { x: 820, y: 640, zoom: 1.28 } },
];

const over = (k: string) => P0[k].over;
const rawNumbers: Num[] = [
	{ at: B.breathHit + 3, ...over('kael'), text: '17' },
	{ at: B.breathHit + 6, ...over('mira'), text: '28' },
	{ at: B.breathHit + 9, ...over('ren'), text: '16' },
	{ at: B.shardHit + 2, ...over('golem'), text: '40', kind: 'weak', sub: 'FIRE · VULNERABLE' },
	{ at: B.slashHit + 2, ...over('golem'), text: '52', crit: true },
	{ at: B.clawHit + 2, ...over('kael'), text: '19' },
	{ at: B.cometHit + 2, ...over('golem'), text: '94' },
];
const numbers = rawNumbers.map((n) => ({ ...n, y: n.y + 60, at: sc(n.at) }));

/* ---------------- the Battle UI's state at a frame ---------------- */

const hpOf = (r: number, start: number, steps: [number, number][]) => steps.reduce((hp, [at, v]) => (r >= at ? v : hp), start);
const golemHp = (r: number) => hpOf(r, 180, [[B.shardHit + 2, 140], [B.slashHit + 2, 88], [B.cometHit + 2, 0]]);

const INVENTORY = [
	{ id: 'shard', label: 'Elemental Shard', meta: '2 IP' },
	{ id: 'tonic', label: 'Tonic', meta: '2 IP' },
	{ id: 'elixir', label: 'Elixir', meta: '3 IP' },
	{ id: 'remedy', label: 'Remedy', meta: '3 IP' },
	{ id: 'tent', label: 'Magic Tent', meta: '4 IP' },
	{ id: 'bag', label: 'Pull something out of the bag', meta: '? IP' },
];

function hudAt(r: number, P: ReturnType<typeof people>) {
	const round = r < B.round2 ? 1 : 2;
	let slots: Slot[];
	let phase = { title: 'Heroes’ turn', hint: 'Mira is acting.', color: '#9fd0ff' };
	const s = (who: keyof typeof P, side: 'hero' | 'foe', state: Slot['state']): Slot => ({ who: P[who], side, state });
	if (r < B.foeTurn) slots = [s('kael', 'hero', 'done'), s('golem', 'foe', 'done'), s('mira', 'hero', 'now'), s('golem', 'foe', 'next'), s('ren', 'hero', 'next')];
	else if (r < B.renTurn) {
		slots = [s('kael', 'hero', 'done'), s('golem', 'foe', 'done'), s('mira', 'hero', 'done'), s('golem', 'foe', 'now'), s('ren', 'hero', 'next')];
		phase = { title: 'Villain’s turn', hint: 'Frost Golem acts. Champion: 2 turns this round.', color: '#ff8d99' };
	} else if (r < B.round2) {
		slots = [s('golem', 'foe', 'done'), s('mira', 'hero', 'done'), s('golem', 'foe', 'done'), s('ren', 'hero', 'now'), s('kael', 'hero', 'next')];
		phase = { title: 'Heroes’ turn', hint: 'Ren is acting.', color: '#9fd0ff' };
	} else if (r < B.clawTurn) {
		slots = [s('golem', 'foe', 'done'), s('ren', 'hero', 'done'), s('kael', 'hero', 'now'), s('golem', 'foe', 'next'), s('mira', 'hero', 'next'), s('golem', 'foe', 'next')];
		phase = { title: 'Heroes’ turn', hint: 'Kael is acting.', color: '#9fd0ff' };
	} else if (r < B.cometTurn) {
		slots = [s('ren', 'hero', 'done'), s('kael', 'hero', 'done'), s('golem', 'foe', 'now'), s('mira', 'hero', 'next'), s('golem', 'foe', 'next')];
		phase = { title: 'Villain’s turn', hint: 'Frost Golem acts. Champion: 2 turns this round.', color: '#ff8d99' };
	} else {
		slots = [s('kael', 'hero', 'done'), s('golem', 'foe', 'done'), s('mira', 'hero', 'now'), s('golem', 'foe', 'next'), s('ren', 'hero', 'next')];
		phase = { title: 'Heroes’ turn', hint: 'Mira is acting.', color: '#9fd0ff' };
	}

	// party cards
	const kaelHp = hpOf(r, 55, [[B.breathHit + 3, 38], [B.clawHit + 2, 19]]);
	const miraHp = hpOf(r, 52, [[B.breathHit + 6, 24]]);
	const renHp = hpOf(r, 42, [[B.breathHit + 9, 26]]);
	const renIp = hpOf(r, 6, [[B.shardGo, 4]]);
	const miraMp = hpOf(r, 40, [[B.glyph, 20]]);
	const actor = r < B.foeTurn ? 'mira' : r < B.renTurn ? 'golem' : r < B.round2 ? 'ren' : r < B.clawTurn ? 'kael' : r < B.cometTurn ? 'golem' : 'mira';
	const r1 = r < B.round2;
	const cards: Card[] = [
		{ who: P.kael, cls: 'Weaponmaster 3 · Darkblade 2', hp: kaelHp, hpMax: 55, mp: 30, mpMax: 30, ip: 6, ipMax: 6, fp: 3, active: actor === 'kael', did: r1 || r >= B.clawTurn, chips: r >= B.clawHit + 2 ? ['weak'] : [] },
		{ who: P.mira, cls: 'Spiritist 3 · Entropist 2', hp: miraHp, hpMax: 60, mp: miraMp, mpMax: 45, ip: 4, ipMax: 6, fp: 3, active: actor === 'mira', did: r1 && r >= B.foeTurn },
		{ who: P.ren, cls: 'Sharpshooter 3 · Rogue 2', hp: renHp, hpMax: 45, mp: 25, mpMax: 25, ip: renIp, ipMax: 6, fp: 2, active: actor === 'ren', did: !r1 },
	];

	// target panel
	const tier = r < B.studyReveal ? 0 : 3;
	const flip: Record<string, number> = {};
	['physical', 'air', 'bolt', 'dark', 'earth', 'fire', 'ice', 'light', 'poison'].forEach((k, i) => (flip[k] = ramp(r, B.studyReveal + i * 4, B.studyReveal + i * 4 + 10, Easing.linear)));
	const hp = golemHp(r);
	const target: Target = {
		name: 'Frost Golem',
		level: 20,
		villain: 'minor',
		tags: ['Champion (2)', 'Construct'],
		hp,
		hpMax: 180,
		ultima: 5,
		ultimaMax: 5,
		tier,
		aff: GOLEM_AFF,
		flip,
		details: ['DEX d8 · INS d8 · MIG d10 · WLP d8', 'DEF 9 · M.DEF 8'],
		traits: 'slow, sturdy, ancient',
		abilities: GOLEM_ABILITIES,
		turns: '2 turns per round',
	};
	const used = r < B.foeTurn ? '1/2 turns' : r < B.round2 ? '2/2 turns' : r < B.clawTurn ? '0/2 turns' : '1/2 turns';
	const roster = [{ name: 'Frost Golem', used, on: true, crisis: hp > 0 && hp <= 90, down: hp <= 0 && r > B.collapse + 30 }];

	// the right-hand panel
	let menu: Menu;
	const cmdRows = (weapon: string) => COMMANDS.map(([id, label]) => ({ id, label, meta: ['spell', 'skill', 'inventory', 'objective'].includes(id) ? '›' : id === 'attack' ? weapon : '' }));
	const walk = (start: number, order: string[]) => order[Math.max(0, Math.min(order.length - 1, Math.floor((r - start) / 6)))];
	if (actor === 'mira' && r < B.cometTurn) {
		const on = r < B.studyCursor ? 'attack' : walk(B.studyCursor, ['attack', 'spell', 'skill', 'guard', 'hinder', 'inventory', 'study']);
		menu = { who: P.mira, title: 'Choose an action', fp: 3, rows: cmdRows('Unarmed'), on, help: COMMANDS.find((c) => c[0] === on)![2] };
	} else if (actor === 'mira') {
		const rows = [
			{ id: 'comet', label: 'Comet', meta: '20 MP' },
			{ id: 'heal', label: 'Heal', meta: '10 MP' },
			{ id: 'cleanse', label: 'Cleanse', meta: '10 MP' },
			{ id: 'lux', label: 'Lux', meta: '10 MP' },
			{ id: 'reinforce', label: 'Reinforce', meta: '10 MP' },
		];
		menu = { who: P.mira, title: 'Spells', fp: 3, rows, on: 'comet', back: true, help: 'Pick a spell. Its cost is paid on casting; × T means per target.' };
	} else if (actor === 'golem') {
		const rows = [
			{ id: 'claw', label: 'Crushing Claw', meta: '【MIG + MIG】 +1' },
			{ id: 'breath', label: 'Ice Breath', meta: '【DEX + INS】' },
			{ id: 'glacies', label: 'Glacies', meta: '10 MP × T' },
			{ id: 'core', label: 'Frozen Core', meta: 'skill' },
			{ id: 'shatter', label: 'Shatter', meta: 'rule' },
		];
		const second = r >= B.clawTurn;
		const on = second ? 'claw' : r < B.foeTurn + 20 ? 'claw' : 'breath';
		menu = { who: P.golem, title: '', fp: 0, rows, on, help: 'Roll an action. The warning button announces a charged attack to everyone.', foe: true, ultima: 5, turn: second ? '2/2' : '1/2' };
	} else if (actor === 'ren') {
		if (r < B.invOpen) {
			const on = walk(B.renTurn + 4, ['attack', 'spell', 'skill', 'guard', 'hinder', 'inventory']);
			menu = { who: P.ren, title: 'Choose an action', fp: 2, rows: cmdRows('Heavy Crossbow'), on, help: COMMANDS.find((c) => c[0] === on)![2] };
		} else menu = { who: P.ren, title: `Inventory · ${hpOf(r, 6, [[B.shardGo, 4]])} IP`, fp: 2, rows: INVENTORY, on: 'shard', back: true, help: 'Produce an item from your bag and use it at once. Core items not on your sheet are added the first time you use them.' };
	} else {
		menu = { who: P.kael, title: 'Skills', fp: 3, rows: [{ id: 'nether', label: 'Nether Slash', meta: 'Heroic' }], on: 'nether', back: true, help: 'Posts the Skill to chat with its rolls and effects. Passive Skills apply on their own.' };
	}

	// banners (who, what, on whom), as Battle UI posts them from the chat card
	const bn = (at: number, len: number, b: Omit<Banner, 'k'>) => (r >= at && r <= at + len ? { ...b, k: (r - at) / len } : null);
	const banner =
		bn(30, 70, { side: 'round', who: 'Conflict start', what: '1' }) ??
		bn(B.studyGo + 2, 62, { side: 'hero', who: 'Mira', what: 'Study', tgt: 'on Frost Golem' }) ??
		bn(B.breathGo + 2, B.breathHit - B.breathGo - 2, { side: 'foe', who: 'Frost Golem', what: 'Ice Breath', tgt: 'on Kael, Mira, Ren' }) ??
		bn(B.shardGo - 10, B.shardHit - B.shardGo + 6, { side: 'hero', who: 'Ren', what: 'Elemental Shard', tgt: 'on Frost Golem' }) ??
		bn(B.round2 - 8, 56, { side: 'round', who: 'Round', what: '2' }) ??
		bn(B.claw - 30, 42, { side: 'foe', who: 'Frost Golem', what: 'Crushing Claw', tgt: 'on Kael' }) ??
		bn(B.cometTurn + 4, 52, { side: 'hero', who: 'Mira', what: 'Comet', tgt: 'on Frost Golem' });

	// panels: in for the menus, out ("hide panels") while the big moves play
	const inOut = (pairs: [number, number][]) => {
		let v = 1;
		for (const [a, b] of pairs) {
			if (r >= a && r < a + 18) v = 1 - Easing.out(Easing.cubic)((r - a) / 18);
			else if (r >= a + 18 && r < b) v = 0;
			else if (r >= b && r < b + 20) v = Easing.out(Easing.cubic)((r - b) / 20);
		}
		return v;
	};
	const hidden: [number, number][] = [
		[B.breathGo + 4, 440],
		[B.shardGo + 2, 640],
		[B.cutIn - 14, 866],
		[B.claw - 18, 962],
		[B.cometTurn + 4, 1068],
		[B.victory - 8, 99999],
	];
	const side = inOut(hidden);
	const show = {
		top: ramp(r, 22, 52, Easing.out(Easing.cubic)),
		left: Math.min(ramp(r, 40, 72, Easing.out(Easing.cubic)), side),
		right: Math.min(ramp(r, 56, 88, Easing.out(Easing.cubic)), side),
		bottom: ramp(r, 70, 104, Easing.out(Easing.cubic)),
	};
	return { round, slots, phase, cards, target, roster, menu, banner, show, bannerTop: side < 0.5 ? '31%' : '47%', actor };
}

const KaelPortrait: React.FC = () => <Img src={artUrl('hero-1')} style={{ height: '100%', display: 'block', transform: 'scaleX(-1)' }} />;

export const Combat: React.FC = () => {
	const r = useCurrentFrame();
	const P = people();
	const sf = sceneFrame(r, freezes);
	const stage = useStage(480, 270, cues);
	const cam = camAt(r, camKeys);
	const sh = shakeAt(r, shakes);
	const hud = hudAt(r, P);
	const dim = Math.max(ramp(r, B.shardGo, B.shardGo + 12) * (1 - ramp(r, B.shardHit + 20, B.shardHit + 40)), ramp(r, B.glyph, B.glyph + 14) * (1 - ramp(r, B.cometHit + 24, B.cometHit + 50))) * 0.5;
	const whiteout = pulse(r, B.cometHit, 22, 0.7) + pulse(r, B.shardHit, 16, 0.4) + pulse(r, B.slashHit, 14, 0.5);
	const hp = golemHp(r);
	return (
		<AbsoluteFill className="trailer-root">
			<BattleWorld
				kind="cave"
				cam={cam}
				shake={sh}
				stage={stage}
				sf={sf}
				fighters={fighters}
				numbers={numbers}
				dim={dim}
				extra={(F) => {
					if (F.key === 'golem') return { glow: hp > 0 ? (hp <= 90 ? GLOWS.bossCrisis : GLOWS.boss) : null, idleOff: r >= B.collapse, alpha: r >= B.collapse ? 1 - 0.4 * ramp(r, B.collapse + 40, B.collapse + 90) : 1 };
					const weak = F.key === 'kael' && r >= B.clawHit + 2;
					return {
						glow: hud.actor === F.key && r < B.victory ? GLOWS.hero : null,
						ghosts: F.key === 'kael' && r > B.kaelDash - 12 && r < B.kaelDash + 4,
						status: weak ? 'weak' : undefined,
						pose: weak ? (p) => (p.tintAmt > 0.42 ? p : { ...p, tint: 0x9a8fb8, tintAmt: 0.42 }) : undefined,
					};
				}}
			/>
			<div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: Math.min(1, whiteout), mixBlendMode: 'screen' }} />
			<Hud show={hud.show} round={hud.round} slots={hud.slots} phase={hud.phase} target={hud.target} roster={hud.roster} right={<CommandPanel m={hud.menu} />} cards={hud.cards} banner={hud.banner} bannerTop={hud.bannerTop} />
			{r > B.slashHit + 12 && r < B.clawTurn ? (
				<div style={{ position: 'absolute', right: 70, top: 170, opacity: Math.min(ramp(r, B.slashHit + 12, B.slashHit + 24), 1 - ramp(r, B.clawTurn - 12, B.clawTurn)), translate: `${(1 - ramp(r, B.slashHit + 12, B.slashHit + 30, Easing.out(Easing.cubic))) * 120}px 0` }}>
					<Shot name="opportunity" width={500} crop={[44, 38, 362, 480]} radius={8} glow="rgba(242,196,90,0.45)" />
				</div>
			) : null}
			<CutIn f={r - B.cutIn} name="Nether Slash" user="Kael" color={C.gold} portrait={<KaelPortrait />} />
			<Caption f={r} a={30} b={152} kicker="Fabula Ultima Battle UI" title="A JRPG battle screen" size={84} style={{ left: 945, top: 150, transform: 'translateX(-50%)' }} />
			<Caption f={r} a={B.studyGo + 6} b={B.foeTurn - 4} kicker="Study" title="Learn what you face" size={84} style={{ left: 945, top: 150, transform: 'translateX(-50%)' }} />
			<Caption f={r} a={B.foeTurn + 6} b={B.breathGo + 2} kicker="Game master" title="Run every foe’s turn" size={84} style={{ left: 945, top: 150, transform: 'translateX(-50%)' }} />
			<Caption f={r} a={B.invOpen - 4} b={B.shardGo + 4} kicker="Inventory Points" title="Items in one click" size={84} style={{ left: 945, top: 150, transform: 'translateX(-50%)' }} />
			<Caption f={r} a={B.shardHit + 44} b={B.round2 - 6} kicker="Fabula Ultima Battle Animations" title="Every ability animated" size={92} style={{ left: 945, top: 150, transform: 'translateX(-50%)' }} />
			<Caption f={r} a={B.slashHit + 26} b={B.clawTurn - 4} kicker="Heroic Skills" title="Cut-ins and criticals" size={92} style={{ left: 120, top: 190 }} align="left" />
			<Caption f={r} a={B.clawHit + 8} b={B.cometTurn - 2} kicker="Battle Animations" title="Conditions on every token" size={84} style={{ left: 960, top: 150, transform: 'translateX(-50%)' }} />
			<Caption f={r} a={B.victory + 10} b={COMBAT_LEN - 4} kicker="Living Sprites" title="Every token comes alive" size={96} style={{ left: 960, top: 150, transform: 'translateX(-50%)' }} />
		</AbsoluteFill>
	);
};
