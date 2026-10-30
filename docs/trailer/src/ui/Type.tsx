// Trailer typography in the Battle UI's language: Antonio for display, PT Sans for text, gold diamonds on navy glass.
import React from 'react';
import { Easing, interpolate } from 'remotion';
import { C, DISP, TEXT } from '../theme';
import { clamp01 } from '../fx/impact';

const out = Easing.bezier(0.16, 1, 0.3, 1);

/** 0 → 1 → 0 envelope: in over `inLen` from `a`, out over `outLen` ending at `b` */
export const env = (f: number, a: number, b: number, inLen = 14, outLen = 12) => {
	if (f < a || f > b) return 0;
	const i = out(clamp01((f - a) / inLen));
	const o = 1 - Easing.in(Easing.cubic)(clamp01((f - (b - outLen)) / outLen));
	return Math.min(i, o);
};

export const GOLD_TEXT: React.CSSProperties = {
	backgroundImage: 'linear-gradient(180deg, #fff6dc 0%, #ffe19a 38%, #f2c45a 62%, #b8862a 100%)',
	WebkitBackgroundClip: 'text',
	backgroundClip: 'text',
	color: 'transparent',
};

/** Letters that rise out of a blur one after another */
export const Letters: React.FC<{ text: string; f: number; start?: number; stagger?: number; len?: number; exit?: number; style?: React.CSSProperties; gold?: boolean }> = ({ text, f, start = 0, stagger = 2, len = 18, exit, style, gold }) => (
	<span style={{ display: 'inline-flex', whiteSpace: 'pre', ...style }}>
		{[...text].map((ch, i) => {
			const k = out(clamp01((f - start - i * stagger) / len));
			const x = exit != null ? Easing.in(Easing.cubic)(clamp01((f - exit - i * stagger * 0.5) / 12)) : 0;
			return (
				<span
					key={i}
					style={{
						display: 'inline-block',
						opacity: k * (1 - x),
						transform: `translateY(${(1 - k) * 0.45 + x * -0.25}em) scale(${0.92 + 0.08 * k})`,
						filter: `blur(${(1 - k) * 10 + x * 8}px)`,
						...(gold ? GOLD_TEXT : {}),
					}}
				>
					{ch}
				</span>
			);
		})}
	</span>
);

export const Kicker: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({ children, color = C.gold, size = 30, style }) => (
	<div style={{ fontFamily: DISP, fontSize: size, letterSpacing: '0.32em', color, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: size * 0.55, ...style }}>
		<span style={{ width: size * 0.42, height: size * 0.42, transform: 'rotate(45deg)', background: color, boxShadow: `0 0 ${size * 0.5}px ${color}`, flex: 'none' }} />
		{children}
	</div>
);

/**
 * A feature callout: kicker above a headline, fading and sliding in and out.
 * Placed by the caller; `align` sets which edge the text hangs from.
 */
export const Caption: React.FC<{ f: number; a: number; b: number; kicker: string; title: string; sub?: string; size?: number; align?: 'left' | 'center' | 'right'; style?: React.CSSProperties }> = ({ f, a, b, kicker, title, sub, size = 92, align = 'center', style }) => {
	const k = env(f, a, b, 16, 14);
	if (k <= 0) return null;
	const items = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
	return (
		<div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: items, textAlign: align, gap: 6, opacity: k, padding: '18px 60px 24px', background: 'radial-gradient(closest-side, rgba(3,6,14,0.62), rgba(3,6,14,0.35) 60%, transparent)', ...style }}>
			<div style={{ transform: `translateY(${(1 - k) * 16}px)` }}>
				<Kicker size={Math.max(24, size * 0.3)}>{kicker}</Kicker>
			</div>
			<div style={{ fontFamily: DISP, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: '0.02em', color: '#fff', textTransform: 'uppercase', textShadow: '0 4px 0 rgba(0,0,0,0.55), 0 0 30px rgba(5,8,20,0.9), 0 0 60px rgba(5,8,20,0.7)' }}>
				<Letters text={title} f={f} start={a + 2} stagger={1.2} len={16} />
			</div>
			{sub ? (
				<div style={{ fontFamily: TEXT, fontSize: Math.max(40, size * 0.42), color: C.ink, opacity: interpolate(k, [0.5, 1], [0, 1], { extrapolateLeft: 'clamp' }), textShadow: '0 2px 12px rgba(0,0,0,0.9)', marginTop: 6 }}>{sub}</div>
			) : null}
		</div>
	);
};

