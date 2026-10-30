import { MODULE_ID, esc, setting } from './util.mjs';
import { FRIENDLY } from './model.mjs';

/**
 * Turn glow: the token whose turn it is gets a soft outline glow instead of Foundry's turn marker.
 * Heroes, enemies and bosses each have their own look, and each changes when that combatant is in Crisis.
 */

export const GLOW_STYLES = { soft: 'Soft', pulse: 'Pulse', energy: 'Energy aura', flicker: 'Flicker', none: 'Off' };
export const GLOW_PROFILES = [
	['hero', 'Heroes'],
	['heroCrisis', 'Heroes in Crisis'],
	['foe', 'Enemies'],
	['foeCrisis', 'Enemies in Crisis'],
	['boss', 'Bosses'],
	['bossCrisis', 'Bosses in Crisis'],
];
export const BOSS_RULES = { 'villain-champion': 'Villains and Champions', villain: 'Villains only', champion: 'Champions only', none: 'Nobody (bosses glow like other enemies)' };

export const GLOW_DEFAULTS = {
	enabled: true,
	hideMarker: true,
	boss: 'villain-champion',
	profiles: {
		hero: { style: 'soft', color: '#5aa9ff', strength: 1, size: 1, speed: 1 },
		heroCrisis: { style: 'pulse', color: '#ff5a64', strength: 1.3, size: 1.15, speed: 1.3 },
		foe: { style: 'soft', color: '#ff5a6e', strength: 1.3, size: 1.1, speed: 1 },
		foeCrisis: { style: 'flicker', color: '#ff3b3b', strength: 1.3, size: 1.1, speed: 1 },
		boss: { style: 'energy', color: '#b072ff', strength: 1.8, size: 1.9, speed: 1 },
		bossCrisis: { style: 'energy', color: '#ff2a55', strength: 2.3, size: 2.2, speed: 1.6 },
	},
};

