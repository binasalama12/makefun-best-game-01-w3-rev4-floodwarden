// The FLOODWARDEN valley: terrain generation, the cellular water simulation,
// the hazard behaviours and the stranded animals. The water rule is deliberately
// simple and bounded — each step, every wet cell sheds a fraction of the water
// that stands above each lower neighbour's total level — so a 27x17 grid stays
// stable and fast at any storm size.

import { GRID_COLS, GRID_ROWS, DAYS } from './data.js';
import { makeRng, hash2 } from './rng.js';

export const COLS = GRID_COLS;
export const ROWS = GRID_ROWS;
const idx = (x, y) => y * COLS + x;
export const cellIndex = idx;

export const KIND_NORMAL = 0;
export const KIND_SOURCE = 1; // river head: the storm pours in here
export const KIND_RESERVOIR = 2; // basin: water held here is captured, safely
export const KIND_OUTFLOW = 3; // the valley mouth: water leaving here is gone

/** Distance from a cell to the river channel, used to shape the valley bowl. */
function riverDistance(x, y, twin) {
  // Main river: down the west edge, then east along the north bank.
  let d = Math.min(Math.abs(x - 1) + Math.max(0, 4 - y) * 0, Math.abs(x - 1));
  d = Math.min(d, Math.abs(y - 1) + Math.max(0, x - 6));
  if (twin) {
    // The Deluge's second river mirrors the first on the east side.
    d = Math.min(d, Math.abs(x - (COLS - 2)));
    d = Math.min(d, Math.abs(y - 1) + Math.max(0, COLS - 7 - x));
  }
  return d;
}

/**
 * Build one storm day's world: heights, special cells, houses, animals and
 * hazard instances, all from the day's seed so replays are identical.
 */
export function createWorld(dayNumber, seed) {
  const cfg = DAYS[dayNumber - 1];
  const rng = makeRng(seed);
  const twin = dayNumber === 9;
  const n = COLS * ROWS;
  const height = new Int16Array(n);
  const baseHeight = new Int16Array(n);
  const water = new Float32Array(n);
  const kind = new Uint8Array(n);
  const levee = new Uint8Array(n); // 1 where the player raised the cell
  const blocked = new Uint8Array(n); // 1 where a debris dam jams the cell

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const d = riverDistance(x, y, twin);
      const grain = hash2(x, y, dayNumber * 31);
      let h = 1 + Math.floor(d / 2.2) + (grain > 0.72 ? 1 : 0);
      // The outflow corner and the reservoir basins sit low.
      const outDist = Math.abs(x - (COLS - 1)) + Math.abs(y - (ROWS - 1));
      if (outDist <= 2) h = Math.min(h, outDist);
      const resDist = Math.abs(x - 22) + Math.abs(y - 4);
      if (resDist <= 2 && !twin) h = Math.min(h, 1);
      if (twin && Math.abs(x - 4) + Math.abs(y - 12) <= 2) h = Math.min(h, 1);
      height[idx(x, y)] = Math.max(0, Math.min(8, h));
    }
  }

  // Special cells.
  const sources = [];
  for (let x = 2; x <= 6; x += 1) {
    kind[idx(x, 0)] = KIND_SOURCE;
    height[idx(x, 0)] = 0;
    sources.push(idx(x, 0));
  }
  if (twin) {
    for (let x = COLS - 7; x <= COLS - 3; x += 1) {
      kind[idx(x, 0)] = KIND_SOURCE;
      height[idx(x, 0)] = 0;
      sources.push(idx(x, 0));
    }
  }
  const reservoirs = [];
  const reservoirCells = twin
    ? [[3, 11], [4, 11], [5, 11], [4, 12], [4, 13]]
    : [[21, 3], [22, 3], [23, 3], [22, 4], [22, 5]];
  for (const [x, y] of reservoirCells) {
    kind[idx(x, y)] = KIND_RESERVOIR;
    height[idx(x, y)] = 1;
    reservoirs.push(idx(x, y));
  }
  const outflows = [];
  for (const [x, y] of [[COLS - 1, ROWS - 2], [COLS - 1, ROWS - 1], [COLS - 2, ROWS - 1]]) {
    kind[idx(x, y)] = KIND_OUTFLOW;
    height[idx(x, y)] = 0;
    outflows.push(idx(x, y));
  }

  // Houses on dry mid-ground in the valley bowl.
  const houses = [];
  let guard = 0;
  while (houses.length < cfg.houses && guard < 600) {
    guard += 1;
    const x = rng.int(7, COLS - 6);
    const y = rng.int(5, ROWS - 5);
    const i = idx(x, y);
    if (kind[i] !== KIND_NORMAL || height[i] < 3) continue;
    if (houses.some((hh) => Math.abs(hh.x - x) + Math.abs(hh.y - y) < 4)) continue;
    houses.push({ x, y, i, flooded: false, wetTime: 0, name: HOUSE_NAMES[houses.length % HOUSE_NAMES.length] });
    height[i] = Math.max(height[i], 4);
  }

  // Animals stranded on the river banks.
  const animals = [];
  guard = 0;
  while (animals.length < cfg.animals && guard < 600) {
    guard += 1;
    const west = rng.chance(0.6) || !twin;
    const x = west ? rng.int(2, 6) : rng.int(COLS - 7, COLS - 3);
    const y = rng.int(3, ROWS - 4);
    const i = idx(x, y);
    if (kind[i] !== KIND_NORMAL || houses.some((hh) => hh.i === i)) continue;
    if (animals.some((a) => a.i === i)) continue;
    animals.push({
      x, y, i,
      species: ANIMAL_SPECIES[animals.length % ANIMAL_SPECIES.length],
      state: 'waiting', // waiting | saved | lost
      moveTimer: rng.range(0.5, 1.5),
      bob: rng.range(0, 6),
    });
  }

  // Hazard instances placed on sensible ground for their kind.
  const hazards = [];
  for (const [hid, count] of cfg.hazards) {
    for (let k = 0; k < count; k += 1) {
      const spot = placeHazard(rng, hid, height, kind, houses, hazards);
      if (spot) hazards.push(spot);
    }
  }

  baseHeight.set(height);

  return {
    dayNumber,
    cfg,
    twin,
    height,
    baseHeight,
    water,
    kind,
    levee,
    blocked,
    sources,
    reservoirs,
    outflows,
    houses,
    animals,
    hazards,
    captured: 0, // water volume parked in reservoirs + outflow this day
    peakWater: 0,
    surgeTimer: dayNumber === 9 ? 9 : 0,
    surgeLevel: 0,
    time: 0,
  };
}

