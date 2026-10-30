import { bundledAssets, MODULE_ID, setting } from './util.mjs';

/**
 * Sound cues. Each one is <folder>/<name>.ogg, so a different pack can be swapped in by
 * pointing the "Sound folder" setting at a folder with the same file names.
 * gain balances the cues against each other; menu cues are the ones that fire on hover/click.
 */
export const CUES = {
	cursor: { gain: 0.45, menu: true }, // moving across menu rows
	confirm: { gain: 0.8, menu: true }, // choosing a command, item, hero
	back: { gain: 0.7, menu: true }, // back, close, deny
	error: { gain: 0.8 }, // can't do that; charged-attack warning
	activate: { gain: 0.75 }, // end turn
	turn: { gain: 0.8 }, // your side's turn begins
	chime: { gain: 0.7 }, // clock changes, Fabula/Ultima spent
	fanfare: { gain: 0.8 }, // conflict starts, new round
};

const PACKS = { ff13: 'FFXIII menu sounds', ff7: 'FFVII menu sounds', custom: 'Custom folder', off: 'Off' };
const packFolder = (pack) => `modules/${MODULE_ID}/sounds/${pack}`;
const DEFAULT_FOLDER = packFolder('ff13');
let lastAt = {};

/**
 * @param {string} cue
 * @param {{sheet?: boolean}} [opts] sheet: the sound comes from the character sheet
 */
export function sfx(cue, { sheet = false } = {}) {
	const def = CUES[cue];
	if (!def) return;
	const pack = setting('sfxPack') || (bundledAssets() ? 'ff13' : 'off');
	if (pack === 'off') return;
	if (pack !== 'custom' && !bundledAssets()) return;
	if (sheet && setting('sfxSheet') === false) return;
	if (def.menu && setting('sfxMenu') === false) return;
	const now = performance.now();
	if (now - (lastAt[cue] ?? 0) < (cue === 'cursor' ? 45 : 90)) return;
	lastAt[cue] = now;
	const folder = (pack === 'custom' ? String(setting('sfxPath') || DEFAULT_FOLDER) : packFolder(PACKS[pack] ? pack : 'ff13')).replace(/\/+$/, '');
	const src = `${folder}/${cue}.ogg`;
	const v = Number(setting('sfxVolume'));
	const volume = Math.max(0, Math.min(1, (Number.isFinite(v) ? v : 0.6) * def.gain));
	if (volume <= 0) return;
	try {
		const AH = foundry?.audio?.AudioHelper;
		if (AH?.play) {
			// interface channel: follows the player's Interface volume slider
			AH.play({ src, volume, autoplay: true, loop: false, channel: 'interface' }, false);
			return;
		}
	} catch (err) {
		console.warn(`${MODULE_ID} | sfx`, err);
	}
	try {
		const a = new Audio(src);
		a.volume = volume;
		a.play().catch(() => {});
	} catch {
		/* no audio */
	}
}

export function registerSfxSettings(reg) {
	reg('sfxPack', { name: 'Sound effects', hint: 'Which sounds the battle UI and the Battle UI sheet use for you, or Off for none. Plays on the Interface volume channel.', scope: 'client', type: String, choices: bundledAssets() ? PACKS : { custom: PACKS.custom, off: PACKS.off }, default: bundledAssets() ? 'ff13' : 'off', onChange: () => sfx('confirm') });
	reg('sfxVolume', { name: 'Sound effects volume', scope: 'client', type: Number, range: { min: 0, max: 1, step: 0.05 }, default: 0.6, onChange: () => sfx('confirm') });
	reg('sfxMenu', { name: 'Menu sounds', hint: 'Cursor, confirm and back sounds while moving through menus. Battle cues (turns, rounds, banners, clocks) still play when this is off.', scope: 'client', type: Boolean, default: true });
	reg('sfxSheet', { name: 'Sounds on the character sheet', hint: 'Cursor and confirm sounds on the Battle UI sheet, using the sound pack above.', scope: 'client', type: Boolean, default: true });
	reg('sfxPath', { name: 'Custom sound folder', hint: 'Used when Sound effects is “Custom folder”: a folder with cursor, confirm, back, error, activate, turn, chime and fanfare .ogg files.', scope: 'world', type: String, default: DEFAULT_FOLDER, filePicker: 'folder' });
}
