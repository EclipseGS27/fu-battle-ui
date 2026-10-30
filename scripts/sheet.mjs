import { AFFINITY_TYPES, AFF_ABBR, AFF_COLOR, COMMANDS, MODULE_ID, STATUS_CHIPS, pct, setting } from './util.mjs';
import { ARMORY_TYPES } from './armory.mjs';
import { ArmoryPicker } from './armory-picker.mjs';
import { itemHelp } from './model.mjs';
import { sfx } from './sfx.mjs';
import { openLevelUp } from './levelup.mjs';
import { openPointMenu } from './point-menu.mjs';

/**
 * Battle UI character sheet: a reskin of Project FU's standard sheet in the battle screen's look.
 * It extends the system sheet, so every roll, equip and table action keeps working; the system's own
 * tables (skills, spells, items, effects) are embedded and re-themed through Project FU's color variables.
 */

const T = (n) => `modules/${MODULE_ID}/templates/sheet/${n}.hbs`;
const SYS = (n) => `systems/projectfu/templates/actor/character/parts/${n}.hbs`;

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

const ATTRS = [
	['dex', 'DEX', 'Dexterity', '#5aa9ff'],
	['ins', 'INS', 'Insight', '#c7a6ff'],
	['mig', 'MIG', 'Might', '#6fe3a0'],
	['wlp', 'WLP', 'Willpower', '#f2c45a'],
];

const SHEET_STATUSES = ['dazed', 'shaken', 'slow', 'weak', 'enraged', 'poisoned'];

const SLOT_LABEL = { mainHand: 'MAIN HAND', offHand: 'OFF HAND', armor: 'ARMOR', accessory: 'ACCESSORY', phantom: 'PHANTOM' };

const BOND_PAIRS = [
	['admInf', ['Admiration', 'Inferiority']],
	['loyMis', ['Loyalty', 'Mistrust']],
	['affHat', ['Affection', 'Hatred']],
];

/* Sheet sounds: what a hover lands on, and which cue a click plays */
const HOVER_SFX = '.fbs-lvbtn, .fbs-npcrow, .fbs-cmd .row, .fbs-tabbtn, .fbs-btn, .fbs-chip, .fbs-aff .cell, .fbs-attr .dia, .fbs-slot button, .fbs-eqrow button, .fbs-link, .fbs-fold, .fbs-foldtab, .fbs-fp, .fbs-ipbtn, .fbs-class .nm, .fbs-class .sk';
const CLICK_CUE = { fbuiLevelUp: null, fbuiFp: 'cursor', fbuiIp: 'cursor', tab: 'cursor', fbuiCollapse: 'cursor', fbuiDelete: 'back', deleteBond: 'back', deleteItem: 'back', deleteEffect: 'back', fbuiEditImage: 'cursor' };

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function itemLine(item) {
	const s = item?.system ?? {};
	const v = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);
	switch (item?.type) {
		case 'basic':
		case 'weapon':
		case 'customWeapon': {
			const attrs = [v(s.attributes?.primary), v(s.attributes?.secondary)].filter(Boolean).map((a) => a.toUpperCase());
			const acc = num(v(s.accuracy));
			const dmg = num(v(s.damage));
			const type = v(s.damageType) ?? '';
			const parts = [];
			if (attrs.length) parts.push(`【${attrs.join(' + ')}】${acc ? ` ${signed(acc)}` : ''}`);
			if (s.damage != null) parts.push(`HR ${signed(dmg)} ${type}`.trim());
			const cat = v(s.category) ?? (item.type === 'basic' ? v(s.type) : null);
			if (cat) parts.push(cat);
			return parts.join(' · ');
		}
		case 'spell': {
			const parts = [];
			const amount = s.cost?.amount ?? v(s.mpCost);
			if (amount) parts.push(`${amount} ${String(s.cost?.resource ?? 'mp').toUpperCase()}${s.cost?.perTarget ? ' × T' : ''}`);
			if (v(s.isOffensive)) {
				const ri = s.rollInfo ?? {};
				const attrs = [v(ri.attributes?.primary), v(ri.attributes?.secondary)].filter(Boolean).map((a) => a.toUpperCase());
				if (attrs.length) parts.push(`【${attrs.join(' + ')}】${num(v(ri.accuracy)) ? ` ${signed(num(v(ri.accuracy)))}` : ''}`);
				if (ri.damage?.hasDamage?.value) parts.push(`HR ${signed(num(ri.damage.value))} ${v(ri.damage.type) ?? ''}`.trim());
			}
			const dur = v(s.duration);
			if (dur) parts.push({ instantaneous: 'Instant', scene: 'Scene' }[dur] ?? dur);
			return parts.join(' · ') || itemHelp(item).slice(0, 70);
		}
		case 'shield':
		case 'armor':
		case 'accessory': {
			const parts = [];
			const def = num(v(s.def));
			const mdef = num(v(s.mdef));
			const init = num(v(s.init));
			if (item.type === 'armor') {
				const pa = v(s.attributes?.primary);
				const sa = v(s.attributes?.secondary);
				parts.push(`DEF ${pa ? `${pa.toUpperCase()} ${def ? signed(def) : ''}`.trim() : def}`);
				parts.push(`M.DEF ${sa ? `${sa.toUpperCase()} ${mdef ? signed(mdef) : ''}`.trim() : mdef}`);
			} else {
				if (def) parts.push(`DEF ${signed(def)}`);
				if (mdef) parts.push(`M.DEF ${signed(mdef)}`);
			}
			if (init) parts.push(`INIT ${signed(init)}`);
			return parts.join(' · ') || itemHelp(item).slice(0, 70);
		}
		default:
			return itemHelp(item).slice(0, 70);
	}
}

