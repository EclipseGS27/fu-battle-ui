import { MODULE_ID, SOCKET, esc } from './util.mjs';
import { itemHelp, resources } from './model.mjs';
import { sfx } from './sfx.mjs';

/* ------------------------------------------------------------------ */
/*  Fabula and Ultima Points                                           */
/* ------------------------------------------------------------------ */

const NEGATIVE_STATUSES = ['dazed', 'shaken', 'slow', 'weak', 'enraged', 'poisoned'];

/** Most recent rolled Check in chat made by this combatant's actor */
export function lastCheck(actor, combatant) {
	const msgs = game.messages?.contents ?? [];
	for (let i = msgs.length - 1, n = 0; i >= 0 && n < 40; i--, n++) {
		const m = msgs[i];
		const check = m.getFlag?.('projectfu', 'Check');
		if (!check || !m.isRoll) continue;
		const sp = m.speaker ?? {};
		const mine = (combatant && sp.token && sp.token === combatant.tokenId) || (!sp.token && sp.actor === actor.id) || ChatMessage.getSpeakerActor?.(sp) === actor;
		if (mine) return { message: m, check };
	}
	return null;
}

/** Project FU puts Trait/Bond invokes in the chat context menu; borrow those entries so its own dialogs and FP costs apply. */
function chatEntry(name) {
	const items = [];
	try {
		Hooks.callAll('getChatMessageContextOptions', ui.chat, items);
	} catch (err) {
		console.warn(`${MODULE_ID} | chat context entries`, err);
	}
	return items.find((i) => i.name === name) ?? null;
}

export function canInvoke(name, message) {
	if (!message) return false;
	const entry = chatEntry(name);
	if (!entry) return false;
	try {
		return !!entry.condition?.({ dataset: { messageId: message.id } });
	} catch {
		return false;
	}
}

export async function invoke(name, message) {
	const entry = chatEntry(name);
	if (!entry || !message) {
		sfx('error');
		return ui.notifications.warn('That option is not available for this Check.');
	}
	return entry.callback({ dataset: { messageId: message.id } });
}

