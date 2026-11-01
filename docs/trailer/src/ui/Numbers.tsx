// Damage numbers as Fabula Ultima Battle Animations draws them (scripts/impact.mjs damageNumber): Antonio 700,
// a dark stroke, slammed in with an overshoot, floating up and fading. Gold and larger after a critical,
// orange for VULNERABLE, grey-blue for RESISTED, green for healing.
import React from 'react';
import { DISP } from '../theme';

const LOOK: Record<string, { color: string; size: number }> = {
	miss: { color: '#bcd0ff', size: 0.36 },
	immune: { color: '#c9cfdd', size: 0.36 },
	weak: { color: '#ffa25e', size: 0.52 },
	resist: { color: '#b7c3db', size: 0.44 },
};

export type Num = { at: number; x: number; y: number; text: string; crit?: boolean; heal?: boolean; sub?: string; kind?: 'miss' | 'immune' | 'weak' | 'resist' | ''; side?: number };

const back = (t: number) => {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** g: one grid square in screen pixels (the module sizes numbers by the grid) */
export const DamageNumber: React.FC<{ n: Num; f: number; g: number }> = ({ n, f, g }) => {
	const t = (f - n.at) / 69; // 1150 ms
	if (t < 0 || t > 1) return null;
	const look = n.kind ? LOOK[n.kind] : null;
	const color = n.heal ? '#7dffb0' : n.crit ? '#ffd34d' : (look?.color ?? '#ffffff');
	const size = g * (n.crit ? 0.62 : (look?.size ?? 0.48));
	const pop = t < 0.12 ? back(t / 0.12) * (n.crit ? 1.5 : 1.25) : t < 0.22 ? 1.25 - (t - 0.12) * 2 : 1;
	const rise = g * 0.35 + g * 0.55 * (1 - Math.pow(1 - t, 3));
	const alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
	const sub = n.sub || (n.crit ? 'CRITICAL' : '');
	const stroke = `${Math.max(2, g * 0.035)}px #10060a`;
	return (
		<div style={{ position: 'absolute', left: n.x + (n.side ?? 0) * g * t, top: n.y - rise, transform: `translate(-50%, -50%) scale(${Math.max(0.01, pop)})`, opacity: alpha, textAlign: 'center', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 50 }}>
			{sub ? (
				<div style={{ fontFamily: DISP, fontWeight: 700, fontSize: g * 0.2, letterSpacing: g * 0.02, color: n.crit ? '#ffb347' : '#d9e6ff', WebkitTextStroke: `${Math.max(1.5, g * 0.02)}px #10060a`, paintOrder: 'stroke fill', marginBottom: -g * 0.04 }}>{sub}</div>
			) : null}
			<div style={{ fontFamily: DISP, fontWeight: 700, fontSize: size, lineHeight: 1, color, WebkitTextStroke: stroke, paintOrder: 'stroke fill', textShadow: `0 0 ${g * 0.08}px ${n.crit ? '#ff6a00' : '#000'}` }}>{n.text}</div>
		</div>
	);
};
