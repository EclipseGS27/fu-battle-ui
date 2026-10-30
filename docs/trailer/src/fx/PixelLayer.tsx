import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { Stage, glowPixels } from './pixel-runner.js';

export type Cue = {
	id: string;
	at: number; // frame it starts on (60 fps, one effect step per frame)
	x: number;
	y: number;
	from?: { x: number; y: number };
	aim?: { x: number; y: number };
	element?: string;
	seed?: number;
	target?: object;
	source?: object;
	alpha?: number;
};

/** A stage of pixel effects in art pixels; one per scene, shared by its back and front layers */
export function useStage(w: number, h: number, cues: Cue[]): Stage {
	// eslint-disable-next-line react-hooks/exhaustive-deps
	return useMemo(() => new Stage(w, h, cues), []);
}

/**
 * One layer of a stage (behind the sprites, or in front of them): its glow added on top of what is
 * below, then its solid pixels, both scaled up without smoothing, like the module's editor preview.
 */
export const PixelLayer: React.FC<{ stage: Stage; step: number; layer: 'back' | 'front'; scale: number }> = ({ stage, step, layer, scale }) => {
	const color = useRef<HTMLCanvasElement>(null);
	const light = useRef<HTMLCanvasElement>(null);
	const glow = useMemo(() => new Uint8ClampedArray(stage.w * stage.h * 4), [stage]);
	useLayoutEffect(() => {
		stage.ensure(Math.max(0, Math.floor(step)));
		const f = layer === 'back' ? stage.back : stage.front;
		light.current?.getContext('2d')?.putImageData(new ImageData(glowPixels(f.light, glow), f.w, f.h), 0, 0);
		color.current?.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(f.color.buffer), f.w, f.h), 0, 0);
	}, [stage, step, layer, glow]);
	const style: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: stage.w * scale, height: stage.h * scale };
	return (
		<>
			<canvas ref={light} className="px" width={stage.w} height={stage.h} style={{ ...style, mixBlendMode: 'plus-lighter' }} />
			<canvas ref={color} className="px" width={stage.w} height={stage.h} style={style} />
		</>
	);
};
