import { AFFINITY_TYPES, AFF_COLOR, MODULE_ID, STATUS_CHIPS, setting } from './util.mjs';
import { sheetData } from './sheet.mjs';
import { affinities, conditionTip, foeActionRows, npcInfo, resources } from './model.mjs';
import { sfx } from './sfx.mjs';
import { openLevelUp } from './levelup.mjs';

/**
 * Battle UI party sheet: Project FU's party sheet with a new header, tab bar and roster.
 * Inventory, Adversaries, Codex, Bonds, Settings and the inspect view are the system's own
 * templates, re-themed, so every party action keeps working.
 */

const T = (n) => `modules/${MODULE_ID}/templates/party/${n}.hbs`;
const ROLE = { tank: 'Tank', damage: 'Damage', support: 'Support', any: '' };
/* menu sounds (the player's pack, FFXIII by default): cursor on hover, confirm on choose, back on close or remove */
const HOVER = '.fbp-mi, .fbp-card, .fbp-card button, .fbp-title img, .window-content > .tab:not(.fbp-roster) :is([data-action], .entry, .fu-table__row-container)';
const CUE = { tab: 'confirm', fbuiLevelUp: null, restParty: 'chime', rewardResource: 'chime', addTrack: 'confirm', refreshSheet: 'cursor', updateTrack: 'cursor' };
const isVideo = (src) => /\.(webm|mp4|m4v|ogv)(\?|$)/i.test(String(src ?? ''));

/** The token art, for the emblem at the foot of each card (animated tokens play) */
function tokenArt(actor) {
	const src = actor.prototypeToken?.texture?.src || actor.img;
	return { src, video: isVideo(src), mirror: (actor.prototypeToken?.texture?.scaleX ?? 1) < 0 };
}

export function cardFor(entry) {
	const actor = entry.actor;
	const d = sheetData(actor);
	return {
		uuid: actor.uuid,
		id: actor.id,
		name: actor.name,
		img: actor.img,
		imgVideo: isVideo(actor.img),
		identity: entry.identity ?? actor.system?.resources?.identity?.name ?? '',
		role: ROLE[entry.role] ?? '',
		level: d.level,
		canLevel: d.canLevel,
		exp: d.exp,
		classes: d.classes.map((c) => ({ name: c.name, level: c.level })),
		main: d.classes[0] ? { name: d.classes[0].name, level: d.classes[0].level } : null,
		more: d.classes.slice(1).map((c) => `${c.name} ${c.level}`).join(' · '),
		expPct: Math.min(100, Math.max(0, (d.exp / 10) * 100)),
		token: tokenArt(actor),
		hp: d.hp,
		mp: d.mp,
		ip: d.ip,
		fp: d.fp,
		zenit: d.zenit,
		ko: d.hp.value <= 0,
		stats: d.stats.filter((s) => s.k !== 'CRISIS'),
		attrs: d.attrs.map((a) => ({ abbr: a.abbr, color: a.color, die: a.current, changed: a.changed, up: a.up })),
		statuses: d.statuses.filter((s) => s.on),
	};
}

/**
 * The inspect page (the emblem at the foot of a card): a status screen for one character, with arrows to the
 * other party members.
 * @param {Actor} actor
 * @param {Actor[]} members the party's characters, in roster order
 */
export function inspectData(actor, members = []) {
	const d = sheetData(actor);
	const s = actor.system ?? {};
	const list = members.length ? members : [actor];
	const n = list.length;
	const i = Math.max(0, list.findIndex((a) => a.uuid === actor.uuid));
	const active = [...(actor.statuses ?? [])].filter((id) => STATUS_CHIPS[id]).map((id) => ({ id, label: STATUS_CHIPS[id][0], color: STATUS_CHIPS[id][1], tip: conditionTip(id) }));
	return {
		...d,
		uuid: actor.uuid,
		name: actor.name,
		img: actor.img,
		imgVideo: isVideo(actor.img),
		token: tokenArt(actor),
		identity: s.resources?.identity?.name ?? '',
		theme: s.resources?.theme?.name ?? '',
		origin: s.resources?.origin?.name ?? '',
		pronouns: s.resources?.pronouns?.name ?? '',
		ko: d.hp.value <= 0,
		activeStatuses: active,
		many: n > 1,
		index: i + 1,
		count: n,
		prev: list[(i - 1 + n) % n].uuid,
		next: list[(i + 1) % n].uuid,
	};
}

