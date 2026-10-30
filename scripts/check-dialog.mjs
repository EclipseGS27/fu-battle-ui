import { MODULE_ID, esc, setting } from './util.mjs';
import { sfx } from './sfx.mjs';

/**
 * Battle UI look for Project FU's check prompt (Attribute / Open / Opposed / Group / Ritual checks).
 *
 * The system's dialog is a DialogV2 form; its inputs are what the roll reads. This keeps every one of
 * them: the attribute radios stay (hidden) and are driven by the diamonds, and the modifier and
 * difficulty inputs are moved into the new layout. Anything this doesn't rebuild (label, increment,
 * group members, ritual tables) stays where it is, re-themed.
 */

const ATTR = {
	dex: { abbr: 'DEX', name: 'Dexterity', color: '#5aa9ff' },
	ins: { abbr: 'INS', name: 'Insight', color: '#c7a6ff' },
	mig: { abbr: 'MIG', name: 'Might', color: '#6fe3a0' },
	wlp: { abbr: 'WLP', name: 'Willpower', color: '#f2c45a' },
};
const LEVELS = [
	[7, 'Easy', '#6fe3a0'],
	[10, 'Normal', '#5aa9ff'],
	[13, 'Hard', '#f2c45a'],
	[16, 'Very hard', '#ff6b7a'],
];

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '+0');

export function registerCheckDialog() {
	Hooks.on('renderDialogV2', (app, html) => {
		if (setting('checkDialog') === false) return;
		const root = html instanceof HTMLElement ? html : html?.[0];
		if (!root || root.classList.contains('fbui-check')) return;
		if (!root.querySelector('.fu-icon__radio-group input[name="primary"]')) return;
		root.classList.add('fbui-check');
		// after the system's own render callback has set the radios
		setTimeout(() => {
			try {
				build(app, root);
			} catch (err) {
				console.error(`${MODULE_ID} | check dialog`, err);
				root.classList.remove('fbui-check');
			}
		}, 0);
	});
}

