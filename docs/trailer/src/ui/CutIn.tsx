// The full-screen cut-in for heroic moves (Fabula Ultima Battle Animations, styles/anim.css .fua-cutin),
// with its CSS keyframes (fua-band-in, fua-por, fua-txt, fua-streak, out) driven by the frame instead.
import React from 'react';
import { Easing } from 'remotion';
import { DISP } from '../theme';
import { clamp01 } from '../fx/impact';

export const CutIn: React.FC<{ f: number; len?: number; name: string; user: string; color?: string; portrait: React.ReactNode }> = ({ f, len = 75, name, user, color = '#f2c45a', portrait }) => {
	if (f < 0 || f > len) return null;
	const sec = f / 60;
	const outStart = len - 17;
	const out = clamp01((f - outStart) / 17);
	const veil = clamp01(sec / 0.2) * (1 - Easing.in(Easing.quad)(out));
	const bandIn = Easing.bezier(0.2, 0.9, 0.2, 1.1)(clamp01(sec / 0.26));
	const bandX = out > 0 ? 110 * Easing.in(Easing.quad)(out) : -110 * (1 - bandIn);
	const porK = Easing.bezier(0.1, 0.8, 0.2, 1)(clamp01(sec / 1.25));
	const txtK = Easing.bezier(0.2, 0.9, 0.2, 1)(clamp01((sec - 0.08) / 0.4));
	const streak = ((sec % 0.45) / 0.45) * -284;
	return (
		<div style={{ position: 'absolute', inset: 0, zIndex: 90, overflow: 'hidden', pointerEvents: 'none' }}>
			<div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.7))', opacity: veil }} />
			<div
				style={{
					position: 'absolute',
					left: '-12%',
					right: '-12%',
					top: '36%',
					height: '28vh',
					transform: `skewY(-5deg) translateX(${bandX}%)`,
					opacity: out > 0 ? 1 - 0.6 * out : 1,
					background: 'linear-gradient(90deg, rgba(4, 7, 16, 0.97), rgba(14, 22, 48, 0.94) 60%, rgba(4, 7, 16, 0.97))',
					borderTop: `3px solid ${color}`,
					borderBottom: `3px solid ${color}`,
					boxShadow: `0 0 40px rgba(0, 0, 0, 0.6), 0 0 22px ${color}73`,
					overflow: 'hidden',
				}}
			>
				<div
					style={{
						position: 'absolute',
						inset: 0,
						backgroundImage: `repeating-linear-gradient(90deg, transparent 0 60px, rgba(255, 255, 255, 0.05) 60px 64px, transparent 64px 140px, ${color}2e 140px 142px)`,
						backgroundPosition: `${streak}px 0`,
					}}
				/>
				<div
					style={{
						position: 'absolute',
						left: '14%',
						top: '-30%',
						height: '170%',
						transform: `skewY(5deg) translateX(${-40 + 46 * porK}%)`,
						opacity: clamp01(porK / 0.3),
						WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 18%, #000 70%, transparent)',
						maskImage: 'linear-gradient(90deg, transparent, #000 18%, #000 70%, transparent)',
						filter: 'drop-shadow(0 0 12px rgba(0, 0, 0, 0.8))',
					}}
				>
					{portrait}
				</div>
				<div style={{ position: 'absolute', right: '16%', top: '50%', transform: `translateY(-50%) skewY(5deg) translateX(${60 * (1 - txtK)}%)`, opacity: txtK, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
					<small style={{ fontFamily: DISP, fontSize: '2.4vh', letterSpacing: '0.4em', color, textTransform: 'uppercase' }}>{user}</small>
					<b style={{ fontFamily: DISP, fontWeight: 700, fontSize: '11vh', lineHeight: 0.95, letterSpacing: '0.04em', color: '#fff', fontStyle: 'italic', textTransform: 'uppercase', textShadow: `0 0 18px ${color}b3, 4px 4px 0 rgba(0, 0, 0, 0.6)` }}>{name}</b>
				</div>
			</div>
		</div>
	);
};
