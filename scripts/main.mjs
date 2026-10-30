import { AFFINITY_TYPES, AFF_WORD, MODULE_ID, SOCKET, bundledAssets, cap, setting } from './util.mjs';
import { Clocks } from './clocks.mjs';
import { BattleUI } from './hud.mjs';
import { loadBasicConsumables } from './points.mjs';
import { registerSfxSettings, sfx } from './sfx.mjs';
import { FRIENDLY, actorKey, combatantsOf } from './model.mjs';
import { ARMORY_TYPES, applyToWorld, isArmoryIcon, onPreCreateItem, onPreUpdateItem, resetIcon, suggestIcon } from './armory.mjs';
import { ArmoryApplyMenu, ArmoryPicker } from './armory-picker.mjs';
import { sheetData } from './sheet.mjs';
import { registerCheckDialog } from './check-dialog.mjs';
import { registerBrowserStyle } from './browser-style.mjs';
import { GLOW_DEFAULTS, TurnGlow, TurnGlowConfig } from './glow.mjs';
import { registerOpportunityMenu } from './opportunity.mjs';

const ui2 = new BattleUI();

const api = {
	ui: ui2,
	Clocks,
	open: () => ui2.open(),
	close: () => ui2.close(),
	toggle: () => ui2.toggle(),
	broadcastBanner(data) {
		game.socket.emit(SOCKET, { type: 'banner', data });
		ui2.banner(data);
	},
	armory: { suggest: suggestIcon, pick: (item) => ArmoryPicker.open(item), reset: resetIcon, applyToWorld },
	sheetData,
	broadcastFloat(data) {
		game.socket.emit(SOCKET, { type: 'float', data });
		handleFloat(data);
	},
};

function handleFloat(data) {
	if (data.typed) ui2.noteTypedFloat(data.actorUuid);
	ui2.float(data);
	if (data.reveal && game.users.activeGM?.isSelf && setting('autoRevealAffinities')) revealAffinity(data.reveal);
}

