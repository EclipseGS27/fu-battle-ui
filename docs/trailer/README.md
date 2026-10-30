# Fabula Ultima modules trailer

A 90-second, 1920 × 1080, 60 fps trailer for the Fabula Ultima Foundry VTT modules (Battle UI, Battle Animations, Character Creator, Living Sprites), made with [Remotion](https://www.remotion.dev).

It lives in `docs/`, which the Battle UI's release workflow leaves out of the module zip, and it changes nothing in any module. The modules' own code runs inside the video:

- **Battle Animations**: every spell, strike and effect is the module's pixel effect code (`scripts/sf`, `scripts/pfx`, `scripts/pixelfx.mjs`), stepped one frame at a time, picked the way the module's tables pick them. Damage numbers, cut-ins and condition loops follow `impact.mjs`, `anim.css` and `statuses.mjs`.
- **Battle UI**: the battle screen, party sheet and window chrome are rebuilt from the module's markup and styled by its own `battle.css`, `sheet.css` and `party.css`. Its FFXIII menu sounds play on the UI cues.
- **Character Creator**: the wizard is rebuilt from its markup and styled by its own `creator.css`.
- **Living Sprites**: every sprite's idle, walk, lunge, flinch, victory and collapse is its `engine.js`.

See [STORYBOARD.md](STORYBOARD.md) for the shot list.

## Build it

Needs Node 20+, Python 3 with numpy and scipy, and ffmpeg.

```bash
npm install
```

Copy what the trailer uses out of the module repositories (they must be checked out next to `fu-battle-ui`):

```bash
node scripts/sync-assets.mjs
```

Prepare the art in `art-src/` (trims the sprites, crops the backdrops, writes `src/art/meta.json`):

```bash
python3 scripts/prepare-art.py
```

Synthesize the score and sound effects:

```bash
python3 scripts/make-audio.py
```

Preview in Remotion Studio:

```bash
npm run dev
```

Render:

```bash
npx remotion render Trailer out/trailer.mp4 --codec=h264 --crf=17
```

Review stills of any act without a full render:

```bash
node scripts/stills.mjs Combat 300 600 900
```

## Layout

| Path | What |
|---|---|
| `src/Trailer.tsx` | The five acts on one timeline |
| `src/scenes/` | Opening, Combat (crystal cave), Features, Showcase (flower field, aurora, effect wall), Closing |
| `src/scenes/battle.tsx` | The shared battle world: backdrop, effects, fighters, numbers, camera |
| `src/fx/pixel-runner.js` | Runs Battle Animations' effects outside Foundry, frame by frame |
| `src/ui/` | Battle UI, party sheet, creator, animation editor, cut-in, numbers, conditions, typography |
| `src/art/` | The trailer's own sprites and backdrops |
| `src/audio/Soundtrack.tsx` | Score and every sound cue, placed from the scenes' timing constants |
| `art-src/` | The source art: three heroes, four foes, three backdrops |
| `src/vendor/`, `public/shots`, `public/sounds`, `public/fonts` | Copied from the modules by `sync-assets.mjs` |

## Credits

- Character, monster and backdrop art: supplied for the trailer (`art-src/`).
- Pixel effects: Fabula Ultima Battle Animations, including Sprite Fusion's open source pixel art VFX and pixelfx (MIT; licenses in `src/vendor/fu-animations/scripts/sf` and `scripts/pfx`).
- Menu sounds: the FFXIII pack bundled with Fabula Ultima Battle UI.
- Fonts: Antonio and PT Sans, SIL Open Font License.
- Music and sound effects: synthesized by `scripts/make-audio.py`.