const HOUSE_NAMES = ['Mill House', 'Baker Row', 'Chapel House', 'Ferryman Cot', 'Weaver Hall', 'Smithy', 'Granary', 'Schoolhouse', 'Alder House', 'Tannery'];
export const ANIMAL_SPECIES = ['goat', 'duck', 'calf', 'cat', 'piglet'];

function placeHazard(rng, hid, height, kind, houses, existing) {
  for (let tries = 0; tries < 80; tries += 1) {
    let x = rng.int(1, COLS - 2);
    let y = rng.int(1, ROWS - 2);
    if (hid === 'debris' || hid === 'beaver') { x = rng.int(1, 9); y = rng.int(1, 8); }
    if (hid === 'damleak') { x = rng.int(3, 8); y = 2; }
    if (hid === 'crack') {
      // Cracked levees sit on the raised ring the valley folk built by houses.
      const h = houses[rng.int(0, houses.length - 1)];
      if (!h) return null;
      x = h.x + rng.int(-1, 1);
      y = h.y + rng.int(-1, 1);
    }
    const i = idx(x, y);
    if (kind[i] !== KIND_NORMAL) continue;
    if (houses.some((hh) => hh.i === i)) continue;
    if (existing.some((hz) => hz.i === i)) continue;
    const hz = { id: hid, x, y, i, timer: rng.range(2, 6), active: true, pulses: 0 };
    if (hid === 'crack') {
      height[i] += 2; // a pre-built levee, already cracking
    }
    if (hid === 'beaver') {
      hz.built = false;
    }
    return hz;
  }
  return null;
}

/**
 * One simulation step. Returns an events object the game layer turns into
 * banners, floating numbers and score: {breach, houseFlooded, rescued, lost,
 * hazardFired:[names], surge}
 */
