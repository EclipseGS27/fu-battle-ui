import { AFFINITY_TYPES, AFF_COLOR, AFF_WORD, CLOCK_KINDS, COLORS, COMMANDS, MODULE_ID, STATUS_CHIPS, clamp, esc, initials, pct, setting } from './util.mjs';
import { Clocks } from './clocks.mjs';
import { sfx } from './sfx.mjs';
import { alterStory, canInvoke, inventoryMenu, invoke, lastCheck, pullOut, ultimaEscape, ultimaRecovery, useConsumable } from './points.mjs';
import {
	FRIENDLY,
	HOSTILE,
	actorKey,
	affinities,
	buildTrack,
	classLine,
	combatantsOf,
	foeActionRows,
	inventoryRows,
	knowledge,
	lastFoeId,
	npcInfo,
	phaseOf,
	portrait,
	resources,
	seenBy,
	skillRows,
	spellRows,
	statusList,
	turnsUsed,
	windowSlots,
	zeroPower,
	equippedGear,
	armoryImg,
} from './model.mjs';

const SUBMENUS = ['spell', 'skill', 'inventory', 'objective'];
const TIER_TEXT = [
	'Not studied. Affinities appear when hit; Study reveals the rest.',
	'Studied (basic): rank, Species, level, HP and MP known.',
	'Studied (complete): Traits, Attributes, defenses and Affinities known.',
	'Studied (detailed): everything, including attacks and spells.',
];

export class BattleUI {
	constructor() {
		this.state = {
			open: false,
			mini: false,
			menu: 'root',
			hover: 'attack',
			objClock: null,
			target: null,
			asPlayer: false,
			lastActive: null,
			points: null,
			lastPhase: null,
			/** a pinned description: { key, html, scroll } */
			lock: null,
		};
		this.pending = [];
		this.hpCache = new Map();
		this.typedFloatAt = new Map();
		this.bannerQueue = [];
		this.bannerBusy = false;
		this.lastRound = new Map();
		this._timer = null;
	}

	/* ---------------------------------------------------------- */
	/*  Mounting and layout                                         */
	/* ---------------------------------------------------------- */

	mount() {
		if (this.root) return;
		const root = document.createElement('div');
		root.id = 'fbui';
		root.className = 'fbui';
		root.innerHTML = `<div class="fbui-stage"><div class="fbui-main"></div><div class="fbui-banners" aria-live="polite"></div><div class="fbui-floats" aria-hidden="true"></div></div>`;
		(document.getElementById('interface') ?? document.body).prepend(root);
		this.root = root;
		this.stage = root.querySelector('.fbui-stage');
		this.main = root.querySelector('.fbui-main');
		this.bannerEl = root.querySelector('.fbui-banners');
		this.floatEl = root.querySelector('.fbui-floats');

		root.addEventListener('click', (e) => this.#onClick(e));
		root.addEventListener('contextmenu', (e) => this.#onContext(e));
		root.addEventListener('mouseover', (e) => this.#onHover(e));
		root.addEventListener('focusin', (e) => this.#onHover(e));
		window.addEventListener('resize', () => this.layout());
		const mid = document.getElementById('ui-middle');
		if (mid && 'ResizeObserver' in window) new ResizeObserver(() => this.layout()).observe(mid);
		this.layout();
	}

	layout() {
		if (!this.root) return;
		const W = window.innerWidth;
		const H = window.innerHeight;
		const rect = (el) => {
			if (typeof el === 'string') el = document.querySelector(el);
			if (!el) return null;
			const r = el.getBoundingClientRect();
			return r.width > 0 && r.height > 0 ? r : null;
		};
		// Measure the actual obstacles, not Foundry's layout columns: in v13 #ui-left also holds the
		// scene navigation and the player list, so it is far wider than the tool strip.
		let left = 0;
		for (const sel of ['#scene-controls', '#controls']) {
			const r = rect(sel);
			if (r && r.left < W * 0.3) left = Math.max(left, r.right);
		}
		left = Math.min(left + 4, W * 0.2);
		let right = W;
		for (const sel of ['#sidebar', '#ui-right']) {
			const r = rect(sel);
			if (r && r.left > W * 0.5) {
				right = r.left - 4;
				break;
			}
		}
		// Top: under the scene tabs only (ignore the expanded scene list dropdown)
		let top = 0;
		const nav = rect('#scene-navigation-active') ?? rect('#scene-navigation') ?? rect('#navigation');
		if (nav && nav.top < H * 0.2) top = Math.min(nav.top + Math.min(nav.height, 44) + 4, 90);
		// Bottom: the hotbar, and anything parked in the bottom-left corner (player list, camera controls)
		let bottom = H;
		const hot = rect('#hotbar');
		if (hot && hot.top > H / 2) bottom = Math.min(bottom, hot.top - 6);
		for (const el of document.querySelectorAll('#players, #ui-left > *, #ui-left > * > *')) {
			const r = rect(el);
			if (r && r.top > H * 0.7 && r.height < H * 0.3 && r.right > left && r.left < W * 0.3) bottom = Math.min(bottom, r.top - 6);
		}
		bottom = Math.max(bottom, H - 180);
		const w = Math.max(320, right - left);
		const h = Math.max(320, bottom - top);
		// Fit by height so the battle screen keeps the same proportions on any monitor; width only caps it.
		const fit = clamp(Math.min(h / 800, w / 1180), 0.7, 3);
		const size = clamp(Number(setting('uiSize')) || 1, 0.5, 2);
		// Foundry's own interface scale (zoom on #interface) applies to us too, so position in zoomed units
		const cz = Number(this.root.currentCSSZoom) || 1;
		const scale = fit * size * cz;
		Object.assign(this.root.style, { left: `${left / cz}px`, top: `${top / cz}px`, width: `${w / cz}px`, height: `${h / cz}px` });
		Object.assign(this.stage.style, { width: `${w / scale}px`, height: `${h / scale}px`, transform: `scale(${scale / cz})` });
		this.stageW = w / scale;
		this.root.classList.toggle('wide', w / scale > 1560);
		this.#fitParty();
		this.scale = scale;
	}

	/** Party row spans the full width only when the cards need it; otherwise the enemy panel keeps the full height */
	#fitParty() {
		if (!this.root) return;
		const n = combatantsOf(this.combat).filter((c) => c.faction === FRIENDLY && c.actor && seenBy(c, this.asPlayer)).length;
		const leftCol = this.root.classList.contains('wide') ? 380 : 340;
		const room = (this.stageW ?? 1400) - 36 - leftCol - 20;
		this.root.classList.toggle('party-wide', n * 235 + (n - 1) * 10 > room);
	}

	open() {
		this.mount();
		this.hpCache.clear();
		this.state.open = true;
		this.root.classList.add('open');
		document.body.classList.add('fbui-open');
		this.render();
	}

	close() {
		if (!this.root) return;
		this.state.open = false;
		this.root.classList.remove('open');
		document.body.classList.remove('fbui-open');
	}

	toggle() {
		this.state.open ? this.close() : this.open();
	}

	scheduleRender() {
		if (!this.state.open) return;
		clearTimeout(this._timer);
		this._timer = setTimeout(() => this.render(), 40);
	}

	/* ---------------------------------------------------------- */
	/*  Rendering                                                   */
	/* ---------------------------------------------------------- */

	get combat() {
		return game.combat ?? null;
	}

	get asPlayer() {
		return game.user.isGM && this.state.asPlayer;
	}

	get isGM() {
		return game.user.isGM && !this.state.asPlayer;
	}

	render() {
		if (!this.root || !this.state.open) return;
		const combat = this.combat;
		const phase = phaseOf(combat);
		const active = combat?.combatant ?? null;
		if (active?.id !== this.state.lastActive) {
			this.state.lastActive = active?.id ?? null;
			this.state.menu = 'root';
			this.state.hover = 'attack';
		}
		const deltas = [];
		for (const c of combatantsOf(combat)) {
			if (!c.actor) continue;
			const hp = resources(c.actor).hp;
			const old = this.hpCache.get(c.actor.uuid);
			this.hpCache.set(c.actor.uuid, hp);
			if (old != null && old !== hp) deltas.push([c.actor.uuid, hp - old]);
		}

		const ctx = { combat, phase, active };
		if (phase !== this.state.lastPhase) {
			const prev = this.state.lastPhase;
			this.state.lastPhase = phase;
			if (prev && prev !== 'none') {
				const left = combat?.countTurnsLeft?.() ?? {};
				const mineLeft = combatantsOf(combat).some((c) => c.faction === FRIENDLY && c.isOwner && (left[c.id] ?? 0) > 0 && !c.isDefeated);
				if (phase === 'pick' && !game.user.isGM && mineLeft) sfx('turn');
				else if (phase === 'foe-pick' && game.user.isGM) sfx('turn');
			}
		}
		this.root.classList.toggle('mini', this.state.mini);
		this.#fitParty();
		this.root.classList.toggle('no-combat', phase === 'none');
		this.main.innerHTML = [
			this.#top(ctx),
			phase === 'none' ? `<section class="fbui-center">${this.#clocks(ctx)}</section>` : `<section class="fbui-center">${this.#charge(ctx)}</section><section class="fbui-clockwrap">${this.#clocks(ctx)}</section>`,
			phase === 'none' ? '' : `<section class="fbui-left">${this.#target(ctx)}</section>`,
			phase === 'none' ? '' : `<section class="fbui-right">${this.#right(ctx)}</section>`,
			phase === 'none' ? '' : `<section class="fbui-bottom">${this.#party(ctx)}</section>`,
		].join('');
		this.#decorateHelp();
		for (const [uuid, d] of deltas) this.#hpDelta(uuid, d);
	}

	/* ---------------------- pinned descriptions ------------------ */

	static rowKey(row) {
		return `${row.dataset.action ?? ''}|${row.dataset.id ?? ''}`;
	}

	/** Each description box gets a pin; a pinned description survives re-renders while its entry is on screen */
	#decorateHelp() {
		const lock = this.state.lock;
		let found = false;
		for (const out of this.main.querySelectorAll('[data-help-out]')) {
			const box = document.createElement('div');
			box.className = 'fbui-helpbox';
			out.before(box);
			box.append(out);
			box.insertAdjacentHTML('beforeend', `<button type="button" class="fbui-pin" data-action="helpPin" aria-pressed="false" data-tooltip="Lock this description so you can scroll it. Right-click an entry to lock it directly."><i class="fa-solid fa-thumbtack"></i></button>`);
			out.addEventListener('scroll', () => {
				if (this.state.lock && box.classList.contains('locked')) this.state.lock.scroll = out.scrollTop;
			});
			if (!lock || found) continue;
			const panel = box.closest('.fbui-panel');
			const row = [...(panel?.querySelectorAll('[data-help]') ?? [])].find((r) => BattleUI.rowKey(r) === lock.key);
			if (!row) continue;
			found = true;
			this.#showLock(box, row);
			out.scrollTop = lock.scroll ?? 0;
		}
		if (lock && !found) this.state.lock = null;
	}

	#showLock(box, row) {
		const out = box.querySelector('[data-help-out]');
		out.innerHTML = this.state.lock.html;
		box.classList.add('locked');
		box.querySelector('.fbui-pin')?.setAttribute('aria-pressed', 'true');
		const panel = box.closest('.fbui-panel');
		panel?.querySelectorAll('.fbui-cmd-row.on, .fbui-cmd-row.pinned').forEach((x) => x.classList.remove('on', 'pinned'));
		row?.classList.add('pinned');
	}

	#helpHtml(row) {
		const name = row.querySelector('.l')?.textContent?.trim();
		return `${name && row.classList.contains('fbui-cmd-row') ? `<b>${esc(name)}</b>` : ''}<span>${esc(row.dataset.help)}</span>`;
	}

