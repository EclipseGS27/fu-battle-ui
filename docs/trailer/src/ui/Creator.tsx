// The Fabula Ultima Character Creator wizard, rebuilt from the markup its scripts/creator.mjs writes and styled
// by its own styles/creator.css. Demo: building Ren (Elementalist 3 / Entropist 2), whose numbers match his
// card in the battle.
import React from 'react';
import '../vendor/fu-character-creator/styles/creator.css';

export const STEPS = ['Identity', 'Classes & Skills', 'Spells & Features', 'Attributes', 'Equipment', 'Review'];

type Skill = { name: string; sl: number; max: number; spells?: boolean };
type Picked = { name: string; icon: string; skills: Skill[] };

const CLASSES: { name: string; icon: string; badges: string[]; on?: boolean }[] = [
	{ name: 'Darkblade', icon: 'fa-skull', badges: ['+5 HP', 'Martial melee weapons'] },
	{ name: 'Elementalist', icon: 'fa-fire', badges: ['+5 MP', 'Ritual: Elementalism'], on: true },
	{ name: 'Entropist', icon: 'fa-hourglass-half', badges: ['+5 MP', 'Ritual: Entropism'], on: true },
	{ name: 'Guardian', icon: 'fa-shield-halved', badges: ['+5 HP', 'Martial armor and shields'] },
	{ name: 'Spiritist', icon: 'fa-hand-sparkles', badges: ['+5 MP', 'Ritual: Spiritism'] },
	{ name: 'Weaponmaster', icon: 'fa-khanda', badges: ['+5 HP', 'Martial melee weapons'] },
];

const Icon: React.FC<{ i: string }> = ({ i }) => (
	<span style={{ width: 40, height: 40, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 6, background: 'linear-gradient(135deg, #3a4a78, #232838)', border: '1px solid var(--fucc-line)', color: '#e0a93a', fontSize: 18 }}>
		<i className={`fa-solid ${i}`} />
	</span>
);

const Stepper: React.FC<{ v: number; max: number; full: boolean }> = ({ v, max, full }) => (
	<div className="fucc-stepper">
		<button type="button" disabled={!v}>
			−
		</button>
		<span>{v}</span>
		<button type="button" disabled={v >= max || full}>
			+
		</button>
	</div>
);