/* ------------------------------------------------------------------ */
/*  Adversaries: what the party has learned                            */
/* ------------------------------------------------------------------ */

const TIER_OF = { none: 0, basic: 1, complete: 2, detailed: 3 };
const TIER_WORD = ['Unstudied', 'Basic', 'Complete', 'Detailed'];
const TIER_TEXT = [
	'Not studied yet. Affinities show up as the party hits them.',
	'Basic (10+): level, rank, Species, HP and MP.',
	'Complete (13+): also Traits, Attributes, Defense, Magic Defense and Affinities.',
	'Detailed (16+): everything, including attacks, spells, skills and special rules.',
];
const AFF_NAME = { VU: 'Vulnerable', RS: 'Resistant', IM: 'Immune', AB: 'Absorbs', '·': 'Normal' };

function studyMax() {
	try {
		const tiers = (game.settings.get('projectfu', 'useRevisedStudyRule') ? CONFIG.FU?.studyRoll?.revised : CONFIG.FU?.studyRoll?.core) ?? [10, 13, 16];
		return Math.max(...tiers);
	} catch {
		return 16;
	}
}

/**
 * The adversary list and the picked one's details, gated by the party's Study like the battle screen
 * (the GM sees everything, with a note on what players know).
 */
export function adversaryData(entries, selected) {
	const max = studyMax();
	const tierOf = (e) => TIER_OF[e.studyResult] ?? 0;
	const list = entries.map((e) => {
		const tier = tierOf(e);
		return { uuid: e.uuid, name: e.name, img: e.img, species: game.i18n.localize(e.species ?? ''), rank: game.i18n.localize(e.rank ?? ''), known: tier > 0 || game.user.isGM, tier, tierWord: TIER_WORD[tier], pct: Math.round(Math.min(1, (Number(e.study) || 0) / max) * 100), sel: e.uuid === selected };
	});
	const entry = entries.find((e) => e.uuid === selected) ?? null;
	let actor = null;
	try {
		actor = entry ? fromUuidSync(entry.uuid) : null;
	} catch {
		actor = null;
	}
	if (!entry || !actor) return { list, detail: null };

	const gm = game.user.isGM;
	const partyTier = tierOf(entry);
	const tier = gm ? 3 : partyTier;
	const info = npcInfo(actor);
	const r = resources(actor);
	const aff = affinities(actor);
	const revealed = entry.revealed?.affinities ?? {};
	const at = actor.system?.attributes ?? {};
	const ATTR = [['dex', 'DEX', '#5aa9ff'], ['ins', 'INS', '#c7a6ff'], ['mig', 'MIG', '#6fe3a0'], ['wlp', 'WLP', '#f2c45a']];
	let prev = null;
	const abilities = tier >= 3
		? foeActionRows(actor).map((m) => {
				const head = m.group !== prev ? m.group : '';
				prev = m.group;
				return { head, label: m.label, meta: m.meta, help: m.help };
			})
		: [];
	const tags = tier >= 1 ? [info.rankLabel, info.species].filter(Boolean) : ['Unknown'];
	return {
		list,
		detail: {
			uuid: entry.uuid,
			name: entry.name,
			img: entry.img ?? actor.img,
			villain: tier >= 1 && info.villain ? info.villain.toUpperCase() : '',
			tags,
			tier,
			level: info.level,
			pct: list.find((x) => x.uuid === entry.uuid)?.pct ?? 0,
			studyLine: `${TIER_WORD[partyTier]}${Number(entry.study) ? ` · ${entry.study}` : ''}`,
			tierText: TIER_TEXT[partyTier],
			gmNote: gm ? `You see everything. Players see: ${TIER_WORD[partyTier].toLowerCase()}.` : '',
			hp: r.hp,
			hpMax: r.hpMax,
			hpPct: Math.round((r.hp / Math.max(1, r.hpMax)) * 100),
			crisis: r.crisis,
			mp: r.mp,
			mpMax: r.mpMax,
			mpPct: Math.round((r.mp / Math.max(1, r.mpMax)) * 100),
			attrs: ATTR.map(([k, abbr, color]) => ({ abbr, color, die: at[k]?.current ?? at[k]?.base ?? '?' })),
			def: info.def ?? '?',
			mdef: info.mdef ?? '?',
			traits: info.traits,
			aff: AFFINITY_TYPES.map(([k, abbr, color]) => {
				const known = tier >= 2 || !!revealed[k];
				const word = known ? aff[k] : '?';
				return { abbr, color, word, wordColor: AFF_COLOR[word] ?? '#eef3ff', tip: `${k[0].toUpperCase()}${k.slice(1)}: ${known ? AFF_NAME[word] : 'not known yet'}` };
			}),
			abilities,
			canOpen: actor.isOwner,
		},
	};
}

