import { AFFINITY_TYPES, AFF_ABBR, MODULE_ID, STATUS_CHIPS, cap, setting, tintFor } from './util.mjs';

export const FRIENDLY = 'friendly';
export const HOSTILE = 'hostile';

/* ------------------------------------------------------------------ */
/*  Actor data                                                         */
/* ------------------------------------------------------------------ */

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function resources(actor) {
	const r = actor?.system?.resources ?? {};
	const hp = num(r.hp?.value);
	const hpMax = Math.max(1, num(r.hp?.max, hp || 1));
	return {
		hp,
		hpMax,
		mp: num(r.mp?.value),
		mpMax: Math.max(0, num(r.mp?.max)),
		ip: r.ip ? num(r.ip.value) : null,
		ipMax: r.ip ? num(r.ip.max) : null,
		fp: num(r.fp?.value),
		crisis: hp <= Math.floor(hpMax / 2),
	};
}

export function statusList(actor) {
	const out = [];
	const set = actor?.statuses instanceof Set ? actor.statuses : new Set();
	for (const id of set) if (STATUS_CHIPS[id]) out.push(id);
	return out;
}

export function classLine(actor) {
	if (actor?.type !== 'character') return '';
	// Project FU derives a class's level from the skills taken in it (system.tlTracker)
	const lvl = (i) => num(actor.system?.tlTracker?.getClassLevel?.(i) ?? i.system?.level?.value);
	const classes = (actor.items?.contents ?? [...(actor.items ?? [])])
		.filter((i) => i.type === 'class')
		.map((i) => [i.name, lvl(i)])
		.sort((a, b) => b[1] - a[1])
		.map(([n, l]) => `${n} ${l}`);
	return classes.join(' · ') || `Level ${num(actor.system?.level?.value)}`;
}

export function zeroPower(actor) {
	const items = actor?.items?.contents ?? [...(actor?.items ?? [])];
	const z = items.find((i) => i.type === 'optionalFeature' && i.system?.optionalType === 'projectfu.zeroPower');
	const p = z?.system?.data?.progress;
	if (!z || !p) return null;
	return { name: z.name, current: num(p.current), max: Math.max(1, num(p.max, 6)), item: z };
}

export function npcInfo(actor) {
	const s = actor?.system ?? {};
	const rank = s.rank?.value ?? 'soldier';
	const replaced = num(s.rank?.replacedSoldiers, 1);
	const rankLabel = rank === 'champion' ? `Champion ${replaced}` : cap(rank);
	return {
		level: num(s.level?.value),
		rank,
		rankLabel,
		species: cap(s.species?.value ?? ''),
		villain: s.villain?.value || '',
		ultima: num(s.resources?.fp?.value),
		ultimaMax: { minor: 5, major: 10, supreme: 15 }[s.villain?.value] ?? 0,
		traits: s.traits?.value ?? '',
		def: s.derived?.def?.value,
		mdef: s.derived?.mdef?.value,
	};
}

export function affinities(actor) {
	const all = actor?.system?.affinities ?? {};
	const out = {};
	for (const [k] of AFFINITY_TYPES) {
		const a = all[k];
		const v = a?.current ?? a?.base ?? 0;
		out[k] = AFF_ABBR[v] ?? '·';
	}
	return out;
}

/* ------------------------------------------------------------------ */
/*  What a condition does                                              */
/* ------------------------------------------------------------------ */

/** For statuses Project FU gives no rules text, said from what the status changes in its own data */
const CONDITION_FALLBACK = {
	aura: 'Magic Defense is at least 12 (13 from level 20, 14 from level 40).',
	barrier: 'Defense is at least 12 (13 from level 20, 14 from level 40).',
	ko: 'Knocked out: 0 Hit Points.',
};

const DURATION_TEXT = {
	rest: 'Lasts until you rest, unless something cures it.',
	endOfScene: 'Lasts until the end of the scene.',
	startOfTurn: 'Lasts until the start of your next turn.',
	endOfTurn: 'Lasts until the end of your turn.',
	endOfRound: 'Lasts until the end of the round.',
};

/**
 * A condition's name, what it does and how long it lasts, from Project FU's status definitions (localized).
 * @param {string} id e.g. 'dazed'
 * @returns {{id:string, name:string, text:string, duration:string}|null}
 */
