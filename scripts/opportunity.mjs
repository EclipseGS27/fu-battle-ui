import { MODULE_ID, esc, setting } from './util.mjs';
import { Clocks } from './clocks.mjs';
import { fullText } from './model.mjs';
import { sfx } from './sfx.mjs';

/**
 * Opportunity menu: when a Check crits, Project FU posts an "Apply opportunity" chat card.
 * This opens a Battle UI menu with the choices right away: the item's own Opportunity, then the
 * world's opportunity table (Project FU's homebrew setting) or the Core Rulebook list.
 */

export const CORE_OPPORTUNITIES = [
	['Advantage', 'The next Check performed by you or an ally will receive a +4 bonus.'],
	['Affliction', 'A creature suffers dazed, shaken, slow, or weak.'],
	['Bonding', 'You create a Bond towards someone or something, or add an emotion to one of your existing Bonds.'],
	['Faux Pas', 'Choose a creature present in the scene: they make a compromising statement chosen by the person who controls them.'],
	['Favor', 'Your Actions earn you someone’s support or admiration.'],
	['Information', 'You spot a useful clue or detail. The GM may tell you what it is or ask you to introduce that detail yourself.'],
	['Lost Item', 'An item is destroyed, lost, stolen, or left behind.'],
	['Progress', 'You may fill or erase up to two sections on a Clock.'],
	['Plot Twist!', 'Someone or something of your choice suddenly appears in the scene.'],
	['Scan', 'You discover one Vulnerability or one Trait of a creature you can see.'],
	['Unmask', 'You learn the goals and motivations of a creature of your choice.'],
];

const CUR = '<span class="cur"><svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1 12 7 2 13Z" fill="currentColor"/></svg></span>';
const mode = () => setting('opportunityMenu') ?? 'auto';
let pending = null;

/** The choices on offer: item first, then the world's table or the Core list */
async function choicesFor(item) {
	const out = [];
	const own = item?.system?.opportunity;
	if (own && String(own).trim()) out.push({ name: `${item.name}`, text: fullText(own), html: String(own), source: 'Item' });
	let table = null;
	try {
		const id = game.settings.get('projectfu', 'opportunities');
		if (id) table = await fromUuid(String(id).includes('.') ? id : `RollTable.${id}`);
	} catch {
		table = null;
	}
	const results = table ? [...(table.results?.values?.() ?? [])] : [];
	if (results.length) {
		for (const r of results) {
			const html = r.description ?? r.text ?? '';
			const text = fullText(html);
			const name = r.name || text.split(/[.:]/)[0].slice(0, 40) || 'Opportunity';
			out.push({ name, text: text || name, html: html || esc(name), source: table.name, progress: /\bclock\b/i.test(text) && /fill|erase/i.test(text) });
		}
	} else {
		for (const [name, text] of CORE_OPPORTUNITIES) out.push({ name, text, html: esc(text), source: 'Core', progress: name === 'Progress' });
	}
	return out;
}

async function post(actor, choice) {
	const render = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
	const opportunity = `<b>${esc(choice.name)}</b><br>${choice.html}`;
	let content;
	try {
		content = await render('systems/projectfu/templates/chat/chat-opportunity.hbs', { actor, opportunity });
	} catch {
		content = `<p><b>Opportunity</b>: ${opportunity}</p>`;
	}
	await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
	game.modules.get(MODULE_ID)?.api?.broadcastBanner({ side: actor.type === 'character' ? 'hero' : 'foe', who: actor.name, what: 'Opportunity', tgt: choice.name, cue: 'chime' });
}

/**
 * @param {{actorUuid:string, itemUuid?:string, fumble?:boolean}} data
 */