/** Everything the custom parts of the sheet show, from the live actor */
export function sheetData(actor) {
	const s = actor.system ?? {};
	const r = s.resources ?? {};
	const hpMax = Math.max(1, num(r.hp?.max, 1));
	const crisis = num(r.hp?.crisisScore, Math.floor(hpMax / 2));
	const ipMax = num(r.ip?.max);
	const ipVal = num(r.ip?.value);
	const level = num(s.level?.value, 1);
	const exp = num(r.exp?.value);
	const items = actor.items?.contents ?? [];
	const tl = s.tlTracker;

	const classes = items
		.filter((i) => i.type === 'class')
		.map((c) => {
			const lvl = num(tl?.getClassLevel?.(c) ?? c.system?.level?.value);
			const max = Math.max(1, num(c.system?.level?.max, 10));
			const fuid = c.system?.fuid;
			const skills = items
				.filter((i) => i.type === 'skill' && fuid && i.system?.class?.value === fuid)
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((k) => {
					const sl = num(k.system?.level?.value);
					const sm = Math.max(1, num(k.system?.level?.max, 1));
					return { id: k.id, uuid: k.uuid, name: k.name, level: sl, max: sm, pips: Array.from({ length: Math.min(sm, 10) }, (_, i) => i < sl) };
				});
			return { id: c.id, uuid: c.uuid, name: c.name, img: c.img, level: lvl, max, mastered: lvl >= max, pips: Array.from({ length: max }, (_, i) => i < lvl), skills };
		})
		.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));

	const eq = s.equipped ?? {};
	const slotKeys = ['mainHand', 'offHand', 'armor', 'accessory'];
	if (eq.phantom) slotKeys.push('phantom');
	const twoHanded = eq.mainHand && eq.mainHand === eq.offHand;
	const equipped = slotKeys.map((key) => {
		const item = eq[key] ? actor.items.get(eq[key]) : null;
		const same = key === 'offHand' && twoHanded;
		return {
			key,
			label: SLOT_LABEL[key],
			item: item
				? { id: item.id, uuid: item.uuid, name: item.name, img: item.img, line: same ? 'Held in both hands' : itemLine(item), armory: ARMORY_TYPES.includes(item.type), rollable: ['weapon', 'customWeapon', 'shield'].includes(item.type) }
				: null,
			empty: { mainHand: 'Unarmed', offHand: 'Empty hand', armor: 'No armor', accessory: 'No accessory', phantom: 'Empty' }[key],
		};
	});

	// Defense breakdowns, mirroring Project FU's own math, with anything else folded into "other"
	const attrs = s.attributes ?? {};
	const die = (k) => (k && attrs[k] ? `${k.toUpperCase()} d${num(attrs[k].current)}` : null);
	const armor = eq.armor ? actor.items.get(eq.armor) : null;
	const shields = ['mainHand', 'offHand'].map((k) => (eq[k] ? actor.items.get(eq[k]) : null)).filter((i, idx, arr) => i?.type === 'shield' && arr.indexOf(i) === idx);
	const acc = eq.accessory ? actor.items.get(eq.accessory) : null;
	const breakdown = (type) => {
		const isM = type === 'mdef';
		const parts = [];
		let sum = 0;
		if (armor) {
			const attrKey = isM ? armor.system?.attributes?.secondary?.value : armor.system?.attributes?.primary?.value;
			if (attrKey && attrs[attrKey]) {
				parts.push(die(attrKey));
				sum += num(attrs[attrKey].current);
			}
			const v = num(isM ? armor.system?.mdef?.value : armor.system?.def?.value);
			if (v || !attrKey) parts.push(`${armor.name} ${attrKey ? signed(v) : v}`);
			sum += v;
		} else {
			const k = isM ? 'ins' : 'dex';
			parts.push(die(k));
			sum += num(attrs[k]?.current);
		}
		for (const sh of shields) {
			const v = num(isM ? sh.system?.mdef?.value : sh.system?.def?.value);
			if (v) {
				parts.push(`${sh.name} ${signed(v)}`);
				sum += v;
			}
		}
		if (acc) {
			const v = num(isM ? acc.system?.mdef?.value : acc.system?.def?.value);
			if (v) {
				parts.push(`${acc.name} ${signed(v)}`);
				sum += v;
			}
		}
		const total = num(s.derived?.[type]?.value, sum);
		if (total !== sum) parts.push(`other ${signed(total - sum)}`);
		return { total, parts: parts.filter(Boolean).join(' + ').replace(/\+ −/g, '− ') };
	};
	const initParts = [];
	let initSum = 0;
	for (const it of [armor, ...shields, acc].filter(Boolean)) {
		const v = num(it.system?.init?.value);
		if (v) {
			initParts.push(`${it.name} ${signed(v)}`);
			initSum += v;
		}
	}
	const initTotal = num(s.derived?.init?.value, initSum);
	if (initTotal !== initSum) initParts.push(`other ${signed(initTotal - initSum)}`);

	const statuses = SHEET_STATUSES.map((id) => {
		const [label, color] = STATUS_CHIPS[id] ?? [id, '#9fd0ff'];
		const on = actor.statuses?.has?.(id) ?? false;
		const immune = !!s.immunities?.[id]?.base;
		return { id, label, color, on, immune };
	});

	const affinities = AFFINITY_TYPES.map(([key, abbr, color]) => {
		const a = s.affinities?.[key];
		const v = num(a?.current ?? a?.base);
		const word = AFF_ABBR[v] ?? '·';
		return { key, abbr, color, word, wordColor: AFF_COLOR[word] ?? AFF_COLOR['·'], tooltip: `${key[0].toUpperCase()}${key.slice(1)}: ${{ VU: 'Vulnerable', RS: 'Resistant', IM: 'Immune', AB: 'Absorbs', '·': 'Normal' }[word] ?? 'Normal'}` };
	});

	const bonds = (s.bonds ?? []).map((b, index) => {
		const feelings = BOND_PAIRS.map(([field, pair]) => ({ field, pair, value: b[field] ?? '', options: pair.map((p) => ({ p, on: b[field] === p })) }));
		const strength = num(b.strength);
		return { index, name: b.name ?? '', feelings, strength, pips: Array.from({ length: Math.max(3, strength) }, (_, i) => i < strength), bonus: b.bonus };
	});

	let bondMax = 6;
	try {
		bondMax = num(game.settings.get('projectfu', 'optionBondMaxLength'), 6);
	} catch {
		/* setting missing */
	}

	const zenitName = (() => {
		try {
			return game.settings.get('projectfu', 'optionRenameCurrency') || 'Zenit';
		} catch {
			return 'Zenit';
		}
	})();

	return {
		level,
		exp,
		expPct: pct(exp, 10),
		canLevel: exp >= 10 && level < 60,
		nextLevel: level + 1,
		expPips: Array.from({ length: 10 }, (_, i) => i < Math.min(10, exp)),
		classLine: classes.map((c) => c.name).join(' · ') || 'No class yet',
		classes,
		totalSkill: tl?.totalSkill ?? { value: classes.reduce((a, c) => a + c.level, 0), max: level },
		hp: { value: num(r.hp?.value), max: hpMax, pct: pct(num(r.hp?.value), hpMax), crisis, crisisPct: pct(crisis, hpMax), inCrisis: num(r.hp?.value) <= crisis },
		mp: { value: num(r.mp?.value), max: num(r.mp?.max), pct: pct(num(r.mp?.value), num(r.mp?.max)) },
		ip: { value: ipVal, max: ipMax, pips: ipMax <= 12 ? Array.from({ length: ipMax }, (_, i) => i < ipVal) : null },
		fp: num(r.fp?.value),
		fpPips: num(r.fp?.value) <= 8 ? Array.from({ length: num(r.fp?.value) }) : null,
		zenit: num(r.zenit?.value),
		zenitName,
		stats: [
			{ k: 'DEF', v: breakdown('def').total },
			{ k: 'M.DEF', v: breakdown('mdef').total },
			{ k: 'INIT', v: signed(initTotal).replace('+', '') === '0' ? '0' : signed(initTotal) },
			{ k: 'CRISIS', v: crisis, crisis: true },
		],
		/** the header tiles: INIT and CRISIS only when the player turns them on */
		get headStats() {
			return this.stats.filter((t) => (t.k !== 'INIT' || setting('sheetShowInit') === true) && (t.k !== 'CRISIS' || setting('sheetShowCrisis') === true));
		},
		defenses: [
			{ k: 'DEF', ...breakdown('def') },
			{ k: 'M.DEF', ...breakdown('mdef') },
			{ k: 'INIT', total: signed(initTotal), parts: initParts.join(' + ').replace(/\+ −/g, '− ') || 'no modifiers' },
		],
		attrs: ATTRS.map(([key, abbr, name, color]) => {
			const a = attrs[key] ?? {};
			const base = num(a.base, 8);
			const cur = num(a.current, base);
			return { key, abbr, name, color, base, current: cur, changed: cur !== base, up: cur > base, options: [6, 8, 10, 12].map((d) => ({ d, on: d === base })) };
		}),
		commands: COMMANDS.filter(([id]) => id !== 'objective').map(([id, label, help]) => ({ id, label, help, sub: ['spell', 'skill', 'inventory'].includes(id) })),
		equipped,
		statuses,
		affinities,
		bonds,
		bondMax,
		canAddBond: bonds.length < bondMax,
		currency: zenitName,
	};
}

