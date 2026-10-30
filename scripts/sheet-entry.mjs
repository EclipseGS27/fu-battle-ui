/**
 * Registers the Battle UI sheets (character, NPC, party). Kept apart from main.mjs so a sheet failure
 * never takes the battle UI down with it.
 *
 * Two routes, so the sheets show up even if one fails:
 * 1. init: Project FU's sheet classes are imported straight from the system files (Foundry v13 holds sheet
 *    registrations until init is over, so CONFIG can't be read yet). Dynamic imports, so a moved or
 *    unreachable file only logs a warning instead of killing this whole script.
 * 2. ready: anything init didn't register is registered from the classes in CONFIG.Actor.sheetClasses.
 * Failures are shown to the GM as a notification instead of only in the console.
 */
import { registerBattleSheet } from './sheet.mjs';
import { registerBattlePartySheet } from './party-sheet.mjs';
import { MODULE_ID } from './util.mjs';

const SOURCES = {
	actor: { path: '../../../systems/projectfu/module/sheets/actor-standard-sheet.mjs', name: 'FUStandardActorSheet', type: 'character', register: registerBattleSheet, label: 'character and NPC sheets' },
	party: { path: '../../../systems/projectfu/module/sheets/actor-party-sheet.mjs', name: 'FUPartySheet', type: 'party', register: registerBattlePartySheet, label: 'party sheet' },
};

const state = {};
for (const [key, src] of Object.entries(SOURCES)) {
	state[key] = { done: false, error: null, cls: null };
	state[key].loading = import(src.path)
		.then((m) => (state[key].cls = m?.[src.name] ?? null))
		.catch((err) => {
			console.warn(`${MODULE_ID} | could not import ${src.name} from ${src.path}, will look it up at ready`, err);
			return null;
		});
}

function tryRegister(key, Base, when) {
	const st = state[key];
	if (st.done || !Base) return st.done;
	try {
		const Sheet = SOURCES[key].register(Base);
		if (!Sheet) return false;
		st.done = true;
		const mod = game.modules.get(MODULE_ID);
		if (mod?.api) mod.api[key === 'actor' ? 'Sheet' : 'PartySheet'] = Sheet;
		console.log(`${MODULE_ID} | Battle UI ${SOURCES[key].label} registered (${when})`);
	} catch (err) {
		st.error = err;
		console.error(`${MODULE_ID} | could not register the Battle UI ${SOURCES[key].label} (${when})`, err);
	}
	return st.done;
}

/** The system's own sheet class for a type, as registered in CONFIG */
function fromConfig(key) {
	const { type, name } = SOURCES[key];
	const entries = Object.values(CONFIG.Actor?.sheetClasses?.[type] ?? {});
	const pick = entries.find((e) => e.id === `projectfu.${name}`) ?? entries.find((e) => e.id?.startsWith('projectfu.')) ?? entries.find((e) => e.default && !e.id?.startsWith(`${MODULE_ID}.`));
	return pick?.cls ?? null;
}

Hooks.once('init', () => {
	for (const key of Object.keys(SOURCES)) tryRegister(key, state[key].cls, 'init');
});

Hooks.once('ready', async () => {
	const failed = [];
	for (const key of Object.keys(SOURCES)) {
		if (state[key].done) continue;
		const Base = (await state[key].loading) ?? fromConfig(key);
		if (!tryRegister(key, Base, 'ready')) failed.push(key);
	}
	if (failed.length && game.user.isGM) {
		const why = failed.map((k) => `${SOURCES[k].label}: ${state[k].error?.message ?? 'Project FU sheet not found'}`).join('; ');
		ui.notifications.error(`Fabula Ultima Battle UI couldn't register its ${why}. See the console (F12) for details.`, { permanent: true });
	}
});
