import { esc } from './util.mjs';
import { sfx } from './sfx.mjs';

/**
 * Level up in one dialog: spend 10 EXP, gain a level, put the class level somewhere, and at levels 20, 40
 * and 60 raise an attribute. Afterwards the compendium opens on the right list (a Skill for that class, or
 * a new class) so the rest of the level is one more click.
 */

const ATTR = [
	['dex', 'DEX', 'Dexterity', '#5aa9ff'],
	['ins', 'INS', 'Insight', '#c7a6ff'],
	['mig', 'MIG', 'Might', '#6fe3a0'],
	['wlp', 'WLP', 'Willpower', '#f2c45a'],
];
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function canLevelUp(actor) {
	return actor?.type === 'character' && num(actor.system?.resources?.exp?.value) >= 10 && num(actor.system?.level?.value, 1) < 60;
}

/** Run a sheet action (the system's openCompendium) as if its button were clicked */
function runSheetAction(sheet, name, dataset) {
	const a = sheet?.options?.actions?.[name];
	const fn = typeof a === 'function' ? a : a?.handler;
	if (!fn) return false;
	fn.call(sheet, new PointerEvent('click'), { dataset, closest: () => null });
	return true;
}

/**
 * @param {Actor} actor
 * @param {{sheet?: foundry.applications.api.ApplicationV2}} [o]
 */
export async function openLevelUp(actor, { sheet = null } = {}) {
	if (!actor?.isOwner) return ui.notifications.warn('You can only level up characters you own.');
	if (!canLevelUp(actor)) return ui.notifications.info(`${actor.name} needs 10 EXP to level up.`);
	const s = actor.system;
	const level = num(s.level?.value, 1);
	const exp = num(s.resources?.exp?.value);
	const next = level + 1;
	const attrUp = next % 20 === 0;
	const tl = s.tlTracker;
	const classes = actor.items
		.filter((i) => i.type === 'class')
		.map((c) => {
			const lv = num(tl?.getClassLevel?.(c) ?? c.system?.level?.value);
			const max = Math.max(1, num(c.system?.level?.max, 10));
			return { id: c.id, name: c.name, img: c.img, level: lv, max, full: lv >= max, mastersNow: lv + 1 >= max };
		})
		.sort((a, b) => b.level - a.level);
	const firstOpen = classes.find((c) => !c.full);
	const classRows = classes
		.map(
			(c) => `<label class="fbl-opt ${c.full ? 'off' : ''}">
				<input type="radio" name="cls" value="${c.id}" ${c.full ? 'disabled' : ''} ${c === firstOpen ? 'checked' : ''}>
				<img src="${esc(c.img)}" alt="">
				<span class="t"><b>${esc(c.name)}</b><small>${c.full ? 'Mastered' : `Class level ${c.level} → ${c.level + 1}${c.mastersNow ? ' · Mastered: you may take a Heroic Skill' : ''}`}</small></span>
				<span class="pips">${Array.from({ length: c.max }, (_, i) => `<i class="${i < c.level ? 'on' : i === c.level && !c.full ? 'new' : ''}"></i>`).join('')}</span>
			</label>`,
		)
		.join('');
	const attrRows = attrUp
		? `<div class="fbl-sec"><small class="cap">Level ${next}: raise one attribute by one die size</small><div class="fbl-attrs">${ATTR.map(([k, abbr, name, color], i) => {
				const base = num(s.attributes?.[k]?.base, 8);
				const max = base >= 12;
				return `<label class="fbl-attr ${max ? 'off' : ''}" style="--c:${color}" data-tooltip="${name}"><input type="radio" name="attr" value="${k}" ${max ? 'disabled' : ''} ${!max && i === ATTR.findIndex(([kk]) => num(s.attributes?.[kk]?.base, 8) < 12) ? 'checked' : ''}><span class="d"><span>d${base}${max ? "" : `→d${base + 2}`}</span></span><b>${abbr}</b></label>`;
			}).join('')}</div></div>`
		: '';

	const content = `<div class="fbl">
		<div class="fbl-top">
			<img src="${esc(actor.img)}" alt="">
			<div class="fbl-who"><small>LEVEL UP</small><b>${esc(actor.name)}</b></div>
			<div class="fbl-lv"><span class="from"><b>${level}</b></span><i>▶</i><span class="to"><b>${next}</b></span></div>
		</div>
		<div class="fbl-exp"><small class="cap">EXP</small><span class="bar"><span style="width:${Math.min(100, exp * 10)}%"></span></span><b>${exp} → ${exp - 10}</b></div>
		<div class="fbl-sec"><small class="cap">Gain a class level in</small>
			<div class="fbl-classes">${classRows}
				<label class="fbl-opt new"><input type="radio" name="cls" value="new" ${firstOpen ? '' : 'checked'}><span class="plus">+</span><span class="t"><b>A new class</b><small>Opens the class compendium after leveling</small></span></label>
			</div>
		</div>
		${attrRows}
		<label class="fbl-check"><input type="checkbox" name="browse" checked> Open the compendium for the new Skill or class</label>
		<label class="fbl-check"><input type="checkbox" name="chat" checked> Announce it in chat</label>
	</div>`;

	sfx('confirm', { sheet: true });
	const DialogV2 = foundry.applications.api.DialogV2;
	const result = await DialogV2.wait({
		window: { title: `Level up: ${actor.name}`, icon: 'fa-solid fa-angles-up' },
		classes: ['fbui-levelup'],
		position: { width: 480 },
		content,
		rejectClose: false,
		buttons: [
			{
				action: 'ok',
				label: `Level up to ${next}`,
				icon: 'fa-solid fa-angles-up',
				default: true,
				callback: (event, button) => {
					const f = button.form;
					return {
						cls: f.querySelector('input[name="cls"]:checked')?.value ?? null,
						attr: f.querySelector('input[name="attr"]:checked')?.value ?? null,
						browse: !!f.querySelector('input[name="browse"]')?.checked,
						chat: !!f.querySelector('input[name="chat"]')?.checked,
					};
				},
			},
			{ action: 'cancel', label: 'Not now' },
		],
		render: (event, dialog) => {
			const el = dialog.element ?? event?.target?.element;
			el?.querySelectorAll('.fbl-opt, .fbl-attr').forEach((o) => o.addEventListener('mouseenter', () => sfx('cursor', { sheet: true })));
			el?.querySelectorAll('input[type="radio"]').forEach((r) => r.addEventListener('change', () => sfx('cursor', { sheet: true })));
		},
	});
	if (!result || result === 'cancel') return sfx('back', { sheet: true });
	return applyLevelUp(actor, result, { sheet });
}

