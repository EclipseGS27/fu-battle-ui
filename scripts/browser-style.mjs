import { setting } from './util.mjs';
import { sfx } from './sfx.mjs';

/**
 * Battle UI look for Project FU's compendium browser. CSS only (styles/browser.css) plus menu sounds;
 * the browser itself, its filters and drag-and-drop are untouched.
 */
const HOVER = '.fu-application__tabs a, .fu-filter-option, .fu-table__row-container, [data-action]';

export function registerBrowserStyle() {
	Hooks.on('renderApplicationV2', (app, html) => {
		const root = html instanceof HTMLElement ? html : app.element;
		if (!root || setting('browserStyle') === false) return;
		if (!root.querySelector(':scope > .window-content.fu-application__browser')) return;
		root.classList.add('fbui-browser');
		if (root.dataset.fbuiSfx) return;
		root.dataset.fbuiSfx = '1';
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
				const hit = ev.target.closest?.('.fu-application__tabs a, [data-action]');
				if (!hit || !root.contains(hit) || hit.closest('.window-header')) return;
				sfx('confirm', { sheet: true });
			},
			true,
		);
		sfx('confirm', { sheet: true });
	});
}