export function companionCard(entry) {
	const actor = entry.actor;
	const r = actor.system?.resources ?? {};
	const num = (v, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);
	const hpMax = Math.max(1, num(r.hp?.max, 1));
	const mpMax = Math.max(1, num(r.mp?.max, 1));
	const crisis = num(r.hp?.crisisScore, Math.floor(hpMax / 2));
	return {
		uuid: actor.uuid,
		name: actor.name,
		img: actor.img,
		imgVideo: isVideo(actor.img),
		identity: entry.identity ?? '',
		level: num(actor.system?.level?.value, 5),
		token: tokenArt(actor),
		hp: { value: num(r.hp?.value), max: hpMax, pct: Math.max(0, Math.min(100, (num(r.hp?.value) / hpMax) * 100)), inCrisis: num(r.hp?.value) <= crisis, crisisPct: (crisis / hpMax) * 100 },
		mp: { value: num(r.mp?.value), max: mpMax, pct: Math.max(0, Math.min(100, (num(r.mp?.value) / mpMax) * 100)) },
	};
}

/** @param {typeof foundry.applications.api.ApplicationV2} Base Project FU's party sheet */
export function registerBattlePartySheet(Base) {
	if (!Base) {
		console.warn(`${MODULE_ID} | Project FU party sheet not found, Battle UI party sheet not registered`);
		return null;
	}

	// keep the system's part order; swap in our header, tab bar and roster
	const parts = {};
	for (const [id, cfg] of Object.entries(Base.PARTS ?? {})) parts[id] = cfg;
	parts.widgets = { template: T('header') };
	parts.tabs = { template: T('tabs') };
	parts.overview = { template: T('roster'), scrollable: [''] };
	parts.character = { template: T('inspect'), scrollable: [''] };
	if (parts.adversaries) parts.adversaries = { template: T('adversaries'), scrollable: ['.entry-list', '.fbp-adv-main'] };

	class FUBattlePartySheet extends Base {
		static DEFAULT_OPTIONS = {
			classes: ['fbui-sheet', 'fbui-party'],
			position: { width: 1000, height: 900 },
			window: { icon: 'fa-solid fa-people-group' },
			actions: {
				async fbuiLevelUp(event, target) {
					const actor = await fromUuid(target.dataset.actor);
					if (actor) return openLevelUp(actor, { sheet: actor.sheet });
				},
				/** pick an adversary to read about */
				fbuiAdversary(event, target) {
					this._fbAdvSel = target.dataset.uuid;
					return this.render({ parts: ['adversaries'] });
				},
				async fbuiOpenActor(event, target) {
					const actor = await fromUuid(target.dataset.uuid);
					actor?.sheet?.render(true);
				},
				fbuiEditImage() {
					if (!this.isEditable) return;
					const FP = foundry.applications.apps.FilePicker.implementation ?? foundry.applications.apps.FilePicker;
					return new FP({ type: 'image', current: this.actor.img, callback: (path) => this.actor.update({ img: path }) }).browse();
				},
			},
		};

		static PARTS = parts;

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			const characters = (context.characters ?? []).map((c) => {
				try {
					return cardFor(c);
				} catch (err) {
					console.warn(`${MODULE_ID} | party card`, err);
					return null;
				}
			});
			context.fbp = {
				characters: characters.filter(Boolean),
				companions: (context.companions ?? []).map(companionCard),
				fbEditable: this.isEditable,
			};
			return context;
		}

		/** Undo "Party,Party,Party": names the duplicate name field repeated before this was fixed */
		#repairName() {
			if (this.#repaired || !this.actor.isOwner) return;
			this.#repaired = true;
			const name = String(this.actor.name ?? '');
			const parts = name.split(',');
			if (parts.length > 1 && parts.every((p) => p === parts[0]) && parts[0].trim()) {
				console.log(`${MODULE_ID} | repairing party name "${name}" -> "${parts[0]}"`);
				this.actor.update({ name: parts[0] });
			}
		}

		#repaired = false;

		async _preparePartContext(partId, context, options) {
			context = await super._preparePartContext(partId, context, options);
			if (partId === 'adversaries') {
				const list = context.adversaries ?? [];
				if (!list.some((a) => a.uuid === this._fbAdvSel)) this._fbAdvSel = list[0]?.uuid ?? null;
				try {
					context.fba = adversaryData(list, this._fbAdvSel);
				} catch (err) {
					console.warn(`${MODULE_ID} | adversaries`, err);
					context.fba = { list: [], detail: null };
				}
			}
			if (partId === 'character') {
				const actor = this.inspectedCharacter?.actor ?? context.character?.actor ?? null;
				const members = (context.characters ?? []).map((c) => c.actor).filter(Boolean);
				try {
					context.fbi = actor ? inspectData(actor, members) : null;
				} catch (err) {
					console.warn(`${MODULE_ID} | inspect`, err);
					context.fbi = null;
				}
			}
			return context;
		}

		#untheme() {
			// the system's party themes lay the window out as a grid; this sheet stacks instead
			const wc = this.element?.querySelector('.window-content');
			if (!wc) return;
			[...wc.classList].filter((c) => c.startsWith('theme-')).forEach((c) => wc.classList.remove(c));
		}

		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			this.#untheme();
			const root = this.element;
			let hovered = null;
			root.addEventListener('mouseover', (ev) => {
				const hit = ev.target.closest?.(HOVER);
				if (hit === hovered) return;
				hovered = hit;
				if (hit && root.contains(hit)) sfx('cursor', { sheet: true });
			});
			root.addEventListener(
				'click',
				(ev) => {
					const btn = ev.target.closest?.('[data-action]');
					if (!btn || !root.contains(btn) || btn.closest('.window-header')) return;
					if (btn.matches('input, select, textarea')) return;
					const a = btn.dataset.action;
					const cue = a in CUE ? CUE[a] : /delete|remove|clear/i.test(a) ? 'back' : 'confirm';
					if (cue) sfx(cue, { sheet: true });
				},
				true,
			);
			sfx('confirm', { sheet: true });
		}

		async _onClose(options) {
			sfx('back', { sheet: true });
			return super._onClose(options);
		}

		async _onRender(context, options) {
			await super._onRender(context, options);
			this.#untheme();
			this.#repairName();
			// the header's name box saves on its own (it is not a form field, see header.hbs)
			const nameBox = this.element.querySelector('input[data-fbui-name]');
			if (nameBox && !nameBox.dataset.wired) {
				nameBox.dataset.wired = '1';
				nameBox.addEventListener('keydown', (ev) => {
					if (ev.key === 'Enter') {
						ev.preventDefault();
						nameBox.blur();
					}
				});
				nameBox.addEventListener('change', (ev) => {
					ev.stopPropagation();
					const name = nameBox.value.trim();
					if (name && name !== this.actor.name && this.isEditable) this.actor.update({ name });
					else nameBox.value = this.actor.name;
				});
			}
			// Big art is the actor's portrait, the emblem is its token. Small (pixel) art is shown whole and crisp.
			this.element.querySelectorAll('.fbp-card .pt img, .fbp-card .emb img, .fbi-por > img').forEach((img) => {
				const mark = () => {
					const small = img.naturalWidth && img.naturalWidth <= 256 && img.naturalHeight <= 256;
					img.parentElement.classList.toggle('px', !!small);
				};
				if (img.complete) mark();
				else img.addEventListener('load', mark, { once: true });
			});
		}
	}

	foundry.documents.collections.Actors.registerSheet(MODULE_ID, FUBattlePartySheet, {
		types: ['party'],
		makeDefault: setting('partySheetDefault') === true,
		label: 'Battle UI Party Sheet',
	});
	return FUBattlePartySheet;
}
