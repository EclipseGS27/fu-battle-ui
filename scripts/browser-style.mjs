import { esc, setting } from './util.mjs';
import { sfx } from './sfx.mjs';

/**
 * Battle UI look for Project FU's compendium browser (styles/browser.css) plus menu sounds, and two ways to get
 * an entry onto a sheet:
 * - drag the whole row (the system only lets you drag its small icon);
 * - the + button on a row adds it to the character sheet you have open, through that sheet's own drop handling.
 */
const HOVER = '.fu-application__tabs a, .fu-filter-option, .fu-table__row-container, [data-action]';
const ROW = 'li.fu-table__row-container';
const LINK = '[data-link][data-uuid]';

/** The actor sheet in front (highest on screen) that this user can edit, else their own character */
function targetActor() {
	let best = null;
	for (const app of foundry.applications.instances?.values?.() ?? []) {
		const actor = app.actor ?? app.document;
		if (!app.rendered || !(actor instanceof Actor) || !actor.isOwner || !['character', 'npc'].includes(actor.type)) continue;
		const z = Number(app.position?.zIndex ?? 0);
		if (!best || z > best.z) best = { app, actor, z };
	}
	if (best) return { actor: best.actor, sheet: best.app };
	const own = game.user.character;
	return own?.isOwner ? { actor: own, sheet: own.sheet?.rendered ? own.sheet : null } : null;
}

async function addToSheet(uuid) {
	const target = targetActor();
	if (!target) return ui.notifications.warn('Open a character sheet first, then click + to add this to it.');
	const doc = await fromUuid(uuid);
	if (!(doc instanceof Item)) return;
	const { actor, sheet } = target;
	try {
		if (sheet && typeof sheet._onDropItem === 'function') {
			const event = { target: sheet.element, currentTarget: sheet.element, preventDefault() {}, stopPropagation() {} };
			await sheet._onDropItem(event, doc);
		} else {
			await actor.createEmbeddedDocuments('Item', [doc.toObject()]);
		}
		ui.notifications.info(`${doc.name} added to ${actor.name}.`);
	} catch (err) {
		console.error('fu-battle-ui | add from compendium', err);
		ui.notifications.error(`Couldn't add ${doc.name}: ${err.message}`);
	}
}

/** + buttons on item rows (not adversaries: actors don't go on a sheet) */
function decorateRows(root) {
	for (const row of root.querySelectorAll(ROW)) {
		if (row.querySelector(':scope > .fbui-add')) continue;
		const link = row.querySelector(LINK);
		if (!link || (link.dataset.type && link.dataset.type !== 'Item')) continue;
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'fbui-add';
		btn.dataset.uuid = link.dataset.uuid;
		btn.setAttribute('aria-label', 'Add to the open character sheet');
		btn.innerHTML = '<i class="fa-solid fa-plus"></i>';
		row.append(btn);
	}
}

export function registerBrowserStyle() {
	Hooks.on('renderApplicationV2', (app, html) => {
		const root = html instanceof HTMLElement ? html : app.element;
		if (!root || setting('browserStyle') === false) return;
		if (!root.querySelector(':scope > .window-content.fu-application__browser')) return;
		root.classList.add('fbui-browser');
		decorateRows(root);
		if (root.dataset.fbuiSfx) return;
		root.dataset.fbuiSfx = '1';
		// tables are re-rendered when tabs change: decorate whatever new rows show up
		new MutationObserver(() => decorateRows(root)).observe(root, { childList: true, subtree: true });

		let hovered = null;
		root.addEventListener('mouseover', (ev) => {
			const hit = ev.target.closest?.(HOVER);
			if (hit === hovered) return;
			hovered = hit;
			if (hit && root.contains(hit) && !hit.closest('.window-header')) sfx('cursor', { sheet: true });
		});
		root.addEventListener(
			'click',
			(ev) => {
				const add = ev.target.closest?.('.fbui-add');
				if (add && root.contains(add)) {
					ev.preventDefault();
					ev.stopPropagation();
					sfx('confirm', { sheet: true });
					return addToSheet(add.dataset.uuid);
				}
				const hit = ev.target.closest?.('.fu-application__tabs a, [data-action]');
				if (!hit || !root.contains(hit) || hit.closest('.window-header')) return;
				sfx('confirm', { sheet: true });
			},
			true,
		);
		// name the sheet the + will add to, just before its tooltip shows
		root.addEventListener('pointerover', (ev) => {
			const add = ev.target.closest?.('.fbui-add');
			if (!add) return;
			const t = targetActor();
			add.dataset.tooltip = t ? `Add to ${esc(t.actor.name)}` : 'Open a character sheet to add this to it';
		});

		// Drag the whole row, not only its icon
		root.addEventListener('pointerdown', (ev) => {
			const row = ev.target.closest?.(ROW);
			if (row && root.contains(row) && row.querySelector(LINK)) row.draggable = true;
		});
		root.addEventListener('dragstart', (ev) => {
			if (ev.target.closest?.('[data-link]')) return; // the icon: Foundry's own handler
			const row = ev.target.closest?.(ROW);
			const link = row?.querySelector(LINK);
			if (!link || !ev.dataTransfer) return;
			ev.dataTransfer.setData('text/plain', JSON.stringify({ type: link.dataset.type || 'Item', uuid: link.dataset.uuid }));
			ev.dataTransfer.effectAllowed = 'copy';
			const img = link.querySelector('img');
			if (img) ev.dataTransfer.setDragImage(img, 16, 16);
		});
		sfx('confirm', { sheet: true });
	});
}
