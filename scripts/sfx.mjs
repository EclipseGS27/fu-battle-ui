import { MODULE_ID, esc, setting } from './util.mjs';

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
	const pack = setting('sfxPack') || 'ff13';
	if (pack === 'off') return;
	if (sheet && setting('sfxSheet') === false) return;
	if (def.menu && setting('sfxMenu') === false) return;
	const now = performance.now();
	if (now - (lastAt[cue] ?? 0) < (cue === 'cursor' ? 45 : 90)) return;
	lastAt[cue] = now;
	const src = sourceFor(cue, pack);
	if (!src) return;
	play(src, def.gain);
}

/** Which file a cue plays: the player's choice in the sound editor, else the pack's own file */
function sourceFor(cue, pack = setting('sfxPack') || 'ff13', useMap = true) {
	const pick = useMap ? (setting('sfxMap') ?? {})[cue] : '';
	if (pick === 'none') return null;
	if (pick) return pick;
	const folder = (pack === 'custom' ? String(setting('sfxPath') || DEFAULT_FOLDER) : packFolder(PACKS[pack] ? pack : 'ff13')).replace(/\/+$/, '');
	return `${folder}/${cue}.ogg`;
}

function play(src, gain = 0.7) {
	const v = Number(setting('sfxVolume'));
	const volume = Math.max(0, Math.min(1, (Number.isFinite(v) ? v : 0.6) * gain));
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

const CUE_INFO = {
	cursor: ['Cursor', 'Moving across menu rows, picks and the roster'],
	confirm: ['Confirm', 'Choosing a command, item, hero or target'],
	back: ['Back', 'Back, close, deny'],
	error: ['Error', 'Not enough IP/FP, unavailable option, charged-attack warning'],
	activate: ['Activate', 'End turn'],
	turn: ['Turn', 'Your side’s turn starts'],
	chime: ['Chime', 'Clock changes, Fabula/Ultima spent, Opportunities'],
	fanfare: ['Fanfare', 'Conflict starts, new round'],
};
const PACK_FILES = ['ff13', 'ff7'];

/** Sound editor: pick any bundled sound, a file of your own, or silence for each cue */
export class SfxEditor extends foundry.applications.api.ApplicationV2 {
	static DEFAULT_OPTIONS = {
		id: 'fbui-sfx-editor',
		tag: 'form',
		classes: ['fbui-armory', 'fbui-sfxcfg'],
		window: { title: 'Sound effects', icon: 'fa-solid fa-volume-high', resizable: true },
		position: { width: 640, height: 'auto' },
		form: { handler: SfxEditor.#onSubmit, closeOnSubmit: true },
		actions: { play: SfxEditor.#onPlay, browse: SfxEditor.#onBrowse, reset: SfxEditor.#onReset },
	};

	#draft = null;

	async _renderHTML() {
		const map = this.#draft ?? { ...(setting('sfxMap') ?? {}) };
		const packName = PACKS[setting('sfxPack')] ?? PACKS.ff13;
		const rows = Object.entries(CUE_INFO)
			.map(([cue, [label, when]]) => {
				const cur = map[cue] ?? '';
				const bundled = PACK_FILES.flatMap((p) => Object.keys(CUE_INFO).map((c) => [packFolder(p) + `/${c}.ogg`, `${PACKS[p].replace(' menu sounds', '')}: ${CUE_INFO[c][0]}`]));
				const isCustom = cur && cur !== 'none' && !bundled.some(([v]) => v === cur);
				const opt = (v, l) => `<option value="${esc(v)}" ${v === (isCustom ? '__custom' : cur) ? 'selected' : ''}>${esc(l)}</option>`;
				const groups = PACK_FILES.map((p) => `<optgroup label="${esc(PACKS[p])}">${bundled.filter(([v]) => v.includes(`/sounds/${p}/`)).map(([v, l]) => opt(v, l)).join('')}</optgroup>`).join('');
				return `<tr data-cue="${cue}">
					<th><b>${esc(label)}</b><small>${esc(when)}</small></th>
					<td><select name="pick.${cue}">${opt('', `Default (${packName})`)}${opt('none', 'Silent')}${groups}${opt('__custom', 'My own file…')}</select>
						<div class="own ${isCustom ? '' : 'hidden'}"><input type="text" name="file.${cue}" value="${isCustom ? esc(cur) : ''}" placeholder="path/to/sound.ogg"><button type="button" class="btn sm" data-action="browse" data-tooltip="Browse"><i class="fa-solid fa-folder-open"></i></button></div></td>
					<td><button type="button" class="btn sm" data-action="play" data-tooltip="Play"><i class="fa-solid fa-play"></i></button></td>
				</tr>`;
			})
			.join('');
		const div = document.createElement('div');
		div.className = 'fbui-armory-body sfx';
		div.innerHTML = `
			<p>Choose what each cue plays for you. Default follows your Sound effects pack (${esc(packName)}). Mix sounds from either pack, use your own file, or silence a cue.</p>
			<table class="gt"><tbody>${rows}</tbody></table>
			<div class="foot"><button type="button" class="btn" data-action="reset">All default</button><span class="sp"></span><button type="submit" class="btn gold">Save</button></div>`;
		div.querySelectorAll('select').forEach((sel) => sel.addEventListener('change', () => sel.parentElement.querySelector('.own').classList.toggle('hidden', sel.value !== '__custom')));
		return div;
	}

	_replaceHTML(result, content) {
		content.replaceChildren(result);
	}

	/** {cue: src | 'none'} from the form, leaving out defaults */
	static #collect(root) {
		const out = {};
		for (const cue of Object.keys(CUE_INFO)) {
			const pick = root.querySelector(`[name="pick.${cue}"]`)?.value ?? '';
			const file = root.querySelector(`[name="file.${cue}"]`)?.value?.trim() ?? '';
			const v = pick === '__custom' ? file : pick;
			if (v) out[cue] = v;
		}
		return out;
	}

	static async #onSubmit(event, form) {
		await game.settings.set(MODULE_ID, 'sfxMap', SfxEditor.#collect(form));
	}

	static #onPlay(event, target) {
		const tr = target.closest('tr');
		const cue = tr.dataset.cue;
		const v = SfxEditor.#collect(this.element)[cue];
		if (v === 'none') return;
		const pack = setting('sfxPack') || 'ff13';
		const src = v || sourceFor(cue, pack === 'off' ? 'ff13' : pack, false);
		play(src, CUES[cue]?.gain ?? 0.7);
	}

	static #onBrowse(event, target) {
		const input = target.parentElement.querySelector('input');
		const FP = foundry.applications.apps.FilePicker.implementation ?? foundry.applications.apps.FilePicker;
		new FP({ type: 'audio', current: input.value, callback: (path) => (input.value = path) }).browse();
	}

	static #onReset() {
		this.#draft = {};
		this.render();
	}
}

