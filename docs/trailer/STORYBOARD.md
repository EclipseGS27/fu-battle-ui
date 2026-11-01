# Trailer storyboard

3 minutes, 1920 × 1080, 60 fps (10,800 frames). The score runs at 120 BPM (one beat is 30 frames) and every act starts on a beat.

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

## Layout

The Battle UI puts the enemy's target panel on the left and the heroes' command menu on the right, so every battle follows it: the foes stand on the left facing right, the party on the right facing left, next to their menu and their cards.

## Act 1: Opening (0:00–0:18)

| Frames | Shot |
|---|---|
| 0–180 | Darkness, pixel embers, low drone. |
| 180–420 | **EVERY SPELL.** Rune circle and pillar of light. |
| 420–660 | **EVERY STRIKE.** Cross slash, impact, shake. |
| 660–900 | **EVERY FOE.** The Phantom Wolf, Wraith, Golem and Wyrm rise out of the dark one by one. *611 bestiary attacks animated.* |
| 900–1080 | Title hit: **FABULA ULTIMA**, *Foundry VTT modules*, over the crystal cave: the Golem on the left, the party on the right. |

## Act 2: Combat in the crystal cave (0:18–1:08)

Turns alternate hero / foe as the module forecasts them. Side panels slide away (the module's "hide panels" mode) while the big moves play; every beat has a hold before and after it.

| Frames | Beat |
|---|---|
| 0–330 | HUD reveal, *Conflict start* banner. **A JRPG battle screen.** |
| 330–780 | Mira's command menu, cursor to **Study**: `?`, `!`, light bulb; the target panel's Affinities flip open. **Learn what you face.** |
| 780–1180 | Villain's turn: the GM command panel, **Ice Breath** across the party; Mira's card turns Crisis. **Run every foe's turn**, **Crisis at a glance.** |
| 1180–1640 | Ren opens the **Inventory** menu and throws an **Elemental Shard**: 40, *FIRE · VULNERABLE*. **Items in one click**, **Every ability animated.** |
| 1640–2060 | *Round 2*. Cut-in **KAEL · NETHER SLASH**, dash with afterimages, critical 52; the Golem enters Crisis; the Opportunity menu opens. **Cut-ins and criticals.** |
| 2060–2400 | **Crushing Claw** leaves Kael weak (sinking arrows, drained tint). **Conditions on every token.** |
| 2400–3000 | Mira's **Comet**: rune circle, meteor, shockwave; the Golem shatters; victory hops. **Every token comes alive.** |

## Act 3: Features (1:08–2:00.5)

| Frames | Slide |
|---|---|
| 0–330 | Battle UI character sheets: normal, wiped to Crisis red. |
| 330–630 | NPC sheets: the Frost Golem's sheet. |
| 630–1110 | **See what your players see**: the GM's target panel (reveal toggles, *Players know*), the eye button switches to the player view; **Size it for your table**: A+ twice (90% → 110%), A− once. |
| 1110–1440 | The party menu with the three heroes. |
| 1440–1830 | The Character Creator: Classes & Skills, then Attributes. |
| 1830–2130 | Point menus and the Opportunity menu. |
| 2130–2670 | **Make every ability yours**: Nether Slash's Animation window; pick Cross slash from the live picker grid, set the color to Fire, set the hit sound to Fire Hit and play it, Save for every Nether Slash in the world. |
| 2670–3150 | **Living Sprites**: standing still (Breathe, Bob, Bounce, Battle Ready, Sway, Hover, Ghostly, Nervous), then moving (Hop, Waddle, March, Glide, Fly). |

## Act 4: Showcase (2:00.5–2:36)

| Frames | Shot |
|---|---|
| 0–780 | Flower field: the Phantom Wolf's **Savage Bite**, Ren's crossbow, the Wraith's **Despair Drain** (the drain heals it), Mira's **Lux** (LIGHT · VULNERABLE), Kael's critical on the wolf. **611 bestiary attacks**, **Drains heal the drainer.** |
| 780–1650 | Aurora: the Verdant Wyrm's **Venom Breath** poisons Kael and Ren (bubbles, green tint, Poisoned chips), Mira heals, Ren fires, then Mira's Heroic Skill **Cleansing Moonlight**: cut-in, pillar of light. **Conditions you can see**, **446 abilities animated.** |
| 1650–2130 | A wall of twelve live effects, then **446** abilities, spells, items · **611** bestiary attacks · **96** pixel effects. |

## Act 5: Closing (2:36–3:00)

| Frames | Shot |
|---|---|
| 0–480 | The title over the aurora, the party below. |
| 480–960 | The four modules with their repositories (github.com/EclipseGS27/fu-battle-ui, fu-animations, fu-character-creator, fu-living-sprites). |
| 960–1440 | Install: Add-on Modules › Install Module › paste the Manifest URL (from each README). Foundry VTT v13, Project FU 4.14 or later; Living Sprites works with any system. github.com/EclipseGS27. Fade out. |
