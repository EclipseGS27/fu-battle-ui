// The Fabula Ultima Battle UI screen, rebuilt from the markup its scripts/hud.mjs writes and styled by its
// own styles/battle.css, with demo data passed in as props so each beat of the trailer can change it.
import React from 'react';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../vendor/fu-battle-ui/styles/battle.css';

/* ---------------- constants from the module (scripts/util.mjs, hud.mjs) ---------------- */

export const AFFINITY_TYPES: [string, string, string][] = [
	['physical', 'PHY', '#d6dae6'],
	['air', 'AIR', '#9ff0c9'],
	['bolt', 'BLT', '#ffe46b'],
	['dark', 'DRK', '#b99bff'],
	['earth', 'ERT', '#dcae74'],
	['fire', 'FIR', '#ff9666'],
	['ice', 'ICE', '#92d8ff'],
	['light', 'LGT', '#fff4b8'],
	['poison', 'PSN', '#d79af0'],
];
export const AFF_COLOR: Record<string, string> = { VU: '#6fe3a0', RS: '#aab3cc', IM: '#ff8d99', AB: '#ff6fb0', '·': 'rgba(238,243,255,.45)', '?': 'rgba(238,243,255,.35)' };
export const TIER_TEXT = [
	'Not studied. Affinities appear when hit; Study reveals the rest.',
	'Studied (basic): rank, Species, level, HP and MP known.',
	'Studied (complete): Traits, Attributes, defenses and Affinities known.',
	'Studied (detailed): everything, including attacks, spells, skills and special rules.',
];
export const COMMANDS: [string, string, string][] = [
	['attack', 'Attack', 'Strike with an equipped weapon. Accuracy Check against the target’s Defense.'],
	['spell', 'Spell', 'Cast a spell you know by paying its Mind Point cost.'],
	['skill', 'Skill', 'Use a Skill, Heroic Skill or class feature.'],
	['guard', 'Guard', 'Until your next turn: Resistance to all damage, +2 on Opposed Checks, and you may cover an ally from melee attacks.'],
	['hinder', 'Hinder', 'Check against Difficulty 10: on a success, the target suffers dazed, shaken, slow or weak.'],
	['inventory', 'Inventory', 'Spend Inventory Points to use an item right away.'],
	['study', 'Study', '(INS + INS) Open Check on the target. Each threshold reveals more: rank, Species and max HP and MP first, then Traits, Attributes, defenses and Affinities, then attacks and spells.'],
	['objective', 'Objective', 'Work toward a goal in the scene. Describe your approach, roll the Check the GM calls for, and fill (or erase) sections of a Clock on a success.'],
	['equipment', 'Equipment', 'Swap any equipped items except armor.'],
];
export const STATUS: Record<string, [string, string]> = {
	dazed: ['Dazed', '#f2c45a'],
	shaken: ['Shaken', '#c7a6ff'],
	slow: ['Slow', '#7cb8ff'],
	weak: ['Weak', '#ff9a6b'],
	enraged: ['Enraged', '#ff6b7a'],
	poisoned: ['Poisoned', '#8ee6b8'],
	guard: ['Guard', '#9fd0ff'],
};

/* ---------------- data ---------------- */

export type Who = { name: string; face?: string; tint?: string };
export type Slot = { who: Who; side: 'hero' | 'foe'; state: 'done' | 'now' | 'next' };
export type Card = {
	who: Who;
	cls: string;
	hp: number;
	hpMax: number;
	mp: number;
	mpMax: number;
	ip: number;
	ipMax: number;
	fp: number;
	active?: boolean;
	did?: boolean;
	down?: boolean;
	chips?: string[];
};
export type Target = {
	name: string;
	level: number;
	villain?: string;
	tags: string[];
	hp: number;
	hpMax: number;
	ultima?: number;
	ultimaMax?: number;
	tier: number;
	aff: Record<string, string>;
	/** 0..1 per affinity key: how far its cell has flipped from ? to its value */
	flip?: Record<string, number>;
	details?: string[];
	traits?: string;
	abilities?: { label: string; meta: string; group?: string }[];
	chips?: string[];
	turns: string;
};
export type MenuRow = { id: string; label: string; meta?: string; disabled?: boolean };
export type Menu = { who: Who; title: string; fp: number; rows: MenuRow[]; on: string | null; back?: boolean; help: string; foe?: boolean; ultima?: number; turn?: string };
export type Banner = { side: 'hero' | 'foe' | 'round'; who: string; what: string; tgt?: string; k: number };

