// Act 5: the title again, the four modules with their repositories, and how to install them.
import React from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { ramp } from '../fx/impact';
import { PixelLayer, useStage } from '../fx/PixelLayer';
import { ambient } from '../fx/pixel-runner.js';
import { ArtSprite, Scenery } from '../art/art';
import { poseAt } from '../sprites/motion';
import { Kicker, TitleLockup } from '../ui/Type';
import { C, DISP, TEXT } from '../theme';

export const CLOSING_LEN = 810;
export const CT = { cards: 290, install: 560 };

const MODULES = [
	{ name: 'Battle UI', repo: 'fu-battle-ui', line: 'JRPG battle screen, sheets, party menu' },
	{ name: 'Battle Animations', repo: 'fu-animations', line: 'Every ability, spell and foe attack animated' },
	{ name: 'Character Creator', repo: 'fu-character-creator', line: 'Step-by-step character creation' },
	{ name: 'Living Sprites', repo: 'fu-living-sprites', line: 'Idle and walk animations for any token' },
];

const outE = Easing.bezier(0.16, 1, 0.3, 1);

export const Closing: React.FC = () => {
	const f = useCurrentFrame();
	const t = f / 60;
	const stage = useStage(480, 270, [ambient('fireflies', { at: 0, area: { x: -20, y: 20, w: 520, h: 250 }, density: 0.8 })]);
	const titleOut = ramp(f, CT.cards - 30, CT.cards, Easing.in(Easing.cubic));
	const bgDim = 0.45 + 0.35 * ramp(f, CT.cards - 30, CT.cards);
	const end = ramp(f, CLOSING_LEN - 40, CLOSING_LEN);
	return (
		<AbsoluteFill className="trailer-root">
			<div style={{ position: 'absolute', inset: 0, transform: `scale(${1.12 - 0.06 * ramp(f, 0, CLOSING_LEN)})`, transformOrigin: '50% 70%' }}>
				<Scenery kind="aurora" />
				<ArtSprite n="hero-2" x={760} y={980} k={0.78} p={poseAt(t, 'battle', 1, 1, [], 0.4)} t={t} />
				<ArtSprite n="hero-1" x={960} y={1030} k={0.8} flip p={poseAt(t, 'battle', 1, 1)} t={t} />
				<ArtSprite n="hero-3" x={1160} y={990} k={0.8} flip p={poseAt(t, 'battle', 1, 1, [], 0.8)} t={t} />
			</div>
			<div style={{ position: 'absolute', left: 0, top: 0 }}>
				<PixelLayer stage={stage} step={f} layer="back" scale={4} />
				<PixelLayer stage={stage} step={f} layer="front" scale={4} />
			</div>
			<AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(3,5,11,${bgDim + 0.35}) 0%, rgba(3,5,11,${bgDim}) 55%, rgba(3,5,11,${bgDim * 0.4}) 100%)` }} />
			{f < CT.cards ? (
				<div style={{ position: 'absolute', left: 0, right: 0, top: 150, display: 'flex', justifyContent: 'center', opacity: 1 - titleOut, transform: `translateY(${-40 * titleOut}px)` }}>
					<TitleLockup f={f} start={6} />
				</div>
			) : null}
			{f >= CT.cards - 10 ? (
				<div style={{ position: 'absolute', left: 0, right: 0, top: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34, opacity: 1 - ramp(f, CT.install - 20, CT.install) }}>
					<div style={{ opacity: ramp(f, CT.cards, CT.cards + 16) }}>
						<Kicker size={36}>Four modules for Project FU on Foundry VTT</Kicker>
					</div>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 760px)', gap: 26 }}>
						{MODULES.map((m, i) => {
							const k = ramp(f, CT.cards + 10 + i * 10, CT.cards + 34 + i * 10, outE);
							return (
								<div key={m.repo} style={{ padding: '26px 32px', borderRadius: 10, background: 'rgba(12, 20, 44, 0.9)', border: '1px solid rgba(159, 208, 255, 0.4)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', opacity: k, transform: `translateY(${(1 - k) * 40}px)` }}>
									<div style={{ fontFamily: DISP, fontSize: 30, letterSpacing: '0.24em', color: C.gold, textTransform: 'uppercase' }}>Fabula Ultima</div>
									<div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 64, lineHeight: 1.05, color: '#fff', textTransform: 'uppercase' }}>{m.name}</div>
									<div style={{ fontFamily: TEXT, fontSize: 32, color: C.ink2, marginTop: 6 }}>{m.line}</div>
									<div style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 32, color: C.sky, marginTop: 14 }}>
										<i className="fa-brands fa-github" style={{ marginRight: 12 }} />
										github.com/EclipseGS27/{m.repo}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			) : null}
			{f >= CT.install - 10 ? (
				<div style={{ position: 'absolute', left: 0, right: 0, top: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, opacity: ramp(f, CT.install, CT.install + 20) * (1 - end) }}>
					<div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 120, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', textShadow: '0 5px 0 rgba(0,0,0,0.5)' }}>Install in Foundry</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 22, fontFamily: DISP, fontSize: 48, color: C.ink, letterSpacing: '0.04em' }}>
						{['Add-on Modules', 'Install Module', 'paste the Manifest URL'].map((s, i) => (
							<React.Fragment key={s}>
								{i ? <span style={{ color: C.gold }}>›</span> : null}
								<span style={{ padding: '10px 22px', borderRadius: 6, border: '1px solid rgba(159,208,255,0.45)', background: 'rgba(12,20,44,0.85)', opacity: ramp(f, CT.install + 14 + i * 10, CT.install + 28 + i * 10) }}>{s}</span>
							</React.Fragment>
						))}
					</div>
					<div style={{ fontFamily: TEXT, fontSize: 38, color: C.ink2, opacity: ramp(f, CT.install + 50, CT.install + 70) }}>Manifest URLs are in each repository’s README.</div>
					<div style={{ fontFamily: TEXT, fontSize: 38, color: C.ink2, opacity: ramp(f, CT.install + 60, CT.install + 80) }}>Foundry VTT v13 · Project FU 4.14 or later (Living Sprites works with any system)</div>
					<div style={{ marginTop: 30, fontFamily: DISP, fontWeight: 700, fontSize: 72, color: C.gold, opacity: ramp(f, CT.install + 80, CT.install + 100), letterSpacing: '0.04em' }}>
						<i className="fa-brands fa-github" style={{ marginRight: 24 }} />
						github.com/EclipseGS27
					</div>
				</div>
			) : null}
			<AbsoluteFill style={{ background: '#000', opacity: end }} />
		</AbsoluteFill>
	);
};
