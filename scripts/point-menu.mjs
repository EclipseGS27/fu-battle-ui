import { esc } from './util.mjs';
import { resources } from './model.mjs';
import { alterStory, canInvoke, inventoryMenu, invoke, lastCheck, pullOut, ultimaEscape, ultimaRecovery, useConsumable } from './points.mjs';
import { sfx } from './sfx.mjs';

/**
 * The sheet's Fabula / Ultima / Inventory Point menus: the battle screen's own option lists,
 * opened as a small popover next to the button that was clicked.
 */

const CUR = '<span class="cur"><svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1 12 7 2 13Z" fill="currentColor"/></svg></span>';

function fpRows(actor) {
	const fp = resources(actor).fp;
	const villain = actor.type === 'npc' && actor.system?.villain?.value;
	const lc = lastCheck(actor);
	const chk = lc?.check;
	const last = chk ? `${chk.itemName || 'Check'} · Result ${chk.result ?? '?'}${chk.critical ? ' · CRITICAL' : chk.fumble ? ' · FUMBLE' : ''}` : 'No Check rolled yet';
	if (villain) {
		return {
			title: 'Ultima Points',
			count: fp,
			foe: true,
			last,
			help: fp > 0 ? 'A Villain cannot regain Ultima Points. At 0 they stop being a Villain unless they escalate.' : 'No Ultima Points left.',
			rows: [
				{ id: 'trait', label: 'Invoke a Trait: reroll', meta: '1 UP', help: 'Reroll one or both dice of the last Check.', ok: canInvoke('FU.ChatContextRerollUltima', lc?.message) },
				{ id: 'recovery', label: 'Recovery (uses an action)', meta: '1 UP', help: 'Recover from all status effects and recover 50 Mind Points.', ok: fp > 0 },
				{ id: 'escape', label: 'Escape', meta: '1 UP', help: 'Safely leave the scene. The GM describes how.', ok: fp > 0 },
			],
		};
	}
	return {
		title: 'Fabula Points',
		count: fp,
		last,
		help: chk?.fumble ? 'You can’t invoke a Trait or Bond on a fumble.' : 'Invoke a Trait or Bond after rolling a Check, or spend a point to alter the story.',
		rows: [
			{ id: 'trait', label: 'Invoke a Trait: reroll', meta: '1 FP', help: 'Reroll one or both dice of your last Check. Each reroll costs another Fabula Point. Not on a fumble.', ok: canInvoke('FU.ChatContextRerollFabula', lc?.message) },
			{ id: 'bond', label: 'Invoke a Bond: + Bond strength', meta: '1 FP', help: 'Add the strength of one of your Bonds to the Result of your last Check. Once per Check. Not on a fumble.', ok: canInvoke('FU.ChatContextPush', lc?.message) },
			{ id: 'alter', label: 'Alter the story', meta: '1 FP', help: 'Make a statement about the story: add a detail, create an opportunity, or introduce a convenient twist. The GM can veto anything that breaks the scene.', ok: fp > 0 },
		],
	};
}

function ipRows(actor) {
	const r = resources(actor);
	return {
		title: 'Inventory Points',
		count: `${r.ip ?? 0}${r.ipMax != null ? ` / ${r.ipMax}` : ''}`,
		help: 'Produce an item from your bag and use it at once. Core items not on your sheet are added the first time you use them.',
		rows: inventoryMenu(actor).map((x) => ({ id: x.id, label: x.label, meta: x.meta, help: x.help, ok: !x.disabled, kind: x.action })),
	};
}

async function choose(actor, kind, row) {
	if (kind === 'ip') {
		if (row.kind === 'ipSpend') return pullOut(actor);
		return useConsumable(actor, row.id);
	}
	const lc = lastCheck(actor);
	switch (row.id) {
		case 'trait':
			return invoke(actor.type === 'character' ? 'FU.ChatContextRerollFabula' : 'FU.ChatContextRerollUltima', lc?.message);
		case 'bond':
			return invoke('FU.ChatContextPush', lc?.message);
		case 'alter':
			return alterStory(actor);
		case 'recovery':
			return ultimaRecovery(actor);
		case 'escape':
			return ultimaEscape(actor);
	}
}

/** @param {ApplicationV2} sheet  @param {HTMLElement} anchor  @param {'fp'|'ip'} kind */
export function openPointMenu(sheet, anchor, kind) {
	const root = sheet.element;
	const prev = root.querySelector('.fbs-pop');
	const again = prev?.dataset.kind === kind;
	prev?._close?.();
	if (again) return;

	const actor = sheet.actor;
	const data = kind === 'ip' ? ipRows(actor) : fpRows(actor);
	const pop = document.createElement('div');
	pop.className = `fbs-pop ${data.foe ? 'foe' : ''} ${kind}`;
	pop.dataset.kind = kind;
	pop.setAttribute('role', 'menu');
	pop.innerHTML = `
		<div class="hd"><small>${esc(data.title)}</small><b>${esc(String(data.count))}</b><button type="button" class="x" aria-label="Close">✕</button></div>
		${data.last ? `<div class="last">Last Check: <b>${esc(data.last)}</b></div>` : ''}
		<div class="list">${
			data.rows
				.map(
					(r, i) =>
						`<button type="button" class="row" role="menuitem" data-i="${i}" ${r.ok ? '' : 'disabled'}>${CUR}<span class="l">${esc(r.label)}</span><span class="m">${esc(r.meta ?? '')}</span></button>`,
				)
				.join('') || '<div class="empty">Nothing here.</div>'
		}</div>
		<div class="help">${esc(data.help)}</div>`;
	root.append(pop);

	// place it under the button, kept inside the window
	const a = anchor.getBoundingClientRect();
	const w = root.getBoundingClientRect();
	const z = Number(root.currentCSSZoom) || 1;
	const pw = pop.offsetWidth;
	let left = (a.left - w.left) / z;
	left = Math.max(8, Math.min(left, w.width / z - pw - 8));
	pop.style.left = `${left}px`;
	pop.style.top = `${(a.bottom - w.top) / z + 6}px`;

	const help = pop.querySelector('.help');
	const def = help.textContent;
	pop.querySelectorAll('.row').forEach((b) => {
		const r = data.rows[Number(b.dataset.i)];
		const show = () => (help.innerHTML = `<b>${esc(r.label)}</b>${esc(r.help ?? '')}`);
		b.addEventListener('mouseenter', () => {
			show();
			sfx('cursor', { sheet: true });
		});
		b.addEventListener('focus', show);
		b.addEventListener('click', async (ev) => {
			ev.stopPropagation();
			if (b.disabled) return;
			sfx('confirm', { sheet: true });
			close();
			try {
				await choose(actor, kind, r);
			} catch (err) {
				console.error(err);
				ui.notifications.error(err.message ?? String(err));
			}
		});
	});
	pop.querySelector('.list').addEventListener('mouseleave', () => (help.textContent = def));

	const outside = (ev) => {
		if (!pop.contains(ev.target) && !anchor.contains(ev.target)) close();
	};
	const key = (ev) => {
		if (ev.key === 'Escape') {
			ev.stopPropagation();
			close();
		}
	};
	function close() {
		document.removeEventListener('pointerdown', outside, true);
		document.removeEventListener('keydown', key, true);
		pop.remove();
	}
	pop._close = close;
	pop.querySelector('.x').addEventListener('click', (ev) => {
		ev.stopPropagation();
		sfx('back', { sheet: true });
		close();
	});
	setTimeout(() => {
		document.addEventListener('pointerdown', outside, true);
		document.addEventListener('keydown', key, true);
	});
}