/* ---------------- pieces ---------------- */

const initials = (n: string) =>
	n
		.split(/\s+/)
		.map((w) => w[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();

export const Dia: React.FC<{ who: Who; size?: '' | 'sm' }> = ({ who, size = '' }) => (
	<span className={`fbui-dia ${size}`} style={{ ['--tint' as string]: who.tint ?? '#9fd0ff' }}>
		{who.face ? <img src={who.face} alt="" /> : <i>{initials(who.name)}</i>}
	</span>
);

const Cur: React.FC<{ s?: number }> = ({ s = 14 }) => (
	<span className="cur">
		<svg width={s} height={s} viewBox="0 0 14 14" aria-hidden="true">
			<path d="M2 1 12 7 2 13Z" fill="currentColor" />
		</svg>
	</span>
);

const Chips: React.FC<{ ids?: string[]; small?: boolean }> = ({ ids = [], small }) => (
	<>
		{ids.map((s) => (
			<span key={s} className={`fbui-chip ${small ? 'sm' : ''}`} style={{ ['--c' as string]: STATUS[s]?.[1] ?? '#ccc' }}>
				{STATUS[s]?.[0] ?? s}
			</span>
		))}
	</>
);

export const Top: React.FC<{ round: number; slots: Slot[]; phase: { title: string; hint: string; color: string }; style?: React.CSSProperties; tools?: { eye?: boolean; hot?: string } }> = ({ round, slots, phase, style, tools = {} }) => (
	<header className="fbui-top" style={style}>
		<div className="fbui-round">
			<span className="d" />
			<span className="t">
				<small>ROUND</small>
				<b>{round}</b>
			</span>
		</div>
		<div className="fbui-track">
			{slots.map((s, i) => (
				<div key={i} className={`fbui-slot ${s.state} ${s.side}`}>
					<div className="lbl">{s.state === 'now' ? 'NOW' : s.side === 'hero' ? 'HERO' : 'FOE'}</div>
					<div className="fbui-dia">{s.who.face ? <img src={s.who.face} alt="" /> : <i>{initials(s.who.name)}</i>}</div>
					<div className="sub">{s.state === 'done' ? '✓' : ''}</div>
				</div>
			))}
		</div>
		<div className="fbui-phase">
			<div className="t" style={{ color: phase.color }}>
				{phase.title}
			</div>
			<div className="h">{phase.hint}</div>
		</div>
		<div className="fbui-tools">
			<button type="button" className={`fbui-tool ${tools.eye ? 'on' : ''}`} data-tool="eye" style={tools.hot === 'eye' ? { borderColor: 'var(--gold)' } : undefined}>
				<i className="fa-solid fa-eye" />
			</button>
			<button type="button" className="fbui-tool txt" data-tool="minus" style={tools.hot === 'minus' ? { color: '#fff', borderColor: 'var(--gold)' } : undefined}>
				A−
			</button>
			<button type="button" className="fbui-tool txt" data-tool="plus" style={tools.hot === 'plus' ? { color: '#fff', borderColor: 'var(--gold)' } : undefined}>
				A+
			</button>
			<button type="button" className="fbui-tool">
				<i className="fa-solid fa-clock" />
			</button>
			<button type="button" className="fbui-tool">
				<i className="fa-solid fa-down-left-and-up-right-to-center" />
			</button>
			<button type="button" className="fbui-tool">
				<i className="fa-solid fa-xmark" />
			</button>
		</div>
	</header>
);

const pct = (v: number, m: number) => Math.max(0, Math.min(100, (v / Math.max(1, m)) * 100));

export const TargetPanel: React.FC<{ t: Target; roster?: { name: string; used: string; on?: boolean; crisis?: boolean; down?: boolean }[]; gm?: { tier: number; shown: string[] } }> = ({ t, roster, gm }) => {
	const crisis = t.hp <= t.hpMax / 2 && t.hp > 0;
	const tier = t.tier;
	return (
		<>
			<div className={`fbui-panel foe ${t.villain ? 'villain' : ''}`}>
				<div className="fbui-head">
					<div>
						<div className="fbui-kicker foe">{t.villain ? `VILLAIN · ${t.villain.toUpperCase()}` : 'TARGET'}</div>
						<div className="fbui-name">{t.name}</div>
					</div>
					<div className="fbui-lv">{tier >= 1 ? `Lv ${t.level}` : 'Lv ?'}</div>
				</div>
				<div className="fbui-tags">
					{(tier >= 1 ? t.tags : []).concat([t.turns], tier === 0 ? ['Not studied'] : []).map((x) => (
						<span key={x}>{x}</span>
					))}
				</div>
				<div className={`fbui-hp ${crisis ? 'crisis' : ''}`}>
					<div className="row">
						<span className="k">{crisis ? 'HP · CRISIS' : 'HP'}</span>
						<span className="v">{tier >= 1 ? `${Math.max(0, Math.round(t.hp))} / ${t.hpMax}` : '???'}</span>
					</div>
					<div className="bar">
						<span style={{ width: `${pct(t.hp, t.hpMax)}%` }} />
						<i />
					</div>
					<div className="row sm">
						<span>{crisis ? 'In Crisis' : 'Not in Crisis'}</span>
						<span>{tier >= 1 ? `${Math.max(0, t.hpMax - Math.round(t.hp))} damage taken` : ''}</span>
					</div>
				</div>
				{t.villain && t.ultima != null ? (
					<div className="fbui-ultima">
						<span className="k">ULTIMA POINTS</span>
						<span className="pips">
							{Array.from({ length: t.ultimaMax ?? t.ultima }, (_, i) => (
								<i key={i} className={i < t.ultima! ? 'on' : ''} />
							))}
						</span>
						<span className="n">
							{t.ultima}
							{t.ultimaMax ? ` of ${t.ultimaMax}` : ''}
						</span>
					</div>
				) : null}
				{t.chips?.length ? (
					<div className="fbui-chips">
						<Chips ids={t.chips} />
					</div>
				) : null}
				{tier >= 2 && t.details ? (
					<div className="fbui-details">
						{t.details[0]}
						{t.details[1] ? (
							<>
								<br />
								{t.details[1]}
							</>
						) : null}
						{t.traits ? <div className="traits">{t.traits}</div> : null}
					</div>
				) : null}
				<div>
					<div className="fbui-kicker">AFFINITIES</div>
					<div className="fbui-aff">
						{AFFINITY_TYPES.map(([k, abbr, col]) => {
							const flip = t.flip?.[k] ?? (tier >= 2 ? 1 : 0);
							const v = flip >= 0.5 ? t.aff[k] : '?';
							const sy = Math.abs(Math.cos(flip * Math.PI));
							const hot = flip > 0 && flip < 1;
							if (gm) {
								const shown = gm.shown.includes(k) || gm.tier >= 2;
								return (
									<button key={k} type="button" className={`cell gm ${shown ? 'shown' : ''}`}>
										<span style={{ color: col }}>{abbr}</span>
										<b style={{ color: AFF_COLOR[t.aff[k]] ?? '#eef3ff' }}>{t.aff[k]}</b>
									</button>
								);
							}
							return (
								<div key={k} className="cell" style={{ transform: `scaleY(${Math.max(0.05, sy)})`, borderColor: hot || (flip >= 1 && v === 'VU') ? 'rgba(111,227,160,0.7)' : undefined, background: flip >= 1 && v === 'VU' ? 'rgba(111,227,160,0.14)' : undefined }}>
									<span style={{ color: col }}>{abbr}</span>
									<b style={{ color: AFF_COLOR[v] ?? '#eef3ff' }}>{v}</b>
								</div>
							);
						})}
					</div>
					<div className="fbui-note">{gm ? `Players see: ${TIER_TEXT[gm.tier]}` : TIER_TEXT[tier]}</div>
					{gm ? (
						<div className="fbui-tier">
							<span>Players know</span>
							{[0, 1, 2, 3].map((n) => (
								<button key={n} type="button" className={gm.tier === n ? 'on' : ''}>
									{['–', 'Basic', 'Full', 'All'][n]}
								</button>
							))}
						</div>
					) : null}
				</div>
				{tier >= 3 && t.abilities ? (
					<div className="fbui-abil">
						<div className="fbui-kicker">ABILITIES</div>
						<div className="fbui-abil-list">
							{t.abilities.map((m, i) => (
								<React.Fragment key={m.label}>
									{m.group && m.group !== t.abilities![i - 1]?.group ? <div className="fbui-sep">{m.group}</div> : null}
									<button type="button" className="fbui-cmd-row">
										<Cur s={12} />
										<span className="l">{m.label}</span>
										<span className="m">{m.meta}</span>
									</button>
								</React.Fragment>
							))}
						</div>
					</div>
				) : null}
			</div>
			{roster ? (
				<div className="fbui-panel roster">
					{roster.map((r) => (
						<button key={r.name} type="button" className={`fbui-roster ${r.on ? 'on' : ''} ${r.down ? 'down' : ''}`}>
							<span className="nm">{r.name}</span>
							<span className="rt">
								{r.crisis && !r.down ? <em>CRISIS</em> : null}
								{r.down ? <em className="ko">DOWN</em> : null}
								<small>{r.used}</small>
							</span>
						</button>
					))}
				</div>
			) : null}
		</>
	);
};

export const CommandPanel: React.FC<{ m: Menu }> = ({ m }) => (
	<div className={`fbui-panel cmd ${m.foe ? 'foe' : ''}`}>
		<div className={`fbui-cmd-head ${m.foe ? 'foe' : ''}`}>
			<Dia who={m.who} />
			<div className="who">
				{m.foe ? <div className="fbui-kicker foe">GAME MASTER</div> : null}
				<div className="fbui-name sm">{m.foe ? `${m.who.name} acts` : m.who.name}</div>
				{m.foe ? null : <div className="sub">{m.title}</div>}
			</div>
			{m.foe ? (
				<>
					{m.ultima != null ? (
						<button type="button" className="fp">
							<small>ULTIMA</small>
							<b>{m.ultima}</b>
						</button>
					) : null}
					<div className="fp">
						<small>TURN</small>
						<b>{m.turn}</b>
					</div>
				</>
			) : (
				<button type="button" className="fp">
					<small>FABULA</small>
					<b>{m.fp <= 8 ? '◆'.repeat(m.fp) || '0' : `◆ × ${m.fp}`}</b>
				</button>
			)}
		</div>
		<div className="fbui-cmd-list">
			{m.back ? (
				<button type="button" className="fbui-cmd-row back">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
						<path d="M10 3 5 8l5 5" />
					</svg>
					<span className="l">Back</span>
				</button>
			) : null}
			{m.rows.map((r) => (
				<button key={r.id} type="button" className={`fbui-cmd-row ${m.on === r.id ? 'on' : ''}`} disabled={r.disabled}>
					<Cur />
					<span className="l">{r.label}</span>
					<span className="m">{r.meta ?? ''}</span>
				</button>
			))}
		</div>
		<div className="fbui-help">{m.help}</div>
		<div className="fbui-cmd-foot">
			<button type="button" className={`fbui-cta ${m.foe ? 'red' : 'gold'}`}>
				{m.foe ? `End ${m.who.name}’s turn` : 'End turn'}
			</button>
		</div>
	</div>
);

export const PartyCards: React.FC<{ cards: Card[]; lift?: (i: number) => number }> = ({ cards, lift }) => (
	<div className="fbui-party" style={{ ['--n' as string]: cards.length }}>
		{cards.map((c, i) => {
			const crisis = c.hp <= c.hpMax / 2 && c.hp > 0;
			const badge = c.down ? 'DOWN' : c.active ? 'ACTING' : c.did ? 'ACTED' : crisis ? 'CRISIS' : '';
			const badgeCls = ({ DOWN: 'down', ACTING: 'acting', ACTED: 'acted', CRISIS: 'crisis' } as Record<string, string>)[badge] ?? '';
			return (
				<div key={c.who.name} className={`fbui-card ${c.active ? 'active' : ''} ${c.did ? 'did' : ''} ${c.down ? 'down' : ''}`} style={lift ? { translate: `0 ${lift(i)}px` } : undefined}>
					<span className="top">
						<Dia who={c.who} />
						<span className="nm">
							<b>{c.who.name}</b>
							<small>{c.cls}</small>
						</span>
						{badge ? <span className={`badge ${badgeCls}`}>{badge}</span> : null}
					</span>
					<span className="meter">
						<span className="k hp">HP</span>
						<span className={`bar hp ${crisis ? 'crisis' : ''}`}>
							<span style={{ width: `${pct(c.hp, c.hpMax)}%` }} />
							<i />
						</span>
						<span className={`v ${crisis ? 'crisis' : ''}`}>
							{Math.round(c.hp)}
							<small>/{c.hpMax}</small>
						</span>
					</span>
					<span className="meter">
						<span className="k mp">MP</span>
						<span className="bar mp">
							<span style={{ width: `${pct(c.mp, c.mpMax)}%` }} />
						</span>
						<span className="v">
							{Math.round(c.mp)}
							<small>/{c.mpMax}</small>
						</span>
					</span>
					<span className="foot">
						<span className="ipg">
							<span className="ip">
								<b>IP</b>
								{Array.from({ length: c.ipMax }, (_, k) => (
									<i key={k} className={k < c.ip ? 'on' : ''} />
								))}
							</span>
						</span>
						<span className="chips">
							<Chips ids={c.chips} small />
							<span className="fpchip can">◆ {c.fp}</span>
						</span>
					</span>
				</div>
			);
		})}
	</div>
);

export const BannerEl: React.FC<{ b: Banner }> = ({ b }) => {
	const k = b.k;
	// fbui-in: from opacity 0 and scaleX(0.6); fbui-out: up 10px and fade
	const inK = Math.min(1, k * 3.4);
	const outK = Math.max(0, (k - 0.82) / 0.18);
	return (
		<div className={`fbui-banner ${b.side}`} style={{ opacity: inK * (1 - outK), transform: `scaleX(${0.6 + 0.4 * inK}) translateY(${-10 * outK}px)` }}>
			<span className="who">{b.who}</span>
			<span className="what">{b.what}</span>
			{b.tgt ? <span className="tgt">{b.tgt}</span> : null}
		</div>
	);
};

/**
 * The whole screen. `show` slides each region in (0 hidden, 1 in place), the way the trailer reveals it.
 * Stage size and scale follow hud.mjs layout(): fit by height to an 800-unit stage.
 */
export const Hud: React.FC<{
	W?: number;
	H?: number;
	show?: { top?: number; left?: number; right?: number; bottom?: number };
	round: number;
	slots: Slot[];
	phase: { title: string; hint: string; color: string };
	target?: Target;
	roster?: { name: string; used: string; on?: boolean; crisis?: boolean; down?: boolean }[];
	right?: React.ReactNode;
	cards: Card[];
	banner?: Banner | null;
	bannerTop?: string;
	cardLift?: (i: number) => number;
	size?: number;
	tools?: { eye?: boolean; hot?: string };
	gm?: { tier: number; shown: string[] };
}> = ({ W = 1920, H = 1080, show = {}, round, slots, phase, target, roster, right, cards, banner, bannerTop, cardLift, size = 1, tools, gm }) => {
	// hud.mjs layout(): fit by height to an 800-unit stage, times the UI size setting (A− / A+)
	const fit = Math.min(Math.max(Math.min(H / 800, W / 1180), 0.7), 3) * size;
	const sw = W / fit;
	const sh = H / fit;
	const v = (k: number | undefined) => (k == null ? 1 : Math.max(0, Math.min(1, k)));
	const top = v(show.top);
	const left = v(show.left);
	const rgt = v(show.right);
	const bot = v(show.bottom);
	return (
		<div id="fbui" className="fbui open" style={{ width: W, height: H }}>
			<div className="fbui-stage" style={{ width: sw, height: sh, transform: `scale(${fit})` }}>
				<div className="fbui-main">
					<Top round={round} slots={slots} phase={phase} tools={tools} style={{ opacity: top, translate: `0 ${(1 - top) * -120}px` }} />
					<section className="fbui-center" />
					<section className="fbui-left" style={{ opacity: left, translate: `${(1 - left) * -420}px 0` }}>
						{target ? <TargetPanel t={target} roster={roster} gm={gm} /> : null}
					</section>
					<section className="fbui-right" style={{ opacity: rgt, translate: `${(1 - rgt) * 420}px 0` }}>
						{right}
					</section>
					<section className="fbui-bottom" style={{ opacity: bot, translate: `0 ${(1 - bot) * 260}px` }}>
						<PartyCards cards={cards} lift={cardLift} />
					</section>
				</div>
				<div className="fbui-banners" style={bannerTop ? { top: bannerTop } : undefined}>{banner ? <BannerEl b={banner} /> : null}</div>
				<div className="fbui-floats" />
			</div>
		</div>
	);
};
