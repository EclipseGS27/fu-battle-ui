import { MODULE_ID, SOCKET, clamp, randomId, setting } from './util.mjs';

/**
 * Scene clocks live in a scene flag so they survive between conflicts in the same scene.
 * @typedef {{id:string,name:string,max:number,current:number,kind:'threat'|'goal'|'env',tick:boolean,hidden:boolean}} Clock
 */

export const Clocks = {
	/** The scene whose clocks the UI shows: the active combat's scene, else the viewed scene. */
	scene() {
		return game.combat?.scene ?? canvas?.scene ?? game.scenes?.viewed ?? null;
	},

	/** @returns {Clock[]} */
	list(scene = this.scene()) {
		const raw = scene?.getFlag?.(MODULE_ID, 'clocks');
		return Array.isArray(raw) ? raw.map((c) => normalize(c)) : [];
	},

	visible(scene = this.scene()) {
		const all = this.list(scene);
		return game.user.isGM ? all : all.filter((c) => !c.hidden);
	},

	isFull: (c) => c.current >= c.max,

	/** Pure: returns new list and the clock that just filled, if any */
	applyTick(list, id, n) {
		let filled = null;
		const out = list.map((c) => {
			if (c.id !== id) return c;
			const current = clamp(c.current + n, 0, c.max);
			if (current >= c.max && c.current < c.max) filled = { ...c, current };
			return { ...c, current };
		});
		return { list: out, filled };
	},

	/**
	 * Entry point for every change. GMs write directly; players go through the socket.
	 * @param {{op:'add'|'update'|'remove'|'tick', id?:string, n?:number, data?:object, reason?:string}} action
	 */
	async request(action) {
		const scene = this.scene();
		if (!scene) return ui.notifications?.warn('No scene for clocks.');
		const payload = { ...action, sceneId: scene.id, userId: game.user.id };
		if (game.user.isGM) return this.apply(payload);
		if (!game.users.activeGM) return ui.notifications?.warn('A GM must be online to change clocks.');
		const direct = setting('playersFillClocks') && action.op === 'tick';
		game.socket.emit(SOCKET, { type: direct ? 'clockApply' : 'clockRequest', payload });
		if (!direct) ui.notifications?.info('Clock change sent to the GM for approval.');
	},

	/** GM side: actually write the change. */
	async apply(payload) {
		const scene = game.scenes.get(payload.sceneId) ?? this.scene();
		if (!scene) return;
		let list = this.list(scene);
		let filled = null;
		switch (payload.op) {
			case 'add': {
				const d = payload.data ?? {};
				list.push(
					normalize({
						id: randomId(),
						name: d.name || 'Clock',
						max: d.max ?? 6,
						current: d.current ?? 0,
						kind: d.kind ?? 'env',
						tick: !!d.tick,
						hidden: !!d.hidden,
					}),
				);
				break;
			}
			case 'update':
				list = list.map((c) => (c.id === payload.id ? normalize({ ...c, ...payload.data }) : c));
				break;
			case 'remove':
				list = list.filter((c) => c.id !== payload.id);
				break;
			case 'tick': {
				const r = this.applyTick(list, payload.id, payload.n ?? 1);
				list = r.list;
				filled = r.filled;
				break;
			}
		}
		await saveClocks(scene, list);
		if (payload.op === 'tick' && payload.reason) {
			const c = list.find((x) => x.id === payload.id);
			const n = payload.n ?? 1;
			if (c && !c.hidden) {
				game.modules.get(MODULE_ID)?.api?.broadcastBanner({ side: 'clock', who: payload.reason, what: c.name, tgt: `${n > 0 ? 'fills' : 'erases'} ${Math.abs(n)} section${Math.abs(n) === 1 ? '' : 's'} · ${c.current}/${c.max}` });
			}
		}
		if (filled) announceFull(filled, payload.reason ?? '');
		return filled;
	},

	/** GM: advance every "+1 each round" clock. */
	async tickRound(endedRound) {
		const scene = this.scene();
		if (!scene) return;
		let list = this.list(scene);
		const ticking = list.filter((c) => c.tick && c.current < c.max);
		if (!ticking.length) return;
		const filled = [];
		for (const c of ticking) {
			const r = this.applyTick(list, c.id, 1);
			list = r.list;
			if (r.filled) filled.push(r.filled);
		}
		await saveClocks(scene, list);
		const filledIds = new Set(filled.map((c) => c.id));
		const visibleNames = ticking.filter((c) => !c.hidden && !filledIds.has(c.id)).map((c) => c.name);
		if (visibleNames.length) game.modules.get(MODULE_ID)?.api?.broadcastBanner({ side: 'clock', who: 'End of round', what: 'Clocks tick', tgt: visibleNames.join(', ') + ' +1' });
		filled.forEach((c) => announceFull(c, `end of round ${endedRound}`));
	},
};

async function saveClocks(scene, list) {
	if (!scene) return;
	await scene.setFlag(MODULE_ID, 'clocks', list);
}

function normalize(c) {
	const max = clamp(Number(c.max) || 6, 2, 20);
	return {
		id: String(c.id ?? randomId()),
		name: String(c.name ?? 'Clock'),
		max,
		current: clamp(Number(c.current) || 0, 0, max),
		kind: ['threat', 'goal', 'env'].includes(c.kind) ? c.kind : 'env',
		tick: !!c.tick,
		hidden: !!c.hidden,
	};
}

function announceFull(clock, reason) {
	const api = game.modules.get(MODULE_ID)?.api;
	if (!api) return;
	if (clock.hidden) {
		// Only the GM learns about hidden clocks filling
		api.ui?.banner({ side: 'clock', who: 'Hidden clock full', what: clock.name, tgt: reason });
		return;
	}
	api.broadcastBanner({ side: 'clock', who: 'Clock full', what: clock.name, tgt: reason });
}
