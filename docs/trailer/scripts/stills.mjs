// Renders chosen frames of a composition as JPEGs for review, bundling once.
// Usage: node scripts/stills.mjs <composition> <frame> [frame...]   -> out/stills/<composition>-<frame>.jpg
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [id, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: join(root, 'src', 'index.ts'), rspack: true, publicDir: join(root, 'public') });
const composition = await selectComposition({ serveUrl, id });
mkdirSync(join(root, 'out', 'stills'), { recursive: true });
for (const f of frames.map(Number)) {
	await renderStill({ serveUrl, composition, frame: f, output: join(root, 'out', 'stills', `${id}-${f}.jpg`), imageFormat: 'jpeg', jpegQuality: 85 });
	console.log('still', id, f);
}
