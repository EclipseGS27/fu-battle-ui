# Trailer storyboard

90 seconds, 1920 × 1080, 60 fps (5,400 frames). The score runs at 120 BPM (one beat is 30 frames) and every act starts on a beat.

## Assets

| Asset | Source | Use |
|---|---|---|
| 96 pixel effects drawn in code | Battle Animations (`scripts/sf`, `scripts/pfx`, `scripts/pixelfx.mjs`) | Every spell, strike and flourish, played with the module's own mappings (Study, Elemental Shard, Comet, Lux, Heal, Cleansing Moonlight, breaths, bites, drains, claws). |
| Impact layer, cut-ins, damage numbers, condition loops | Battle Animations (`impact.mjs`, `anim.css`, `statuses.mjs`) | Hit freezes, shake, knockback, flashes, cut-in band, number styles, poisoned and weak loops. |
| Animation editor and effect picker | Battle Animations (`editor.mjs`, `anim.css`) | The customization slide, with live previews. |
| Battle screen, party sheet | Battle UI (`hud.mjs` markup, `battle.css`, `sheet.css`, `party.css`) | Rebuilt with demo data. |
| Wizard | Character Creator (`creator.mjs` markup, `creator.css`) | Rebuilt with demo data. |
| Pose engine | Living Sprites (`engine.js`) | All sprite motion; the idle and walk presets slide. |
| Screenshots | `docs/` in Battle UI and Battle Animations | Sheets, NPC sheet, point menus, Opportunity menu. |
| FFXIII menu sounds | Battle UI (`sounds/ff13`) | Cursor, confirm, turn, chime, fanfare cues. |
| Three heroes, four foes, three backdrops | Supplied for the trailer (`art-src/`) | Kael (red coat), Mira (hourglass oracle), Ren (crossbow); Frost Golem in the crystal cave, Wraith and Phantom Wolf in the flower field, Verdant Wyrm under the aurora. |
| Music and sound effects | Synthesized (`scripts/make-audio.py`) | The Battle Animations sound pack is paid and not in the repository. |

Demo data follows the module screenshots where they exist: Mira (Spiritist, Last Oracle of Vel) and the Frost Golem (Level 20 Champion, Minor Villain, Crushing Claw, Ice Breath, Glacies, Frozen Core, Shatter, fire Vulnerable).

## Act 1: Opening (0:00–0:10)

| Frames | Shot |
|---|---|
| 0–120 | Darkness, pixel embers, low drone. |
| 120–240 | **EVERY SPELL.** Rune circle and pillar of light. |
| 240–360 | **EVERY STRIKE.** Cross slash, impact, shake. |
| 360–480 | **EVERY FOE.** The Phantom Wolf, Wraith, Golem and Wyrm rise out of the dark. *611 bestiary attacks animated.* |
| 480–600 | Title hit: **FABULA ULTIMA**, *Foundry VTT modules*, over the crystal cave with the party facing the Golem. |

## Act 2: Combat in the crystal cave (0:10–0:30)

The Battle UI over the battle, turns alternating hero / foe as the module forecasts them. Side panels slide away (the module's "hide panels" mode) while the big moves play.

| Frames | Beat |
|---|---|
| 0–160 | HUD reveal, *Conflict start* banner. **A JRPG battle screen.** |
| 160–330 | Mira's command menu, cursor to **Study**: `?`, `!`, light bulb; the target panel's Affinities flip open. **Learn what you face.** |
| 330–500 | Villain's turn: the GM command panel, **Ice Breath** across the party; Mira's card turns Crisis. **Run every foe's turn.** |
| 500–690 | Ren opens the **Inventory** menu, throws an **Elemental Shard**: 40, *FIRE · VULNERABLE*. **Items in one click**, then **Every ability animated.** |
| 690–866 | *Round 2*. Cut-in **KAEL · NETHER SLASH**, dash with afterimages, critical 52; the Golem enters Crisis (red boss glow); the Opportunity menu opens. **Cut-ins and criticals.** |
| 866–975 | **Crushing Claw** leaves Kael weak (sinking arrows, drained tint). **Conditions on every token.** |
| 975–1200 | Mira's **Comet**: rune circle, meteor, shockwave, the Golem shatters; victory hops. **Every token comes alive.** |

## Act 3: Features (0:30–0:57)

| Frames | Slide |
|---|---|
| 0–180 | Battle UI character sheets: normal, wiped to Crisis red. |
| 180–330 | NPC sheets: the Frost Golem's sheet. |
| 330–580 | **See what your players see**: the GM's target panel (reveal toggles, *Players know*), the eye button switches to the player view; **Size it for your table**: A+ twice, A− once. |
| 580–760 | The party menu, rebuilt with the three heroes. |
| 760–940 | The Character Creator: Classes & Skills, then Attributes. |
| 940–1090 | Point menus and the Opportunity menu. |
| 1090–1380 | **Make every ability yours**: Nether Slash's Animation window; pick Cross slash from the live picker grid, set the color to Fire, set the hit sound to Fire Hit and play it, Save for every Nether Slash in the world. |
| 1380–1620 | **Living Sprites**: standing still (Breathe, Bob, Bounce, Battle Ready, Sway, Hover, Ghostly, Nervous), then moving (Hop, Waddle, March, Glide, Fly). |

## Act 4: Showcase (0:57–1:16.5)

| Frames | Shot |
|---|---|
| 0–440 | Flower field: Phantom Wolf's **Savage Bite**, Ren's crossbow, the Wraith's **Despair Drain** (the drain heals it), Mira's **Lux** (LIGHT · VULNERABLE), Kael's critical on the wolf. **611 bestiary attacks**, **Drains heal the drainer.** |
| 440–900 | Aurora: the Verdant Wyrm's **Venom Breath** poisons Kael and Ren (bubbles, green tint, Poisoned chips), Mira heals, Ren fires, then Mira's Heroic Skill **Cleansing Moonlight**: cut-in, pillar of light. **Conditions you can see**, **446 abilities animated.** |
| 900–1170 | A wall of twelve live effects, then **446** abilities, spells, items · **611** bestiary attacks · **96** pixel effects. |

## Act 5: Closing (1:16.5–1:30)

| Frames | Shot |
|---|---|
| 0–290 | The title over the aurora, the party below. |
| 290–560 | The four modules with their repositories (github.com/EclipseGS27/fu-battle-ui, fu-animations, fu-character-creator, fu-living-sprites). |
| 560–810 | Install: Add-on Modules › Install Module › paste the Manifest URL (from each README). Foundry VTT v13, Project FU 4.14 or later; Living Sprites works with any system. github.com/EclipseGS27. Fade out. |