export function conditionInfo(id) {
	const def = (CONFIG?.statusEffects ?? []).find((e) => e.id === id);
	if (!def && !STATUS_CHIPS[id]) return null;
	const loc = (k) => (k ? game.i18n.localize(k) : '');
	const name = loc(def?.name) || STATUS_CHIPS[id]?.[0] || cap(id);
	let text = '';
	if (def?.description) {
		const t = loc(def.description);
		if (t && t !== def.description) text = fullText(t).replace(/\n+/g, ' ');
	}
	text ||= CONDITION_FALLBACK[id] ?? '';
	if (text && /die size/i.test(text)) text += ' Dice never go below d6.';
	const duration = DURATION_TEXT[def?.system?.duration?.event] ?? '';
	return { id, name, text, duration };
}

/** One line for a plain-text tooltip: "Dazed: Reduce Insight die size by 1. Lasts until you rest." */
export function conditionTip(id) {
	const c = conditionInfo(id);
	if (!c) return '';
	return [`${c.name}:`, c.text || 'No rules text.', c.duration].filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/*  Study / reveal                                                     */
/* ------------------------------------------------------------------ */

export const actorKey = (actor) => (actor?.resolveUuid?.() ?? actor?.uuid ?? '').replace(/\./g, '_');

function partyEntry(actor) {
	try {
		const id = game.settings.get('projectfu', 'activeParty');
		if (!id) return null;
		const party = fromUuidSync(`Actor.${id}`);
		const uuid = actor.resolveUuid?.() ?? actor.uuid;
		return party?.system?.adversaries?.find?.((a) => a.uuid === uuid) ?? null;
	} catch {
		return null;
	}
}

const TIER_OF = { none: 0, basic: 1, complete: 2, detailed: 3 };

/**
 * 0 nothing, 1 basic (level, rank, species, HP/MP), 2 complete (+traits, attributes, defenses, affinities), 3 detailed (+attacks and spells)
 * @param {boolean} asPlayer GM previewing the player view
 */
export function knowledge(actor, combat, asPlayer = false) {
	const full = { tier: 3, aff: null, full: true };
	if (!actor || actor.type === 'character') return full;
	if (!setting('hideUnstudied')) return full;
	if (!asPlayer && (game.user.isGM || actor.isOwner)) return full;
	const entry = partyEntry(actor);
	let tier = 0;
	if (entry && typeof entry.study === 'number') {
		const handler = globalThis.projectfu?.StudyRollHandler;
		const res = handler?.resolveStudyResult?.(entry.study);
		tier = TIER_OF[res] ?? 0;
	}
	const flag = combat?.getFlag?.(MODULE_ID, `reveal.${actorKey(actor)}`) ?? {};
	tier = Math.max(tier, num(flag.tier));
	const aff = { ...(entry?.revealed?.affinities ?? {}), ...(flag.aff ?? {}) };
	return { tier, aff, full: false };
}

/* ------------------------------------------------------------------ */
/*  Turn structure                                                     */
/* ------------------------------------------------------------------ */

export function combatantsOf(combat) {
	return combat?.combatants?.contents ?? [...(combat?.combatants ?? [])];
}

export function seenBy(c, asPlayer) {
	if (!c) return false;
	if (game.user.isGM && !asPlayer) return true;
	return !c.hidden;
}

/**
 * Builds the turn track: past turns, the current one, then a forecast that alternates sides
 * as long as both have turns left (the larger side finishes the round).
 */
export function buildTrack(combat, asPlayer = false) {
	const combatants = combatantsOf(combat);
	const taken = (combat.currentRoundTurnsTaken ?? []).map((id) => combat.combatants.get(id)).filter(Boolean);
	const left = combat.countTurnsLeft?.() ?? {};
	const skip = !!combat.settings?.skipDefeated;
	let remF = 0;
	let remH = 0;
	for (const c of combatants) {
		if (skip && c.isDefeated) continue;
		if (!seenBy(c, asPlayer)) continue;
		const n = Math.max(0, num(left[c.id]));
		if (c.faction === FRIENDLY) remF += n;
		else remH += n;
	}
	const active = combat.combatant ?? null;
	const slots = taken.map((c) => ({ state: 'done', faction: c.faction, combatant: seenBy(c, asPlayer) ? c : null }));
	let current = active?.faction ?? combat.getCurrentTurn?.() ?? combat.determineNextTurn?.() ?? FRIENDLY;
	if (current === FRIENDLY && remF === 0 && remH > 0) current = HOSTILE;
	if (current === HOSTILE && remH === 0 && remF > 0) current = FRIENDLY;
	if (remF + remH > 0) {
		slots.push({ state: 'now', faction: current, combatant: active && seenBy(active, asPlayer) ? active : null });
		if (current === FRIENDLY) remF--;
		else remH--;
	}
	let last = current;
	while (remF + remH > 0) {
		const want = last === FRIENDLY ? HOSTILE : FRIENDLY;
		const has = want === FRIENDLY ? remF > 0 : remH > 0;
		const f = has ? want : last;
		if (f === FRIENDLY) remF--;
		else remH--;
		slots.push({ state: 'next', faction: f, combatant: null });
		last = f;
	}
	return slots;
}

/** Slice the track around "now" so long fights still fit */
export function windowSlots(slots, size = 10) {
	if (slots.length <= size) return slots;
	const now = Math.max(0, slots.findIndex((s) => s.state === 'now'));
	const start = Math.max(0, Math.min(now - 2, slots.length - size));
	return slots.slice(start, start + size);
}

/**
 * @returns {'none'|'prestart'|'pick'|'command'|'foe-pick'|'foe-act'|'end'}
 */
export function phaseOf(combat) {
	if (!combat) return 'none';
	if (!combat.started) return 'prestart';
	const active = combat.combatant;
	if (active) return active.faction === FRIENDLY ? 'command' : 'foe-act';
	const left = combat.countTurnsLeft?.() ?? {};
	const any = combatantsOf(combat).some((c) => num(left[c.id]) > 0 && !(combat.settings?.skipDefeated && c.isDefeated));
	if (!any) return 'end';
	const f = combat.getCurrentTurn?.() ?? combat.determineNextTurn?.();
	return f === HOSTILE ? 'foe-pick' : 'pick';
}

export function turnsUsed(combat, c) {
	return (combat.currentRoundTurnsTaken ?? []).filter((id) => id === c.id).length;
}

/** The hostile combatant who took the most recent enemy turn, for the "never twice in a row" reminder */
export function lastFoeId(combat) {
	const ids = combat.currentRoundTurnsTaken ?? [];
	for (let i = ids.length - 1; i >= 0; i--) {
		const c = combat.combatants.get(ids[i]);
		if (c?.faction === HOSTILE) return c.id;
	}
	return null;
}

export function portrait(c) {
	const actor = c?.actor;
	// Character art first; the token image only when the actor has no art of its own
	const isGeneric = (src) => !src || /mystery-man|icons\/svg/.test(src);
	const img = [actor?.img, c?.img, c?.token?.texture?.src].find((src) => !isGeneric(src)) ?? '';
	return { img, tint: tintFor(actor?.id ?? c?.id) };
}

/* ------------------------------------------------------------------ */
/*  Item lists for the command menu                                    */
/* ------------------------------------------------------------------ */

const itemsOf = (actor) => actor?.items?.contents ?? [...(actor?.items ?? [])];

/* ---------------------- inline tags as words ---------------------- */

const RESOURCE_WORD = { hp: 'HP', mp: 'MP', ip: 'IP', fp: 'FP', exp: 'EXP', zenit: 'Zenit', up: 'UP' };
const ICON_WORD = { offensive: 'offensive', martial: 'martial' };

/** "HR+10", "5*$sl", "max(5, ...)" as a person would write them */
function amountText(a) {
	return String(a ?? '')
		.replace(/&amp;/g, '&')
		.replace(/&cs\(['"]?([\w-]+)['"]?\)/g, (m, id) => id.replace(/-/g, ' '))
		.replace(/\$sl\b/gi, 'SL')
		.replace(/\$chk\b/gi, 'Check')
		.replace(/\$mbs\b/gi, 'Bond')
		.replace(/\$\w+/g, (m) => m.slice(1))
		.replace(/@[\w.]+/g, (m) => m.split('.').pop())
		.replace(/\s*\*\s*/g, ' × ')
		.replace(/\s*\+\s*/g, ' + ')
		.replace(/(\S)-(\d)/g, '$1 − $2')
		.replace(/\s+/g, ' ')
		.trim();
}

function localizeType(type) {
	const key = CONFIG?.FU?.damageTypes?.[type];
	const word = key ? game?.i18n?.localize?.(key) : '';
	return (word && word !== key ? word : type).toLowerCase();
}

function statusName(id) {
	const s = (CONFIG?.statusEffects ?? []).find((e) => e.id === id);
	if (s) {
		const n = game?.i18n?.localize?.(s.name ?? s.label ?? '') ?? '';
		if (n) return n.toLowerCase();
	}
	if (/^[a-z-]+$/.test(id)) return id.replace(/-/g, ' ');
	try {
		const doc = fromUuidSync?.(id);
		if (doc?.name) return doc.name;
	} catch {
		/* not a uuid */
	}
	return 'an effect';
}

/**
 * Project FU's inline tags (@DMG[HR+10 fire], @EFFECT[dazed], @GAIN[5 hp], @UUID[...]{Name}...) as plain words,
 * so "deals @DMG[HR+10 fire] damage" reads "deals HR + 10 fire damage" instead of "deals damage".
 */
export function inlineText(kind, body, label) {
	if (label) return label;
	const k = String(kind).toUpperCase();
	const words = String(body ?? '')
		.replace(/\|[^|]*\|/g, ' ')
		.replace(/\s+\w+:\S+/g, ' ')
		.trim();
	const split = () => {
		const m = words.match(/^(.*\S)\s+(\w+)$/);
		return m ? [m[1], m[2].toLowerCase()] : [words, ''];
	};
	switch (k) {
		case 'DMG': {
			const [a, t] = split();
			return [amountText(a), t ? localizeType(t) : ''].filter(Boolean).join(' ');
		}
		case 'HEAL':
		case 'GAIN':
		case 'LOSS': {
			const [a, t] = split();
			return [amountText(a), RESOURCE_WORD[t] ?? t.toUpperCase()].filter(Boolean).join(' ');
		}
		case 'EFFECT':
			return statusName(words.split(/\s+/)[0] ?? '');
		case 'TYPE': {
			const [type, ...args] = words.split(/\s+/);
			const rest = args.filter((w) => w !== 'all').join(' ');
			return type === 'damage' ? rest : rest || type;
		}
		case 'WEAPON':
			return words.split(/\s+/).join(', ');
		case 'ICON':
		case 'TOOLTIP': {
			const m = String(body ?? '').match(/^(\w+)(?:\s+"([^"]*)")?/);
			return m?.[2] ?? ICON_WORD[m?.[1]] ?? '';
		}
		case 'UUID': {
			try {
				return fromUuidSync?.(words)?.name ?? '';
			} catch {
				return '';
			}
		}
		case 'CHECK': {
			const parts = words.split(/\s+/);
			const attrs = parts.filter((p) => /^(dex|ins|mig|wlp)$/i.test(p)).map((p) => p.toUpperCase());
			const dl = parts.find((p) => /^\d+$/.test(p));
			return [attrs.length ? `【${attrs.join(' + ')}】` : 'a Check', dl ? `(DL ${dl})` : ''].filter(Boolean).join(' ');
		}
		case 'COMPENDIUM': {
			const m = String(body ?? '').match(/"([^"]*)"/);
			return m?.[1] ?? '';
		}
		case 'CODEX':
			return words;
		case 'ACTION':
			return cap(words.split(/\s+/)[0] ?? '');
	}
	return '';
}

const INLINE = /@(\w+)\[([^\]]*)\](?:\{([^}]*)\})?/g;
const inlineWords = (s) => String(s).replace(INLINE, (m, kind, body, label) => inlineText(kind, body, label));

export function stripHtml(html, max = 260) {
	const t = inlineWords(
		String(html ?? '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/&nbsp;/g, ' '),
	)
		.replace(/\s+/g, ' ')
		.trim();
	return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** Rules text with its paragraph breaks kept and nothing cut short */
export function fullText(html) {
	return inlineWords(
		String(html ?? '')
			.replace(/<\/(p|li|tr|h[1-6]|div|blockquote)>|<br\s*\/?>|<hr\s*\/?>/gi, '\n')
			.replace(/<\/t[dh]>/gi, '  ')
			.replace(/<[^>]+>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#0?39;/g, "'"),
	)
		.replace(/&amp;/g, '&')
		.replace(/\(\s*\)/g, '')
		.split('\n')
		.map((l) => l.replace(/[ \t]+/g, ' ').trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** What an item does: its summary and its full description, whichever say more */
export function itemHelp(item) {
	const sum = fullText(item?.system?.summary?.value);
	const desc = fullText(item?.system?.description);
	const flat = (t) => t.replace(/\s+/g, ' ').toLowerCase();
	if (sum && desc) {
		if (flat(desc).includes(flat(sum))) return desc;
		if (flat(sum).includes(flat(desc))) return sum;
		return `${sum}\n\n${desc}`;
	}
	return sum || desc || item?.name || '';
}

export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** One-line rules summary: 【DEX + INS】 +1 · HR +5 fire, MP costs, DEF / M.DEF... */
export function itemLine(item) {
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

export function spellRows(actor) {
	const res = resources(actor);
	return itemsOf(actor)
		.filter((i) => i.type === 'spell')
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((i) => {
			const cost = i.system?.cost ?? {};
			const amount = num(cost.amount, num(i.system?.mpCost?.value));
			const resource = cost.resource ?? 'mp';
			const perT = !!cost.perTarget;
			const have = resource === 'hp' ? res.hp : resource === 'ip' ? res.ip ?? 0 : res.mp;
			return {
				id: i.id,
				label: i.name,
				meta: amount ? `${amount}${perT ? ' × T' : ''} ${resource.toUpperCase()}` : '',
				disabled: amount > 0 && have < amount,
				help: itemHelp(i),
			};
		});
}

const SKILL_TYPES = ['skill', 'heroic', 'miscAbility', 'classFeature', 'optionalFeature'];

export function skillRows(actor) {
	return itemsOf(actor)
		.filter((i) => SKILL_TYPES.includes(i.type))
		.filter((i) => i.type !== 'skill' || num(i.system?.level?.value) > 0)
		.sort((a, b) => SKILL_TYPES.indexOf(a.type) - SKILL_TYPES.indexOf(b.type) || a.name.localeCompare(b.name))
		.map((i) => {
			let meta = '';
			if (i.type === 'skill') meta = `SL ${num(i.system?.level?.value)}`;
			else if (i.type === 'heroic') meta = 'heroic';
			else if (i.type === 'classFeature') meta = String(i.system?.featureType ?? '').replace(/^projectfu\./, '');
			else if (i.type === 'optionalFeature') meta = String(i.system?.optionalType ?? '').replace(/^projectfu\./, '').replace(/([A-Z])/g, ' $1').toLowerCase();
			return { id: i.id, label: i.name, meta, disabled: false, help: itemHelp(i) };
		});
}

export function inventoryRows(actor) {
	const res = resources(actor);
	return itemsOf(actor)
		.filter((i) => i.type === 'consumable')
		.sort((a, b) => num(a.system?.ipCost?.value) - num(b.system?.ipCost?.value) || a.name.localeCompare(b.name))
		.map((i) => {
			const cost = num(i.system?.ipCost?.value);
			return { id: i.id, label: i.name, meta: `${cost} IP`, disabled: res.ip != null && cost > res.ip, help: itemHelp(i) };
		});
}

/** What each kind of NPC entry is called in the battle menus, in the order they are listed */
const FOE_GROUPS = [
	['basic', 'attack', 'Attacks'],
	['weapon', 'weapon', 'Attacks'],
	['customWeapon', 'weapon', 'Attacks'],
	['spell', 'spell', 'Spells'],
	['miscAbility', 'skill', 'Skills'],
	['skill', 'skill', 'Skills'],
	['rule', 'rule', 'Special rules'],
];
const FOE_ORDER = FOE_GROUPS.map(([t]) => t);

/** An NPC's attacks, spells, skills and special rules, the same entries its Battle UI sheet lists */
function foeEntries(actor) {
	const eq = actor?.system?.equipped ?? {};
	const equippedIds = new Set(Object.values(eq).filter(Boolean));
	return itemsOf(actor)
		.filter((i) => FOE_ORDER.includes(i.type))
		.filter((i) => !['weapon', 'customWeapon'].includes(i.type) || equippedIds.has(i.id))
		.sort((a, b) => FOE_ORDER.indexOf(a.type) - FOE_ORDER.indexOf(b.type) || (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
}

function foeRow(i) {
	const [, word, group] = FOE_GROUPS.find(([t]) => t === i.type) ?? [i.type, '', ''];
	let meta = word;
	if (i.type === 'spell') {
		const amount = num(i.system?.cost?.amount, num(i.system?.mpCost?.value));
		meta = amount ? `${amount}${i.system?.cost?.perTarget ? ' × T' : ''} MP` : 'spell';
	}
	const line = ['basic', 'weapon', 'customWeapon', 'spell'].includes(i.type) ? itemLine(i) : '';
	const help = itemHelp(i);
	return { id: i.id, label: i.name, meta, group, disabled: false, help: line && !help.includes(line) ? `${line}\n\n${help}` : help, img: armoryImg(i) };
}

export function foeActionRows(actor) {
	return foeEntries(actor).map(foeRow);
}

/* ------------------------------------------------------------------ */
/*  Equipment icons                                                    */
/* ------------------------------------------------------------------ */

/** Equipped hands, armor and accessory with their icons, for party cards and the Attack command */
export function equippedGear(actor) {
	const eq = actor?.system?.equipped ?? {};
	const seen = new Set();
	const out = [];
	for (const slot of ['mainHand', 'offHand', 'armor', 'accessory']) {
		const id = eq[slot];
		if (!id || seen.has(id)) continue;
		seen.add(id);
		const item = actor.items?.get?.(id);
		if (item?.img) out.push({ slot, id: item.id, name: item.name, img: item.img, type: item.type });
	}
	return out;
}

/** Menus show no item art in this build */
export const armoryImg = () => '';
