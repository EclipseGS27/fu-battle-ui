// The score, the synthesized sound effects (scripts/make-audio.py) and the Battle UI's own FFXIII menu sounds
// (public/sounds/ui/ff13, synced from the module), each cue placed from the scenes' own timing constants.
import React from 'react';
import { Sequence, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import { T as OP } from '../scenes/Opening';
import { B } from '../scenes/Combat';
import { CZ, PV, SLIDES } from '../scenes/Features';
import { AB, FB, FIELD_LEN, AURORA_LEN } from '../scenes/Showcase';
import { CT } from '../scenes/Closing';

type Sfx = 'boom' | 'hit' | 'impact' | 'whoosh' | 'slash' | 'explosion' | 'ice' | 'magic' | 'charge' | 'fire' | 'heal' | 'bite' | 'arrow' | 'drain' | 'poison' | 'riser' | 'crash' | 'meteor' | 'holy';
type Ui = 'cursor' | 'confirm' | 'back' | 'activate' | 'turn' | 'chime' | 'fanfare';
type Cue = [frame: number, sound: Sfx | `ui:${Ui}`, volume: number];

// where each act starts in the trailer (Trailer.tsx)
const AT = { opening: 0, combat: 600, features: 1800, showcase: 3420, closing: 4590 };
const SLIDE_AT = (() => {
	let at = AT.features;
	const out: Record<string, number> = {};
	for (const s of SLIDES) {
		out[s.id] = at;
		at += s.len;
	}
	return out;
})();

const C = (offset: number, list: Cue[]): Cue[] => list.map(([f, s, v]) => [f + offset, s, v]);

const CUES: Cue[] = [
	// Opening: the spell, the strike, the foes
	...C(AT.opening, [
		[OP.spell + 4, 'magic', 0.7],
		[OP.spell + 30, 'holy', 0.45],
		[OP.strike + 2, 'slash', 0.9],
		[OP.strike + 10, 'impact', 0.8],
		...[0, 1, 2, 3].map((i): Cue => [OP.foe + 18 + i * 14, 'boom', 0.5]),
		[OP.title, 'impact', 0.55],
	]),
	// Combat
	...C(AT.combat, [
		[30, 'ui:fanfare', 0.5],
		...[0, 1, 2, 3, 4, 5, 6].map((i): Cue => [B.studyCursor + i * 6, 'ui:cursor', 0.4]),
		[B.studyGo, 'ui:confirm', 0.5],
		[B.studyGo + 4, 'magic', 0.35],
		[B.studyReveal, 'ui:chime', 0.5],
		[B.foeTurn, 'ui:turn', 0.45],
		[B.foeTurn + 20, 'ui:cursor', 0.35],
		[B.breathGo, 'ui:confirm', 0.45],
		[B.breath, 'whoosh', 0.7],
		[B.breathHit, 'ice', 0.8],
		[B.breathHit, 'hit', 0.5],
		[B.renTurn, 'ui:turn', 0.45],
		...[0, 1, 2, 3, 4, 5].map((i): Cue => [B.renTurn + 4 + i * 6, 'ui:cursor', 0.38]),
		[B.invOpen, 'ui:confirm', 0.45],
		[B.shardGo, 'ui:confirm', 0.45],
		[B.bolt, 'arrow', 0.6],
		[B.shardHit, 'explosion', 0.85],
		[B.shardHit, 'fire', 0.5],
		[B.round2 - 8, 'ui:fanfare', 0.4],
		[B.cutIn, 'whoosh', 0.8],
		[B.cutIn + 4, 'charge', 0.45],
		[B.kaelDash - 10, 'whoosh', 0.6],
		[B.slashHit - 6, 'slash', 0.9],
		[B.slashHit, 'impact', 0.95],
		[B.slashHit, 'crash', 0.25],
		[B.slashHit + 12, 'ui:chime', 0.45],
		[B.clawTurn, 'ui:turn', 0.45],
		[B.claw - 6, 'whoosh', 0.6],
		[B.clawHit, 'slash', 0.6],
		[B.clawHit, 'hit', 0.7],
		[B.cometTurn, 'ui:confirm', 0.45],
		[B.glyph, 'magic', 0.6],
		[B.glyph + 10, 'charge', 0.5],
		[B.meteor + 6, 'meteor', 0.8],
		[B.cometHit, 'explosion', 0.95],
		[B.cometHit, 'boom', 0.7],
		[B.collapse + 20, 'ice', 0.6],
	]),
	// Features: a whoosh into each slide, and the clicks
	...SLIDES.map((s): Cue => [SLIDE_AT[s.id], 'whoosh', 0.3]),
	[SLIDE_AT.sheets + 92, 'whoosh', 0.35],
	...C(SLIDE_AT.preview, [
		[PV.eye, 'ui:confirm', 0.55],
		[PV.plus1, 'ui:cursor', 0.55],
		[PV.plus2, 'ui:cursor', 0.55],
		[PV.minus, 'ui:back', 0.5],
	]),
	...C(SLIDE_AT.party, [
		[90, 'ui:cursor', 0.4],
		[110, 'ui:cursor', 0.4],
		[128, 'ui:cursor', 0.4],
	]),
	...C(SLIDE_AT.creator, [[104, 'ui:confirm', 0.4]]),
	...C(SLIDE_AT.customize, [
		[CZ.pick, 'ui:confirm', 0.5],
		[CZ.hoverX, 'ui:cursor', 0.4],
		[CZ.choose, 'ui:confirm', 0.5],
		[CZ.choose + 4, 'slash', 0.5],
		[CZ.color, 'ui:cursor', 0.45],
		[CZ.colorSet, 'ui:confirm', 0.45],
		[CZ.sound, 'ui:cursor', 0.45],
		[CZ.play, 'fire', 0.8],
		[CZ.save, 'ui:chime', 0.55],
	]),
	// Showcase: the flower field
	...C(AT.showcase, [
		[FB.bite, 'whoosh', 0.6],
		[FB.bite + 30, 'bite', 0.9],
		[FB.shot + 2, 'arrow', 0.7],
		[FB.shot + 14, 'hit', 0.6],
		[FB.shot + 18, 'arrow', 0.7],
		[FB.shot + 30, 'hit', 0.6],
		[FB.drain + 8, 'drain', 0.8],
		[FB.drain + 34, 'heal', 0.6],
		[FB.lux, 'magic', 0.6],
		[FB.lux + 22, 'whoosh', 0.5],
		[FB.lux + 40, 'holy', 0.6],
		[FB.lux + 40, 'impact', 0.7],
		[FB.finish, 'whoosh', 0.6],
		[FB.finish + 20, 'slash', 0.8],
		[FB.finish + 26, 'impact', 0.85],
		[FB.finish + 34, 'slash', 0.6],
	]),
	// Showcase: the aurora
	...C(AT.showcase + FIELD_LEN, [
		[AB.breath + 10, 'whoosh', 0.7],
		[AB.breathHit, 'poison', 0.9],
		[AB.breathHit, 'hit', 0.5],
		[AB.heal, 'heal', 0.8],
		[AB.shot + 2, 'arrow', 0.7],
		[AB.shot + 14, 'hit', 0.6],
		[AB.cutIn, 'whoosh', 0.8],
		[AB.pillar, 'holy', 0.8],
		[AB.pillarHit, 'impact', 1],
		[AB.pillarHit, 'boom', 0.7],
		[AB.pillarHit, 'crash', 0.3],
		[AB.collapse, 'boom', 0.45],
	]),
	// Showcase: the wall of effects
	...C(AT.showcase + FIELD_LEN + AURORA_LEN, [
		...Array.from({ length: 12 }, (_, i): Cue => [6 + i * 5, 'ui:cursor', 0.22]),
		[76, 'hit', 0.4],
		[96, 'hit', 0.4],
		[116, 'hit', 0.4],
	]),
	// Closing
	...C(AT.closing, [
		...[0, 1, 2, 3].map((i): Cue => [CT.cards + 10 + i * 10, 'ui:cursor', 0.4]),
		[CT.install, 'ui:confirm', 0.4],
		...[0, 1, 2].map((i): Cue => [CT.install + 14 + i * 10, 'ui:cursor', 0.35]),
	]),
];

const src = (s: Cue[1]) => (s.startsWith('ui:') ? staticFile(`sounds/ui/ff13/${s.slice(3)}.ogg`) : staticFile(`audio/sfx/${s}.wav`));

export const Soundtrack: React.FC = () => (
	<>
		<Audio src={staticFile('audio/score.mp3')} volume={0.85} />
		{CUES.map(([f, s, v], i) => (
			<Sequence key={i} from={Math.max(0, Math.round(f))} durationInFrames={240} layout="none" name={s}>
				<Audio src={src(s)} volume={v} />
			</Sequence>
		))}
	</>
);