async function revealAffinity({ key, type }) {
	const combat = game.combat;
	if (!combat || !key || !type) return;
	if (combat.getFlag(MODULE_ID, `reveal.${key}.aff.${type}`)) return;
	await combat.setFlag(MODULE_ID, `reveal.${key}.aff.${type}`, true);
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

function registerSettings() {
	const reg = (key, data) => game.settings.register(MODULE_ID, key, { config: true, ...data });
	const rerender = () => ui2.scheduleRender();

	reg('replaceSystemHud', { name: 'Replace the Project FU combat HUD', hint: 'Hides the system’s experimental combat HUD and turns its per-user toggle off. Reload after changing.', scope: 'world', type: Boolean, default: true, requiresReload: true });
	reg('hideUnstudied', { name: 'Hide unstudied enemy stats from players', hint: 'Players see enemy level, HP numbers, Traits and Affinities only as far as the party has Studied them (read from the active Party), or as the GM reveals them in the target panel.', scope: 'world', type: Boolean, default: true, onChange: rerender });
	reg('autoRevealAffinities', { name: 'Reveal an Affinity when it is hit', hint: 'When damage of a type lands on an enemy, players learn that Affinity.', scope: 'world', type: Boolean, default: true });
	reg('playersFillClocks', { name: 'Players change clocks directly', hint: 'Off: a player’s Objective result is sent to the GM to approve. On: it applies at once.', scope: 'world', type: Boolean, default: false });
	reg('tickClocksEachRound', { name: 'Tick round clocks automatically', hint: 'Clocks marked “+1 each round” fill one section when a round ends.', scope: 'world', type: Boolean, default: true });
	reg('surrenderPrompt', { name: 'Surrender or Sacrifice prompt', hint: 'When a Player Character drops to 0 HP, ask their player to Surrender (gain 2 Fabula Points) or Sacrifice.', scope: 'world', type: Boolean, default: true, onChange: rerender });

	reg('sheetDefault', { name: 'Battle UI sheet for new characters', hint: 'Make the Battle UI sheet the default for Player Characters. Each character can still switch sheets from its Sheet button. Reload after changing.', scope: 'world', type: Boolean, default: false, requiresReload: true });
	reg('npcSheetDefault', { name: 'Battle UI sheet for NPCs', hint: 'Make the Battle UI NPC sheet the default for NPCs. Each NPC can still switch from its Sheet button. Reload after changing.', scope: 'world', type: Boolean, default: false, requiresReload: true });
	reg('partySheetDefault', { name: 'Battle UI party sheet', hint: 'Make the Battle UI party sheet the default for parties. Reload after changing.', scope: 'world', type: Boolean, default: false, requiresReload: true });
	const resheet = () => {
		for (const app of foundry.applications.instances?.values?.() ?? []) if (app.element?.classList?.contains('fbui-sheet') && app.rendered) app.render();
	};
	reg('sheetShowInit', { name: 'Sheet: show Initiative', hint: 'Show the INIT tile in the Battle UI sheet header. The Gear tab always lists it.', scope: 'client', type: Boolean, default: false, onChange: resheet });
	reg('sheetShowCrisis', { name: 'Sheet: show Crisis threshold', hint: 'Show the CRISIS tile in the Battle UI sheet header. The HP bar always marks it.', scope: 'client', type: Boolean, default: false, onChange: resheet });
	reg('sheetCrisisTint', { name: 'Sheet: turn red in Crisis', hint: 'The Battle UI sheet changes from blue to red while its character is in Crisis.', scope: 'client', type: Boolean, default: true, onChange: resheet });
	reg('armoryAuto', { name: 'Armory icons for weapons and armor', hint: 'Give new weapons, shields, armor and accessories a pixel icon from the Premium Armory pack, picked by category, damage type, price and name. Only replaces default or system art.', scope: 'world', type: Boolean, default: bundledAssets() });
	reg('armoryPath', { name: 'Armory icon folder', hint: 'Where the icons live. Change this if you move them out of the module, for example to share the module without the paid pack.', scope: 'world', type: String, default: `modules/${MODULE_ID}/icons/armory` });
	game.settings.registerMenu(MODULE_ID, 'armoryApply', { name: 'Armory icons for existing items', label: 'Apply armory icons', hint: 'Give icons to the weapons and armor already in this world.', icon: 'fa-solid fa-shield-halved', type: ArmoryApplyMenu, restricted: true });

	game.settings.register(MODULE_ID, 'turnGlow', { scope: 'world', config: false, type: Object, default: foundry.utils.deepClone(GLOW_DEFAULTS), onChange: () => TurnGlow.reconfigure() });
	game.settings.registerMenu(MODULE_ID, 'turnGlowMenu', { name: 'Turn glow', label: 'Configure turn glow', hint: 'The token whose turn it is glows instead of showing the turn marker. Set the color, style and strength for heroes, enemies and bosses, and how each changes in Crisis.', icon: 'fa-solid fa-sun', type: TurnGlowConfig, restricted: true });

	registerSfxSettings(reg);
	reg('autoOpen', { name: 'Open when a conflict starts', scope: 'client', type: Boolean, default: true });
	reg('uiSize', { name: 'Battle UI size', hint: 'The UI fits itself to your screen; this makes it bigger or smaller on top of that. Also adjustable with A− / A+ in the battle UI.', scope: 'client', type: Number, range: { min: 0.5, max: 2, step: 0.1 }, default: 1, onChange: () => { ui2.layout(); ui2.scheduleRender(); } });
	reg('checkDialog', { name: 'Battle UI check dialog', hint: 'Show Project FU’s check prompt (Attribute, Open, Opposed, Group, Ritual) in the Battle UI look.', scope: 'client', type: Boolean, default: true });
	reg('browserStyle', { name: 'Battle UI compendium browser', hint: 'Show Project FU’s compendium browser in the Battle UI look.', scope: 'client', type: Boolean, default: true });
	reg('opportunityMenu', { name: 'Opportunity menu', hint: 'When one of your Checks crits, open a menu with the Opportunities you can pick: the item’s own, then the world’s opportunity table (Project FU homebrew setting) or the Core Rulebook list.', scope: 'client', type: String, choices: { auto: 'Open as soon as I crit', click: 'Only from the chat card button', off: 'Off (Project FU’s own dialog)' }, default: 'auto' });
	reg('banners', { name: 'Action banners', hint: 'Show a banner across the screen when someone acts.', scope: 'client', type: Boolean, default: true });
	reg('floatingNumbers', { name: 'Floating damage numbers', scope: 'client', type: Boolean, default: true });
}

/* ------------------------------------------------------------------ */
/*  Init                                                               */
/* ------------------------------------------------------------------ */

registerCheckDialog();
registerBrowserStyle();

Hooks.once('init', () => {
	registerSettings();
	game.modules.get(MODULE_ID).api = api;
	game.keybindings.register(MODULE_ID, 'toggle', {
		name: 'Toggle the battle UI',
		editable: [{ key: 'KeyB', modifiers: ['Shift'] }],
		onDown: () => {
			api.toggle();
			return true;
		},
	});
});

Hooks.once('ready', async () => {
	if (game.system.id !== 'projectfu') {
		ui.notifications.warn('Fabula Ultima Battle UI needs the Project FU system.');
		return;
	}
	if (setting('replaceSystemHud')) {
		document.body.classList.add('fbui-replace');
		try {
			if (game.settings.get('projectfu', 'experimentalCombatHud')) {
				await game.settings.set('projectfu', 'experimentalCombatHud', false);
				ui.notifications.info('Battle UI turned off the Project FU combat HUD for you. Reload once to remove it completely.');
			}
		} catch (err) {
			console.warn(`${MODULE_ID} | could not change the system HUD setting`, err);
		}
	}

	game.socket.on(SOCKET, onSocket);
	await hookDamageEvents();
	await loadBasicConsumables();
	ui2.mount();
	TurnGlow.init();
	registerOpportunityMenu();
	for (const c of game.combats ?? []) ui2.lastRound.set(c.id, c.round);
	if (game.combat?.started && setting('autoOpen')) ui2.open();
});

async function hookDamageEvents() {
	try {
		const path = foundry.utils.getRoute('systems/projectfu/module/helpers/async-hooks.mjs');
		const { AsyncHooks } = await import(path);
		AsyncHooks.on(game.projectfu?.hooks?.DAMAGE_EVENT ?? 'projectfu.events.damage', onDamage);
	} catch (err) {
		console.warn(`${MODULE_ID} | damage events unavailable, falling back to HP changes`, err);
	}
}

function onDamage(ev) {
	try {
		const actor = ev?.actor;
		if (!actor || !game.combat?.started) return;
		const amount = Math.abs(Number(ev.amount) || 0);
		const type = String(ev.type ?? '');
		const absorb = ev.affinity === 'absorption';
		const word = AFF_WORD[ev.affinity];
		const c = combatantsOf(game.combat).find((x) => x.actor === actor || x.actor?.uuid === actor.uuid);
		const data = {
			actorUuid: actor.uuid,
			text: absorb ? `+${amount}` : `−${amount}`,
			sub: [word, type.toUpperCase()].filter(Boolean).join(' · '),
			kind: absorb ? 'heal' : ev.affinity === 'vulnerability' ? 'weak' : ev.affinity === 'resistance' || ev.affinity === 'immunity' ? 'resist' : `dmg ${type}`,
			typed: true,
		};
		if (c && c.faction !== FRIENDLY && AFFINITY_TYPES.some(([k]) => k === type)) data.reveal = { key: actorKey(actor), type };
		api.broadcastFloat(data);
	} catch (err) {
		console.warn(`${MODULE_ID} | damage float`, err);
	}
}

/* ------------------------------------------------------------------ */
/*  Socket                                                             */
/* ------------------------------------------------------------------ */

function onSocket(msg) {
	if (!msg?.type) return;
	switch (msg.type) {
		case 'banner':
			return ui2.banner(msg.data);
		case 'float':
			return handleFloat(msg.data);
		case 'clockApply':
			if (game.users.activeGM?.isSelf) Clocks.apply(msg.payload);
			return;
		case 'clockRequest':
			if (game.users.activeGM?.isSelf) ui2.addPending(msg.payload);
			return;
		case 'notify':
			if (msg.userId === game.user.id) ui.notifications.info(msg.text);
			return;
	}
}

/* ------------------------------------------------------------------ */
/*  Document hooks                                                     */
/* ------------------------------------------------------------------ */

const rerender = () => ui2.scheduleRender();
for (const h of ['createCombatant', 'updateCombatant', 'deleteCombatant', 'updateActor', 'updateToken', 'createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect', 'createItem', 'updateItem', 'deleteItem', 'canvasReady', 'controlToken', 'collapseSidebar']) {
	Hooks.on(h, rerender);
}
Hooks.on('collapseSidebar', () => setTimeout(() => ui2.layout(), 260));
Hooks.on('targetToken', (user) => {
	if (user === game.user) rerender();
});
Hooks.on('updateScene', (scene, changed) => {
	if (foundry.utils.hasProperty(changed, `flags.${MODULE_ID}`)) rerender();
});
Hooks.on('createCombat', rerender);
Hooks.on('deleteCombat', (combat) => {
	ui2.lastRound.delete(combat.id);
	rerender();
});
Hooks.on('combatStart', () => {
	if (setting('autoOpen')) ui2.open();
});

Hooks.on('updateCombat', (combat, changed) => {
	if ('round' in changed) {
		const prev = ui2.lastRound.get(combat.id) ?? 0;
		const round = changed.round;
		ui2.lastRound.set(combat.id, round);
		if (round > prev && combat === game.combat) {
			if (round === 1 && setting('autoOpen') && !ui2.state.open) ui2.open();
			ui2.banner({ side: 'round', who: round === 1 ? 'Conflict start' : 'Round', what: String(round), tgt: '', log: false });
			if (prev >= 1 && game.users.activeGM?.isSelf && setting('tickClocksEachRound')) Clocks.tickRound(prev);
		}
	}
	rerender();
});

/* ------------------------------------------------------------------ */
/*  Chat: action banners, misses, charged-attack cleanup               */
/* ------------------------------------------------------------------ */

Hooks.on('updateChatMessage', rerender);
Hooks.on('createChatMessage', (msg) => {
	if (ui2.state.points) rerender();
	const combat = game.combat;
	if (!combat?.started) return;
	const check = msg.getFlag?.('projectfu', 'Check');
	if (!check) return;
	const speaker = msg.speaker ?? {};
	const c = combatantsOf(combat).find((x) => (speaker.token && x.tokenId === speaker.token) || (!speaker.token && speaker.actor && x.actorId === speaker.actor));
	if (!c) return;
	if (c.hidden && !game.user.isGM) return;
	const action = check.additionalData?.ruleDefinedAction;
	const what = check.itemName || (action ? cap(action) : '');
	if (!what) return;
	const targets = Array.isArray(check.additionalData?.targets) ? check.additionalData.targets : [];
	let tgt = targets.length ? `on ${targets.map((t) => t.name).join(', ')}` : '';
	if (check.critical) tgt += `${tgt ? ' · ' : ''}CRITICAL`;
	else if (check.fumble) tgt += `${tgt ? ' · ' : ''}FUMBLE`;
	let img = '';
	try {
		const item = check.itemUuid ? fromUuidSync(check.itemUuid) : null;
		if (item && ARMORY_TYPES.includes(item.type) && isArmoryIcon(item.img)) img = item.img;
	} catch {
		/* item gone or in a pack */
	}
	ui2.banner({ side: c.faction === FRIENDLY ? 'hero' : 'foe', who: c.name, what, tgt, img });
	const def = check.type === 'magic' ? 'M.DEF' : 'DEF';
	for (const t of targets) {
		if (t.result === 'miss') ui2.float({ actorUuid: t.uuid, text: 'MISS', sub: t.difficulty ? `vs ${def} ${t.difficulty}` : '', kind: 'miss' });
	}
	const ch = combat.getFlag(MODULE_ID, 'charge');
	if (ch && ch.cid === c.id && ch.item === check.itemName && game.users.activeGM?.isSelf) combat.unsetFlag(MODULE_ID, 'charge');
});

/* Owners clear their Surrender/Sacrifice choice once the character is back on their feet */
Hooks.on('updateActor', (actor) => {
	const fallen = actor.getFlag?.(MODULE_ID, 'fallen');
	if (!fallen || !actor.isOwner) return;
	const hp = Number(actor.system?.resources?.hp?.value ?? 0);
	if (hp > 0 && (game.user.isGM ? game.users.activeGM?.isSelf : true)) actor.unsetFlag(MODULE_ID, 'fallen');
});

/* ------------------------------------------------------------------ */
/*  Buttons to open it                                                 */
/* ------------------------------------------------------------------ */

Hooks.on('getSceneControlButtons', (controls) => {
	try {
		const tokens = controls.tokens ?? controls.token;
		if (tokens?.tools && !Array.isArray(tokens.tools)) {
			tokens.tools.fbuiToggle = { name: 'fbuiToggle', title: 'Battle UI (Shift+B)', icon: 'fa-solid fa-gamepad', button: true, order: 50, visible: true, onChange: () => api.toggle() };
		}
	} catch (err) {
		console.warn(`${MODULE_ID} | scene control`, err);
	}
});

Hooks.on('renderCombatTracker', (app, html) => {
	const root = html instanceof HTMLElement ? html : html?.[0];
	if (!root || root.querySelector('.fbui-tracker-btn')) return;
	const header = root.querySelector('.combat-tracker-header, header');
	if (!header) return;
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'fbui-tracker-btn';
	btn.innerHTML = '<i class="fa-solid fa-gamepad"></i> Battle UI';
	btn.addEventListener('click', () => api.toggle());
	header.append(btn);
});

/* ------------------------------------------------------------------ */
/*  Armory icons                                                       */
/* ------------------------------------------------------------------ */

Hooks.on('preCreateItem', onPreCreateItem);
Hooks.on('preUpdateItem', onPreUpdateItem);

/* An "Armory icon" button in the header of weapon, shield, armor and accessory sheets */
Hooks.on('getHeaderControlsDocumentSheetV2', (app, controls) => {
	const doc = app.document;
	if (!(doc instanceof Item) || !ARMORY_TYPES.includes(doc.type) || !doc.isOwner) return;
	app.options.actions ??= {};
	app.options.actions.fbuiArmoryIcon ??= () => ArmoryPicker.open(app.document);
	if (controls.some((c) => c.action === 'fbuiArmoryIcon')) return;
	controls.push({ action: 'fbuiArmoryIcon', icon: 'fa-solid fa-shield-halved', label: 'Armory icon', ownership: 'OWNER' });
});

/* Same choice from the Items directory's right-click menu */
Hooks.on('getItemContextOptions', (app, options) => {
	options.push({
		name: 'Armory icon',
		icon: '<i class="fa-solid fa-shield-halved"></i>',
		condition: (li) => {
			const item = game.items.get(li?.dataset?.entryId ?? li?.[0]?.dataset?.entryId);
			return !!item && ARMORY_TYPES.includes(item.type) && item.isOwner;
		},
		callback: (li) => {
			const item = game.items.get(li?.dataset?.entryId ?? li?.[0]?.dataset?.entryId);
			if (item) ArmoryPicker.open(item);
		},
	});
});