async function spendPoint(actor, label, text) {
	const fp = resources(actor).fp;
	if (fp < 1) {
		sfx('error');
		ui.notifications.warn(`${actor.name} has no ${label} Points left.`);
		return false;
	}
	await actor.update({ 'system.resources.fp.value': fp - 1 });
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${label} Point`,
		content: `<p>${text}</p>`,
		flags: { projectfu: { UseMetaCurrency: true } },
	});
	return true;
}

async function confirm(title, content) {
	const D = foundry.applications.api.DialogV2;
	return D.confirm({ window: { title }, content: `<p>${content}</p>`, rejectClose: false });
}

export async function alterStory(actor) {
	if (!(await confirm('Alter the story', `Spend 1 Fabula Point for ${esc(actor.name)} to make a statement about the story?`))) return;
	if (await spendPoint(actor, 'Fabula', `<b>${esc(actor.name)}</b> spends a Fabula Point to alter the story.`)) {
		game.modules.get(MODULE_ID).api.broadcastBanner({ side: 'hero', who: actor.name, what: 'Alters the story', tgt: '−1 Fabula Point', cue: 'chime' });
	}
}

export async function ultimaRecovery(actor) {
	if (!(await confirm('Ultima: Recovery', `${esc(actor.name)} uses an action and 1 Ultima Point to recover from all status effects and recover 50 MP?`))) return;
	const r = resources(actor);
	if (!(await spendPoint(actor, 'Ultima', `<b>${esc(actor.name)}</b> spends an Ultima Point: recovers from all status effects and recovers 50 Mind Points.`))) return;
	await actor.update({ 'system.resources.mp.value': Math.min(r.mpMax || r.mp + 50, r.mp + 50) });
	for (const s of NEGATIVE_STATUSES) {
		if (actor.statuses?.has(s)) await actor.toggleStatusEffect?.(s, { active: false });
	}
	game.modules.get(MODULE_ID).api.broadcastBanner({ side: 'foe', who: actor.name, what: 'Recovery', tgt: 'statuses cleared · +50 MP', cue: 'chime' });
}

export async function ultimaEscape(actor) {
	if (!(await confirm('Ultima: Escape', `${esc(actor.name)} spends 1 Ultima Point to safely leave the scene?`))) return;
	if (await spendPoint(actor, 'Ultima', `<b>${esc(actor.name)}</b> spends an Ultima Point and escapes the scene.`)) {
		game.modules.get(MODULE_ID).api.broadcastBanner({ side: 'foe', who: actor.name, what: 'Escapes', tgt: '' });
	}
}

/* ------------------------------------------------------------------ */
/*  Inventory Points                                                   */
/* ------------------------------------------------------------------ */

const BASIC = ['remedy', 'elixir', 'tonic', 'elemental-shard', 'magic-tent'];
let basics = [];

/** The Core Rulebook inventory items from Project FU's consumables compendium */
export async function loadBasicConsumables() {
	try {
		const pack = game.packs.get('projectfu.consumables');
		if (!pack) return;
		const idx = await pack.getIndex({ fields: ['system.ipCost', 'system.summary', 'system.fuid'] });
		basics = idx
			.filter((e) => BASIC.includes(e.system?.fuid))
			.sort((a, b) => BASIC.indexOf(a.system.fuid) - BASIC.indexOf(b.system.fuid))
			.map((e) => ({ uuid: e.uuid, name: e.name, fuid: e.system.fuid, ip: Number(e.system?.ipCost?.value ?? 0), help: e.system?.summary?.value ?? '' }));
	} catch (err) {
		console.warn(`${MODULE_ID} | could not load consumables`, err);
	}
}

/**
 * Items this module adds on top of the Core ones. They are made from this data the first time a character uses
 * one (then they live on the sheet and can be edited like any item).
 * Phoenix Down: revives one creature at 0 HP. Project FU removes KO itself when HP goes above 0; the "defeated"
 * mark (from Surrender) is cleared by the GM's client once the healing lands (see trackRevive).
 */
export const EXTRA_ITEMS = [
	{
		key: 'phoenix-down',
		data: {
			name: 'Phoenix Down',
			type: 'consumable',
			img: 'icons/svg/angel.svg',
			system: {
				subtype: { value: 'potion' },
				summary: { value: 'One creature at 0 Hit Points is revived and recovers 50 Hit Points.' },
				description: '<p>One creature at 0 Hit Points gets back up: it recovers 50 Hit Points and is no longer KO or defeated.</p>',
				ipCost: { value: 4 },
				fuid: 'phoenix-down',
				resource: { enabled: true, amount: '50', type: 'hp' },
				traits: { entries: ['potion', 'restore', 'hit-point'] },
			},
			flags: { 'fu-battle-ui': { revive: true } },
		},
	},
];
const extraId = (key) => `module:${key}`;

/** Pick the 0 HP targets a revive item would bring back */
function reviveTargets() {
	return [...(game.user.targets ?? [])].map((t) => t.actor).filter((a) => a && Number(a.system?.resources?.hp?.value ?? 1) <= 0);
}

/** The actor's own consumables plus any Core item they don't carry yet */
export function inventoryMenu(actor) {
	const res = resources(actor);
	const own = (actor.items?.contents ?? [...(actor.items ?? [])]).filter((i) => i.type === 'consumable');
	const ownFuids = new Set(own.map((i) => i.system?.fuid).filter(Boolean));
	const ownNames = new Set(own.map((i) => i.name.toLowerCase()));
	const rows = own.map((i) => {
		const cost = Number(i.system?.ipCost?.value ?? 0);
		return { id: i.id, label: i.name, meta: `${cost} IP`, cost, help: itemHelp(i), action: 'consumable' };
	});
	for (const b of basics) {
		if (ownFuids.has(b.fuid) || ownNames.has(b.name.toLowerCase())) continue;
		rows.push({ id: b.uuid, label: b.name, meta: `${b.ip} IP`, cost: b.ip, help: b.help, action: 'consumable' });
	}
	for (const x of EXTRA_ITEMS) {
		if (ownFuids.has(x.data.system.fuid) || ownNames.has(x.data.name.toLowerCase())) continue;
		const ip = Number(x.data.system.ipCost.value);
		rows.push({ id: extraId(x.key), label: x.data.name, meta: `${ip} IP`, cost: ip, help: x.data.system.summary.value, action: 'consumable' });
	}
	rows.sort((a, b) => a.cost - b.cost || a.label.localeCompare(b.label));
	for (const r of rows) r.disabled = res.ip != null && r.cost > res.ip;
	rows.push({ id: 'pull', label: 'Pull something out of the bag', meta: '? IP', disabled: !res.ip, help: 'An uncommon item that doesn’t fit your Identity. The GM sets the cost, usually 2 to 4 IP.', action: 'ipSpend' });
	return rows;
}

/** Use a consumable: owned items roll directly; Core items get added to the sheet first so Project FU can roll them. */
export async function useConsumable(actor, id) {
	let item = actor.items.get(id);
	const extra = !item && String(id).startsWith('module:') ? EXTRA_ITEMS.find((x) => extraId(x.key) === id) : null;
	if (extra) {
		item = actor.items.find((i) => i.type === 'consumable' && (i.system?.fuid === extra.data.system.fuid || i.name === extra.data.name));
		if (!item) [item] = await actor.createEmbeddedDocuments('Item', [foundry.utils.deepClone(extra.data)]);
	} else if (!item) {
		const src = await fromUuid(id);
		if (!src) return ui.notifications.warn('Item not found in the compendium.');
		item = actor.items.find((i) => i.type === 'consumable' && (i.system?.fuid === src.system?.fuid || i.name === src.name));
		if (!item) {
			const data = game.items.fromCompendium ? game.items.fromCompendium(src) : src.toObject();
			[item] = await actor.createEmbeddedDocuments('Item', [data]);
		}
	}
	const cost = Number(item.system?.ipCost?.value ?? 0);
	if (resources(actor).ip != null && cost > resources(actor).ip) return sfx('error'), ui.notifications.warn(`${actor.name} doesn’t have ${cost} IP.`);
	if (isRevive(item)) {
		const fallen = reviveTargets();
		if (!fallen.length) return sfx('error'), ui.notifications.warn(`Target a creature at 0 HP to use ${item.name}.`);
		announceRevive(fallen);
	}
	return item.roll();
}

/** A revive item: ours (by flag) or any consumable whose fuid says Phoenix Down */
export const isRevive = (item) => !!item?.getFlag?.(MODULE_ID, 'revive') || item?.system?.fuid === 'phoenix-down';

/** Tell the GM which fallen creatures are being revived, so their defeated mark goes once they have HP again */
function announceRevive(actors) {
	const uuids = actors.map((a) => a.uuid);
	game.socket.emit(SOCKET, { type: 'revive', uuids });
	trackRevive(uuids);
}

const pendingRevive = new Map(); // actor uuid -> expiry time

/** GM side: remember these for a minute (long enough to click HEAL on the card when nothing applies it on its own) */
export function trackRevive(uuids) {
	if (!game.users.activeGM?.isSelf) return;
	const until = Date.now() + 60000;
	for (const u of uuids ?? []) pendingRevive.set(u, until);
}

/** GM side: a creature waiting on a revive has HP again: it is no longer defeated */
export async function onReviveUpdate(actor) {
	const until = pendingRevive.get(actor.uuid);
	if (!until) return;
	if (Date.now() > until) return void pendingRevive.delete(actor.uuid);
	if (Number(actor.system?.resources?.hp?.value ?? 0) <= 0) return;
	pendingRevive.delete(actor.uuid);
	for (const c of game.combat?.combatants ?? []) {
		if (c.actor?.uuid === actor.uuid && c.defeated) await c.update({ defeated: false }).catch(() => {});
	}
	if (actor.getFlag(MODULE_ID, 'fallen')) await actor.unsetFlag(MODULE_ID, 'fallen');
	game.modules.get(MODULE_ID).api.broadcastBanner({ side: 'hero', who: actor.name, what: 'Revived', tgt: '', cue: 'chime' });
}

export async function pullOut(actor) {
	const r = resources(actor);
	const D = foundry.applications.api.DialogV2;
	const res = await D.prompt({
		window: { title: 'Pull something out of the bag' },
		content: `<div class="fbui-dlg"><label>What is it?<input type="text" name="what" placeholder="e.g. quality lockpicks" autofocus></label><label>Inventory Points (you have ${r.ip})<input type="number" name="ip" min="1" max="${r.ip}" value="${Math.min(2, r.ip)}"></label></div>`,
		ok: { label: 'Spend IP', callback: (ev, button) => ({ what: button.form.elements.what.value.trim(), ip: Number(button.form.elements.ip.value) }) },
		rejectClose: false,
		classes: ['fbui-dialog'],
	});
	if (!res || !res.ip || res.ip < 1) return;
	const now = resources(actor).ip ?? 0;
	if (res.ip > now) return sfx('error'), ui.notifications.warn(`${actor.name} only has ${now} IP.`);
	await actor.update({ 'system.resources.ip.value': now - res.ip });
	const what = res.what || 'something useful';
	await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), flavor: 'Inventory', content: `<p><b>${esc(actor.name)}</b> pulls out <b>${esc(what)}</b> (${res.ip} IP).</p>` });
	game.modules.get(MODULE_ID).api.broadcastBanner({ side: 'hero', who: actor.name, what: 'Inventory', tgt: `${what} · −${res.ip} IP` });
}