/* ------------------------------------------------------------------ */
/*  NPC data                                                           */
/* ------------------------------------------------------------------ */

const NPC_COMMANDS = [
	['attack', 'Attack', 'Use a basic attack or an equipped weapon against a target’s Defense.'],
	['spell', 'Spell', 'Cast one of its spells, paying the MP cost.'],
	['skill', 'Skill', 'Use one of its Skills or special rules.'],
	['guard', 'Guard', 'Until its next turn: Resistance to all damage and +2 on Opposed Checks; it may cover an ally.'],
	['hinder', 'Hinder', 'Check against Difficulty 10: on a success, the target suffers dazed, shaken, slow or weak.'],
];

const sysSetting = (key, fallback) => {
	try {
		return game.settings.get('projectfu', key);
	} catch {
		return fallback;
	}
};

/** NPC extras on top of sheetData: rank, villain, Ultima, study, skill points, attack and spell lists */
export function npcData(actor, FUc = CONFIG.FU) {
	const fb = sheetData(actor);
	const s = actor.system ?? {};
	const loc = (k) => (k ? game.i18n.localize(k) : '');
	const rank = s.rank?.value ?? 'soldier';
	const villain = s.villain?.value ?? '';
	const items = actor.items?.contents ?? [];
	const ultima = num(s.resources?.fp?.value);
	const study = num(s.study?.value);
	const tiers = (sysSetting('useRevisedStudyRule', false) ? FUc?.studyRoll?.revised : FUc?.studyRoll?.core) ?? [10, 13, 16];
	const studyOptions = ['—', ...tiers.map((t) => `${t}+`)].map((label, i) => ({ value: i, label, on: i === study }));
	const sp = s.spTracker;
	const spPart = (list) => (list ?? []).filter((x) => num(x.value)).map((x) => ({ label: loc(x.label), value: num(x.value), tooltip: x.tooltip ?? '' }));

	const attacks = items
		.filter((i) => i.type === 'basic' || (['weapon', 'customWeapon'].includes(i.type) && s.useEquipment?.value))
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
		.map((i) => ({ id: i.id, uuid: i.uuid, name: i.name, img: i.img, line: itemLine(i), quality: i.system?.quality?.value ?? '' }));
	const spells = items
		.filter((i) => i.type === 'spell')
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
		.map((i) => ({ id: i.id, uuid: i.uuid, name: i.name, img: i.img, line: itemLine(i), offensive: !!i.system?.isOffensive?.value }));
	const skills = items
		.filter((i) => ['miscAbility', 'skill', 'rule'].includes(i.type))
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
		.map((i) => ({ id: i.id, uuid: i.uuid, name: i.name, img: i.img, kind: i.type === 'rule' ? 'RULE' : 'SKILL', line: itemHelp(i).slice(0, 90) }));

	const traits = String(s.traits?.value ?? '')
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);

	return {
		...fb,
		commands: NPC_COMMANDS.map(([id, label, help]) => ({ id, label, help, sub: ['spell', 'skill'].includes(id) })),
		rank,
		rankLabel: loc(FUc?.rank?.[rank]) || rank,
		isChampion: rank === 'champion',
		isCompanion: rank === 'companion',
		replaced: num(s.rank?.replacedSoldiers, 1),
		species: s.species?.value ?? '',
		speciesLabel: loc(FUc?.species?.[s.species?.value]) || s.species?.value,
		villain,
		villainLabel: villain ? loc(FUc?.villainTypes?.[villain]) || villain : '',
		phases: num(s.phases?.value, 1),
		showUltima: !!villain && rank !== 'companion',
		ultima,
		ultimaPips: ultima <= 10 ? Array.from({ length: ultima }) : null,
		study,
		studyOptions,
		traits,
		behavior: sysSetting('optionBehaviorRoll', false) === true,
		useEquipment: !!s.useEquipment?.value,
		sp: sp ? { used: num(sp.used), available: num(sp.available), pct: num(sp.percentage), over: num(sp.used) > num(sp.available), have: spPart(sp.availableSkills), spent: spPart(sp.usedSkills) } : null,
		attacks,
		spells,
		skills,
		levelLine: [loc(FUc?.rank?.[rank]) || rank, rank === 'champion' ? `(${num(s.rank?.replacedSoldiers, 1)})` : '', loc(FUc?.species?.[s.species?.value]) || '', villain ? `· ${loc(FUc?.villainTypes?.[villain])}` : '']
			.filter(Boolean)
			.join(' '),
	};
}

