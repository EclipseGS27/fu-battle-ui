import { KINDS, MATERIALS, iconPath, kindFor, resetIcon, setIcon, suggestIcon } from './armory.mjs';
import { ARMORY_INDEX } from './armory-index.mjs';
import { esc } from './util.mjs';

const { ApplicationV2 } = foundry.applications.api;

const KIND_LABEL = { Weapon: 'Weapons', Shield: 'Shields', Chestplate: 'Armor', Helmet: 'Helmets', Gloves: 'Gloves', Boots: 'Boots', Leggings: 'Leggings' };

/** Grid of armory icons for one item: pick a metal and a piece, click an icon to use it */
export class ArmoryPicker extends ApplicationV2 {
	static DEFAULT_OPTIONS = {
		classes: ['fbui-armory'],
		window: { title: 'Armory icon', icon: 'fa-solid fa-shield-halved', resizable: true },
		position: { width: 560, height: 560 },
		actions: {
			mat: ArmoryPicker.#onMaterial,
			kind: ArmoryPicker.#onKind,
			use: ArmoryPicker.#onUse,
			auto: ArmoryPicker.#onAuto,
		},
	};

	/** @param {Item} item */
	constructor(item, options = {}) {
		super({ ...options, id: `fbui-armory-${item.id}` });
		this.item = item;
		const pick = suggestIcon(item);
		const current = String(item.img ?? '').match(/\/([A-Za-z]+)\/\1_([A-Za-z]+)\d+\.png$/);
		this.material = current?.[1] && ARMORY_INDEX[current[1]] ? current[1] : (pick?.material ?? 'Steel');
		this.kind = current?.[2] && KINDS.includes(current[2]) ? current[2] : kindFor(item);
		if (!ARMORY_INDEX[this.material]?.[this.kind]) this.material = MATERIALS.find((m) => ARMORY_INDEX[m][this.kind]) ?? 'Steel';
	}

	get title() {
		return `Armory icon: ${this.item.name}`;
	}

	static open(item) {
		if (!item?.isOwner) return ui.notifications.warn('You can only change icons on items you own.');
		const existing = foundry.applications.instances.get(`fbui-armory-${item.id}`);
		if (existing) return existing.render({ force: true });
		return new ArmoryPicker(item).render({ force: true });
	}

	async _renderHTML() {
		const count = ARMORY_INDEX[this.material]?.[this.kind] ?? 0;
		const auto = suggestIcon(this.item);
		const mats = MATERIALS.filter((m) => ARMORY_INDEX[m][this.kind])
			.map((m) => `<button type="button" class="chip ${m === this.material ? 'on' : ''}" data-action="mat" data-mat="${m}" aria-pressed="${m === this.material}">${m}</button>`)
			.join('');
		const kinds = KINDS.map((k) => `<button type="button" class="tab ${k === this.kind ? 'on' : ''}" data-action="kind" data-kind="${k}" aria-pressed="${k === this.kind}">${KIND_LABEL[k]}</button>`).join('');
		const icons = Array.from({ length: count }, (_, i) => {
			const src = iconPath(this.material, this.kind, i + 1);
			const on = src === this.item.img;
			return `<button type="button" class="ic ${on ? 'on' : ''}" data-action="use" data-src="${esc(src)}" aria-label="${this.material} ${this.kind} ${i + 1}" data-tooltip="${this.material} ${this.kind} ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`;
		}).join('');
		const div = document.createElement('div');
		div.className = 'fbui-armory-body';
		div.innerHTML = `
			<div class="cur"><img src="${esc(this.item.img)}" alt=""><div><b>${esc(this.item.name)}</b><small>${auto ? `Automatic pick: ${esc(auto.material)} ${esc(auto.kind.toLowerCase())}` : 'No automatic pick fits this item.'}</small></div>${auto ? '<button type="button" class="btn" data-action="auto">Use automatic</button>' : ''}</div>
			<nav class="kinds">${kinds}</nav>
			<div class="mats">${mats}</div>
			<div class="grid">${icons || '<p class="empty">No icons of this kind in this metal.</p>'}</div>`;
		return div;
	}

	_replaceHTML(result, content) {
		content.replaceChildren(result);
	}

	static #onMaterial(event, target) {
		this.material = target.dataset.mat;
		this.render();
	}

	static #onKind(event, target) {
		this.kind = target.dataset.kind;
		if (!ARMORY_INDEX[this.material]?.[this.kind]) this.material = MATERIALS.find((m) => ARMORY_INDEX[m][this.kind]) ?? this.material;
		this.render();
	}

	static async #onUse(event, target) {
		await setIcon(this.item, target.dataset.src, { manual: true });
		this.render();
	}

	static async #onAuto() {
		await resetIcon(this.item);
		this.render();
	}
}

/** Settings menu: apply icons to everything already in the world */
export class ArmoryApplyMenu extends ApplicationV2 {
	static DEFAULT_OPTIONS = {
		id: 'fbui-armory-apply',
		classes: ['fbui-armory'],
		window: { title: 'Armory icons', icon: 'fa-solid fa-shield-halved' },
		position: { width: 460, height: 'auto' },
		actions: { apply: ArmoryApplyMenu.#onApply },
	};

	async _renderHTML() {
		const div = document.createElement('div');
		div.className = 'fbui-armory-body apply';
		div.innerHTML = `
			<p>Give every weapon, shield, armor and accessory already in this world an armory icon: the Items directory, every actor, and unlinked tokens.</p>
			<p>New items get one automatically when they are created or dropped on a sheet. Rings, amulets and other accessories with no matching piece keep their art.</p>
			<label class="row"><input type="checkbox" name="overwrite"> Also replace custom art I picked myself</label>
			<div class="foot"><button type="button" class="btn gold" data-action="apply">Apply icons</button></div>`;
		return div;
	}

	_replaceHTML(result, content) {
		content.replaceChildren(result);
	}

	static async #onApply(event, target) {
		const overwrite = !!this.element.querySelector('input[name="overwrite"]')?.checked;
		target.disabled = true;
		const { applyToWorld } = await import('./armory.mjs');
		const n = await applyToWorld({ overwrite });
		ui.notifications.info(`Armory icons applied to ${n} item${n === 1 ? '' : 's'}.`);
		this.close();
	}
}
