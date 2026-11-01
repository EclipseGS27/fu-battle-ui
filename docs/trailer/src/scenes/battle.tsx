// The shared battle world: a backdrop, the module's pixel effects behind and in front of the fighters, the
// fighters posed by Living Sprites with the impact layer on top (flash, knockback, afterimages), damage
// numbers, all under one camera. Each battle supplies its own script.
import React from 'react';
import { ArtName, ArtSprite, boxOf, Glow, Scenery, targetFor } from '../art/art';
import { PixelLayer } from '../fx/PixelLayer';
import { Stage } from '../fx/pixel-runner.js';
import { Cam, camTransform, knock, pulse } from '../fx/impact';
import { Act, poseAt, Pose } from '../sprites/motion';
import { DamageNumber, Num } from '../ui/Numbers';
import { StatusLoop } from '../ui/StatusLoop';

export const S = 4; // screen pixels per art pixel of the effects

export type Fighter = {
	key: string;
	n: ArtName;
	x: number;
	y: number;
	k: number;
	flip?: boolean;
	/** which way it faces on screen: 1 right, -1 left (Living Sprites leans and lunges this way) */
	dir: number;
	idle: string;
	idleK?: number;
	phase?: number;
	acts: Act[];
	hits: number[];
	/** which way knockback pushes it, in screen pixels */
	kb?: number;
	shadowW?: number;
};

/** The fighter's box, centre in art pixels (for effect anchors) and as an effect target */
export function place(F: Fighter) {
	const b = boxOf(F.n, F.x, F.y, F.k, F.flip);
	return { ...b, art: { x: b.cx / S, y: b.cy / S }, target: targetFor(F.n, F.k, F.flip, S), over: { x: b.cx, y: b.head + 10 } };
}

export type Extra = {
	glow?: Glow | null;
	alpha?: number;
	/** override the pose (tints from conditions) */
	pose?: (p: Pose) => Pose;
	ghosts?: boolean;
	status?: string;
	idleOff?: boolean;
};

export const BattleWorld: React.FC<{
	kind: 'field' | 'aurora' | 'cave';
	cam: Cam;
	shake: { x: number; y: number };
	stage: Stage;
	sf: number;
	fighters: Fighter[];
	extra: (F: Fighter) => Extra;
	numbers: Num[];
	dim?: number;
	children?: React.ReactNode;
	under?: React.ReactNode;
}> = ({ kind, cam, shake, stage, sf, fighters, extra, numbers, dim = 0, children, under }) => {
	const t = sf / 60;
	return (
		<div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: camTransform(cam, 1920, 1080, shake) }}>
			<div style={{ position: 'absolute', left: -240, top: -135, width: 2400, height: 1350, overflow: 'hidden' }}>
				<div style={{ position: 'absolute', left: 240, top: 135, width: 1920, height: 1080, transform: 'scale(1.12)', transformOrigin: '50% 65%' }}>
					<Scenery kind={kind} />
				</div>
			</div>
			{under}
			<div style={{ position: 'absolute', inset: -400, background: '#03040a', opacity: dim }} />
			<PixelLayer stage={stage} step={sf} layer="back" scale={S} />
			{fighters
				.slice()
				.sort((a, b) => a.y - b.y)
				.map((F) => {
					const X = extra(F);
					let p = poseAt(t, X.idleOff ? 'none' : F.idle, F.idleK ?? 1, F.dir, F.acts, F.phase ?? 0);
					if (X.pose) p = X.pose(p);
					const lastHit = F.hits.filter((h) => sf >= h).pop();
					const flash = lastHit != null ? pulse(sf, lastHit, 10, 0.85) : 0;
					const kbx = F.hits.reduce((s, h) => s + knock(sf, h, F.kb ?? 0), 0);
					const b = boxOf(F.n, F.x, F.y, F.k, F.flip);
					const ghosts = X.ghosts
						? [6, 4, 2].map((d, i) => {
								const gp = poseAt((sf - d) / 60, F.idle, F.idleK ?? 1, F.dir, F.acts, F.phase ?? 0);
								return <ArtSprite key={`g${i}`} n={F.n} x={F.x} y={F.y} k={F.k} flip={F.flip} p={{ ...gp, tint: 0xbfe2ff, tintAmt: 0.75 }} alpha={0.16 + i * 0.12} shadow={false} />;
							})
						: null;
					return (
						<React.Fragment key={F.key}>
							{ghosts}
							<div style={{ position: 'absolute', left: kbx, top: 0 }}>
								<ArtSprite n={F.n} x={F.x} y={F.y} k={F.k} flip={F.flip} p={p} flash={flash} glow={X.glow ?? null} t={t} alpha={X.alpha ?? 1} shadowW={F.shadowW} />
							</div>
							{X.status ? <StatusLoop kind={X.status} x={b.cx + p.px + kbx} y={b.cy + p.py} hw={Math.min(b.w, b.h * 0.6) * 0.5} top={b.head - b.cy} bottom={b.top + b.h - b.cy} p={S} t={t} /> : null}
						</React.Fragment>
					);
				})}
			<PixelLayer stage={stage} step={sf} layer="front" scale={S} />
			{numbers.map((n, i) => (
				<DamageNumber key={i} n={n} f={sf} g={36 * S} />
			))}
			{children}
		</div>
	);
};
