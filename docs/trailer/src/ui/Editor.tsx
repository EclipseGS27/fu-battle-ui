// Fabula Ultima Battle Animations' Animation window and effect picker, rebuilt from the markup its
// scripts/editor.mjs writes and styled by its own styles/anim.css, with live previews of the module's effects
// laid out like its editor previews (target on the right, user on the left).
import React from 'react';
import { useStage, PixelLayer, Cue } from '../fx/PixelLayer';
import { PIXEL } from '../fx/pixel-runner.js';
import '../vendor/fu-animations/styles/anim.css';
import { C } from '../theme';

const capsule = (w: number, h: number) => {
	const data = new Uint32Array(w * h);
	const r = w / 2;
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const cx = x + 0.5 - r;
			const cy = Math.min(Math.max(y + 0.5, r), h - r) - (y + 0.5);
			if (cx * cx + cy * cy <= r * r) data[y * w + x] = 0xff808080;
		}
	return data;
};
const T = { w: 30, h: 34, shape: { w: 18, h: 30, data: capsule(18, 30) } };

/** One effect looping in a small preview, every `loop` frames (scripts/pixel.mjs PixelPreview) */
export const FxPreview: React.FC<{ id: string; element: string; f: number; size: number; art: number; loop?: number; seed?: number }> = ({ id, element, f, size, art, loop = 84, seed = 3 }) => {
	const def = (PIXEL as Record<string, { line?: boolean; proj?: string }>)[id];
	const anchor = { x: art * 0.62, y: art * 0.55 };
	const from = def?.line || def?.proj ? { x: art * 0.14, y: art * 0.62 } : { x: art * 0.2, y: art * 0.55 };
	const cues: Cue[] = Array.from({ length: 8 }, (_, i) => ({ id, at: i * loop, ...anchor, from, element, seed: seed + i, target: T, source: { w: 30, h: 34 } }));
	const stage = useStage(art, art, cues);
	const k = size / art;
	return (
		<div style={{ position: 'relative', width: size, height: size }}>
			<div style={{ position: 'absolute', left: (anchor.x - 9) * k, top: (anchor.y - 15) * k, width: 18 * k, height: 30 * k, background: 'rgba(255,255,255,0.08)' }} />
			{def?.line || def?.proj ? <div style={{ position: 'absolute', left: (from.x - 9) * k, top: (from.y - 15) * k, width: 18 * k, height: 30 * k, background: 'rgba(255,255,255,0.08)' }} /> : null}
			<PixelLayer stage={stage} step={Math.max(0, f)} layer="back" scale={k} />
			<PixelLayer stage={stage} step={Math.max(0, f)} layer="front" scale={k} />
		</div>
	);
};

export const STYLE_LABEL = 'Melee: dash to the target and strike';

export type EditorState = {
	name: string;
	source: string;
	hit: string;
	hitLabel: string;
	element: string;
	elementLabel: string;
	castSound: string;
	hitSound: string;
	hot?: string;
	saved?: boolean;
	f: number;
	key: string;
};

const Slot: React.FC<{ label: string; value: string; off?: boolean; hot?: boolean }> = ({ label, value, off, hot }) => (
	<div className={`snd slot ${off ? 'off' : ''}`}>
		<span>{label}</span>
		<button type="button" className="pick" style={hot ? { borderColor: C.gold, background: 'rgba(242, 196, 90, 0.1)' } : undefined}>
			<b>{value}</b>
			<i className="fa-solid fa-table-cells-large" />
		</button>
	</div>
);

const Sel: React.FC<{ label: string; value: string; hot?: boolean; play?: boolean; playHot?: boolean }> = ({ label, value, hot, play, playHot }) => (
	<div className="snd">
		<span>{label}</span>
		<div className="row">
			<select value={value} onChange={() => {}} style={hot ? { borderColor: C.gold, boxShadow: `0 0 0 1px ${C.gold}` } : undefined}>
				<option>{value}</option>
			</select>
			{play ? (
				<button type="button" className="play" style={playHot ? { borderColor: C.gold, background: 'rgba(242,196,90,0.3)' } : undefined}>
					▶
				</button>
			) : null}
		</div>
	</div>
);