export function stepWorld(world, dt, opts) {
  const events = { houseFlooded: [], rescued: [], lost: [], fired: [], surge: false, breach: false };
  world.time += dt;
  const { height, water, kind, blocked } = world;
  const inflowRate = world.cfg.inflow * opts.inflowScale;

  // Storm inflow at the river heads.
  const perSource = (inflowRate * dt) / world.sources.length;
  for (const s of world.sources) water[s] += perSource * 2.4;
  // The Deluge: a surge meter that periodically doubles the inflow.
  if (world.twin) {
    world.surgeTimer -= dt;
    if (world.surgeTimer <= 0) {
      world.surgeTimer = 11;
      world.surgeLevel = opts.delugeWeakened ? 1.6 : 2.2;
      events.surge = true;
    }
    if (world.surgeLevel > 0) {
      for (const s of world.sources) water[s] += perSource * world.surgeLevel;
      world.surgeLevel = Math.max(0, world.surgeLevel - dt * 0.35);
    }
  }

  hazardStep(world, dt, opts, events);

  // Cellular flow: two passes over the grid, moving water downhill.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const i = idx(x, y);
        if (water[i] <= 0.001 || blocked[i]) continue;
        flowTo(world, i, x + 1, y);
        flowTo(world, i, x - 1, y);
        flowTo(world, i, x, y + 1);
        flowTo(world, i, x, y - 1);
      }
    }
  }

  // Reservoirs and the outflow swallow what reaches them: captured, scored.
  for (const r of world.reservoirs) {
    const cap = opts.reservoirCap;
    if (water[r] > cap) {
      world.captured += (water[r] - cap) * 0.9;
      water[r] = cap;
    }
  }
  for (const o of world.outflows) {
    if (water[o] > 0) {
      world.captured += water[o] * 0.9;
      water[o] *= 0.1;
    }
  }

  // Houses: standing water above the threshold starts the flood clock.
  const threshold = 0.45 + (opts.dryStone ? 0.2 : 0);
  for (const h of world.houses) {
    if (h.flooded) continue;
    if (water[h.i] > threshold) {
      h.wetTime += dt;
      if (h.wetTime > 2.2) {
        h.flooded = true;
        events.houseFlooded.push(h);
        events.breach = true;
      }
    } else {
      h.wetTime = Math.max(0, h.wetTime - dt * 2);
    }
  }

  // Animals: seek the driest neighbour; saved if dry at a safe cell, lost if
  // the water over their cell stays deep.
  const moveEvery = opts.animalCalm ? 0.55 : 1.1;
  for (const a of world.animals) {
    if (a.state !== 'waiting') continue;
    a.moveTimer -= dt;
    const depth = water[a.i];
    if (depth > 0.85) {
      a.state = 'lost';
      events.lost.push(a);
      continue;
    }
    if (a.moveTimer <= 0) {
      a.moveTimer = moveEvery * (0.7 + hash2(a.x, a.y, Math.floor(world.time)));
      // Move to the driest reachable neighbour (prefer higher, drier ground).
      let bestI = a.i;
      let bestScore = (height[a.i] - water[a.i] * 2) + (depth > 0.25 ? -3 : 0);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        const nx = a.x + dx;
        const ny = a.y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const ni = idx(nx, ny);
        if (kind[ni] === KIND_SOURCE || blocked[ni]) continue;
        const s = height[ni] - water[ni] * 2 + hash2(nx, ny, 7) * 0.3;
        if (s > bestScore) {
          bestScore = s;
          bestI = ni;
        }
      }
      if (bestI !== a.i) {
        a.i = bestI;
        a.x = bestI % COLS;
        a.y = Math.floor(bestI / COLS);
      }
      // Reaching high dry ground (height >= 5 and dry) is a rescue.
      if (water[a.i] < 0.12 && height[a.i] >= 5) {
        a.state = 'saved';
        events.rescued.push(a);
      }
    }
  }

  // Track the flood level for the HUD bar.
  let total = 0;
  for (let i = 0; i < water.length; i += 1) total += water[i];
  world.peakWater = Math.max(world.peakWater, total);
  world.floodTotal = total;
  return events;
}