/* ------------------------------------------------------------------ */
/*  Sheet classes                                                      */
/* ------------------------------------------------------------------ */

const foldKey = (kind) => `${MODULE_ID}.sheetFolded${kind === 'character' ? '' : '.' + kind}`;
const readFoldFor = (kind) => {
	try {
		return localStorage.getItem(foldKey(kind)) === '1';
	} catch {
		return false;
	}
};
const writeFoldFor = (kind, on) => {
	try {
		localStorage.setItem(foldKey(kind), on ? '1' : '0');
	} catch {
		/* storage blocked: the fold just isn't remembered */
	}
};

function equipVia(actor, target, slot) {
	const fake = { preventDefault() {}, button: slot === 'offHand' ? 2 : 0, ctrlKey: slot === 'phantom', shiftKey: false };
	return actor.equipmentHandler?.handleItemClick(fake, target);
}

/** Actions both Battle UI actor sheets share; `this` is the sheet */
const SHARED_ACTIONS = {
	fbuiEquip(event, target) {
		return equipVia(this.actor, target, target.dataset.slot ?? 'mainHand');
	},
	fbuiIcon(event, target) {
		const item = this.actor.items.get(target.closest('[data-item-id]')?.dataset.itemId);
		if (item) ArmoryPicker.open(item);
	},
	fbuiDelete(event, target) {
		const item = this.actor.items.get(target.closest('[data-item-id]')?.dataset.itemId);
		if (item) return item.deleteDialog();
	},
	/** Bond feelings are toggles: click the selected one again to clear it */
	async fbuiFeeling(event, target) {
		const index = Number(target.dataset.bond);
		const { field, value } = target.dataset;
		const bonds = this.actor.system.bonds.map((b) => (b.toObject ? b.toObject() : { ...b }));
		if (!bonds[index]) return;
		bonds[index][field] = bonds[index][field] === value ? '' : value;
		await this.actor.update({ 'system.bonds': bonds });
	},
	/** Fabula / Ultima and Inventory Point menus, the same options as the battle screen */
	fbuiFp(event, target) {
		if (!this.isEditable) return;
		openPointMenu(this, target, 'fp');
	},
	fbuiIp(event, target) {
		if (!this.isEditable) return;
		openPointMenu(this, target, 'ip');
	},
	fbuiCollapse() {
		const on = !this.element.classList.contains('fbs-folded');
		this.element.classList.toggle('fbs-folded', on);
		writeFoldFor(this.actor.type, on);
	},
	fbuiEditImage() {
		if (!this.isEditable) return;
		const FP = foundry.applications.apps.FilePicker.implementation ?? foundry.applications.apps.FilePicker;
		return new FP({ type: 'image', current: this.actor.img, callback: (path) => this.actor.update({ img: path }) }).browse();
	},
	/** Open an owned item's sheet from our own lists */
	fbuiOpen(event, target) {
		const item = this.actor.items.get(target.closest('[data-item-id]')?.dataset.itemId);
		item?.sheet?.render(true);
	},
};

