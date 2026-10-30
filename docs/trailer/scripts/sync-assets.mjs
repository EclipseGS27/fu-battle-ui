// Copies what the trailer uses out of the module repositories, read-only.
// Code and styles go to src/vendor/<repo>/ (same layout as the repo, so relative imports and
// url() references keep working); screenshots, sounds and fonts go to public/.
//
// Usage: node scripts/sync-assets.mjs [path to the folder holding the module repos]
// Default: the folder three levels up (docs/trailer -> fu-battle-ui -> its parent).

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const trailer = resolve(here, '..');
const repos = resolve(process.argv[2] ?? join(trailer, '..', '..', '..'));

const need = ['fu-battle-ui', 'fu-animations', 'fu-living-sprites', 'fu-character-creator'];
for (const r of need) {
	if (!existsSync(join(repos, r))) {
		console.error(`Missing ${r} in ${repos}. Clone the repos side by side, or pass their folder.`);
		process.exit(1);
	}
}

const vendor = join(trailer, 'src', 'vendor');
const pub = join(trailer, 'public');
rmSync(vendor, { recursive: true, force: true });

const copy = (repo, from, to) => {
	const src = join(repos, repo, from);
	mkdirSync(dirname(to), { recursive: true });
	cpSync(src, to, { recursive: true });
};
const code = (repo, ...paths) => paths.forEach((p) => copy(repo, p, join(vendor, repo, p)));
const asset = (repo, from, to) => copy(repo, from, join(pub, to));

// Battle Animations: the pixel effects (Sprite Fusion VFX, pixelfx library) and the cut-in styles
code('fu-animations', 'scripts/sf', 'scripts/pfx', 'scripts/pixelfx.mjs', 'styles/anim.css');
// Living Sprites: the pose engine (no Foundry code in it)
code('fu-living-sprites', 'scripts/engine.js');
// Battle UI and Character Creator: their stylesheets and fonts
code('fu-battle-ui', 'styles/battle.css', 'styles/party.css', 'styles/sheet.css', 'fonts');
code('fu-character-creator', 'styles/creator.css');

// Screenshots
for (const f of ['sheet-crisis', 'npc-sheet', 'point-menus', 'battle-menu', 'opportunity', 'turn-glow']) asset('fu-battle-ui', `docs/${f}.png`, `shots/${f}.png`);
for (const f of ['effects', 'conditions', 'picker']) asset('fu-animations', `docs/${f}.png`, `shots/${f}.png`);
// Menu sounds (FFXIII and FFVII packs bundled with the Battle UI) and fonts
asset('fu-battle-ui', 'sounds', 'sounds/ui');
asset('fu-battle-ui', 'fonts', 'fonts');

console.log(`Synced from ${repos}`);
