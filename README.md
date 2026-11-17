[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/binasalama12/makefun-best-game-01-w3-rev4-floodwarden/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/binasalama12/makefun-best-game-01-w3-rev4-floodwarden/reward.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# FLOODWARDEN

**FLOODWARDEN: dig trenches and raise levees to steer the flood — 9 storms, 3 valleys, 9 tools, 8 valley marks and the Deluge**

A dig-and-route flood defence game. Each storm day the river rises over a
top-down valley grid and the water flows downhill, cell to cell. You spend a
limited earth budget to **dig channels** and **raise levees** before and
during the flood, steering the water into reservoirs and the outflow while
keeping the village houses dry — and keeping dry paths open so stranded
animals can climb to safety.

## How to play

- **Click** a cell to dig a channel (−1 earth). **Right-click** or
  **Shift+Click** to raise a levee (−2 earth). Earth is limited every day.
- Water seeks lower ground: carve a route from the river to the **reservoir**
  basins and the **outflow**, and ring the houses you cannot afford to lose.
- **WIN a day:** keep the required number of houses dry until the storm timer
  runs out. **LOSE the run:** end a storm with fewer dry houses than required.
- Stranded animals seek the driest neighbouring cell on their own — keep a
  dry path open and each rescue pays +500, pays supplies, and earns marks.
- Captured water (reservoir + outflow) pays **supplies** and score. Press
  **B** to buy +5 earth for 12 supplies. Press **Q** for the Sandbag Line
  tool once drafted.
- After every held day, **draft 1 of 3 tools**. Tools and marks stack for
  the whole run.

## The run

- **9 storm days across 3 valleys** — Green Hollow (days 1–3), Ember Canyon
  (days 4–6), Moon Fen (days 7–9) — each with its own palette, procedurally
  textured terrain (height grain, wet/dry shading), rain and shimmer.
- **Bosses:** Day 5 is **THE CRACKED DAM**, leaking pulses of water from the
  dam wall. Day 9 is **THE DELUGE**: twin rivers plus a storm surge meter
  that periodically doubles the inflow.
- **3 difficulties:** Calm, Storm, Tempest — river speed, earth budget and
  the required dry-house ratio all change.

## Hazard bestiary (7)

- **Debris Dam** — fallen logs jam a channel cell and block all flow.
- **Sinkhole** — drains water from its cell and its neighbours.
- **Rain Burst** — a parked storm cell dumps local rain in a 3×3 patch.
- **Mudslide** — a slope slumps, lowering a ridge by 1–2 steps.
- **Beaver Dam** — beavers raise a cell by 2 and back the water up.
- **Cracked Levee** — old levees (and yours, nearby) erode step by step.
- **Dam Leak** — boss hazard: the cracked dam spits a pulse every few seconds.

## Tool draft (9)

Wider Spade (dig two cells at once) · Stone Levees (cheaper, never erode) ·
Pumps (drain the wettest village cell every 4 s) · Sandbag Line (instant
3-cell levee on Q) · Surveyor (flow-forecast arrows) · Reservoir Gate
(+50% capacity, double capture score) · Deep Trowel (dig 2 deep) · Rain
Barrels (bursts fill half as fast, +4 supplies) · Animal Whistle (animals
seek dry ground twice as often).

## Valley Marks (8 collectible passives)

Earned from rescues and boss days, listed in the HUD side panel during play:
Otter Charm (+50% rescue score) · Heron Feather (+6 earth a day) · Dry Stone
(houses shrug off shallow water) · Rainbow Trout (+25% outflow score) · Clay
Seal (erosion halved, from the Day 5 dam) · Old Oak Root (one dig in four is
free) · Moon Moth Lantern (next-hazard timer) · Deluge Bell (Day 9 surges
arrive weaker).

## Scoring and screens

House-hold chains build a combo up to ×5; rescues, captured water, dry
bonuses and perfect-day bonuses stack on top — a complete run scores in the
tens of thousands. The game has an information-dense title screen (how to
play, the full bestiary, all three difficulties), a full action HUD (WIN and
LOSE lines, houses dry, storm and flood bars, surge meter on Day 9, earth,
supplies, threat panel, marks and tools panels), floating score numbers,
event banners, a mid-run draft screen, and a victory screen with a letter
rank (S/A/B/C), twelve run statistics and a tools + marks recap.

## Technical notes

- Plain static game: `game/index.html` plus ES modules under `game/src/`,
  vanilla canvas 2D, no libraries, no build step, no network calls.
- Deterministic seeded RNG: the same seed always replays the same valleys,
  hazards and draft offers. The water simulation is a bounded cellular flow
  on a 27×17 grid (each wet cell sheds water toward lower neighbours).
- Screenshot scenes are staged deterministically through `?shot=` queries
  (see `shots.json`): a scripted warden plan plays the real rules forward —
  the cover is Day 9 at peak surge, the meta shot is the draft after the
  Day 5 boss, and the end shot is a full winning run.

## Layout

- `game/` — the game itself (`index.html`, `src/`: `rng.js`, `data.js`,
  `world.js`, `game.js`, `render.js`, `shots.js`, `main.js`)
- `screenshots/` — the four hand-in screenshots, in `shots.json` order
- `vendor/makefun-game.ts` — the make.fun dossier library, unchanged
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`
- `serve.ts` — a tiny local static server for playing the game

## Run it locally

```sh
node serve.ts            # serves game/ at http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build the dossier
```

## License

MIT — see `LICENSE`.
