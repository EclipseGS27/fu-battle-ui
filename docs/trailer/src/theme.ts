import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

// The Battle UI's palette (styles/battle.css) and fonts (Antonio for display, PT Sans for text).
export const C = {
	ink: '#eef3ff',
	ink2: 'rgba(238, 243, 255, 0.72)',
	ink3: 'rgba(238, 243, 255, 0.55)',
	glass: 'rgba(12, 20, 44, 0.9)',
	navy: '#0b1220',
	deep: '#070b14',
	line: 'rgba(159, 208, 255, 0.35)',
	gold: '#f2c45a',
	goldHi: '#ffe19a',
	hero: '#5aa9ff',
	sky: '#9fd0ff',
	foe: '#ff6b7a',
	foe2: '#ff8d99',
	crisis: '#ff9a6b',
	heal: '#6fe3a0',
	boss: '#b072ff',
};

export const DISP = "'FBUI Antonio', 'Antonio', 'Arial Narrow', sans-serif";
export const TEXT = "'FBUI PT Sans', 'PT Sans', system-ui, sans-serif";

const fonts: [string, string, string][] = [
	['FBUI Antonio', 'antonio-latin-400-normal.woff2', '400'],
	['FBUI Antonio', 'antonio-latin-700-normal.woff2', '700'],
	['FUD Antonio', 'antonio-latin-700-normal.woff2', '700'],
	['FBUI PT Sans', 'pt-sans-latin-400-normal.woff2', '400'],
	['FBUI PT Sans', 'pt-sans-latin-700-normal.woff2', '700'],
];
export const fontsReady = Promise.all(fonts.map(([family, file, weight]) => loadFont({ family, url: staticFile(`fonts/${file}`), weight })));

export const FPS = 60;
export const BEAT = 30; // 120 BPM
export const BAR = 120;