/**
 * Behaviour both sheets share: sounds, the folding header, the command help panel, right-click off-hand equip.
 * @param {typeof foundry.applications.api.ApplicationV2} Base
 */
function battleBase(Base) {
	return class BattleSheetBase extends Base {
		static DEFAULT_OPTIONS = {
			classes: ['fbui-sheet'],
			window: { icon: 'fa-solid fa-gamepad' },
			actions: { ...SHARED_ACTIONS },
		};

		/** system part ids whose context our parts reuse */
		static BORROW = {};

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			context.fbEditable = this.isEditable;
			context.fbGM = game.user.isGM;
			return context;
		}

		async _preparePartContext(partId, context, options) {
			context = await super._preparePartContext(partId, context, options);
			// Reuse the system's table rendering for the parts we embed
			const borrow = this.constructor.BORROW[partId] ?? [];
			const ownPartId = context.partId;
			for (const p of borrow) context = (await super._preparePartContext(p, context, options)) ?? context;
			if (ownPartId !== undefined) context.partId = ownPartId;
			const tabs = this._prepareTabs('primary');
			if (partId === 'tabs') context.fbTabs = Object.values(tabs);
			if (partId in tabs) context.tab = tabs[partId];
			return context;
		}

		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			const root = this.element;
			root.classList.toggle('fbs-folded', readFoldFor(this.actor.type));
			// Sounds, wired once on the window element, which survives part re-renders
			let hovered = null;
			root.addEventListener('mouseover', (ev) => {
				const hit = ev.target.closest?.(HOVER_SFX);
				if (hit === hovered) return;
				hovered = hit;
				if (hit && !hit.disabled && root.contains(hit)) sfx('cursor', { sheet: true });
			});
			root.addEventListener(
				'click',
				(ev) => {
					const btn = ev.target.closest?.('[data-action]');
					if (!btn || !root.contains(btn) || btn.disabled || btn.closest('.window-header')) return;
					if (btn.matches('input, select, textarea')) return;
					const a = btn.dataset.action;
					const cue = a in CLICK_CUE ? CLICK_CUE[a] : /delete|remove/i.test(a) ? 'back' : 'confirm';
					if (cue) sfx(cue, { sheet: true });
				},
				true,
			);
		}

		_onClose(options) {
			sfx('back', { sheet: true });
			return super._onClose(options);
		}

		_onRender(context, options) {
			super._onRender(context, options);
			const root = this.element;
			root.classList.toggle('fbs-folded', readFoldFor(this.actor.type));
			root.classList.toggle('fbs-crisis', !!context.fb?.hp?.inCrisis && setting('sheetCrisisTint') !== false);
			// Command list: hovering an action shows what it does, like the battle menu
			const out = root.querySelector('[data-fbui-help]');
			if (out) {
				const def = out.textContent;
				root.querySelectorAll('.fbs-cmd [data-help]').forEach((el) => {
					const show = () => {
						out.textContent = el.dataset.help;
						root.querySelectorAll('.fbs-cmd .on').forEach((x) => x.classList.remove('on'));
						el.classList.add('on');
					};
					el.addEventListener('mouseenter', show);
					el.addEventListener('focus', show);
				});
				root.querySelector('.fbs-cmd')?.addEventListener('mouseleave', () => (out.textContent = def));
			}
			// Right-click a weapon's equip button to put it in the off hand
			root.querySelectorAll('[data-action="fbuiEquip"][data-slot="mainHand"]').forEach((el) =>
				el.addEventListener('contextmenu', (ev) => {
					ev.preventDefault();
					equipVia(this.actor, el, 'offHand');
				}),
			);
		}
	};
}