/** The trailer's mark: nested diamonds after the Battle UI's round and level diamonds, with a gleam */
export const Emblem: React.FC<{ size: number; f: number; gleamAt?: number }> = ({ size, f, gleamAt = 0 }) => {
	const g = clamp01((f - gleamAt) / 40);
	return (
		<div style={{ position: 'relative', width: size, height: size }}>
			<div style={{ position: 'absolute', inset: '14%', transform: 'rotate(45deg)', border: `${size * 0.035}px solid ${C.gold}`, boxShadow: `0 0 ${size * 0.25}px rgba(242,196,90,0.55), inset 0 0 ${size * 0.15}px rgba(242,196,90,0.35)`, background: 'rgba(12,20,44,0.92)', overflow: 'hidden' }}>
				<div style={{ position: 'absolute', inset: 0, background: `linear-gradient(115deg, transparent ${-30 + g * 160}%, rgba(255,246,220,0.75) ${-20 + g * 160}%, transparent ${-10 + g * 160}%)` }} />
			</div>
			<div style={{ position: 'absolute', inset: '33%', transform: 'rotate(45deg)', background: 'linear-gradient(135deg, #fff6dc, #f2c45a 55%, #b8862a)', boxShadow: `0 0 ${size * 0.2}px rgba(242,196,90,0.8)` }} />
			<div style={{ position: 'absolute', inset: '44%', transform: 'rotate(45deg)', background: C.navy }} />
		</div>
	);
};

/** FABULA ULTIMA / Foundry VTT modules, built up from `start` */
export const TitleLockup: React.FC<{ f: number; start?: number; scale?: number; sub?: string }> = ({ f, start = 0, scale = 1, sub = 'Foundry VTT modules' }) => {
	const e = out(clamp01((f - start) / 26));
	const line = out(clamp01((f - start - 16) / 30));
	const s = (v: number) => v * scale;
	return (
		<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
			<div style={{ transform: `scale(${0.6 + 0.4 * e}) rotate(${(1 - e) * -90}deg)`, opacity: e, marginBottom: s(8) }}>
				<Emblem size={s(150)} f={f} gleamAt={start + 30} />
			</div>
			<div style={{ fontFamily: DISP, fontWeight: 700, fontSize: s(196), lineHeight: 0.95, letterSpacing: '0.07em', filter: 'drop-shadow(0 6px 0 rgba(60,36,6,0.85)) drop-shadow(0 0 40px rgba(242,196,90,0.35))' }}>
				<Letters text="FABULA ULTIMA" f={f} start={start + 4} stagger={2} len={20} gold />
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: s(28), marginTop: s(18) }}>
				<span style={{ width: s(220) * line, height: 2, background: `linear-gradient(90deg, transparent, ${C.gold})` }} />
				<span style={{ fontFamily: DISP, fontSize: s(46), letterSpacing: '0.42em', color: C.ink, opacity: line, textTransform: 'uppercase', marginRight: '-0.42em' }}>{sub}</span>
				<span style={{ width: s(220) * line, height: 2, background: `linear-gradient(270deg, transparent, ${C.gold})` }} />
			</div>
		</div>
	);
};

/** Big number with a label, for counters */
export const Stat: React.FC<{ value: number; label: string; f: number; start: number; dur?: number }> = ({ value, label, f, start, dur = 40 }) => {
	const k = out(clamp01((f - start) / dur));
	const appear = out(clamp01((f - start) / 14));
	return (
		<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: appear, transform: `translateY(${(1 - appear) * 30}px)` }}>
			<div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 170, lineHeight: 1, ...GOLD_TEXT, filter: 'drop-shadow(0 5px 0 rgba(60,36,6,0.85))' }}>{Math.round(value * k)}</div>
			<div style={{ fontFamily: DISP, fontSize: 40, letterSpacing: '0.3em', color: C.ink, textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
		</div>
	);
};
