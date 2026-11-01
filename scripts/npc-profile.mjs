import { MODULE_ID, setting } from './util.mjs';
import { adversaryDetail, profileTier } from './party-sheet.mjs';
import { sfx } from './sfx.mjs';

/**
 * Battle UI look for Project FU's NPC profile window (what the party has learned about an adversary, opened
 * from the party sheet, Study chat cards and the adversary list). The system still decides what is known;
 * this draws it the way the party sheet's Adversaries tab does.
 */

const PROFILE = `modules/${MODULE_ID}/templates/party/profile.hbs`;

function partyEntry(app, context) {
	const uuid = context?.uuid ?? context?.actor?.uuid;
	const fromParty = app.party?.system?.adversaries?.find?.((a) => a.uuid === uuid);
	return { uuid, name: context?.name, img: context?.img, study: context?.study ?? fromParty?.study ?? 0, revealed: context?.revealed ?? fromParty?.revealed ?? {} };
}

async function restyle(app, element, context) {
	if (setting('profileStyle') === false) return;
	const root = element instanceof HTMLElement ? element : element?.[0];
	const actor = context?.actor;
	const body = root?.querySelector('.window-content');
	if (!body || !actor) return;
	const entry = partyEntry(app, context);
	let detail;
	try {
		detail = adversaryDetail(entry, actor, profileTier(context));
	} catch (err) {
		console.warn(`${MODULE_ID} | NPC profile`, err);
		return;
	}
	detail.inWindow = true;
	const html = await foundry.applications.handlebars.renderTemplate(PROFILE, detail);
	root.classList.add('fbui-sheet', 'fbui-profile');
	body.innerHTML = `<div class="fbp-adv-main">${html}</div>`;
	body.querySelectorAll('details > summary').forEach((s) => s.addEventListener('click', () => sfx('cursor')));
	// the system sizes the window for its own layout; ours is a column
	if (!app._fbuiSized) {
		app._fbuiSized = true;
		app.setPosition?.({ width: 560, height: Math.min(820, window.innerHeight - 80) });
	}
}

export function registerProfileStyle() {
	Hooks.once('init', () => foundry.applications.handlebars.loadTemplates([PROFILE]));
	Hooks.on('renderNpcProfileWindow', (app, element, context) => {
		restyle(app, element, context).catch((err) => console.warn(`${MODULE_ID} | NPC profile`, err));
	});
}
