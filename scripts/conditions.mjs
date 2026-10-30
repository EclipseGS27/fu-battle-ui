import { STATUS_CHIPS, esc, setting } from './util.mjs';
import { conditionInfo } from './model.mjs';

/**
 * Hover a token on the map to see what its conditions do: a small card next to it with each status's
 * rules text (Project FU's own, localized) and how long it lasts.
 */

let box = null;
let current = null;
let timer = null;

function el() {
	if (box?.isConnected) return box;
	box = document.createElement('div');
	box.className = 'fbui-condtip';
	box.setAttribute('role', 'tooltip');
	document.body.append(box);
	return box;
}

function hide() {
	current = null;
	clearTimeout(timer);
	box?.classList.remove('show');
}

function conditionsOf(token) {
	const ids = [...(token?.actor?.statuses ?? [])];
	return ids
		.map((id) => {
			const def = (CONFIG.statusEffects ?? []).find((e) => e.id === id);
			if (!STATUS_CHIPS[id] && !def?.description) return null;
			const info = conditionInfo(id);
			if (!info) return null;
			return { ...info, color: STATUS_CHIPS[id]?.[1] ?? '#9fd0ff', img: def?.img ?? '' };
		})
		.filter(Boolean)
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Next to the token's right edge, or its left one when there is no room */
function place(token) {
	if (!box || !token?.visible || !canvas?.stage?.worldTransform) return hide();
	const wt = canvas.stage.worldTransform;
	const right = wt.apply({ x: token.x + token.w, y: token.y });
	const left = wt.apply({ x: token.x, y: token.y });
	const w = box.offsetWidth;
	const h = box.offsetHeight;
	let x = right.x + 10;
	if (x + w > window.innerWidth - 8) x = left.x - w - 10;
	const y = Math.min(Math.max(8, right.y), window.innerHeight - h - 8);
	box.style.left = `${Math.max(8, x)}px`;
	box.style.top = `${y}px`;
}

function show(token) {
	const list = conditionsOf(token);
	if (!list.length) return hide();
	const b = el();
	b.innerHTML = `<div class="hd">${esc(token.document?.name ?? token.name ?? '')}</div>${list
		.map(
			(c) =>
				`<div class="c" style="--c:${c.color}">${c.img ? `<img src="${esc(c.img)}" alt="">` : '<i></i>'}<div><b>${esc(c.name)}</b>${c.text ? `<p>${esc(c.text)}</p>` : ''}${c.duration ? `<small>${esc(c.duration)}</small>` : ''}</div></div>`,
		)
		.join('')}`;
	b.classList.add('show');
	place(token);
}

export function registerConditionTips() {
	Hooks.on('hoverToken', (token, hovered) => {
		if (setting('conditionTips') === false) return hide();
		if (hovered) {
			current = token;
			clearTimeout(timer);
			// a short wait, so sweeping the mouse across the map doesn't flash cards
			timer = setTimeout(() => current === token && show(token), 180);
		} else if (current === token) hide();
	});
	Hooks.on('canvasPan', () => current && place(current));
	Hooks.on('refreshToken', (token) => token === current && box?.classList.contains('show') && place(token));
	for (const h of ['createActiveEffect', 'deleteActiveEffect', 'updateActiveEffect', 'updateActor']) {
		Hooks.on(h, () => current && box?.classList.contains('show') && show(current));
	}
	for (const h of ['deleteToken', 'canvasTearDown', 'canvasReady']) Hooks.on(h, hide);
	window.addEventListener('blur', hide);
}
