import { ARMORY_INDEX } from './armory-index.mjs';
import { MODULE_ID, setting } from './util.mjs';

/**
 * Armory icons: picks a pixel-art icon for weapons, shields, armor and accessories from the
 * Premium Armory pack, based on what the item is (category, damage type, cost, name keywords).
 */

export const ARMORY_TYPES = ['weapon', 'customWeapon', 'shield', 'armor', 'accessory'];

/** Basic metals by price, cheapest first */
const COST_TIERS = [
	[100, 'Copper'],
	[250, 'Iron'],
	[500, 'Steel'],
	[1000, 'Silver'],
	[2000, 'Gold'],
	[Infinity, 'Altair'],
];

/** Element → metal. Nova has no weapons, so dark weapons use Fateful */
const ELEMENT_WEAPON = { fire: 'Crimson', ice: 'Cobalt', air: 'Platinum', bolt: 'Gold', earth: 'Copper', poison: 'Adamantine', light: 'Angelic', dark: 'Fateful' };
const ELEMENT_ARMOR = { ...ELEMENT_WEAPON, dark: 'Nova' };

/** Name keywords that force a metal (checked in order) */
const NAME_METALS = [
	[/\b(wood|wooden|oak|ash|bamboo|bone|training)\b/i, 'Wooden'],
	[/\b(bronze|copper|leather|hide|rusty|travel|silk|cloth|tunic|garb)\b/i, 'Copper'],
	[/\biron\b/i, 'Iron'],
	[/\bsteel\b/i, 'Steel'],
	[/\b(silver|moon|lunar)\b/i, 'Silver'],
	[/\b(gold|golden|sun|solar|royal)\b/i, 'Gold'],
	[/\b(mithril|platinum|wind|gale|storm)\b/i, 'Platinum'],
	[/\b(cobalt|frost|ice|icy|frozen|glacial|snow)\b/i, 'Cobalt'],
	[/\b(crimson|blood|flame|fire|burning|ember|inferno|magma)\b/i, 'Crimson'],
	[/\b(adamant|adamantine|venom|poison|jade|emerald)\b/i, 'Adamantine'],
	[/\b(angel|angelic|holy|sacred|divine|saint|seraph)\b/i, 'Angelic'],
	[/\b(fate|fateful|cursed|shadow|dark|abyss|void)\b/i, 'Fateful'],
	[/\b(runic|rune|onyx|obsidian|night)\b/i, 'Altair'],
];

/**
 * Weapon shapes by FU category. Numbers are the pack's weapon slots, which follow the same layout in every metal:
 * 1–20 and 22 swords, 21 dagger, 23 greatsword, 24–26 spears, 27–28 staves, 29–31 axes and hammers,
 * 32 whip, 33 pistol, 34 rifle, 35 bow, 36 crossbow. Wooden has its own 16 slots.
 */
const WEAPON_SLOTS = {
	sword: [...Array.from({ length: 20 }, (_, i) => i + 1), 22],
	dagger: [21],
	spear: [24, 25, 26],
	arcane: [27, 28],
	heavy: [29, 30, 31],
	flail: [32],
	firearm: [33, 34],
	bow: [35, 36],
	thrown: [21],
};
const WOODEN_SLOTS = {
	sword: [2, 3],
	dagger: [1],
	spear: [4, 5, 6],
	arcane: [7, 8],
	heavy: [9, 10, 11],
	flail: [12],
	thrown: [13],
	firearm: [14],
	bow: [15, 16],
};