/** The Animation window for one ability (editor.mjs #html) */
export const EditorWindow: React.FC<{ s: EditorState; w: number }> = ({ s, w }) => (
	<div className="application fua-app" style={{ width: w }}>
		<header className="window-header">
			<h1 className="window-title">Animation: {s.name}</h1>
		</header>
		<section className="window-content">
			<div className="fua-ed">
				<header>
					<b>{s.name}</b>
					<small>{s.source}</small>
				</header>
				<div className="grid">
					<label className="wide">
						<span>Style</span>
						<select value={STYLE_LABEL} onChange={() => {}}>
							<option>{STYLE_LABEL}</option>
						</select>
					</label>
					<Slot label="On the user first" value="None" />
					<Slot label="Projectile" value="None" off />
					<Slot label="On each target" value={s.hitLabel} hot={s.hot === 'hit'} />
					<Slot label="Back on the user after" value="None" />
					<Sel label="Color" value={s.elementLabel} hot={s.hot === 'color'} />
					<label>
						<span>
							Size <output>1.0×</output>
						</span>
						<input type="range" min="0.5" max="2.5" step="0.1" defaultValue="1" />
					</label>
					<Sel label="Sound on use" value={s.castSound} play />
					<Sel label="Sound on hit" value={s.hitSound} hot={s.hot === 'sound'} play playHot={s.hot === 'play'} />
				</div>
				<div className="previews">
					<figure>
						<div className="pv" />
						<figcaption>On the user</figcaption>
					</figure>
					<figure>
						<div className="pv" style={{ display: 'grid', placeItems: 'center' }}>
							<FxPreview key={s.key} id={s.hit} element={s.element} f={s.f} size={150} art={150} loop={44} />
						</div>
						<figcaption>On the target</figcaption>
					</figure>
					<figure>
						<div className="pv" />
						<figcaption>Back on the user</figcaption>
					</figure>
				</div>
				<fieldset className="scope">
					<legend>Save for</legend>
					<label>
						<input type="radio" readOnly checked={false} /> This item only
					</label>
					<label>
						<input type="radio" readOnly checked /> Every “{s.name}” in this world
					</label>
				</fieldset>
				<footer>
					<button type="button">Preview on the scene</button>
					<label className="crit">
						<input type="checkbox" readOnly checked={false} /> as a critical
					</label>
					<span className="sp" />
					<button type="button">Reset</button>
					<button type="button" className="gold" style={s.hot === 'save' ? { boxShadow: `0 0 18px ${C.gold}`, filter: 'brightness(1.3)' } : undefined}>
						{s.saved ? '✓ Saved' : 'Save'}
					</button>
				</footer>
			</div>
		</section>
	</div>
);

export const PICK_TILES: [string, string][] = [
	['sf-slash', 'Slash'],
	['sf-slash-up', 'Rising slash'],
	['sf-slash-wide', 'Wide sweep'],
	['sf-slash-heavy', 'Heavy cleave'],
	['sf-slash-combo', 'Slash combo'],
	['sf-slash-x', 'Cross slash'],
	['sf-thrust', 'Thrust'],
	['sf-claw', 'Claw marks'],
	['sf-lightning', 'Lightning strike'],
	['sf-ice-nova', 'Frost nova'],
	['sf-explosion', 'Explosion'],
	['sf-pillar', 'Pillar of light'],
];

/** The effect picker (editor.mjs, .fua-pick): search, kind chips and a grid of tiles that play */
export const PickerWindow: React.FC<{ f: number; w: number; h: number; current: string; hover: string | null; element: string }> = ({ f, w, h, current, hover, element }) => (
	<div className="application fua-app" style={{ width: w, height: h }}>
		<header className="window-header">
			<h1 className="window-title">On each target: Nether Slash</h1>
		</header>
		<section className="window-content" style={{ height: h - 34 }}>
			<div className="fua-pick">
				<div className="top">
					<input type="search" placeholder="Search effects" readOnly />
					<div className="chips">
						{['All', 'Bolts', 'Elements', 'Explosions', 'Hits', 'Magic', 'Status', 'Strikes', 'Support', 'Symbols', 'Weather'].map((c, i) => (
							<button key={c} type="button" className={`chip ${i === 0 ? 'on' : ''}`}>
								{c}
							</button>
						))}
					</div>
				</div>
				<div className="grid-wrap">
					<h4>Pixel Strikes</h4>
					<div className="tiles">
						{PICK_TILES.map(([id, label], i) => (
							<button key={id} type="button" className={`tile ${id === current ? 'on' : ''}`} style={id === hover ? { borderColor: 'rgba(159, 208, 255, 0.35)', background: 'rgba(90, 169, 255, 0.1)' } : undefined}>
								<span className="pv">
									<FxPreview id={id} element={element} f={f + i * 7} size={104} art={70} loop={44} seed={i + 2} />
								</span>
								<span className="nm">{label}</span>
							</button>
						))}
					</div>
				</div>
				<p className="note">Hover a tile to play it, click to choose. Colors follow the animation’s color setting.</p>
			</div>
		</section>
	</div>
);

/** A mouse pointer, with a ring when it clicks */
export const Cursor: React.FC<{ x: number; y: number; click?: number }> = ({ x, y, click = 0 }) => (
	<div style={{ position: 'absolute', left: x, top: y, zIndex: 200, pointerEvents: 'none' }}>
		{click > 0 && click < 1 ? <div style={{ position: 'absolute', left: -26 * click, top: -26 * click, width: 52 * click, height: 52 * click, borderRadius: '50%', border: `3px solid ${C.gold}`, opacity: 1 - click }} /> : null}
		<svg width="34" height="40" viewBox="0 0 17 20" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.6))' }}>
			<path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill="#fff" stroke="#0b1220" strokeWidth="1.2" strokeLinejoin="round" />
		</svg>
	</div>
);
