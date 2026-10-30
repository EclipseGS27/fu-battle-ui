// A screenshot from a module's docs folder, framed as a Battle UI window: navy glass border, glow and a slow push.
import React from 'react';
import { Img, staticFile } from 'remotion';

export const SHOT_SIZE: Record<string, [number, number]> = {
	'sheet-crisis': [880, 1120],
	'npc-sheet': [860, 960],
	'point-menus': [900, 365],
	'battle-menu': [500, 740],
	opportunity: [900, 612],
	'turn-glow': [840, 507],
	effects: [1004, 510],
	conditions: [1120, 300],
	picker: [760, 660],
	'dice-3d': [1280, 720],
	'dice-pixel': [659, 581],
	'dice-smooth': [1043, 500],
	'dice-config': [920, 780],
};

/**
 * Shows the part `crop` ([x, y, w, h] in image pixels) of a screenshot at `width` on screen.
 * zoom pushes in around the crop's centre; pixelated keeps pixel art crisp.
 */
export const Shot: React.FC<{
	name: string;
	width: number;
	crop?: [number, number, number, number];
	zoom?: number;
	pan?: [number, number];
	pixelated?: boolean;
	frame?: boolean;
	radius?: number;
	glow?: string;
	style?: React.CSSProperties;
}> = ({ name, width, crop, zoom = 1, pan = [0, 0], pixelated, frame = true, radius = 10, glow = 'rgba(90,169,255,0.25)', style }) => {
	const [iw, ih] = SHOT_SIZE[name];
	const [cx, cy, cw, ch] = crop ?? [0, 0, iw, ih];
	const k = (width / cw) * zoom;
	const height = (width / cw) * ch;
	const ox = -(cx + cw / 2) * k + width / 2 + pan[0];
	const oy = -(cy + ch / 2) * k + height / 2 + pan[1];
	return (
		<div
			style={{
				position: 'relative',
				width,
				height,
				overflow: 'hidden',
				borderRadius: radius,
				border: frame ? '1px solid rgba(159, 208, 255, 0.45)' : undefined,
				boxShadow: frame ? `0 30px 80px rgba(0,0,0,0.65), 0 0 50px ${glow}` : undefined,
				background: '#0b1220',
				...style,
			}}
		>
			<Img src={staticFile(`shots/${name}.png`)} style={{ position: 'absolute', left: ox, top: oy, width: iw * k, height: ih * k, maxWidth: 'none', imageRendering: pixelated ? 'pixelated' : 'auto' }} />
		</div>
	);
};
