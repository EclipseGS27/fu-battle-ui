// The party and their foes. Mira and the Frost Golem are the characters on the module's own screenshots
// (docs/sheet-crisis.png and docs/npc-sheet.png); the art is the trailer's own (art-src/).
import { ArtName, faceUrl } from '../art/art';
import { Who } from '../ui/Hud';

const who = (n: ArtName, name: string, tint: string): Who => ({ name, tint, face: faceUrl(n) });

export const people = () => ({
	kael: who('hero-1', 'Kael', '#3a1a22'),
	mira: who('hero-2', 'Mira', '#1d2a55'),
	ren: who('hero-3', 'Ren', '#23361f'),
	golem: who('golem', 'Frost Golem', '#16303a'),
	dragon: who('dragon', 'Verdant Wyrm', '#16301c'),
	wraith: who('wraith', 'Wraith', '#141c33'),
	wolf: who('phantom-wolf', 'Phantom Wolf', '#10283a'),
});

export const GOLEM_AFF: Record<string, string> = { physical: 'RS', air: '·', bolt: '·', dark: '·', earth: 'IM', fire: 'VU', ice: 'AB', light: '·', poison: 'IM' };

export const GOLEM_ABILITIES = [
	{ group: 'Attacks', label: 'Crushing Claw', meta: '【MIG + MIG】 +1 · HR +5 physical' },
	{ group: 'Attacks', label: 'Ice Breath', meta: '【DEX + INS】 · HR +10 ice' },
	{ group: 'Spells', label: 'Glacies', meta: '10 MP × T' },
	{ group: 'Skills and rules', label: 'Frozen Core', meta: 'skill' },
	{ group: 'Skills and rules', label: 'Shatter', meta: 'rule' },
];