/** Name keywords that pick a specific shape (checked before the category) */
const NAME_SHAPES = [
	[/crossbow|arbalest/i, { slots: [36], wood: [16] }],
	[/rifle|musket|carbine|long ?gun/i, { slots: [34], wood: [14] }],
	[/pistol|revolver|handgun|\bgun\b/i, { slots: [33], wood: [14] }],
	[/boomerang/i, { wood: [13], woodOnly: true }],
	[/\bbow\b|longbow|shortbow/i, { slots: [35], wood: [15] }],
	[/whip|chain|\blash\b/i, { slots: [32], wood: [12] }],
	[/hammer|maul|mallet/i, { slots: [31], wood: [11] }],
	[/great ?axe|battle ?axe|halberd/i, { slots: [30], wood: [10] }],
	[/\baxe\b|hatchet/i, { slots: [29], wood: [9] }],
	[/\bclub\b|mace\b|morning ?star|cudgel/i, { slots: [27], wood: [11] }],
	[/staff|\brod\b|\bwand\b|scepter|sceptre|\bcane\b/i, { slots: [27, 28], wood: [7, 8] }],
	[/trident|fork/i, { slots: [26], wood: [6] }],
	[/spear|lance|pike|javelin|glaive/i, { slots: [24, 25], wood: [4, 5] }],
	[/great ?sword|claymore|zweihander|broadsword|buster/i, { slots: [23], wood: [3] }],
	[/dagger|knife|dirk|stiletto|kunai|shuriken/i, { slots: [21], wood: [1] }],
];

/** Accessory name keywords → armor piece */
const ACCESSORY_PIECES = [
	[/\bhat\b|helm|crown|circlet|tiara|mask|hood\b|\bcap\b|headband|diadem|goggles/i, 'Helmet'],
	[/boot|shoe|greave|sandal|slipper|sabaton/i, 'Boots'],
	[/glove|gauntlet|bracer|bracelet|bangle|vambrace|mitt|wrist/i, 'Gloves'],
	[/belt|pants|leggings|trousers|skirt|sash|girdle/i, 'Leggings'],
];

/* ------------------------------------------------------------------ */

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
/** Fields are { value } objects on most items but plain values on custom weapons */
const val = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);