/** @param {typeof foundry.applications.api.ApplicationV2} Base Project FU's standard actor sheet */
export function registerBattleSheet(Base) {
	if (!Base) {
		console.warn(`${MODULE_ID} | Project FU character sheet not found, Battle UI sheet not registered`);
		return null;
	}
	const Shared = battleBase(Base);

	class FUBattleSheet extends Shared {
		static DEFAULT_OPTIONS = {
			position: { width: 880, height: 980 },
			actions: {
				fbuiLevelUp() {
					return openLevelUp(this.actor, { sheet: this });
				},
			},
		};

		static PARTS = {
			header: { template: T('header') },
			limited: { template: SYS('actor-limited') },
			tabs: { template: T('tabs') },
			overview: { template: T('overview'), templates: [T('slot')] },
			abilities: { template: T('abilities') },
			gear: { template: T('gear') },
			story: { template: T('story') },
			effects: { template: SYS('actor-section-effects') },
			settings: { template: SYS('actor-section-settings') },
		};

		static TABS = {
			primary: {
				tabs: [
					{ id: 'overview', label: 'Overview' },
					{ id: 'abilities', label: 'Abilities' },
					{ id: 'gear', label: 'Gear' },
					{ id: 'story', label: 'Story' },
					{ id: 'effects', label: 'Effects' },
					{ id: 'settings', label: 'Settings' },
				],
				initial: 'overview',
			},
		};

		static BORROW = { overview: ['stats'], abilities: ['classes', 'spells', 'features'], gear: ['items'], story: ['notes'] };

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			context.fb = sheetData(this.actor);
			return context;
		}

		async _preparePartContext(partId, context, options) {
			context = await super._preparePartContext(partId, context, options);
			if (partId === 'story') {
				const opts = Array.isArray(context.bondOptions) ? context.bondOptions : [];
				context.fbBondOptions = [...new Set(opts.map((o) => (typeof o === 'string' ? o : (o?.value ?? o?.label ?? o?.name ?? ''))).filter(Boolean))];
			}
			return context;
		}
	}

	class FUBattleNpcSheet extends Shared {
		static DEFAULT_OPTIONS = {
			classes: ['fbui-npc'],
			position: { width: 860, height: 960 },
		};

		static PARTS = {
			header: { template: T('npc-header') },
			limited: { template: SYS('actor-limited') },
			tabs: { template: T('tabs') },
			overview: { template: T('npc-overview'), templates: [T('npc-row')] },
			abilities: { template: T('npc-abilities') },
			gear: { template: T('npc-gear') },
			tactics: { template: T('npc-behavior') },
			lore: { template: T('npc-notes') },
			effects: { template: SYS('actor-section-effects') },
			settings: { template: SYS('actor-section-settings') },
		};

		static TABS = {
			primary: {
				tabs: [
					{ id: 'overview', label: 'Overview' },
					{ id: 'abilities', label: 'Abilities' },
					{ id: 'gear', label: 'Gear' },
					{ id: 'tactics', label: 'Behavior' },
					{ id: 'lore', label: 'Notes' },
					{ id: 'effects', label: 'Effects' },
					{ id: 'settings', label: 'Settings' },
				],
				initial: 'overview',
			},
		};

		static BORROW = { overview: ['stats'], abilities: ['combat'], gear: ['combat'], tactics: ['behavior'], lore: ['notes'] };

		/** Gear only when the NPC uses equipment; Behavior only with Project FU's behavior roll option */
		#hidden() {
			const out = [];
			if (!this.actor.system?.useEquipment?.value) out.push('gear');
			if (sysSetting('optionBehaviorRoll', false) !== true) out.push('tactics');
			return out;
		}

		_configureRenderParts(options) {
			const parts = super._configureRenderParts(options);
			if (this.isLimited) return parts;
			for (const id of this.#hidden()) delete parts[id];
			return parts;
		}

		_prepareTabs(group) {
			const tabs = super._prepareTabs(group);
			for (const id of this.#hidden()) delete tabs[id];
			return tabs;
		}

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			context.fb = npcData(this.actor, context.FU ?? CONFIG.FU);
			return context;
		}
	}

	const makeDefault = setting('sheetDefault') === true;
	foundry.documents.collections.Actors.registerSheet(MODULE_ID, FUBattleSheet, {
		types: ['character'],
		makeDefault,
		label: 'Battle UI Sheet',
	});
	foundry.documents.collections.Actors.registerSheet(MODULE_ID, FUBattleNpcSheet, {
		types: ['npc'],
		makeDefault: setting('npcSheetDefault') === true,
		label: 'Battle UI NPC Sheet',
	});
	return FUBattleSheet;
}