	/** Pin a row's description (or the one on show), or unpin when it is already pinned */
	#toggleLock(box, row) {
		const out = box?.querySelector('[data-help-out]');
		if (!out) return;
		const key = row ? BattleUI.rowKey(row) : null;
		if (this.state.lock && (!row || this.state.lock.key === key)) {
			this.state.lock = null;
			box.classList.remove('locked');
			box.querySelector('.fbui-pin')?.setAttribute('aria-pressed', 'false');
			box.closest('.fbui-panel')?.querySelectorAll('.pinned').forEach((x) => x.classList.remove('pinned'));
			sfx('back');
			return;
		}
		const target = row ?? box.closest('.fbui-panel')?.querySelector('.fbui-cmd-row.on') ?? null;
		this.state.lock = { key: target ? BattleUI.rowKey(target) : '|', html: target?.dataset.help ? this.#helpHtml(target) : out.innerHTML, scroll: target === row ? 0 : out.scrollTop };
		if (target) {
			this.state.hover = target.dataset.id ?? this.state.hover;
		}
		this.#showLock(box, target);
		if (target === row) out.scrollTop = 0;
		sfx('cursor');
	}

	/* ----------------------------- top --------------------------- */

	#top({ combat, phase, active }) {
		const tools = [
			game.user.isGM ? `<button type="button" class="fbui-tool ${this.state.asPlayer ? 'on' : ''}" data-action="viewAs" data-tooltip="Preview what players see"><i class="fa-solid fa-eye"></i></button>` : '',
			`<button type="button" class="fbui-tool txt" data-action="size" data-n="-0.1" data-tooltip="Smaller (${Math.round((Number(setting('uiSize')) || 1) * 100)}%)">A−</button>`,
			`<button type="button" class="fbui-tool txt" data-action="size" data-n="0.1" data-tooltip="Bigger (${Math.round((Number(setting('uiSize')) || 1) * 100)}%)">A+</button>`,
			game.user.isGM ? `<button type="button" class="fbui-tool" data-action="clockAdd" data-tooltip="Add a scene clock"><i class="fa-solid fa-clock"></i></button>` : '',
			phase !== 'none' ? `<button type="button" class="fbui-tool" data-action="mini" data-tooltip="${this.state.mini ? 'Show panels' : 'Hide panels'}"><i class="fa-solid ${this.state.mini ? 'fa-up-right-and-down-left-from-center' : 'fa-down-left-and-up-right-to-center'}"></i></button>` : '',
			`<button type="button" class="fbui-tool" data-action="close" data-tooltip="Close battle UI (Shift+B)"><i class="fa-solid fa-xmark"></i></button>`,
		].join('');

		if (phase === 'none') {
			return `<header class="fbui-top none"><div class="fbui-phase"><div class="t">Scene clocks</div><div class="h">No conflict running. Clocks stay with the scene.</div></div><div class="fbui-tools">${tools}</div></header>`;
		}

		const slots = phase === 'prestart' ? [] : windowSlots(buildTrack(combat, this.asPlayer), 10);
		const slotHtml = slots
			.map((s) => {
				const hero = s.faction === FRIENDLY;
				const label = s.state === 'now' ? 'NOW' : hero ? 'HERO' : 'FOE';
				const c = s.combatant;
				let face = '';
				if (c) {
					const p = portrait(c);
					face = p.img ? `<img src="${esc(p.img)}" alt="">` : `<i>${esc(initials(c.name))}</i>`;
				} else if (s.state === 'now') face = '<i>?</i>';
				return `<div class="fbui-slot ${s.state} ${hero ? 'hero' : 'foe'}"><div class="lbl">${label}</div><div class="fbui-dia">${face}</div><div class="sub">${s.state === 'done' ? '✓' : ''}</div></div>`;
			})
			.join('');