async function applyLevelUp(actor, { cls, attr, browse, chat }, { sheet }) {
	if (!canLevelUp(actor)) return;
	const s = actor.system;
	const level = num(s.level?.value, 1);
	const next = level + 1;
	const upd = { 'system.level.value': next, 'system.resources.exp.value': num(s.resources?.exp?.value) - 10 };
	let attrLine = '';
	if (attr && next % 20 === 0 && s.attributes?.[attr]) {
		const base = num(s.attributes[attr].base, 8);
		if (base < 12) {
			upd[`system.attributes.${attr}.base`] = base + 2;
			attrLine = `${attr.toUpperCase()} d${base} → d${base + 2}`;
		}
	}
	await actor.update(upd);

	let classLine = '';
	let classItem = null;
	if (cls && cls !== 'new') {
		classItem = actor.items.get(cls);
		if (classItem) {
			const lv = num(classItem.system?.level?.value);
			const max = num(classItem.system?.level?.max, 10);
			if (lv < max) {
				await classItem.update({ 'system.level.value': lv + 1 });
				classLine = `${classItem.name} ${lv + 1}${lv + 1 >= max ? ' (mastered)' : ''}`;
			}
		}
	}

	sfx('fanfare');
	sheet?.element && burst(sheet.element, next);

	if (chat) {
		const bits = [classLine || (cls === 'new' ? 'a new class' : ''), attrLine].filter(Boolean).join(' · ');
		ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor }),
			content: `<div class="fbui-lvchat"><b>${esc(actor.name)}</b> reached <b>level ${next}</b>${bits ? `<br><small>${esc(bits)}</small>` : ''}</div>`,
		});
	}

	if (browse && sheet) {
		const opened = cls === 'new' ? runSheetAction(sheet, 'openCompendium', { tab: 'classes', type: 'class', actorId: actor.uuid }) : classItem ? runSheetAction(sheet, 'openCompendium', { tab: 'classes', type: 'skill', actorId: actor.uuid, text: classItem.name }) : false;
		if (!opened) ui.notifications.info(cls === 'new' ? 'Add the new class from the compendium.' : `Pick a ${classItem?.name ?? ''} Skill from the compendium.`);
	} else if (cls === 'new') {
		ui.notifications.info('Add the new class from the compendium.');
	}
	if (canLevelUp(actor)) ui.notifications.info(`${actor.name} still has ${num(actor.system.resources.exp.value)} EXP: another level is ready.`);
}

/** A big LEVEL UP flourish over the sheet */
function burst(root, level) {
	const el = document.createElement('div');
	el.className = 'fbs-lvburst';
	el.innerHTML = `<b>LEVEL UP!</b><small>Level ${level}</small>`;
	root.append(el);
	setTimeout(() => el.remove(), 2200);
}