const ClassesStep: React.FC<{ k: number }> = ({ k }) => {
	// skill levels are spent one by one as k goes 0 → 1
	const spend = Math.min(5, Math.floor(k * 6));
	const picked: Picked[] = [
		{ name: 'Elementalist', icon: 'fa-fire', skills: [{ name: 'Elemental Magic', sl: Math.min(2, spend), max: 10, spells: true }, { name: 'Ritual Elementalism', sl: spend >= 3 ? 1 : 0, max: 1 }] },
		{ name: 'Entropist', icon: 'fa-hourglass-half', skills: [{ name: 'Entropic Magic', sl: Math.max(0, Math.min(2, spend - 3)), max: 10, spells: true }, { name: 'Ritual Entropism', sl: 0, max: 1 }] },
	];
	const total = spend;
	return (
		<div className="fucc-classes">
			<div className="fucc-col">
				<div className="fucc-toolbar">
					<input type="search" placeholder="Search classes" />
					<select defaultValue="all">
						<option value="all">All books</option>
					</select>
				</div>
				<div className="fucc-class-list">
					{CLASSES.map((c) => (
						<div key={c.name} className={`fucc-class ${c.on ? 'is-on' : ''}`}>
							<Icon i={c.icon} />
							<div className="fucc-class-txt">
								<div className="fucc-class-name">
									{c.name} <span className="fucc-book">Core Rulebook</span>
								</div>
								<div className="fucc-badges">
									{c.badges.map((b) => (
										<span key={b}>{b}</span>
									))}
								</div>
							</div>
							<div className="fucc-class-btns">
								<button type="button" className="fucc-mini">
									<i className="fa-solid fa-book-open" />
								</button>
								<button type="button" className={`fucc-mini ${c.on ? 'is-on' : ''}`}>
									{c.on ? (
										<>
											<i className="fa-solid fa-check" /> Taken
										</>
									) : (
										'Take'
									)}
								</button>
							</div>
						</div>
					))}
				</div>
			</div>
			<div className="fucc-col">
				<div className="fucc-meter">
					<div>
						<b>{total}</b> / 5 levels
					</div>
					<div className="fucc-bar">
						<i style={{ width: `${(total / 5) * 100}%` }} />
					</div>
					<div className="fucc-muted fucc-small">2 of 2–3 classes. Each level buys one Skill Level in that class.</div>
				</div>
				<div className="fucc-picked-list">
					{picked.map((p) => (
						<div key={p.name} className="fucc-picked">
							<div className="fucc-picked-h">
								<Icon i={p.icon} />
								<b>{p.name}</b>
								<span className="fucc-lv">Level {p.skills.reduce((s, x) => s + x.sl, 0)}</span>
							</div>
							{p.skills.map((s) => (
								<div key={s.name} className={`fucc-skill ${s.sl ? 'is-on' : ''}`}>
									<div className="fucc-skill-row">
										<Stepper v={s.sl} max={s.max} full={total >= 5} />
										<div className="fucc-txt">
											<button type="button" className="fucc-link">
												{s.name}
											</button>
											<span className="fucc-muted fucc-small">
												max SL {s.max}
												{s.spells ? (
													<>
														{' · '}
														<span className="fucc-tag">grants spells</span>
													</>
												) : null}
											</span>
										</div>
									</div>
								</div>
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

const ATTRS: [string, string, string][] = [
	['DEX', 'Dexterity', 'Precision, coordination, finesse.'],
	['INS', 'Insight', 'Observation, understanding, reasoning.'],
	['MIG', 'Might', 'Strength and resilience.'],
	['WLP', 'Willpower', 'Determination and spirit.'],
];

const AttributesStep: React.FC<{ k: number }> = ({ k }) => {
	const avg = k > 0.25;
	const dice = avg ? [6, 10, 8, 8] : [8, 8, 8, 8];
	const count = (v: number) => Math.round(v * Math.min(1, Math.max(0, (k - 0.3) / 0.5)));
	const hp = 5 + 5 * dice[2];
	const mp = 5 + 5 * dice[3] + 10;
	return (
		<div className="fucc-attrs">
			<div className="fucc-profiles">
				{[
					['Jack of All Trades', 'd8 · d8 · d8 · d8'],
					['Average', 'd10 · d8 · d8 · d6'],
					['Specialized', 'd10 · d10 · d6 · d6'],
				].map(([l, d], i) => (
					<button key={l} type="button" className={`fucc-profile ${(avg ? i === 1 : i === 0) ? 'is-on' : ''}`}>
						<b>{l}</b>
						<span>{d}</span>
					</button>
				))}
			</div>
			<div className="fucc-attr-grid">
				{ATTRS.map(([abbr, label, hint], i) => (
					<div key={abbr} className="fucc-attr">
						<div className="fucc-attr-h">
							<b>{abbr}</b> {label}
						</div>
						<select value={`d${dice[i]}`} onChange={() => {}}>
							<option>d{dice[i]}</option>
						</select>
						<div className="fucc-muted fucc-small">{hint}</div>
					</div>
				))}
			</div>
			<div className="fucc-derived">
				<div>
					<span>Max HP</span>
					<b>{count(hp)}</b>
					<small>5 + 5 × MIG · Crisis {Math.floor(hp / 2)}</small>
				</div>
				<div>
					<span>Max MP</span>
					<b>{count(mp)}</b>
					<small>5 + 5 × WLP + 10 from classes</small>
				</div>
				<div>
					<span>Max IP</span>
					<b>{count(6)}</b>
					<small>6</small>
				</div>
				<div>
					<span>Defense</span>
					<b>{count(dice[0])}</b>
					<small>DEX die, then armor and shield</small>
				</div>
				<div>
					<span>M. Defense</span>
					<b>{count(dice[1])}</b>
					<small>INS die, then equipment</small>
				</div>
				<div>
					<span>Initiative</span>
					<b>+0</b>
					<small>from armor and shield</small>
				</div>
			</div>
			<p className="fucc-muted fucc-small">Choosing a die for one Attribute swaps it with the Attribute that held it, so the profile always stays valid.</p>
		</div>
	);
};

/** step: index into STEPS; k: progress through the shown step's demo (0 → 1) */
export const Creator: React.FC<{ step: number; k: number; w: number; h: number }> = ({ step, k, w, h }) => (
	<div className="application fucc" style={{ width: w, height: h }}>
		<header className="window-header">
			<h1 className="window-title">Character Creator</h1>
		</header>
		<section className="window-content">
			<nav className="fucc-steps">
				{STEPS.map((label, i) => (
					<button key={label} type="button" className={`fucc-step ${i === step ? 'is-active' : ''} ${i < step ? 'is-done' : ''}`}>
						<span className="n">{i + 1}</span>
						{label}
					</button>
				))}
			</nav>
			<section className="fucc-body">{step === 3 ? <AttributesStep k={k} /> : <ClassesStep k={k} />}</section>
			<footer className="fucc-foot">
				<div className="fucc-foot-msg">
					<i className="fa-solid fa-check" /> This step is complete.
				</div>
				<div className="fucc-foot-btns">
					<button type="button">
						<i className="fa-solid fa-arrow-left" /> Back
					</button>
					<button type="button" className="fucc-primary">
						Next <i className="fa-solid fa-arrow-right" />
					</button>
				</div>
			</footer>
		</section>
	</div>
);