		const t = this.#phaseText(combat, phase, active);
		return `<header class="fbui-top">
			<div class="fbui-round"><span class="d"></span><span class="t"><small>ROUND</small><b>${combat.round || '–'}</b></span></div>
			<div class="fbui-track">${slotHtml || '<div class="fbui-track-empty">Turn order appears when the conflict starts.</div>'}</div>
			<div class="fbui-phase"><div class="t" style="color:${t.color}">${esc(t.title)}</div><div class="h">${esc(t.hint)}</div></div>
			<div class="fbui-tools">${tools}</div>
		</header>`;
	}

	#phaseText(combat, phase, active) {
		const left = combat.countTurnsLeft?.() ?? {};
		const heroLeft = combatantsOf(combat)
			.filter((c) => c.faction === FRIENDLY)
			.reduce((n, c) => n + Math.max(0, left[c.id] ?? 0), 0);
		switch (phase) {
			case 'prestart':
				return { title: 'Conflict ready', hint: this.isGM ? 'Start the conflict to choose which side goes first.' : 'Waiting for the GM to start the conflict.', color: COLORS.gold };
			case 'pick':
				return { title: 'Heroes’ turn', hint: `Choose which hero acts. ${heroLeft} hero turn${heroLeft === 1 ? '' : 's'} left this round.`, color: '#9fd0ff' };
			case 'command':
				return { title: 'Heroes’ turn', hint: `${active.name} is acting.`, color: '#9fd0ff' };
			case 'foe-pick':
				return { title: 'Foes’ turn', hint: this.isGM ? 'Pick which enemy acts.' : 'The GM picks which enemy acts.', color: COLORS.foeText };
			case 'foe-act': {
				const info = active.actor?.type === 'npc' ? npcInfo(active.actor) : null;
				const villain = info?.villain;
				const champ = info?.rank === 'champion' && info.rankLabel ? ` ${info.rankLabel}: ${active.totalTurns} turns a round, never two in a row.` : '';
				return { title: villain ? 'Villain’s turn' : 'Foes’ turn', hint: `${active.name} acts.${champ}`, color: COLORS.foeText };
			}
			case 'end':
				return { title: 'Round over', hint: 'All turns taken.', color: COLORS.gold };
		}
		return { title: '', hint: '', color: '#eef3ff' };
	}

	/* ---------------------------- clocks -------------------------- */

	#clocks({ phase }) {
		const all = Clocks.list();
		const list = this.isGM ? all : all.filter((c) => !c.hidden);
		const gm = this.isGM;
		if (!list.length && !gm && !this.pending.length) return '';
		const cards = list
			.map((c) => {
				const kind = CLOCK_KINDS[c.kind] ?? CLOCK_KINDS.env;
				const p = pct(c.current, c.max);
				const full = c.current >= c.max;
				const step = 360 / c.max;
				const tags = [];
				if (c.tick) tags.push(['+1/round', 'Fills 1 section at the end of each round']);
				if (c.hidden) tags.push(['hidden', 'Hidden from players']);
				if (full) tags.push(['FULL', '']);
				const body = `<div class="n">${esc(c.name)}</div><div class="c"><b>${c.current}/${c.max}</b><span>${kind.label}</span></div>${tags.length ? `<div class="tags">${tags.map(([t, tip]) => `<span ${tip ? `data-tooltip="${tip}"` : ''}>${t}</span>`).join('')}</div>` : ''}`;
				return `<div class="fbui-clock ${full ? 'full' : ''} ${c.hidden ? 'hidden' : ''}" style="--c:${kind.color}" data-clock="${esc(c.id)}">
					<div class="pie"><span class="fill" style="background:conic-gradient(${kind.color} 0 ${p}%, rgba(255,255,255,.08) ${p}% 100%)"></span><span class="ticks" style="background:repeating-conic-gradient(from -1deg, #0b1220 0deg 2deg, transparent 2deg ${step}deg)"></span><span class="ring"></span></div>
					${gm ? `<button type="button" class="body" data-action="clockEdit" data-id="${esc(c.id)}" data-tooltip="Edit clock">${body}</button>` : `<div class="body">${body}</div>`}
					${gm ? `<div class="btns"><button type="button" data-action="clockTick" data-id="${esc(c.id)}" data-n="1" aria-label="Fill one section of ${esc(c.name)}">+</button><button type="button" data-action="clockTick" data-id="${esc(c.id)}" data-n="-1" aria-label="Erase one section of ${esc(c.name)}">−</button></div>` : ''}
				</div>`;
			})
			.join('');
		const pending = gm
			? this.pending
					.map((p, i) => {
						const clock = all.find((c) => c.id === p.id);
						const who = game.users.get(p.userId)?.name ?? 'A player';
						const what = p.op === 'tick' ? `${p.n > 0 ? 'fill' : 'erase'} ${Math.abs(p.n)} on “${clock?.name ?? '?'}”` : p.op;
						return `<div class="fbui-pending"><span><b>${esc(who)}</b> asks to ${esc(what)}${p.reason ? ` (${esc(p.reason)})` : ''}</span><button type="button" data-action="approve" data-i="${i}">Approve</button><button type="button" data-action="deny" data-i="${i}">Deny</button></div>`;
					})
					.join('')
			: '';
		const empty = !list.length && gm ? `<button type="button" class="fbui-clock-add" data-action="clockAdd"><i class="fa-solid fa-plus"></i> Add a clock</button>` : '';
		return `<div class="fbui-clocks">${phase === 'none' ? '' : '<div class="hd"><span>SCENE CLOCKS</span></div>'}${pending}<div class="row">${cards}${empty}</div></div>`;
	}

	#charge({ combat }) {
		const ch = combat?.getFlag?.(MODULE_ID, 'charge');
		if (!ch?.item) return '';
		return `<div class="fbui-charge"><i class="fa-solid fa-triangle-exclamation"></i><span><b>Charging:</b> ${esc(ch.who)} is preparing <b>${esc(ch.item)}</b>.${ch.note ? ' ' + esc(ch.note) : ''}</span>${this.isGM ? `<button type="button" data-action="clearCharge" aria-label="Clear warning">✕</button>` : ''}</div>`;
	}

	/* ---------------------------- target --------------------------- */

	foes(combat) {
		return combatantsOf(combat).filter((c) => c.faction === HOSTILE && c.actor && seenBy(c, this.asPlayer));
	}

	currentTarget(combat) {
		const foes = this.foes(combat);
		for (const t of game.user.targets ?? []) {
			const c = foes.find((f) => f.tokenId === t.id || f.token?.id === t.id);
			if (c) return c;
		}
		return foes.find((f) => f.id === this.state.target) ?? foes.find((f) => !f.isDefeated) ?? foes[0] ?? null;
	}

	#target({ combat }) {
		const foes = this.foes(combat);
		const c = this.currentTarget(combat);
		if (!c) return `<div class="fbui-panel foe"><div class="fbui-kicker foe">TARGET</div><div class="fbui-empty">No enemies in this conflict.</div></div>`;
		const actor = c.actor;
		const isNpc = actor.type === 'npc';
		const info = isNpc ? npcInfo(actor) : null;
		const know = knowledge(actor, combat, this.asPlayer);
		const r = resources(actor);
		const tier = know.tier;
		const showTurns = combat.constructor?.showTurnsFor ? combat.constructor.showTurnsFor(c) || this.isGM : true;
		const turnTag = showTurns ? `${c.totalTurns} turn${c.totalTurns === 1 ? '' : 's'} per round` : '';
		const tags = [];
		if (info && tier >= 1) tags.push(info.rankLabel, info.species);
		if (turnTag) tags.push(turnTag);
		if (tier === 0) tags.push('Not studied');

		const kicker = info?.villain ? `VILLAIN · ${info.villain.toUpperCase()}` : 'TARGET';
		const hpText = tier >= 1 ? `${r.hp} / ${r.hpMax}` : '???';
		const ultima = info?.villain
			? `<div class="fbui-ultima ${this.isGM ? 'gm' : ''}" ${this.isGM ? `data-action="points" data-cid="${c.id}" data-tooltip="Spend Ultima Points"` : ''}><span class="k">ULTIMA POINTS</span><span class="pips">${Array.from({ length: Math.min(info.ultimaMax || info.ultima, 15) }, (_, i) => `<i class="${i < info.ultima ? 'on' : ''}"></i>`).join('')}</span><span class="n">${info.ultima}${info.ultimaMax ? ` of ${info.ultimaMax}` : ''}</span></div>`
			: '';
		let details = '';
		if (info && tier >= 2) {
			const at = actor.system?.attributes ?? {};
			const attrs = ['dex', 'ins', 'mig', 'wlp'].map((k) => `${k.toUpperCase()} d${at[k]?.current ?? at[k]?.base ?? '?'}`).join(' · ');
			const defs = [info.def != null ? `DEF ${info.def}` : '', info.mdef != null ? `M.DEF ${info.mdef}` : ''].filter(Boolean).join(' · ');
			details = `<div class="fbui-details">${esc(attrs)}${defs ? `<br>${esc(defs)}` : ''}${info.traits ? `<div class="traits">${esc(info.traits)}</div>` : ''}</div>`;
		}

		const aff = affinities(actor);
		const gm = this.isGM;
		const cells = AFFINITY_TYPES.map(([k, abbr, col]) => {
			const known = tier >= 2 || !!know.aff?.[k];
			const shown = know.full ? this.#revealedTo(combat, actor, k) : known;
			const v = known || know.full ? aff[k] : '?';
			const cls = gm ? `cell gm ${shown ? 'shown' : ''}` : 'cell';
			const tag = gm ? 'button type="button"' : 'div';
			const close = gm ? 'button' : 'div';
			return `<${tag} class="${cls}" ${gm ? `data-action="revealAff" data-k="${k}" data-tooltip="${shown ? 'Players know this. Click to hide.' : 'Click to reveal to players'}"` : ''}><span style="color:${col}">${abbr}</span><b style="color:${AFF_COLOR[v] ?? '#eef3ff'}">${v}</b></${close}>`;
		}).join('');

		const tierCtl = gm && isNpc
			? `<div class="fbui-tier"><span>Players know</span>${[0, 1, 2, 3].map((n) => `<button type="button" class="${this.#flagTier(combat, actor) === n ? 'on' : ''}" data-action="revealTier" data-n="${n}" data-tooltip="${esc(TIER_TEXT[n])}">${['–', 'Basic', 'Full', 'All'][n]}</button>`).join('')}</div>`
			: '';
		const studyText = gm && isNpc ? `Players see: ${TIER_TEXT[knowledge(actor, combat, true).tier]}` : TIER_TEXT[tier];

		const roster = foes
			.map((f) => {
				const fr = resources(f.actor);
				const used = turnsUsed(combat, f);
				return `<button type="button" class="fbui-roster ${f.id === c.id ? 'on' : ''} ${f.isDefeated ? 'down' : ''}" data-action="target" data-cid="${f.id}"><span class="nm">${esc(f.name)}</span><span class="rt">${fr.crisis && !f.isDefeated ? '<em>CRISIS</em>' : ''}${f.isDefeated ? '<em class="ko">DOWN</em>' : ''}<small>${used}/${f.totalTurns} turns</small></span></button>`;
			})
			.join('');

		return `<div class="fbui-panel foe ${info?.villain ? 'villain' : ''}" data-cid="${c.id}">
			<div class="fbui-head"><div><div class="fbui-kicker foe">${kicker}</div><div class="fbui-name">${esc(c.name)}</div></div><div class="fbui-lv">${info ? (tier >= 1 ? `Lv ${info.level}` : 'Lv ?') : ''}</div></div>
			<div class="fbui-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
			<div class="fbui-hp ${r.crisis ? 'crisis' : ''}">
				<div class="row"><span class="k">${r.crisis ? 'HP · CRISIS' : 'HP'}</span><span class="v">${hpText}</span></div>
				<div class="bar"><span style="width:${pct(r.hp, r.hpMax)}%"></span><i></i></div>
				<div class="row sm"><span>${r.crisis ? 'In Crisis' : 'Not in Crisis'}</span><span>${tier >= 1 ? `${Math.max(0, r.hpMax - r.hp)} damage taken` : ''}</span></div>
			</div>
			${ultima}
			<div class="fbui-chips">${this.#chips(actor, false)}</div>
			${details}
			<div><div class="fbui-kicker">AFFINITIES</div><div class="fbui-aff">${cells}</div><div class="fbui-note">${esc(studyText)}</div>${tierCtl}</div>
		</div>
		<div class="fbui-panel roster">${roster}</div>`;
	}

	#flagTier(combat, actor) {
		return Number(combat?.getFlag?.(MODULE_ID, `reveal.${actorKey(actor)}`)?.tier ?? 0);
	}

	#revealedTo(combat, actor, k) {
		const k2 = knowledge(actor, combat, true);
		return k2.tier >= 2 || !!k2.aff?.[k];
	}

	#chips(actor, small) {
		return statusList(actor)
			.map((s) => {
				const [label, col] = STATUS_CHIPS[s];
				return `<span class="fbui-chip ${small ? 'sm' : ''}" style="--c:${col}">${esc(label)}</span>`;
			})
			.join('');
	}

	/* ----------------------------- right ---------------------------- */

	#right(ctx) {
		const { combat, phase, active } = ctx;
		const out = [this.#pointsPanel(combat), this.#fallen(combat)];
		const canAct = active && (active.isOwner || game.user.isGM) && !this.asPlayer;
		switch (phase) {
			case 'prestart':
				out.push(
					this.isGM
						? `<div class="fbui-panel gold"><div class="fbui-big">Ready to fight?</div><p>Starting asks which side takes the first turn. Clocks marked “+1 each round” tick when a round ends.</p><button type="button" class="fbui-cta gold" data-action="startCombat">Start conflict</button></div>`
						: `<div class="fbui-panel"><div class="fbui-big">Get ready</div><p>The GM is setting up the conflict.</p></div>`,
				);
				break;
			case 'pick': {
				const left = combat.countTurnsLeft?.() ?? {};
				const mine = combatantsOf(combat).filter((c) => c.faction === FRIENDLY && (left[c.id] ?? 0) > 0 && !c.isDefeated && (c.isOwner || game.user.isGM) && !this.asPlayer);
				out.push(`<div class="fbui-panel"><div class="fbui-big">Who acts next?</div><p>Pick any hero who hasn’t acted this round.</p>${
					mine.length ? `<div class="fbui-picks">${mine.map((c) => `<button type="button" class="fbui-pick" data-action="startTurn" data-cid="${c.id}">${this.#dia(c, 'sm')}<span>${esc(c.name)}</span><i class="fa-solid fa-play"></i></button>`).join('')}</div>` : ''
				}</div>`);
				break;
			}
			case 'command':
				if (this.state.points === active.id && canAct) break;
				out.push(canAct ? this.#commandPanel(combat, active) : this.#waiting(active, 'is acting'));
				break;
			case 'foe-pick':
				out.push(this.isGM ? this.#foePick(combat) : `<div class="fbui-panel foe"><div class="fbui-kicker foe">FOES’ TURN</div><div class="fbui-big">The enemy moves</div><p>Brace yourselves. The GM picks who acts.</p></div>`);
				break;
			case 'foe-act':
				if (this.state.points === active.id && this.isGM) break;
				out.push(this.isGM ? this.#foeAct(combat, active) : this.#waiting(active, 'acts', true));
				break;
			case 'end':
				out.push(this.isGM ? `<div class="fbui-panel gold"><div class="fbui-big">Round ${combat.round} complete</div><p>Every combatant has taken their turns.</p><button type="button" class="fbui-cta gold" data-action="nextRound">Start round ${combat.round + 1}</button></div>` : `<div class="fbui-panel"><div class="fbui-big">Round ${combat.round} complete</div></div>`);
				break;
		}
		return out.join('');
	}

	#gear(actor) {
		const gear = equippedGear(actor).filter((g) => armoryImg(actor.items.get(g.id)));
		if (!gear.length) return '';
		return `<span class="gear">${gear.map((g) => `<img src="${esc(g.img)}" alt="${esc(g.name)}" data-tooltip="${esc(g.name)}">`).join('')}</span>`;
	}

	#dia(c, size = '') {
		const p = portrait(c);
		return `<span class="fbui-dia ${size}" style="--tint:${p.tint}">${p.img ? `<img src="${esc(p.img)}" alt="">` : `<i>${esc(initials(c.name))}</i>`}</span>`;
	}

	#waiting(c, verb, foe = false) {
		return `<div class="fbui-panel ${foe ? 'foe' : ''}"><div class="fbui-actor">${this.#dia(c)}<div><div class="fbui-kicker ${foe ? 'foe' : ''}">${foe ? 'FOES’ TURN' : 'HEROES’ TURN'}</div><div class="fbui-big">${esc(c.name)} ${verb}</div></div></div></div>`;
	}

	#pointsPanel(combat) {
		const c = this.state.points ? combat?.combatants.get(this.state.points) : null;
		if (!c?.actor) return '';
		const actor = c.actor;
		const villain = actor.type === 'npc' && actor.system?.villain?.value;
		if (actor.type !== 'character' && !villain) return '';
		if (!(actor.isOwner || game.user.isGM) || this.asPlayer) return '';
		const fp = resources(actor).fp;
		const lc = lastCheck(actor, c);
		const chk = lc?.check;
		const last = chk ? `${chk.itemName || 'Check'} · Result ${chk.result ?? '?'}${chk.critical ? ' · CRITICAL' : chk.fumble ? ' · FUMBLE' : ''}` : 'No Check rolled yet';
		const row = (id, label, meta, help, ok) =>
			`<button type="button" class="fbui-cmd-row" data-action="pt" data-id="${id}" data-help="${esc(help)}" ${ok ? '' : 'disabled'}><span class="cur"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1 12 7 2 13Z" fill="currentColor"/></svg></span><span class="l">${esc(label)}</span><span class="m">${esc(meta)}</span></button>`;
		let rows;
		let help;
		if (!villain) {
			const reroll = canInvoke('FU.ChatContextRerollFabula', lc?.message);
			const push = canInvoke('FU.ChatContextPush', lc?.message);
			help = chk?.fumble ? 'You can’t invoke a Trait or Bond on a fumble.' : 'After rolling a Check: invoke a Trait to reroll one or both dice (1 FP per reroll), or a Bond to add its strength to the Result (once per Check).';
			rows = [
				row('trait', 'Invoke a Trait: reroll', '1 FP', 'Reroll one or both dice of your last Check. Each reroll costs another Fabula Point. Not on a fumble.', reroll),
				row('bond', 'Invoke a Bond: + Bond strength', '1 FP', 'Add the strength of one of your Bonds to the Result of your last Check. Once per Check. Not on a fumble.', push),
				row('alter', 'Alter the story', '1 FP', 'Make a statement about the story: add a detail, create an opportunity, or introduce a convenient twist. The GM can veto anything that breaks the scene.', fp > 0),
			].join('');
		} else {
			const reroll = canInvoke('FU.ChatContextRerollUltima', lc?.message);
			help = fp > 0 ? 'A Villain cannot regain Ultima Points. At 0 they stop being a Villain unless they escalate.' : 'No Ultima Points left: this Villain is now an ordinary NPC unless they escalate.';
			rows = [
				row('trait', 'Invoke a Trait: reroll', '1 UP', 'After rolling a Check, reroll one or both dice.', reroll),
				row('recovery', 'Recovery (uses an action)', '1 UP', 'Recover from all status effects and recover 50 Mind Points.', fp > 0),
				row('escape', 'Escape', '1 UP', 'Safely leave the scene. The GM describes how, perhaps leaving henchmen behind.', fp > 0),
			].join('');
		}
		const pips = Array.from({ length: Math.min(Math.max(fp, villain ? npcInfo(actor).ultimaMax : 3), 15) }, (_, i) => `<i class="${i < fp ? 'on' : ''}"></i>`).join('');
		return `<div class="fbui-panel cmd points ${villain ? 'foe' : ''}">
			<div class="fbui-cmd-head ${villain ? 'foe' : ''}">${this.#dia(c)}<div class="who"><div class="fbui-kicker ${villain ? 'foe' : ''}">${villain ? 'ULTIMA POINTS' : 'FABULA POINTS'}</div><div class="fbui-name sm">${esc(c.name)}</div></div><div class="fbui-pips">${pips}<b>${fp}</b></div><button type="button" class="fbui-x" data-action="pointsClose" aria-label="Close" data-tooltip="${c.id === combat.combatant?.id ? 'Back to actions' : 'Close'}">✕</button></div>
			<div class="fbui-last">Last Check: <b>${esc(last)}</b></div>
			<div class="fbui-cmd-list">${rows}</div>
			<div class="fbui-help" data-help-out>${esc(help)}</div>
		</div>`;
	}

	#fallen(combat) {
		if (setting('surrenderPrompt') === false) return '';
		const down = combatantsOf(combat).filter((c) => c.faction === FRIENDLY && c.actor?.type === 'character' && resources(c.actor).hp <= 0 && !c.actor.getFlag(MODULE_ID, 'fallen'));
		return down
			.map((c) => {
				const mine = c.actor.isOwner && !game.user.isGM;
				const can = mine || (game.user.isGM && !this.asPlayer);
				return `<div class="fbui-panel fallen"><div class="fbui-kicker">${esc(c.name.toUpperCase())} · 0 HP</div><div class="fbui-big sm">Surrender or Sacrifice?</div><p class="sm">Surrender: leave the fight, gain 2 Fabula Points, the GM adds a consequence. Sacrifice: one final heroic act, then leave the story.</p>${
					can
						? `<div class="fbui-two"><button type="button" class="fbui-cta" data-action="surrender" data-cid="${c.id}">Surrender</button><button type="button" class="fbui-cta red" data-action="sacrifice" data-cid="${c.id}">Sacrifice</button></div>`
						: ''
				}${mine ? '' : `<div class="fbui-note">${game.user.isGM ? 'The player usually decides; you can answer for them.' : `${esc(c.name)}’s player decides.`}</div>`}</div>`;
			})
			.join('');
	}

	#commandPanel(combat, c) {
		const actor = c.actor;
		const r = resources(actor);
		const st = this.state;
		let rows = [];
		let title = 'Choose an action';
		let help = '';
		if (st.menu === 'root') {
			const counts = { spell: spellRows(actor).length, skill: skillRows(actor).length, inventory: r.ipMax != null || inventoryRows(actor).length ? 1 : 0, objective: Clocks.visible().length };
			rows = COMMANDS.map(([id, label, desc]) => {
				const sub = SUBMENUS.includes(id);
				const disabled = sub && counts[id] === 0 && id !== 'objective';
				const row = { id, label, help: desc, disabled, meta: disabled ? `no ${id === 'inventory' ? 'items' : id + 's'}` : sub ? '›' : '', action: 'cmd' };
				if (id === 'attack') {
					const main = equippedGear(actor).find((g) => g.slot === 'mainHand' && ['weapon', 'customWeapon'].includes(g.type));
					if (main) {
						row.meta = main.name;
						row.img = armoryImg(actor.items.get(main.id));
					}
				}
				return row;
			});
			help = (COMMANDS.find((x) => x[0] === st.hover) ?? COMMANDS[0])[2];
		} else if (st.menu === 'spell') {
			title = 'Spells';
			rows = spellRows(actor).map((x) => ({ ...x, action: 'item' }));
			help = 'Pick a spell. Its cost is paid on casting; × T means per target.';
		} else if (st.menu === 'skill') {
			title = 'Skills';
			rows = skillRows(actor).map((x) => ({ ...x, action: 'item' }));
			help = 'Posts the Skill to chat with its rolls and effects. Passive Skills apply on their own.';
		} else if (st.menu === 'inventory') {
			title = `Inventory · ${r.ip ?? 0} IP`;
			rows = inventoryMenu(actor);
			help = 'Produce an item from your bag and use it at once. Core items not on your sheet are added the first time you use them.';
		} else if (st.menu === 'objective') {
			title = 'Objective: pick a Clock';
			help = 'On a success, fill 1 section; a high Result or critical can fill more. Threat Clocks can be erased instead if your approach fits.';
			rows = Clocks.visible().map((k) => ({ id: k.id, label: k.name, meta: k.current >= k.max ? 'full' : `${k.current}/${k.max}`, disabled: false, help: `${CLOCK_KINDS[k.kind]?.label ?? ''} · ${k.current} of ${k.max} filled`, action: 'objClock' }));
			if (!rows.length) rows = [{ id: 'objRoll', label: 'Roll a Check', meta: '', help: 'No clocks on this scene. Roll the Check the GM calls for.', action: 'objRoll' }];
		} else if (st.menu === 'objective-clock') {
			const k = Clocks.list().find((x) => x.id === st.objClock);
			title = k ? `Objective: ${k.name}` : 'Objective';
			const direct = game.user.isGM || setting('playersFillClocks');
			help = direct ? 'Roll the Check first, then mark the result.' : 'Roll the Check first, then mark the result. The GM confirms clock changes.';
			const threat = k?.kind === 'threat';
			rows = [
				{ id: 'roll', label: 'Roll the Check', meta: '', action: 'objRoll', help: 'Opens the attribute Check. The GM sets the Difficulty.' },
				{ id: 'f1', label: threat ? 'Erase 1 section' : 'Fill 1 section', meta: threat ? '−1' : '+1', action: 'objTick', n: threat ? -1 : 1, help: 'A normal success.' },
				{ id: 'f2', label: threat ? 'Erase 2 sections' : 'Fill 2 sections', meta: threat ? '−2' : '+2', action: 'objTick', n: threat ? -2 : 2, help: 'A high Result, or a critical success.' },
				{ id: 'f3', label: threat ? 'Fill 1 section' : 'Erase 1 section', meta: threat ? '+1' : '−1', action: 'objTick', n: threat ? 1 : -1, help: threat ? 'Things got worse.' : 'A setback.' },
			];
		}
		if (st.menu !== 'root' && st.hover) {
			const h = rows.find((x) => x.id === st.hover);
			if (h?.help) help = h.help;
		}
		const fp = r.fp <= 8 ? '◆'.repeat(r.fp) || '0' : `◆ × ${r.fp}`;
		const rowHtml = rows
			.map((m) => {
				const on = st.hover === m.id && !m.disabled;
				return `<button type="button" class="fbui-cmd-row ${on ? 'on' : ''}" data-action="${m.action}" data-id="${esc(m.id)}" ${m.n != null ? `data-n="${m.n}"` : ''} data-help="${esc(m.help ?? '')}" ${m.disabled ? 'disabled' : ''}><span class="cur"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1 12 7 2 13Z" fill="currentColor"/></svg></span><span class="l">${esc(m.label)}</span>${m.img ? `<img class="ico" src="${esc(m.img)}" alt="">` : ''}<span class="m">${esc(m.meta ?? '')}</span></button>`;
			})
			.join('');
		const back = st.menu !== 'root' ? `<button type="button" class="fbui-cmd-row back" data-action="back"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg><span class="l">Back</span></button>` : '';
		return `<div class="fbui-panel cmd">
			<div class="fbui-cmd-head">${this.#dia(c)}<div class="who"><div class="fbui-name sm">${esc(c.name)}</div><div class="sub">${esc(title)}</div></div><button type="button" class="fp" data-action="points" data-cid="${c.id}" data-tooltip="Spend Fabula Points"><small>FABULA</small><b>${fp}</b></button></div>
			<div class="fbui-cmd-list">${back}${rowHtml || '<div class="fbui-empty">Nothing here.</div>'}</div>
			<div class="fbui-help" data-help-out>${esc(help)}</div>
			<div class="fbui-cmd-foot"><button type="button" class="fbui-cta gold" data-action="endTurn">End turn</button></div>
		</div>`;
	}

	#foePick(combat) {
		const left = combat.countTurnsLeft?.() ?? {};
		const last = lastFoeId(combat);
		const foes = combatantsOf(combat).filter((c) => c.faction === HOSTILE && (left[c.id] ?? 0) > 0 && !(combat.settings?.skipDefeated && c.isDefeated));
		const others = foes.filter((c) => c.id !== last).length;
		const rows = foes
			.map((c) => {
				const repeat = c.id === last && others > 0;
				return `<button type="button" class="fbui-pick foe ${repeat ? 'warn' : ''}" data-action="startTurn" data-cid="${c.id}">${this.#dia(c, 'sm')}<span>${esc(c.name)}${repeat ? '<small>acted last foe turn</small>' : ''}</span><em>${turnsUsed(combat, c)}/${c.totalTurns}</em><i class="fa-solid fa-play"></i></button>`;
			})
			.join('');
		return `<div class="fbui-panel foe"><div class="fbui-kicker foe">GAME MASTER</div><div class="fbui-big">Which enemy acts?</div><p>Elites and Champions can’t take two turns in a row while others can still act.</p><div class="fbui-picks">${rows}</div></div>`;
	}

	#foeAct(combat, c) {
		const actor = c.actor;
		const rows = foeActionRows(actor)
			.map(
				(m) =>
					`<div class="fbui-foe-row"><button type="button" class="fbui-cmd-row" data-action="item" data-id="${esc(m.id)}" data-help="${esc(m.help)}"><span class="cur"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1 12 7 2 13Z" fill="currentColor"/></svg></span><span class="l">${esc(m.label)}</span>${m.img ? `<img class="ico" src="${esc(m.img)}" alt="">` : ''}<span class="m">${esc(m.meta)}</span></button><button type="button" class="fbui-tele" data-action="telegraph" data-id="${esc(m.id)}" data-tooltip="Telegraph as a charged attack"><i class="fa-solid fa-triangle-exclamation"></i></button></div>`,
			)
			.join('');
		const cards = [
			['study', 'Study'],
			['guard', 'Guard'],
			['hinder', 'Hinder'],
		]
			.map(([id, l]) => `<button type="button" class="fbui-mini" data-action="cmd" data-id="${id}">${l}</button>`)
			.join('');
		return `<div class="fbui-panel foe cmd">
			<div class="fbui-cmd-head foe">${this.#dia(c)}<div class="who"><div class="fbui-kicker foe">GAME MASTER</div><div class="fbui-name sm">${esc(c.name)} acts</div></div>${actor.type === 'npc' && actor.system?.villain?.value ? `<button type="button" class="fp" data-action="points" data-cid="${c.id}" data-tooltip="Spend Ultima Points"><small>ULTIMA</small><b>${resources(actor).fp}</b></button>` : ''}<div class="fp"><small>TURN</small><b>${turnsUsed(combat, c) + 1}/${c.totalTurns}</b></div></div>
			<div class="fbui-cmd-list">${rows || '<div class="fbui-empty">No attacks, spells or skills on this sheet.</div>'}</div>
			<div class="fbui-mini-row">${cards}</div>
			<div class="fbui-help" data-help-out>Roll an action. The warning button announces a charged attack to everyone.</div>
			<div class="fbui-cmd-foot"><button type="button" class="fbui-cta red" data-action="endTurn">End ${esc(c.name)}’s turn</button></div>
		</div>`;
	}

	/* ----------------------------- party ---------------------------- */

	#party({ combat, phase, active }) {
		const left = combat.countTurnsLeft?.() ?? {};
		const heroes = combatantsOf(combat).filter((c) => c.faction === FRIENDLY && c.actor && seenBy(c, this.asPlayer));
		const cards = heroes
			.map((c) => {
				const actor = c.actor;
				const r = resources(actor);
				const isActive = active?.id === c.id;
				const did = (left[c.id] ?? 0) <= 0 && !isActive;
				const canPick = phase === 'pick' && !did && !c.isDefeated && (c.isOwner || game.user.isGM) && !this.asPlayer;
				const badge = c.isDefeated ? 'DOWN' : r.hp <= 0 ? '0 HP' : isActive ? 'ACTING' : did ? 'ACTED' : r.crisis ? 'CRISIS' : '';
				const badgeCls = { DOWN: 'down', '0 HP': 'ko', ACTING: 'acting', ACTED: 'acted', CRISIS: 'crisis' }[badge] ?? '';
				const z = zeroPower(actor);
				const ipRow =
					r.ipMax != null
						? `<span class="ip"><b>IP</b>${r.ipMax <= 12 ? Array.from({ length: r.ipMax }, (_, i) => `<i class="${i < r.ip ? 'on' : ''}"></i>`).join('') : `<em>${r.ip} / ${r.ipMax}</em>`}</span>`
						: '<span></span>';
				const zero = z
					? `<span class="zero"><b>ZERO</b><span class="segs" style="grid-template-columns:repeat(${z.max},minmax(0,1fr))">${Array.from({ length: z.max }, (_, i) => `<i class="${i < z.current ? 'on' : ''}"></i>`).join('')}</span><em class="${z.current >= z.max ? 'ready' : ''}">${z.current >= z.max ? 'READY' : `${z.current}/${z.max}`}</em></span>`
					: '';
				const tag = canPick ? 'button type="button"' : 'div';
				const close = canPick ? 'button' : 'div';
				return `<${tag} class="fbui-card ${isActive ? 'active' : ''} ${did ? 'did' : ''} ${c.isDefeated ? 'down' : ''} ${canPick ? 'pickable' : ''}" data-cid="${c.id}" ${canPick ? 'data-action="startTurn"' : ''} aria-label="${esc(c.name)}${did ? ', already acted' : canPick ? ', choose to act' : ''}">
					<span class="top">${this.#dia(c)}<span class="nm"><b>${esc(c.name)}</b><small>${esc(classLine(actor))}</small></span>${badge ? `<span class="badge ${badgeCls}">${badge}</span>` : ''}</span>
					<span class="meter"><span class="k hp">HP</span><span class="bar hp ${r.crisis ? 'crisis' : ''}"><span style="width:${pct(r.hp, r.hpMax)}%"></span><i></i></span><span class="v ${r.crisis ? 'crisis' : ''}">${r.hp}<small>/${r.hpMax}</small></span></span>
					<span class="meter"><span class="k mp">MP</span><span class="bar mp"><span style="width:${pct(r.mp, r.mpMax)}%"></span></span><span class="v">${r.mp}<small>/${r.mpMax}</small></span></span>
					${zero}
					<span class="foot"><span class="ipg">${ipRow}${this.#gear(actor)}</span><span class="chips">${this.#chips(actor, true)}${actor.type === 'character' ? `<span class="fpchip ${actor.isOwner || game.user.isGM ? 'can' : ''}" ${actor.isOwner || game.user.isGM ? `role="button" tabindex="0" data-action="points" data-cid="${c.id}" data-tooltip="Fabula Points"` : 'data-tooltip="Fabula Points"'}>◆ ${r.fp}</span>` : ''}</span></span>
				</${close}>`;
			})
			.join('');
		return `<div class="fbui-party" style="--n:${Math.max(1, heroes.length)}">${cards}</div>`;
	}

	/* ---------------------------------------------------------- */
	/*  Banners and floats                                           */
	/* ---------------------------------------------------------- */

	banner(data) {
		if (!data) return;
		if (setting('banners') === false || !this.state.open) return;
		this.bannerQueue.push(data);
		if (!this.bannerBusy) this.#nextBanner();
	}

	#nextBanner() {
		const data = this.bannerQueue.shift();
		if (!data) {
			this.bannerBusy = false;
			return;
		}
		this.bannerBusy = true;
		// Action banners stay silent; rounds, clocks and explicit cues (warnings, points spent) play a sound
		const bannerCue = data.cue ?? (data.side === 'round' ? 'fanfare' : data.side === 'clock' ? 'chime' : null);
		if (bannerCue) sfx(bannerCue);
		const el = document.createElement('div');
		el.className = `fbui-banner ${data.side ?? 'hero'}`;
		el.innerHTML = `<span class="who">${esc(data.who ?? '')}</span>${data.img ? `<img class="ico" src="${esc(data.img)}" alt="">` : ''}<span class="what">${esc(data.what ?? '')}</span>${data.tgt ? `<span class="tgt">${esc(data.tgt)}</span>` : ''}`;
		this.bannerEl.append(el);
		const hold = this.bannerQueue.length ? 1500 : 2600;
		setTimeout(() => el.classList.add('out'), hold);
		setTimeout(() => {
			el.remove();
			this.#nextBanner();
		}, hold + 350);
	}

	/**
	 * @param {{tokenId?:string, actorUuid?:string, text:string, sub?:string, kind?:'dmg'|'heal'|'miss'|'crit'|'fire'|string}} data
	 */
	float(data) {
		if (!this.root || !this.state.open || setting('floatingNumbers') === false) return;
		const pos = this.#anchorFor(data);
		if (!pos) return;
		const el = document.createElement('div');
		el.className = `fbui-float ${data.kind ?? 'dmg'}`;
		el.style.left = `${pos.x}px`;
		el.style.top = `${pos.y}px`;
		el.innerHTML = `<b>${esc(data.text)}</b>${data.sub ? `<small>${esc(data.sub)}</small>` : ''}`;
		this.floatEl.append(el);
		setTimeout(() => el.remove(), 1900);
	}

	#anchorFor({ tokenId, actorUuid }) {
		const combat = this.combat;
		const c = combatantsOf(combat).find((x) => (tokenId && x.tokenId === tokenId) || (actorUuid && x.actor?.uuid === actorUuid));
		const rootRect = this.root.getBoundingClientRect();
		const s = this.scale || 1;
		// Prefer the token on the map, like a JRPG damage number
		const tok = c ? canvas?.tokens?.get?.(c.tokenId) : tokenId ? canvas?.tokens?.get?.(tokenId) : null;
		if (tok?.visible && canvas?.stage?.worldTransform) {
			const p = canvas.stage.worldTransform.apply({ x: tok.center.x, y: tok.y });
			const bx = (p.x - rootRect.left) / s;
			const by = (p.y - rootRect.top) / s;
			const w = this.stage.offsetWidth;
			const h = this.stage.offsetHeight;
			if (bx > 0 && by > 0 && bx < w && by < h) return { x: bx, y: by };
		}
		const el = c ? this.main.querySelector(`[data-cid="${c.id}"]`) : null;
		if (!el) return null;
		const r = el.getBoundingClientRect();
		return { x: (r.left + r.width / 2 - rootRect.left) / s, y: (r.top + 20 - rootRect.top) / s };
	}

	noteTypedFloat(actorUuid) {
		this.typedFloatAt.set(actorUuid, Date.now());
	}

	/** HP changed since the last render: show a number unless a typed damage float already covered it */
	#hpDelta(uuid, d) {
		setTimeout(() => {
			const t = this.typedFloatAt.get(uuid) ?? 0;
			if (Date.now() - t < 1800) return;
			this.float({ actorUuid: uuid, text: d > 0 ? `+${d}` : `${d}`.replace('-', '−'), sub: d > 0 ? 'HP' : '', kind: d > 0 ? 'heal' : 'dmg' });
		}, 450);
	}

	addPending(payload) {
		this.pending.push(payload);
		if (!this.state.open) ui.notifications?.info(`${game.users.get(payload.userId)?.name ?? 'A player'} asks to change a clock. Open the battle UI (Shift+B) to approve.`);
		this.scheduleRender();
	}

	/* ---------------------------------------------------------- */
	/*  Events                                                      */
	/* ---------------------------------------------------------- */

	#onHover(e) {
		const hit = e.target.closest?.('.fbui-cmd-row, .fbui-pick, .fbui-roster, .fbui-card.pickable, .fbui-mini, .fbui-cta, .fbui-tier button, .fbui-aff button');
		if (hit !== this._hovered) {
			this._hovered = hit;
			if (hit && !hit.disabled && e.type === 'mouseover') sfx('cursor');
		}
		const row = e.target.closest?.('[data-help]');
		if (!row || !this.root.contains(row)) return;
		const out = row.closest('.fbui-panel')?.querySelector('[data-help-out]') ?? this.root.querySelector('[data-help-out]');
		// a pinned description stays put until it is unpinned
		if (this.state.lock && out?.closest('.fbui-helpbox')?.classList.contains('locked')) return;
		if (out && row.dataset.help) {
			// the hovered entry's full name heads its text: long names are cut short in the list
			out.innerHTML = this.#helpHtml(row);
			out.scrollTop = 0;
		}
		if (row.dataset.id && row.dataset.id !== this.state.hover) {
			this.state.hover = row.dataset.id;
			this.root.querySelectorAll('.fbui-cmd-row.on').forEach((x) => x.classList.remove('on'));
			if (!row.disabled) row.classList.add('on');
		}
	}

	#onContext(e) {
		const helpRow = e.target.closest?.('.fbui-cmd-row[data-help]');
		if (helpRow && this.root.contains(helpRow) && helpRow.dataset.help) {
			e.preventDefault();
			return this.#toggleLock(helpRow.closest('.fbui-panel')?.querySelector('.fbui-helpbox'), helpRow);
		}
		const card = e.target.closest?.('.fbui-card, .fbui-roster');
		if (card) {
			const c = this.combat?.combatants?.get(card.dataset.cid);
			if (c?.actor?.isOwner) {
				e.preventDefault();
				c.actor.sheet?.render(true);
			}
			return;
		}
		const clock = e.target.closest?.('.fbui-clock');
		if (clock && game.user.isGM) {
			e.preventDefault();
			this.editClock(clock.dataset.clock);
		}
	}

	async #onClick(e) {
		const btn = e.target.closest?.('[data-action]');
		if (!btn || !this.root.contains(btn) || btn.disabled) return;
		e.preventDefault();
		const a = btn.dataset.action;
		const CUE = { helpPin: null, back: 'back', pointsClose: 'back', close: 'back', deny: 'back', mini: 'cursor', viewAs: 'cursor', size: 'cursor', endTurn: 'activate', telegraph: null, clockTick: 'cursor' };
		const cue = a in CUE ? CUE[a] : 'confirm';
		if (cue) sfx(cue);
		const combat = this.combat;
		const active = combat?.combatant;
		const actor = active?.actor;
		try {
			switch (a) {
				case 'close':
					return this.close();
				case 'helpPin':
					return this.#toggleLock(btn.closest('.fbui-helpbox'), null);
				case 'mini':
					this.state.mini = !this.state.mini;
					return this.render();
				case 'size': {
					const next = clamp(Math.round(((Number(setting('uiSize')) || 1) + Number(btn.dataset.n)) * 10) / 10, 0.5, 2);
					await game.settings.set(MODULE_ID, 'uiSize', next);
					this.layout();
					return this.render();
				}
				case 'viewAs':
					this.state.asPlayer = !this.state.asPlayer;
					return this.render();
				case 'startCombat':
					return combat?.startCombat();
				case 'nextRound':
					return combat?.nextRound();
				case 'startTurn': {
					const c = combat?.combatants.get(btn.dataset.cid);
					if (c) await combat.startTurn(c);
					return;
				}
				case 'endTurn':
					if (active) await combat.endTurn(active);
					return;
				case 'target':
					return this.setTarget(btn.dataset.cid);
				case 'back':
					this.state.hover = this.state.menu === 'objective-clock' ? this.state.objClock : this.state.menu;
					this.state.menu = this.state.menu === 'objective-clock' ? 'objective' : 'root';
					return this.render();
				case 'cmd': {
					const id = btn.dataset.id;
					if (SUBMENUS.includes(id)) {
						this.state.menu = id;
						this.state.hover = null;
						return this.render();
					}
					if (!actor) return;
					if (['attack', 'hinder', 'study'].includes(id)) this.ensureTarget();
					const Handler = game.projectfu?.ActionHandler ?? globalThis.projectfu?.ActionHandler;
					if (!Handler) return ui.notifications.warn('Project FU action handler not found.');
					return new Handler(actor).handleAction(id);
				}
				case 'item': {
					const item = actor?.items.get(btn.dataset.id);
					if (!item) return;
					const offensive = item.system?.isOffensive?.value || ['basic', 'weapon', 'customWeapon'].includes(item.type) || (active?.faction === HOSTILE && item.type !== 'spell');
					if (offensive) this.ensureTarget();
					await item.roll();
					return;
				}
				case 'consumable':
					if (actor) await useConsumable(actor, btn.dataset.id);
					return;
				case 'ipSpend':
					if (actor) await pullOut(actor);
					return;
				case 'points':
					this.state.points = this.state.points === btn.dataset.cid ? null : btn.dataset.cid;
					return this.render();
				case 'pointsClose':
					this.state.points = null;
					return this.render();
				case 'pt': {
					const pc = combat?.combatants.get(this.state.points);
					const pa = pc?.actor;
					if (!pa) return;
					const lc = lastCheck(pa, pc);
					switch (btn.dataset.id) {
						case 'trait':
							return invoke(pa.type === 'character' ? 'FU.ChatContextRerollFabula' : 'FU.ChatContextRerollUltima', lc?.message);
						case 'bond':
							return invoke('FU.ChatContextPush', lc?.message);
						case 'alter':
							return alterStory(pa);
						case 'recovery':
							return ultimaRecovery(pa);
						case 'escape':
							return ultimaEscape(pa);
					}
					return;
				}
				case 'objClock':
					this.state.menu = 'objective-clock';
					this.state.objClock = btn.dataset.id;
					this.state.hover = 'roll';
					return this.render();
				case 'objRoll': {
					const Handler = game.projectfu?.ActionHandler ?? globalThis.projectfu?.ActionHandler;
					if (actor && Handler) return new Handler(actor).handleAction('objective');
					return;
				}
				case 'objTick':
					await Clocks.request({ op: 'tick', id: this.state.objClock, n: Number(btn.dataset.n), reason: `${active?.name ?? game.user.name} (Objective)` });
					this.state.menu = 'root';
					this.state.hover = 'objective';
					return this.render();
				case 'clockTick':
					return Clocks.request({ op: 'tick', id: btn.dataset.id, n: Number(btn.dataset.n) });
				case 'clockAdd':
					return this.editClock(null);
				case 'clockEdit':
					return this.editClock(btn.dataset.id);
				case 'approve': {
					const p = this.pending.splice(Number(btn.dataset.i), 1)[0];
					if (p) await Clocks.apply(p);
					return this.render();
				}
				case 'deny': {
					const p = this.pending.splice(Number(btn.dataset.i), 1)[0];
					if (p) game.socket.emit(`module.${MODULE_ID}`, { type: 'notify', userId: p.userId, text: 'The GM declined the clock change.' });
					return this.render();
				}
				case 'revealTier': {
					const c = this.currentTarget(combat);
					if (c) await combat.setFlag(MODULE_ID, `reveal.${actorKey(c.actor)}.tier`, Number(btn.dataset.n));
					return;
				}
				case 'revealAff': {
					const c = this.currentTarget(combat);
					if (!c) return;
					const key = actorKey(c.actor);
					const k = btn.dataset.k;
					const cur = combat.getFlag(MODULE_ID, `reveal.${key}.aff.${k}`);
					if (cur) await combat.update({ [`flags.${MODULE_ID}.reveal.${key}.aff.-=${k}`]: null });
					else {
						await combat.setFlag(MODULE_ID, `reveal.${key}.aff.${k}`, true);
						const v = affinities(c.actor)[k];
						const word = { VU: 'vulnerable to', RS: 'resists', IM: 'is immune to', AB: 'absorbs', '·': 'takes normal damage from' }[v];
						game.modules.get(MODULE_ID).api.broadcastBanner({ side: 'foe', who: 'Affinity', what: `${c.name} ${word} ${k}`, tgt: '' });
					}
					return;
				}
				case 'telegraph': {
					const item = actor?.items.get(btn.dataset.id);
					if (!item) return;
					await combat.setFlag(MODULE_ID, 'charge', { who: active.name, item: item.name, cid: active.id, round: combat.round });
					game.modules.get(MODULE_ID).api.broadcastBanner({ side: 'foe', who: active.name, what: item.name, tgt: 'is charging!', cue: 'error' });
					return;
				}
				case 'clearCharge':
					return combat?.unsetFlag(MODULE_ID, 'charge');
				case 'surrender':
				case 'sacrifice':
					return this.#fall(combat?.combatants.get(btn.dataset.cid), a);
			}
		} catch (err) {
			console.error(`${MODULE_ID} |`, err);
			ui.notifications?.error(`Battle UI: ${err.message}`);
		}
	}

	setTarget(cid) {
		const c = this.combat?.combatants.get(cid);
		if (!c) return;
		this.state.target = cid;
		const tok = canvas?.tokens?.get?.(c.tokenId);
		if (tok) {
			try {
				if (canvas.tokens.setTargets) canvas.tokens.setTargets([tok.id]);
				else tok.setTarget(true, { releaseOthers: true, groupSelection: false });
			} catch (err) {
				console.warn(`${MODULE_ID} | could not set target`, err);
			}
		}
		this.render();
	}

	/** Attack, Hinder and Study read the user's Foundry targets, so make sure the panel's target is one. */
	ensureTarget() {
		if ((game.user.targets?.size ?? 0) > 0) return;
		const c = this.currentTarget(this.combat);
		if (c) this.setTarget(c.id);
	}

	async #fall(c, kind) {
		const actor = c?.actor;
		if (!actor) return;
		if (kind === 'surrender') {
			const fp = resources(actor).fp;
			await actor.update({ 'system.resources.fp.value': fp + 2, [`flags.${MODULE_ID}.fallen`]: 'surrender' });
			if (!c.isDefeated && c.isOwner) await c.update({ defeated: true }).catch(() => {});
			await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><b>${esc(c.name)} Surrenders.</b> They gain 2 Fabula Points and leave the conflict. The GM chooses a consequence. At the start of their next scene they wake with HP equal to their Crisis score.</p>` });
			game.modules.get(MODULE_ID).api.broadcastBanner({ side: 'hero', who: c.name, what: 'Surrenders', tgt: '+2 Fabula Points' });
		} else {
			await actor.setFlag(MODULE_ID, 'fallen', 'sacrifice');
			await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><b>${esc(c.name)} makes a Sacrifice.</b> One final heroic act before leaving the story.</p>` });
			game.modules.get(MODULE_ID).api.broadcastBanner({ side: 'hero', who: c.name, what: 'Sacrifice', tgt: '' });
		}
	}

	async editClock(id) {
		const clock = id ? Clocks.list().find((c) => c.id === id) : null;
		const c = clock ?? { name: '', max: 6, current: 0, kind: 'goal', tick: false, hidden: false };
		const opt = (v, label, cur) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${label}</option>`;
		const content = `<div class="fbui-dlg">
			<label>Name<input type="text" name="name" value="${esc(c.name)}" placeholder="e.g. The bridge collapses" autofocus></label>
			<div class="two"><label>Sections<select name="max">${[4, 6, 8, 10, 12].map((n) => opt(n, n, c.max)).join('')}</select></label>
			${clock ? `<label>Filled<input type="number" name="current" min="0" max="${c.max}" value="${c.current}"></label>` : ''}
			<label>Kind<select name="kind">${opt('threat', 'Threat (bad when full)', c.kind)}${opt('goal', 'Heroes’ goal', c.kind)}${opt('env', 'Scene / environment', c.kind)}</select></label></div>
			<label class="chk"><input type="checkbox" name="tick" ${c.tick ? 'checked' : ''}> Fill 1 section at the end of each round</label>
			<label class="chk"><input type="checkbox" name="hidden" ${c.hidden ? 'checked' : ''}> Hidden from players</label>
		</div>`;
		const DialogV2 = foundry.applications.api.DialogV2;
		const read = (button) => {
			const f = button.form;
			return {
				name: f.elements.name.value.trim() || 'Clock',
				max: Number(f.elements.max.value),
				current: f.elements.current ? Number(f.elements.current.value) : 0,
				kind: f.elements.kind.value,
				tick: f.elements.tick.checked,
				hidden: f.elements.hidden.checked,
			};
		};
		const buttons = [{ action: 'save', label: clock ? 'Save' : 'Add clock', icon: 'fa-solid fa-check', default: true, callback: (ev, button) => read(button) }];
		if (clock) buttons.push({ action: 'delete', label: 'Delete', icon: 'fa-solid fa-trash', callback: () => 'delete' });
		const res = await DialogV2.wait({ window: { title: clock ? `Edit clock` : 'New scene clock' }, content, buttons, rejectClose: false, classes: ['fbui-dialog'] });
		if (!res) return;
		if (res === 'delete') return Clocks.request({ op: 'remove', id });
		if (clock) return Clocks.request({ op: 'update', id, data: res });
		return Clocks.request({ op: 'add', data: res });
	}
}

export { AFF_WORD };
