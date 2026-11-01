import { MODULE_ID, setting } from './util.mjs';

/**
 * Two conveniences on top of Project FU:
 * - Damage and healing apply themselves. Damage on a hit goes through the system's own "apply damage"
 *   automation (kept in step with this setting); healing links (HEAL / GAIN) on a chat card from someone acting
 *   on targets are applied once, by the client that made the card, to those targets.
 * - Consumables that deal one of several damage types (the Elemental Shard: air, bolt, earth, fire or ice) ask
 *   which one, instead of offering every type on the card.
 */

const SYSTEM = 'projectfu';

/** Keep the system's own damage automation matching this module's switch (GM only: it is a world setting) */
async function syncSystemDamage() {
	if (!game.user.isGM) return;
	try {
		const want = !!setting('autoApply');
		if (game.settings.get(SYSTEM, 'automationApplyDamage') !== want) await game.settings.set(SYSTEM, 'automationApplyDamage', want);
	} catch (err) {
		console.warn(`${MODULE_ID} | could not change Project FU's damage automation`, err);
	}
}

/** Chat cards already handled here, so a re-render never heals twice */
const healed = new Set();

/**
 * Healing on a fresh card from this client: click each recovery link once, which applies it to the targets
 * through Project FU itself (Affinities, caps and bonuses included).
 */
function autoHeal(message, html) {
	if (!setting('autoApply')) return;
	const authorId = message.author?.id ?? message.user?.id ?? message.author;
	if (authorId !== game.user.id || healed.has(message.id)) return;
	if (Date.now() - (message.timestamp ?? 0) > 15000) return;
	const root = html instanceof HTMLElement ? html : html?.[0];
	const links = [...(root?.querySelectorAll?.('a.inline-recovery') ?? [])];
	if (!links.length) return;
	const check = message.getFlag?.(SYSTEM, 'Check');
	// not on attacks: a "recover HP" there is usually the attacker's own (draining), and the targets are enemies
	const offensive = (check?.additionalData?.targets ?? []).some((t) => t.result === 'hit' || t.result === 'miss') || !!root.querySelector('a.inline-damage') || !!check?.damage;
	if (offensive) return;
	// only when the action was aimed at someone: a card with targets, or targets picked right now
	const aimed = (check?.additionalData?.targets?.length ?? 0) > 0 || (game.user.targets?.size ?? 0) > 0;
	if (!aimed) return;
	healed.add(message.id);
	// Project FU wires the links up as the card renders: give it a moment
	setTimeout(() => {
		for (const a of links) if (a.isConnected) a.click();
	}, 400);
}

/** Pick one damage type for a consumable that offers several */
async function pickElement(item, types) {
	const D = foundry.applications.api.DialogV2;
	const label = (t) => game.i18n.localize(CONFIG.FU?.damageTypes?.[t] ?? t) || t;
	return D.wait({
		window: { title: `${item?.name ?? 'Consumable'}: which element?` },
		content: `<p class="fbui-pick-note">Pick the damage type for this ${esc(item?.name ?? 'item')}.</p>`,
		buttons: types.map((t, i) => ({ action: t, label: label(t), default: i === 0 })),
		rejectClose: false,
		classes: ['fbui-dialog', 'fbui-elements'],
	});
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Project FU fires this while it builds a consumable's card; its callbacks are awaited before the card is made */
function onConsumable(event, register) {
	if (!setting('pickElement')) return;
	const damage = event?.actions?.damage;
	const types = damage ? Object.keys(damage) : [];
	if (types.length < 2 || typeof register !== 'function') return;
	register(async () => {
		const item = event.consumable?.parent ?? null;
		const choice = await pickElement(item, types);
		// closed without choosing: leave every type on the card, as before
		if (!choice || !damage[choice]) return;
		for (const t of types) if (t !== choice) delete damage[t];
	});
}

export function registerAutomation(reg) {
	reg('autoApply', {
		name: 'Apply damage and healing automatically',
		hint: 'Damage lands on the targets that were hit, and healing on the targets of the action, without clicking the chat card. Turns on Project FU’s own “apply damage” automation too.',
		scope: 'world',
		type: Boolean,
		default: false,
		onChange: syncSystemDamage,
	});
	reg('pickElement', { name: 'Choose the element of consumables', hint: 'Items that deal one of several damage types (the Elemental Shard) ask which one, instead of offering every type on the card.', scope: 'client', type: Boolean, default: true });
	Hooks.once('ready', syncSystemDamage);
	Hooks.on('renderChatMessageHTML', autoHeal);
	Hooks.on('projectfu.events.consumables.create', onConsumable);
}