function hash(str) {
	let h = 2166136261;
	for (const ch of String(str ?? '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
	return h;
}

/** Stable pick from a list, so the same item name always gets the same icon */
function pickFrom(list, seed) {
	if (!list?.length) return null;
	return list[hash(seed) % list.length];
}

export function armoryRoot() {
	const p = String(setting('armoryPath') || `modules/${MODULE_ID}/icons/armory`).replace(/\/+$/, '');
	return p;
}

export function iconPath(material, kind, n) {
	return `${armoryRoot()}/${material}/${material}_${kind}${n}.png`;
}

export function isArmoryIcon(src) {
	return !!src && String(src).startsWith(armoryRoot() + '/');
}

/** Default and system art we are allowed to replace automatically */
export function isReplaceable(item) {
	const src = String(item?.img ?? item?._source?.img ?? '');
	if (!src) return true;
	if (/mystery-man|item-bag|icons\/svg\//.test(src)) return true;
	if (src.startsWith('systems/projectfu/')) return true;
	if (src.startsWith('icons/')) return true;
	if (isArmoryIcon(src)) return item?.getFlag?.(MODULE_ID, 'armory')?.manual !== true;
	return false;
}

function tierMetal(cost) {
	for (const [max, m] of COST_TIERS) if (cost <= max) return m;
	return 'Steel';
}

function nameMetal(name) {
	for (const [re, m] of NAME_METALS) if (re.test(name)) return m;
	return null;
}

function hasKind(material, kind) {
	return num(ARMORY_INDEX[material]?.[kind]) > 0;
}

/**
 * @returns {{material:string, kind:string, n:number, src:string}|null}
 */
export function suggestIcon(item) {
	if (!item) return null;
	const sys = item.system ?? {};
	const name = String(item.name ?? '');
	const cost = num(val(sys.cost), 100);
	const seed = `${item.type}:${name}`;

	if (item.type === 'weapon' || item.type === 'customWeapon') {
		const category = val(sys.category) ?? 'sword';
		const element = val(sys.damageType) ?? val(sys.damage?.type);
		let material = nameMetal(name) ?? ELEMENT_WEAPON[element] ?? tierMetal(cost);
		if (material === 'Nova') material = 'Fateful';
		if (category === 'brawling') {
			// Brawling weapons use the gauntlets from the armor half of the pack
			const m = hasKind(material, 'Gloves') ? material : 'Steel';
			const n = 1 + (hash(seed) % num(ARMORY_INDEX[m].Gloves, 1));
			return { material: m, kind: 'Gloves', n, src: iconPath(m, 'Gloves', n) };
		}
		const shape = NAME_SHAPES.find(([re]) => re.test(name))?.[1];
		const twoHanded = val(sys.hands) === 'two-handed';
		let slots = shape?.slots ?? (category === 'sword' && twoHanded ? [23] : WEAPON_SLOTS[category]) ?? WEAPON_SLOTS.sword;
		let wood = shape?.wood ?? WOODEN_SLOTS[category] ?? WOODEN_SLOTS.sword;
		// Some shapes only exist in wood (boomerang); cheap staves and bows look best wooden too
		if (shape?.woodOnly || (category === 'thrown' && /boomerang/i.test(name))) material = 'Wooden';
		if (!nameMetal(name) && !ELEMENT_WEAPON[element] && cost <= 100 && ['arcane', 'bow', 'thrown'].includes(category)) material = 'Wooden';
		if (material === 'Wooden') {
			const n = pickFrom(wood, seed);
			return { material, kind: 'Weapon', n, src: iconPath(material, 'Weapon', n) };
		}
		const n = pickFrom(slots, seed);
		return { material, kind: 'Weapon', n, src: iconPath(material, 'Weapon', n) };
	}

	if (item.type === 'shield') {
		let material = nameMetal(name) ?? tierMetal(cost);
		if (!hasKind(material, 'Shield')) material = 'Steel';
		const n = 1 + (hash(seed) % 4);
		return { material, kind: 'Shield', n, src: iconPath(material, 'Shield', n) };
	}

	if (item.type === 'armor') {
		let material = nameMetal(name);
		const martial = !!val(sys.isMartial);
		// Robes and other caster armor that favor Magic Defense take a mystic color
		const mdef = num(val(sys.mdef));
		const def = num(val(sys.def));
		if (!material && !martial && mdef > def) material = cost > 500 ? 'Angelic' : 'Nova';
		material ??= tierMetal(cost);
		if (material === 'Wooden') material = 'Copper';
		if (material === 'Fateful' && /dark|shadow|cursed|abyss|void|night/i.test(name)) material = 'Nova';
		const count = num(ARMORY_INDEX[material]?.Chestplate, 8);
		// Light pieces (shirts, mail, padding) first, heavy plate after
		const light = Array.from({ length: Math.min(5, count) }, (_, i) => i + 1);
		const heavy = Array.from({ length: Math.max(0, count - 5) }, (_, i) => i + 6);
		const n = pickFrom(martial && heavy.length ? heavy : light, seed);
		return { material, kind: 'Chestplate', n, src: iconPath(material, 'Chestplate', n) };
	}

	if (item.type === 'accessory') {
		const piece = ACCESSORY_PIECES.find(([re]) => re.test(name))?.[1];
		if (!piece) return null;
		let material = nameMetal(name) ?? tierMetal(cost);
		if (!hasKind(material, piece)) material = 'Steel';
		const n = 1 + (hash(seed) % num(ARMORY_INDEX[material][piece], 1));
		return { material, kind: piece, n, src: iconPath(material, piece, n) };
	}
	return null;
}

/* ------------------------------------------------------------------ */
/*  Applying                                                           */
/* ------------------------------------------------------------------ */

/** Update data for one item, or null when nothing should change */
export function armoryUpdate(item, { force = false } = {}) {
	if (!ARMORY_TYPES.includes(item?.type)) return null;
	if (!force && !isReplaceable(item)) return null;
	const pick = suggestIcon(item);
	if (!pick || pick.src === item.img) return null;
	return { _id: item.id, img: pick.src, [`flags.${MODULE_ID}.armory`]: { auto: true, manual: false } };
}

/** preCreateItem: give new weapons and armor an icon before they are saved */
export function onPreCreateItem(item, data) {
	if (setting('armoryAuto') === false) return;
	if (!ARMORY_TYPES.includes(item.type)) return;
	if (!isReplaceable(item)) return;
	const pick = suggestIcon(item);
	if (!pick) return;
	item.updateSource({ img: pick.src, [`flags.${MODULE_ID}.armory`]: { auto: true, manual: false } });
}

/** Re-pick icons on rename or recategorise, but only for icons we chose */
export function onPreUpdateItem(item, changes) {
	if (setting('armoryAuto') === false) return;
	if (!ARMORY_TYPES.includes(item.type)) return;
	if ('img' in changes) return;
	const flag = item.getFlag(MODULE_ID, 'armory');
	if (!flag?.auto || flag.manual) return;
	const touched = ['name', 'system.category', 'system.damageType', 'system.cost', 'system.isMartial', 'system.hands'].some((k) => foundry.utils.hasProperty(changes, k));
	if (!touched) return;
	const clone = item.clone(foundry.utils.mergeObject(item.toObject(), changes, { inplace: false }), { keepId: true });
	const pick = suggestIcon(clone);
	if (pick && pick.src !== item.img) changes.img = pick.src;
}

/**
 * GM tool: apply icons to every weapon, shield, armor and accessory in the world (items directory and actors).
 * @param {{overwrite?: boolean}} opts overwrite replaces custom art too
 */
export async function applyToWorld({ overwrite = false } = {}) {
	if (!game.user.isGM) return 0;
	let count = 0;
	const worldUpdates = game.items.contents.map((i) => armoryUpdate(i, { force: overwrite })).filter(Boolean);
	if (worldUpdates.length) await Item.updateDocuments(worldUpdates);
	count += worldUpdates.length;
	const actors = [...game.actors.contents];
	for (const scene of game.scenes.contents) for (const t of scene.tokens.contents) if (!t.actorLink && t.actor) actors.push(t.actor);
	for (const actor of actors) {
		const updates = actor.items.contents.map((i) => armoryUpdate(i, { force: overwrite })).filter(Boolean);
		if (updates.length) {
			await actor.updateEmbeddedDocuments('Item', updates);
			count += updates.length;
		}
	}
	return count;
}

export async function setIcon(item, src, { manual = true } = {}) {
	return item.update({ img: src, [`flags.${MODULE_ID}.armory`]: { auto: !manual, manual } });
}

export async function resetIcon(item) {
	const pick = suggestIcon(item);
	if (!pick) return ui.notifications.info(`No armory icon fits ${item.name}. Pick one by hand.`);
	return setIcon(item, pick.src, { manual: false });
}

/** Everything in the pack, for the picker */
export function catalog() {
	const out = [];
	for (const [material, kinds] of Object.entries(ARMORY_INDEX)) {
		for (const [kind, count] of Object.entries(kinds)) {
			for (let n = 1; n <= count; n++) out.push({ material, kind, n, src: iconPath(material, kind, n) });
		}
	}
	return out;
}

const ORDER = ['Wooden', 'Copper', 'Iron', 'Steel', 'Silver', 'Gold', 'Platinum', 'Cobalt', 'Crimson', 'Adamantine', 'Angelic', 'Fateful', 'Nova', 'Altair'];
export const MATERIALS = Object.keys(ARMORY_INDEX).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
export const KINDS = ['Weapon', 'Shield', 'Chestplate', 'Helmet', 'Gloves', 'Boots', 'Leggings'];

/** Which picker tab fits an item best */
export function kindFor(item) {
	const pick = suggestIcon(item);
	if (pick) return pick.kind;
	return { weapon: 'Weapon', customWeapon: 'Weapon', shield: 'Shield', armor: 'Chestplate', accessory: 'Helmet' }[item?.type] ?? 'Weapon';
}