function build(app, root) {
	const content = root.querySelector('.window-content') ?? root;
	const host = content.querySelector('.dialog-content') ?? content.querySelector('form') ?? content;
	const fieldsets = [...content.querySelectorAll('fieldset')];
	const legendOf = (fs) => fs.querySelector(':scope > legend')?.textContent?.trim() ?? '';

	// --- read what the system rendered
	const radios = (name) => [...content.querySelectorAll(`input[type="radio"][name="${name}"]`)];
	const prim = radios('primary');
	const sec = radios('secondary');
	const actorFs = fieldsets.find((fs) => fs.querySelector('img.profile-img'));
	const img = actorFs?.querySelector('img.profile-img');
	const dice = {};
	const keys = prim.map((r) => r.value);
	const overlays = [...(actorFs?.querySelectorAll('.fu-icon__badge-overlay') ?? [])];
	keys.forEach((k, i) => (dice[k] = num(overlays[i]?.textContent?.trim(), 0)));
	const attrFs = prim[0]?.closest('fieldset');
	const mod = content.querySelector('input[name="modifier"]');
	const diff = content.querySelector('input[name="difficulty"]:not([hidden])');
	const support = content.querySelector('input[name="supportDifficulty"]');
	const modFs = mod?.closest('fieldset');
	const diffFs = diff?.closest('fieldset');
	const bonus = num(modFs?.querySelector('.fu-icon__badge-overlay')?.textContent?.trim(), 0);
	const kind = String(app.options?.window?.title ?? app.title ?? 'Check');
	const isRitual = !!content.querySelector('input[name="potency"]');

	// --- new layout
	const panel = document.createElement('div');
	panel.className = 'fbc';
	const diamonds = (group) =>
		keys
			.map((k) => {
				const a = ATTR[k] ?? { abbr: k.toUpperCase(), name: k, color: '#9fd0ff' };
				return `<button type="button" class="fbc-dia" style="--c:${a.color}" data-group="${group}" data-attr="${k}" aria-label="${group === 'primary' ? 'Primary' : 'Secondary'}: ${a.name} d${dice[k]}" data-tooltip="${a.name}">
					<span class="d"><span>d${dice[k] || '?'}</span></span><b>${a.abbr}</b></button>`;
			})
			.join('');
	const levels = LEVELS.map(([v, l, c]) => `<button type="button" class="fbc-lv" style="--c:${c}" data-dl="${v}"><b>${v}</b><small>${l}</small></button>`).join('');
	panel.innerHTML = `
		<header class="fbc-head">
			${img ? `<img src="${esc(img.getAttribute('src'))}" alt="">` : ''}
			<div class="fbc-who"><small>${esc(kind)}</small><b>${esc(img?.getAttribute('title') ?? '')}</b></div>
			<div class="fbc-formula"><small>Roll</small><b data-out="formula"></b><span data-out="vs"></span></div>
		</header>
		<div class="fbc-attrs">
			<div class="fbc-row"><small class="cap">Primary</small><div class="fbc-dias">${diamonds('primary')}</div></div>
			<div class="fbc-row"><small class="cap">Secondary</small><div class="fbc-dias">${diamonds('secondary')}</div></div>
		</div>
		${
			isRitual || (!mod && !diff)
				? ''
				: `<div class="fbc-grid ${diff ? '' : 'one'}">
			${
				mod
					? `<div class="fbc-box"><small class="cap">Modifier</small>
				<div class="fbc-step"><button type="button" data-step="-1" aria-label="Lower modifier">−</button><span data-slot="modifier"></span><button type="button" data-step="1" aria-label="Raise modifier">+</button></div>
				${bonus ? `<small class="fbc-bonus" data-tooltip="Accuracy bonus from equipment and effects">Bonus ${signed(bonus)}</small>` : ''}</div>`
					: ''
			}
			${
				diff
					? `<div class="fbc-box"><small class="cap">${support ? 'Difficulty · leader / support' : 'Difficulty'}</small>
				<div class="fbc-dl"><span data-slot="difficulty"></span>${support ? '<i>/</i><span data-slot="support"></span>' : ''}</div>
				<div class="fbc-lvs">${levels}</div></div>`
					: ''
			}
		</div>`
		}`;
	host.prepend(panel);

	// move the real inputs into the slots so the form still submits them
	const slot = (name, input) => {
		const s = panel.querySelector(`[data-slot="${name}"]`);
		if (s && input) {
			input.classList.add('fbc-num');
			s.replaceWith(input);
		}
	};
	slot('modifier', mod);
	slot('difficulty', diff);
	slot('support', support);

	// hide what the panel replaces
	for (const fs of [actorFs, attrFs, isRitual ? null : modFs, isRitual ? null : diffFs]) fs?.classList.add('fbc-hidden');
	// empty wrappers left behind
	content.querySelectorAll('.flexrow').forEach((row) => {
		if (row.children.length && [...row.children].every((c) => c.classList.contains('fbc-hidden'))) row.classList.add('fbc-hidden');
	});
	// anything else the system shows (label, increment, actors, ritual) keeps its legend as a small header
	fieldsets.filter((fs) => !fs.classList.contains('fbc-hidden')).forEach((fs) => fs.classList.add('fbc-extra'));

	// --- behaviour
	const update = () => {
		const p = prim.find((r) => r.checked)?.value;
		const s = sec.find((r) => r.checked)?.value;
		panel.querySelectorAll('.fbc-dia').forEach((b) => {
			const on = (b.dataset.group === 'primary' ? p : s) === b.dataset.attr;
			b.classList.toggle('on', on);
			b.setAttribute('aria-pressed', String(on));
		});
		const m = num(mod?.value, 0);
		const parts = [p, s].map((k) => (k ? `d${dice[k] || '?'}` : '—'));
		const f = panel.querySelector('[data-out="formula"]');
		f.innerHTML = `【${esc((ATTR[p]?.abbr ?? '?') + ' + ' + (ATTR[s]?.abbr ?? '?'))}】 ${parts.join(' + ')}${m ? ` <em>${signed(m)}</em>` : ''}`;
		const vs = panel.querySelector('[data-out="vs"]');
		vs.textContent = diff && !isRitual ? `vs DL ${num(diff.value, 0)}` : '';
		const dl = num(diff?.value, NaN);
		panel.querySelectorAll('.fbc-lv').forEach((b) => b.classList.toggle('on', Number(b.dataset.dl) === dl));
	};
	panel.addEventListener('click', (ev) => {
		const dia = ev.target.closest('.fbc-dia');
		if (dia) {
			const list = dia.dataset.group === 'primary' ? prim : sec;
			const r = list.find((x) => x.value === dia.dataset.attr);
			if (r) {
				r.checked = true;
				r.dispatchEvent(new Event('change', { bubbles: true }));
			}
			sfx('cursor', { sheet: true });
			return update();
		}
		const step = ev.target.closest('[data-step]');
		if (step && mod) {
			mod.value = String(num(mod.value, 0) + Number(step.dataset.step));
			mod.dispatchEvent(new Event('change', { bubbles: true }));
			sfx('cursor', { sheet: true });
			return update();
		}
		const lv = ev.target.closest('.fbc-lv');
		if (lv && diff) {
			diff.value = lv.dataset.dl;
			diff.dispatchEvent(new Event('change', { bubbles: true }));
			sfx('cursor', { sheet: true });
			return update();
		}
	});
	let hovered = null;
	panel.addEventListener('mouseover', (ev) => {
		const hit = ev.target.closest('button');
		if (hit !== hovered) {
			hovered = hit;
			if (hit) sfx('cursor', { sheet: true });
		}
	});
	for (const i of [mod, diff, support]) i?.addEventListener('input', update);
	[...prim, ...sec].forEach((r) => r.addEventListener('change', update));

	// footer: the submit button reads as the roll
	const ok = root.querySelector('.form-footer button[data-action="ok"], footer button[data-action="ok"]');
	if (ok) {
		ok.classList.add('fbc-roll');
		const label = ok.querySelector('span') ?? null;
		if (label) label.textContent = 'Roll';
		ok.addEventListener('click', () => sfx('confirm', { sheet: true }));
	}
	update();
	try {
		app.setPosition?.({ width: 500, height: 'auto' });
	} catch {
		/* size stays the system's */
	}
}