export async function openOpportunityMenu(data) {
	const actor = await fromUuid(data.actorUuid);
	if (!actor) return;
	const item = data.itemUuid ? await fromUuid(data.itemUuid).catch(() => null) : null;
	const choices = await choicesFor(item);
	if (!choices.length) return;
	document.querySelector('.fbui-opp')?._close?.();

	const foe = actor.type !== 'character';
	const el = document.createElement('div');
	el.className = `fbui-opp ${foe ? 'foe' : ''}`;
	el.setAttribute('role', 'dialog');
	el.setAttribute('aria-label', 'Opportunity');
	(document.getElementById('interface') ?? document.body).append(el);

	const list = (rows, help, back = false) => {
		el.innerHTML = `
			<div class="hd">
				<div class="flash">${data.fumble ? 'Opportunity for the opposition' : 'Opportunity!'}</div>
				<div class="who"><b>${esc(actor.name)}</b><small>${esc(item?.name ? `${item.name} · critical success` : 'critical success')}</small></div>
				<button type="button" class="x" aria-label="Decide later" data-tooltip="Decide later: the chat card keeps a button">✕</button>
			</div>
			<div class="list">${back ? `<button type="button" class="row back" data-i="back"><span class="l">‹ Back</span></button>` : ''}${rows
				.map((r, i) => `<button type="button" class="row" data-i="${i}" ${r.disabled ? 'disabled' : ''}>${CUR}<span class="l">${esc(r.label)}</span><span class="m">${esc(r.meta ?? '')}</span></button>`)
				.join('')}</div>
			<div class="help">${esc(help)}</div>
			<div class="ft"><span>Pick one. It is posted to chat for everyone.</span><button type="button" class="later">Decide later</button></div>`;
		const out = el.querySelector('.help');
		el.querySelectorAll('.row').forEach((b) => {
			const r = rows[Number(b.dataset.i)];
			if (r) {
				b.addEventListener('mouseenter', () => {
					out.innerHTML = `<b>${esc(r.label)}</b><span>${esc(r.help ?? '')}</span>`;
					sfx('cursor');
				});
				b.addEventListener('focus', () => (out.innerHTML = `<b>${esc(r.label)}</b><span>${esc(r.help ?? '')}</span>`));
			}
			b.addEventListener('click', async (ev) => {
				ev.stopPropagation();
				if (b.disabled) return;
				if (b.dataset.i === 'back') {
					sfx('back');
					return main();
				}
				sfx('confirm');
				await r.run();
			});
		});
		el.querySelector('.x').addEventListener('click', later);
		el.querySelector('.later').addEventListener('click', later);
	};

	const finish = async (choice) => {
		close();
		await post(actor, choice);
	};

	const progress = (choice) => {
		const clocks = Clocks.visible();
		if (!clocks.length) return finish(choice);
		const rows = clocks.map((k) => ({
			label: k.name,
			meta: `${k.current}/${k.max}`,
			help: `Fill or erase up to two sections of ${k.name}.`,
			run: () =>
				list(
					[
						['Fill 2 sections', 2],
						['Fill 1 section', 1],
						['Erase 1 section', -1],
						['Erase 2 sections', -2],
					].map(([label, n]) => ({
						label,
						meta: n > 0 ? `+${n}` : `−${-n}`,
						help: `${k.name}: ${k.current}/${k.max} → ${Math.max(0, Math.min(k.max, k.current + n))}/${k.max}`,
						run: async () => {
							await Clocks.request({ op: 'tick', id: k.id, n, reason: `${actor.name} (Opportunity)` });
							await finish({ ...choice, html: `${choice.html}<br><i>${esc(k.name)}: ${n > 0 ? 'fills' : 'erases'} ${Math.abs(n)}</i>` });
						},
					})),
					`${k.name}: ${k.current} of ${k.max} filled.`,
					true,
				),
		}));
		rows.push({ label: 'Just post it', meta: '', help: 'Post Progress to chat and handle the clock yourself.', run: () => finish(choice) });
		list(rows, 'Pick a clock.', true);
	};

	const main = () =>
		list(
			choices.map((c) => ({
				label: c.name,
				meta: c.source === 'Item' ? 'ITEM' : '',
				help: c.text,
				run: () => (c.progress ? progress(c) : finish(c)),
			})),
			data.fumble ? 'A fumble hands the opposition an Opportunity.' : 'Hover an option to read it. Your item’s own Opportunity, if it has one, is at the top.',
		);

	const key = (ev) => {
		if (ev.key === 'Escape') {
			ev.stopPropagation();
			later();
		}
	};
	function close() {
		document.removeEventListener('keydown', key, true);
		el.remove();
	}
	function later() {
		sfx('back');
		close();
	}
	el._close = close;
	document.addEventListener('keydown', key, true);
	main();
	sfx('chime');
}

export function registerOpportunityMenu() {
	// Project FU fires this on the client that rolled, before it posts its chat card
	Hooks.on(game.projectfu?.hooks?.OPPORTUNITY_EVENT ?? 'projectfu.events.opportunity', (ev) => {
		pending = { actorUuid: ev?.actor?.uuid, itemUuid: ev?.item?.uuid, fumble: !!ev?.fumble, at: Date.now() };
	});
	// open once the card is in chat (after Dice So Nice has finished)
	Hooks.on('createChatMessage', (msg) => {
		if (mode() !== 'auto' || !msg.getFlag?.('projectfu', 'Opportunity') || !msg.isAuthor) return;
		const p = pending;
		pending = null;
		if (!p || Date.now() - p.at > 60000 || p.fumble) return;
		const a = new DOMParser().parseFromString(msg.content ?? '', 'text/html').querySelector('[data-action="applyOpportunity"]');
		const actorUuid = a?.dataset.actor || p.actorUuid;
		if (!actorUuid) return;
		openOpportunityMenu({ actorUuid, itemUuid: a?.dataset.item || p.itemUuid }).catch((err) => console.error(`${MODULE_ID} | opportunity`, err));
	});
	// the card's own button opens this menu instead of Project FU's dialog
	Hooks.on('renderChatMessageHTML', (msg, html) => {
		if (mode() === 'off' || !msg.getFlag?.('projectfu', 'Opportunity')) return;
		html.addEventListener(
			'click',
			(ev) => {
				const a = ev.target.closest?.('[data-action="applyOpportunity"]');
				if (!a) return;
				ev.preventDefault();
				ev.stopImmediatePropagation();
				openOpportunityMenu({ actorUuid: a.dataset.actor, itemUuid: a.dataset.item }).catch((err) => console.error(`${MODULE_ID} | opportunity`, err));
			},
			true,
		);
	});
}
