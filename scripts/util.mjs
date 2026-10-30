export const MODULE_ID = 'fu-battle-ui';
export const SOCKET = `module.${MODULE_ID}`;

export const COLORS = {
	gold: '#f2c45a',
	hero: '#5aa9ff',
	foe: '#ff6b7a',
	foeText: '#ff8d99',
	crisis: '#ff9a6b',
};

export const CLOCK_KINDS = {
	threat: { label: 'threat', color: '#ff6b7a' },
	goal: { label: 'heroes’ goal', color: '#5aa9ff' },
	env: { label: 'scene', color: '#f2c45a' },
};

export const AFFINITY_TYPES = [
	['physical', 'PHY', '#d6dae6'],
	['air', 'AIR', '#9ff0c9'],
	['bolt', 'BLT', '#ffe46b'],
	['dark', 'DRK', '#b99bff'],
	['earth', 'ERT', '#dcae74'],
	['fire', 'FIR', '#ff9666'],
	['ice', 'ICE', '#92d8ff'],
	['light', 'LGT', '#fff4b8'],
	['poison', 'PSN', '#d79af0'],
];

/** affinity numeric value -> short label */
export const AFF_ABBR = { '-1': 'VU', 0: '·', 1: 'RS', 2: 'IM', 3: 'AB' };
export const AFF_COLOR = { VU: '#6fe3a0', RS: '#aab3cc', IM: '#ff8d99', AB: '#ff6fb0', '·': 'rgba(238,243,255,.45)', '?': 'rgba(238,243,255,.35)' };
export const AFF_WORD = { vulnerability: 'VULNERABLE', resistance: 'RESISTED', immunity: 'IMMUNE', absorption: 'ABSORBED' };

export const STATUS_CHIPS = {
	dazed: ['Dazed', '#f2c45a'],
	shaken: ['Shaken', '#c7a6ff'],
	slow: ['Slow', '#7cb8ff'],
	weak: ['Weak', '#ff9a6b'],
	enraged: ['Enraged', '#ff6b7a'],
	poisoned: ['Poisoned', '#8ee6b8'],
	guard: ['Guard', '#9fd0ff'],
	provoked: ['Provoked', '#ff8d99'],
	flying: ['Flying', '#9ff0c9'],
	cover: ['Cover', '#aab3cc'],
	aura: ['Aura', '#fff4b8'],
	barrier: ['Barrier', '#92d8ff'],
	focus: ['Focus', '#f2c45a'],
	'dex-up': ['DEX ↑', '#6fe3a0'],
	'ins-up': ['INS ↑', '#6fe3a0'],
	'mig-up': ['MIG ↑', '#6fe3a0'],
	'wlp-up': ['WLP ↑', '#6fe3a0'],
	'dex-down': ['DEX ↓', '#ff9a6b'],
	'ins-down': ['INS ↓', '#ff9a6b'],
	'mig-down': ['MIG ↓', '#ff9a6b'],
	'wlp-down': ['WLP ↓', '#ff9a6b'],
};

export const COMMANDS = [
	['attack', 'Attack', 'Strike with an equipped weapon. Accuracy Check against the target’s Defense.'],
	['spell', 'Spell', 'Cast a spell you know by paying its Mind Point cost.'],
	['skill', 'Skill', 'Use a Skill, Heroic Skill or class feature.'],
	['guard', 'Guard', 'Until your next turn: Resistance to all damage, +2 on Opposed Checks, and you may cover an ally from melee attacks.'],
	['hinder', 'Hinder', 'Check against Difficulty 10: on a success, the target suffers dazed, shaken, slow or weak.'],
	['inventory', 'Inventory', 'Spend Inventory Points to use an item right away.'],
	['study', 'Study', '(INS + INS) Open Check on the target. Each threshold reveals more: rank, Species and max HP and MP first, then Traits, Attributes, defenses and Affinities, then attacks and spells.'],
	['objective', 'Objective', 'Work toward a goal in the scene. Describe your approach, roll the Check the GM calls for, and fill (or erase) sections of a Clock on a success.'],
	['equipment', 'Equipment', 'Swap any equipped items except armor.'],
];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function initials(name) {
	const words = String(name ?? '?')
		.replace(/[^\p{L}\p{N} ]/gu, ' ')
		.split(/\s+/)
		.filter(Boolean);
	if (!words.length) return '?';
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return (words[0][0] + words[1][0]).toUpperCase();
}

export const cap = (s) => (s ? String(s)[0].toUpperCase() + String(s).slice(1) : '');
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const pct = (v, max) => (max > 0 ? clamp(Math.round((v / max) * 100), 0, 100) : 0);

/** Stable pastel color for an actor without art, from its id */
export function tintFor(id) {
	const palette = ['#e9c46a', '#9fd0ff', '#c7a6ff', '#8ee6b8', '#ffb38a', '#f4a6c6', '#a8e0ff', '#d9e58c'];
	let h = 0;
	for (const ch of String(id ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return palette[h % palette.length];
}

export function setting(key) {
	try {
		return game.settings.get(MODULE_ID, key);
	} catch {
		return undefined;
	}
}

export function randomId() {
	return foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 12);
}

/** True in the private build that ships the paid armory icons (module.json flags.bundledAssets) */
export const bundledAssets = () => !!game.modules?.get?.(MODULE_ID)?.flags?.bundledAssets;