export function registerSfxSettings(reg) {
	game.settings.register(MODULE_ID, 'sfxMap', { scope: 'client', config: false, type: Object, default: {} });
	game.settings.registerMenu(MODULE_ID, 'sfxEditor', { name: 'Sound effect editor', label: 'Customize sounds', hint: 'Pick which sound plays for each part of the menus: any FFXIII or FFVII sound, your own file, or silence.', icon: 'fa-solid fa-volume-high', type: SfxEditor, restricted: false });
	reg('sfxPack', { name: 'Sound effects', hint: 'Which sounds the battle UI and the Battle UI sheet use for you, or Off for none. Plays on the Interface volume channel.', scope: 'client', type: String, choices: PACKS, default: 'ff13', onChange: () => sfx('confirm') });
	reg('sfxVolume', { name: 'Sound effects volume', scope: 'client', type: Number, range: { min: 0, max: 1, step: 0.05 }, default: 0.6, onChange: () => sfx('confirm') });
	reg('sfxMenu', { name: 'Menu sounds', hint: 'Cursor, confirm and back sounds while moving through menus. Battle cues (turns, rounds, banners, clocks) still play when this is off.', scope: 'client', type: Boolean, default: true });
	reg('sfxSheet', { name: 'Sounds on the character sheet', hint: 'Cursor and confirm sounds on the Battle UI sheet, using the sound pack above.', scope: 'client', type: Boolean, default: true });
	reg('sfxPath', { name: 'Custom sound folder', hint: 'Used when Sound effects is “Custom folder”: a folder with cursor, confirm, back, error, activate, turn, chime and fanfare .ogg files.', scope: 'world', type: String, default: DEFAULT_FOLDER, filePicker: 'folder' });
}