/** Move a share of cell i's water to a neighbour when its level is higher. */
function flowTo(world, i, nx, ny) {
  if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
  const j = idx(nx, ny);
  if (world.blocked[j] || world.blocked[i]) return;
  const levelI = world.height[i] + world.water[i];
  const levelJ = world.height[j] + world.water[j];
  const diff = levelI - levelJ;
  if (diff <= 0) return;
  const move = Math.min(world.water[i] * 0.22, diff * 0.16);
  if (move <= 0.0001) return;
  world.water[i] -= move;
  world.water[j] += move;
}

/** Each hazard kind does its own thing on its own timer. */
function hazardStep(world, dt, opts, events) {
  const { height, water, blocked } = world;
  for (const hz of world.hazards) {
    if (!hz.active) continue;
    hz.timer -= dt;
    switch (hz.id) {
      case 'debris':
        blocked[hz.i] = 1;
        break;
      case 'sinkhole':
        // Continuously sip water from its cell and the ring around it.
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = hz.x + dx;
            const ny = hz.y + dy;
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
            const j = idx(nx, ny);
            const sip = Math.min(water[j], dt * 0.35);
            water[j] -= sip;
            world.captured += sip * 0.3;
          }
        }
        break;
      case 'rainburst':
        if (hz.timer <= 0) {
          hz.timer = 5.5;
          const amount = opts.rainBarrels ? 0.35 : 0.7;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              const nx = hz.x + dx;
              const ny = hz.y + dy;
              if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
              water[idx(nx, ny)] += amount;
            }
          }
          events.fired.push('RAIN BURST');
          if (opts.rainBarrels) events.barrelBonus = true;
        }
        break;
      case 'mudslide':
        if (hz.timer <= 0) {
          hz.timer = 9;
          // The slope below the hazard slumps: lower a short ridge segment.
          for (let k = 0; k < 3; k += 1) {
            const j = idx(Math.min(COLS - 1, hz.x + k), hz.y);
            if (world.kind[j] === KIND_NORMAL && height[j] > 1) height[j] -= 1;
          }
          events.fired.push('MUDSLIDE');
        }
        break;
      case 'beaver':
        if (!hz.built && hz.timer <= 0) {
          hz.built = true;
          height[hz.i] = Math.min(8, height[hz.i] + 2);
          events.fired.push('BEAVER DAM');
        }
        break;
      case 'crack': {
        if (hz.timer <= 0) {
          hz.timer = 6;
          let erosion = 1;
          if (opts.stoneLevees) erosion = 0;
          else if (opts.claySeal) erosion = hz.pulses % 2 === 0 ? 1 : 0;
          hz.pulses += 1;
          if (erosion > 0 && height[hz.i] > world.baseHeight[hz.i]) {
            height[hz.i] -= erosion;
            events.fired.push('LEVEE CRACKS');
            events.breach = true;
          }
        }
        break;
      }
      case 'damleak':
        if (hz.timer <= 0) {
          hz.timer = 4.2;
          hz.pulses += 1;
          water[hz.i] += 2.6;
          const below = idx(hz.x, Math.min(ROWS - 1, hz.y + 1));
          water[below] += 1.6;
          events.fired.push('DAM LEAK PULSE');
          events.breach = true;
        }
        break;
      default:
        break;
    }
  }
}

/** Player levees erode too when a cracked-levee hazard shares their cell ring. */
export function erodePlayerLevees(world, dt, opts) {
  // Cracked ground undermines nearby player levees on a slow timer.
  if (opts.stoneLevees) return [];
  const cracked = world.hazards.filter((h) => h.id === 'crack' && h.active);
  if (!cracked.length) return [];
  const events = [];
  world.erodeTimer = (world.erodeTimer || 0) - dt;
  if (world.erodeTimer > 0) return events;
  world.erodeTimer = 7;
  for (const hz of cracked) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = hz.x + dx;
        const ny = hz.y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const j = idx(nx, ny);
        if (world.levee[j] && world.height[j] > world.baseHeight[j]) {
          if (opts.claySeal && hz.pulses % 2 === 0) continue;
          world.height[j] -= 1;
          if (world.height[j] <= world.baseHeight[j]) world.levee[j] = 0;
          events.push(j);
        }
      }
    }
  }
  return events;
}

/** Total dry-house count and the day's requirement helpers. */
export function housesDry(world) {
  return world.houses.filter((h) => !h.flooded).length;
}
