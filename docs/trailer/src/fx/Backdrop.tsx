import React, { useLayoutEffect, useRef } from 'react';
import { backdrop } from '../vendor/fu-animations/scripts/pfx/core/scene.js';

/**
 * The battlefield: the pixelfx preview backdrops from Fabula Ultima Battle Animations (scripts/pfx/core/scene.js),
 * the starry night "sky" above the stone "ground" floor, at art resolution.
 */
export const Backdrop: React.FC<{ w: number; h: number; ground: number; scale: number }> = ({ w, h, ground, scale }) => {
	const ref = useRef<HTMLCanvasElement>(null);
	useLayoutEffect(() => {
		const sky: Uint32Array = backdrop('sky', w, ground + 4);
		const floor: Uint32Array = backdrop('ground', w, h, ground);
		const out = new Uint32Array(w * h);
		out.set(sky.subarray(0, w * ground));
		out.set(floor.subarray(w * ground), w * ground);
		ref.current?.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(out.buffer), w, h), 0, 0);
	}, [w, h, ground]);
	return <canvas ref={ref} className="px" width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, width: w * scale, height: h * scale }} />;
};