const clampN = (v, lo, hi, d) => {
	const n = Number(v);
	return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** Saved config merged over the defaults, every value checked */
export function glowConfig(raw = setting('turnGlow')) {
	const src = raw && typeof raw === 'object' ? raw : {};
	const out = { enabled: src.enabled ?? GLOW_DEFAULTS.enabled, hideMarker: src.hideMarker ?? GLOW_DEFAULTS.hideMarker, boss: BOSS_RULES[src.boss] ? src.boss : GLOW_DEFAULTS.boss, profiles: {} };
	for (const [id] of GLOW_PROFILES) {
		const d = GLOW_DEFAULTS.profiles[id];
		const p = src.profiles?.[id] ?? {};
		out.profiles[id] = {
			style: GLOW_STYLES[p.style] ? p.style : d.style,
			color: /^#[0-9a-f]{6}$/i.test(p.color ?? '') ? p.color : d.color,
			strength: clampN(p.strength, 0.2, 3, d.strength),
			size: clampN(p.size, 0.3, 3, d.size),
			speed: clampN(p.speed, 0.2, 3, d.speed),
		};
	}
	return out;
}

/* ------------------------------------------------------------------ */
/*  Shader                                                             */
/* ------------------------------------------------------------------ */

const FRAG = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform highp vec4 inputSize;
uniform vec4 inputClamp;
uniform vec3 uColor;
uniform float uStrength;
uniform float uReach;
uniform float uTime;
uniform float uEnergy;
uniform float uCore;
uniform float uInner;

const float PI2 = 6.28318530718;
const float ANGLES = 18.0;
const float STEPS = 10.0;

void main(void) {
	vec4 base = texture2D(uSampler, vTextureCoord);
	float total = 0.0;
	float near = 0.0;
	for (float i = 0.0; i < ANGLES; i += 1.0) {
		float a = i / ANGLES * PI2;
		// energy: the aura ripples, with rays that drift around the silhouette
		float wave = 1.0 + uEnergy * (0.55 * sin(a * 5.0 + uTime * 3.1) + 0.35 * sin(a * 9.0 - uTime * 5.3));
		float reach = uReach * max(0.3, 1.0 + uEnergy * 0.35 * sin(a * 3.0 + uTime * 1.7));
		vec2 dir = vec2(cos(a), sin(a)) * inputSize.zw * (reach / STEPS);
		for (float s = 1.0; s <= STEPS; s += 1.0) {
			float al = texture2D(uSampler, clamp(vTextureCoord + dir * s, inputClamp.xy, inputClamp.zw)).a;
			total += al * ((STEPS + 1.0 - s) / STEPS) * max(0.0, wave);
			if (s < 2.5) near += al;
		}
	}
	float glow = clamp(total / (ANGLES * (STEPS + 1.0) * 0.5), 0.0, 1.0);
	glow = pow(glow, 0.75);
	float outer = clamp(glow * uStrength, 0.0, 1.0) * (1.0 - base.a);
	vec3 col = mix(uColor, vec3(1.0), clamp(glow * glow * uCore, 0.0, 0.9));
	// a little of the color creeps onto the token's own edge
	float edge = 1.0 - clamp(near / (ANGLES * 2.0), 0.0, 1.0);
	vec3 rim = uColor * edge * uInner * base.a;
	gl_FragColor = vec4(base.rgb + rim, base.a) + vec4(col * outer, outer);
}`;

let GlowFilterClass = null;
function makeFilter() {
	if (!GlowFilterClass) {
		GlowFilterClass = class FBUIGlowFilter extends PIXI.Filter {
			constructor() {
				super(undefined, FRAG, { uColor: new Float32Array([1, 1, 1]), uStrength: 1, uReach: 12, uTime: 0, uEnergy: 0, uCore: 0, uInner: 0 });
				this.padding = 40;
				this.fbuiGlow = true;
			}
		};
	}
	return new GlowFilterClass();
}

const hex = (c) => {
	const n = parseInt(String(c).slice(1), 16) || 0;
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/* ------------------------------------------------------------------ */
/*  Who gets which look                                                */
/* ------------------------------------------------------------------ */

function inCrisis(actor) {
	const hp = actor?.system?.resources?.hp ?? {};
	const value = Number(hp.value ?? 0);
	const max = Math.max(1, Number(hp.max ?? 1));
	const crisis = Number.isFinite(Number(hp.crisisScore)) ? Number(hp.crisisScore) : Math.floor(max / 2);
	return value <= crisis;
}

function isBoss(actor, rule) {
	if (actor?.type !== 'npc' || rule === 'none') return false;
	const villain = !!actor.system?.villain?.value;
	const champion = actor.system?.rank?.value === 'champion';
	if (rule === 'villain') return villain;
	if (rule === 'champion') return champion;
	return villain || champion;
}

export function profileFor(combatant, cfg = glowConfig()) {
	const actor = combatant?.actor;
	if (!actor) return null;
	const hero = combatant.faction ? combatant.faction === FRIENDLY : (combatant.token?.disposition ?? 0) > 0;
	const side = hero ? 'hero' : isBoss(actor, cfg.boss) ? 'boss' : 'foe';
	return cfg.profiles[inCrisis(actor) ? `${side}Crisis` : side];
}

/* ------------------------------------------------------------------ */
/*  Controller                                                         */
/* ------------------------------------------------------------------ */

class TurnGlowController {
	constructor() {
		this.token = null;
		this.filter = null;
		this.profile = null;
		this.preview = null;
		this.t = 0;
		this.age = 0;
		this._tick = (dt) => this.#tick(dt);
		this._ticking = false;
		this._cfg = null;
		this.hidden = new WeakSet();
	}

	init() {
		const sync = () => this.sync();
		for (const h of ['canvasReady', 'combatStart', 'updateCombat', 'deleteCombat', 'createCombatant', 'deleteCombatant', 'updateCombatant', 'updateActor', 'createToken', 'deleteToken']) Hooks.on(h, () => setTimeout(sync, 0));
		// a redraw (new art, size change) replaces the token's mesh: put the glow back on the new one
		Hooks.on('refreshToken', (token) => {
			if (token === this.token && this.filter && !token.mesh?.filters?.includes(this.filter)) this.#attach(token);
			if (token === this.token) this.#hideMarker(token);
		});
		Hooks.on('drawToken', (token) => {
			if (this.token && token.id === this.token.id) setTimeout(sync, 0);
		});
		this.sync();
	}

	get cfg() {
		return (this._cfg ??= glowConfig());
	}

	/** settings changed */
	reconfigure() {
		this._cfg = null;
		this.sync();
	}

	/** The token to glow right now, and how */
	#target() {
		if (this.preview && performance.now() < this.preview.until) return { token: this.preview.token, profile: this.preview.profile?.style === 'none' ? null : this.preview.profile };
		this.preview = null;
		const cfg = this.cfg;
		if (!cfg.enabled || !canvas?.ready) return null;
		const combat = game.combat;
		if (!combat?.started || combat.scene && combat.scene !== canvas.scene) return null;
		const c = combat.combatant;
		const token = c?.token?.object;
		if (!token) return null;
		const profile = profileFor(c, cfg);
		if (!profile || profile.style === 'none') return { token, profile: null };
		return { token, profile };
	}

	sync() {
		const want = this.#target();
		const token = want?.token ?? null;
		if (token !== this.token) {
			this.#detach();
			this.token = token;
			this.age = 0;
		}
		this.profile = want?.profile ?? null;
		if (this.token && this.profile) {
			this.#attach(this.token);
			this.#hideMarker(this.token);
			this.#run(true);
		} else {
			this.#detach();
			this.#showMarker(this.token);
			this.#run(false);
		}
	}

	/** Show a look on a token for a few seconds (the settings window's Preview) */
	showPreview(token, profile, ms = 5000) {
		if (!token) return ui.notifications.warn('Select a token on the canvas to preview the glow.');
		this.preview = { token, profile, until: performance.now() + ms };
		this.sync();
		setTimeout(() => this.sync(), ms + 50);
	}

	#attach(token) {
		const mesh = token?.mesh;
		if (!mesh) return;
		this.filter ??= makeFilter();
		const list = (mesh.filters ?? []).filter((f) => !f?.fbuiGlow);
		mesh.filters = [...list, this.filter];
	}

	#detach() {
		const mesh = this.token?.mesh;
		if (mesh?.filters) {
			const list = mesh.filters.filter((f) => !f?.fbuiGlow);
			mesh.filters = list.length ? list : null;
		}
	}

	#hideMarker(token) {
		if (!token || !this.cfg.hideMarker || !this.profile) return;
		const m = token.turnMarker;
		if (m && !m.destroyed) {
			m.visible = false;
			if (m.mesh) m.mesh.visible = false;
			this.hidden.add(m);
		}
	}

	/** Only for the active token when its glow goes away: Foundry looks after markers of tokens whose turn is over */
	#showMarker(token) {
		const m = token?.turnMarker;
		if (m && !m.destroyed && this.hidden.has(m)) {
			m.visible = true;
			if (m.mesh) m.mesh.visible = true;
			this.hidden.delete(m);
		}
	}

	#run(on) {
		const ticker = canvas?.app?.ticker;
		if (!ticker) return;
		if (on && !this._ticking) {
			ticker.add(this._tick);
			this._ticking = true;
		} else if (!on && this._ticking) {
			ticker.remove(this._tick);
			this._ticking = false;
		}
	}

	#tick() {
		const token = this.token;
		const p = this.profile;
		const f = this.filter;
		if (!token || token.destroyed || !p || !f) return;
		const dt = (canvas.app.ticker.deltaMS ?? 16) / 1000;
		this.t += dt;
		this.age += dt;
		const t = this.t * p.speed;
		const zoom = canvas.stage?.scale?.x ?? 1;
		const base = Math.max(6, Math.min(token.w ?? 100, token.h ?? 100) * 0.12) * p.size;
		let strength = p.strength;
		let reach = base;
		let energy = 0;
		let core = 0;
		let inner = 0.08;
		switch (p.style) {
			case 'soft':
				strength *= 0.85 + 0.15 * Math.sin(t * 1.8);
				break;
			case 'pulse': {
				const k = 0.5 + 0.5 * Math.sin(t * 3.4);
				strength *= 0.5 + 0.65 * k;
				reach *= 0.85 + 0.3 * k;
				inner = 0.18 * k;
				break;
			}
			case 'energy':
				energy = 1;
				core = 0.85;
				inner = 0.3;
				reach *= 1.15;
				strength *= 0.9 + 0.12 * Math.sin(t * 5);
				break;
			case 'flicker': {
				energy = 0.35;
				inner = 0.2;
				let k = 0.62 + 0.24 * Math.sin(t * 13.7) + 0.14 * Math.sin(t * 31.1 + 1.3);
				if (Math.random() < 0.03) k -= 0.45;
				strength *= Math.min(1.15, Math.max(0.15, k));
				break;
			}
		}
		strength *= Math.min(1, this.age / 0.35);
		const px = Math.min(140, reach * zoom);
		const u = f.uniforms;
		const [r, g, b] = hex(p.color);
		u.uColor[0] = r;
		u.uColor[1] = g;
		u.uColor[2] = b;
		u.uStrength = strength;
		u.uReach = px;
		u.uTime = t;
		u.uEnergy = energy;
		u.uCore = core;
		u.uInner = inner;
		f.padding = Math.ceil(px * (1 + energy * 0.4)) + 4;
		if (this.cfg.hideMarker) this.#hideMarker(token);
	}
}

export const TurnGlow = new TurnGlowController();

/* ------------------------------------------------------------------ */
/*  Settings window                                                    */
/* ------------------------------------------------------------------ */

const { ApplicationV2 } = foundry.applications.api;

export class TurnGlowConfig extends ApplicationV2 {
	static DEFAULT_OPTIONS = {
		id: 'fbui-glow-config',
		tag: 'form',
		classes: ['fbui-armory', 'fbui-glowcfg'],
		window: { title: 'Turn glow', icon: 'fa-solid fa-sun', resizable: true },
		position: { width: 760, height: 'auto' },
		form: { handler: TurnGlowConfig.#onSubmit, closeOnSubmit: true },
		actions: { preview: TurnGlowConfig.#onPreview, reset: TurnGlowConfig.#onReset },
	};

	#draft = null;

	async _renderHTML() {
		const cfg = this.#draft ?? glowConfig();
		const opt = (map, sel) => Object.entries(map).map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
		const range = (name, v, lo, hi) => `<input type="range" name="${name}" min="${lo}" max="${hi}" step="0.1" value="${v}"><output>${Number(v).toFixed(1)}</output>`;
		const rows = GLOW_PROFILES.map(([id, label]) => {
			const p = cfg.profiles[id];
			const n = (k) => `profiles.${id}.${k}`;
			return `<tr class="${id.endsWith('Crisis') ? 'crisis' : ''}">
				<th>${esc(label)}</th>
				<td><select name="${n('style')}">${opt(GLOW_STYLES, p.style)}</select></td>
				<td><input type="color" name="${n('color')}" value="${p.color}"></td>
				<td class="rg">${range(n('strength'), p.strength, 0.2, 3)}</td>
				<td class="rg">${range(n('size'), p.size, 0.3, 3)}</td>
				<td class="rg">${range(n('speed'), p.speed, 0.2, 3)}</td>
				<td><button type="button" class="btn sm" data-action="preview" data-profile="${id}" data-tooltip="Show this look on your selected token for 5 seconds"><i class="fa-solid fa-eye"></i></button></td>
			</tr>`;
		}).join('');
		const div = document.createElement('div');
		div.className = 'fbui-armory-body glow';
		div.innerHTML = `
			<p>The token whose turn it is glows instead of showing Foundry’s turn marker. Each look changes when that combatant is in Crisis.</p>
			<div class="opts">
				<label class="row"><input type="checkbox" name="enabled" ${cfg.enabled ? 'checked' : ''}> Turn glow on</label>
				<label class="row"><input type="checkbox" name="hideMarker" ${cfg.hideMarker ? 'checked' : ''}> Hide Foundry’s turn marker while a token glows</label>
				<label class="row">Bosses are <select name="boss">${opt(BOSS_RULES, cfg.boss)}</select></label>
			</div>
			<table class="gt">
				<thead><tr><th></th><th>Style</th><th>Color</th><th>Strength</th><th>Size</th><th>Speed</th><th></th></tr></thead>
				<tbody>${rows}</tbody>
			</table>
			<p class="note">Soft: a gentle steady glow. Pulse: breathes in and out. Energy aura: a rippling aura with a bright core. Flicker: unstable, like it might give out.</p>
			<div class="foot"><button type="button" class="btn" data-action="reset">Defaults</button><span class="sp"></span><button type="submit" class="btn gold">Save</button></div>`;
		div.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => (r.nextElementSibling.textContent = Number(r.value).toFixed(1))));
		return div;
	}

	_replaceHTML(result, content) {
		content.replaceChildren(result);
	}

	#read() {
		const fd = new foundry.applications.ux.FormDataExtended(this.element);
		return TurnGlowConfig.#expand(fd.object);
	}

	static #expand(flat) {
		const o = foundry.utils.expandObject(flat);
		return glowConfig({ ...o, enabled: !!o.enabled, hideMarker: !!o.hideMarker });
	}

	static async #onSubmit(event, form, formData) {
		await game.settings.set(MODULE_ID, 'turnGlow', TurnGlowConfig.#expand(formData.object));
	}

	static #onPreview(event, target) {
		const cfg = this.#read();
		const token = canvas.tokens?.controlled?.[0] ?? game.combat?.combatant?.token?.object;
		TurnGlow.showPreview(token, cfg.profiles[target.dataset.profile]);
	}

	static #onReset() {
		this.#draft = foundry.utils.deepClone(GLOW_DEFAULTS);
		this.render();
	}
}
