// The FLOODWARDEN campaign: nine storm days, the earth budget, supplies, the
// combo chain, scoring, the tool draft and the valley marks. This layer owns
// the run state and the rules that connect the water simulation to winning,
// losing and the final letter rank.

import { DAYS, DIFFICULTIES, TOOLS, MARKS, MARK_RESCUE_THRESHOLDS } from './data.js';
import { createWorld, stepWorld, erodePlayerLevees, housesDry } from './world.js';
import { makeRng } from './rng.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_DRAFT = 'draft';
export const SCREEN_DAYCLEAR = 'dayclear';
export const SCREEN_END = 'end';

export function createGame(seed) {
  return {
    seed,
    screen: SCREEN_TITLE,
    difficulty: DIFFICULTIES[1],
    day: 1,
    world: null,
    timeLeft: 0,
    earth: 0,
    supplies: 20,
    score: 0,
    combo: 1,
    dryChainSeconds: 0,
    bestCombo: 1,
    tools: [], // owned tool ids
    marks: [], // owned mark ids
    draftChoices: [],
    floaters: [], // {x, y, text, colour, t, life}
    banner: null, // {text, sub, t, life, colour}
    particles: [], // {x, y, vx, vy, t, life, colour, size}
    stats: {
      daysHeld: 0,
      housesHeldTotal: 0,
      housesLost: 0,
      rescued: 0,
      animalsLost: 0,
      capturedTotal: 0,
      earthMoved: 0,
      digs: 0,
      levees: 0,
      bestChain: 0,
      playSeconds: 0,
    },
    result: null, // 'victory' | 'defeat'
    message: '',
    pumpTimer: 0,
    scoreTick: 0,
    rng: makeRng(seed ^ 0x9e3779b9),
  };
}

export function hasTool(game, id) {
  return game.tools.includes(id);
}
export function hasMark(game, id) {
  return game.marks.includes(id);
}

/** Start (or restart) a full run on the chosen difficulty. */
export function startRun(game, difficulty) {
  game.difficulty = difficulty;
  game.day = 1;
  game.score = 0;
  game.combo = 1;
  game.bestCombo = 1;
  game.dryChainSeconds = 0;
  game.supplies = 20;
  game.tools = [];
  game.marks = [];
  game.result = null;
  game.stats = {
    daysHeld: 0, housesHeldTotal: 0, housesLost: 0, rescued: 0, animalsLost: 0,
    capturedTotal: 0, earthMoved: 0, digs: 0, levees: 0, bestChain: 0, playSeconds: 0,
  };
  startDay(game, 1);
}

/** Set up one storm day: fresh world, earth budget, day banner. */
export function startDay(game, dayNumber) {
  game.day = dayNumber;
  const cfg = DAYS[dayNumber - 1];
  game.world = createWorld(dayNumber, game.seed + dayNumber * 7919);
  game.timeLeft = cfg.seconds;
  game.earth = game.difficulty.earth + (hasMark(game, 'heron') ? 6 : 0) + Math.min(6, dayNumber);
  game.screen = SCREEN_PLAY;
  game.pumpTimer = 0;
  game.scoreTick = 0;
  if (dayNumber === 9 && !hasMark(game, 'delugebell')) grantMark(game, 'delugebell');
  setBanner(game, cfg.boss ? `${cfg.boss}` : `DAY ${dayNumber}`, cfg.boss ? 'Boss storm — hold the valley!' : 'The storm is coming. Dig and raise!', '#ffd94d', 2.6);
}

/** Houses that must still be dry when the storm passes. */
export function requiredDry(game) {
  const total = game.world.houses.length;
  return Math.max(1, Math.ceil(total * game.difficulty.requiredRatio));
}

/** Simulation options derived from owned tools and marks. */
export function simOptions(game) {
  return {
    inflowScale: game.difficulty.inflow,
    reservoirCap: hasTool(game, 'gate') ? 0.9 : 0.6,
    dryStone: hasMark(game, 'drystone'),
    animalCalm: hasTool(game, 'whistle') || hasMark(game, 'mothlamp'),
    rainBarrels: hasTool(game, 'barrels'),
    stoneLevees: hasTool(game, 'stone'),
    claySeal: hasMark(game, 'clayseal'),
    delugeWeakened: hasMark(game, 'delugebell'),
  };
}

function addScore(game, points, x, y, label, colour) {
  const gained = Math.round(points);
  game.score += gained;
  if (x !== undefined) {
    game.floaters.push({ x, y, text: `+${gained} ${label}`, colour: colour || '#ffe27a', t: 0, life: 1.6 });
  }
  return gained;
}

export function setBanner(game, text, sub, colour, life) {
  game.banner = { text, sub: sub || '', t: 0, life: life || 2.2, colour: colour || '#ffd94d' };
}

export function addFloater(game, x, y, text, colour) {
  game.floaters.push({ x, y, text, colour: colour || '#ffffff', t: 0, life: 1.6 });
}

function splash(game, x, y, colour, count) {
  for (let k = 0; k < count; k += 1) {
    const a = game.rng.range(0, Math.PI * 2);
    const sp = game.rng.range(14, 60);
    game.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 26,
      t: 0, life: game.rng.range(0.35, 0.8),
      colour, size: game.rng.range(1.5, 3.4),
    });
  }
}

/**
 * One frame of the run. dt is real seconds; the world steps in fixed slices
 * so the water behaves the same at any frame rate.
 */
export function updateGame(game, dt) {
  // Floaters, banner and particles always animate.
  for (const f of game.floaters) f.t += dt;
  game.floaters = game.floaters.filter((f) => f.t < f.life);
  for (const p of game.particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 130 * dt;
  }
  game.particles = game.particles.filter((p) => p.t < p.life);
  if (game.banner) {
    game.banner.t += dt;
    if (game.banner.t >= game.banner.life) game.banner = null;
  }
  if (game.screen !== SCREEN_PLAY || !game.world) return;

  game.stats.playSeconds += dt;
  game.timeLeft -= dt;
  const world = game.world;
  const opts = simOptions(game);
  const capturedBefore = world.captured;

  const SLICE = 1 / 30;
  let remaining = Math.min(dt, 0.06);
  while (remaining > 0) {
    const step = Math.min(SLICE, remaining);
    remaining -= step;
    const ev = stepWorld(world, step, opts);
    handleEvents(game, ev);
    const eroded = erodePlayerLevees(world, step, opts);
    if (eroded.length) setBanner(game, 'LEVEE BREACH!', 'Cracked ground undermines your levees', '#ff7a5c', 1.6);
  }

  // Captured water pays supplies and score continuously.
  const capturedNow = world.captured - capturedBefore;
  if (capturedNow > 0) {
    game.stats.capturedTotal += capturedNow;
    const mult = (hasTool(game, 'gate') ? 2 : 1) * (hasMark(game, 'trout') ? 1.25 : 1);
    game.score += Math.round(capturedNow * 4 * mult);
    game.supplies += capturedNow * 0.55;
  }

  // Pumps tool: drain the wettest house cell every few seconds.
  if (hasTool(game, 'pumps')) {
    game.pumpTimer -= dt;
    if (game.pumpTimer <= 0) {
      game.pumpTimer = 4;
      let worst = null;
      for (const h of world.houses) {
        if (!h.flooded && (worst === null || world.water[h.i] > world.water[worst.i])) worst = h;
      }
      if (worst && world.water[worst.i] > 0.15) {
        world.water[worst.i] *= 0.25;
        splash(game, worst.x, worst.y, '#7db8e8', 8);
        addFloater(game, worst.x, worst.y, 'PUMPED', '#7db8e8');
      }
    }
  }

  // Combo chain: every second with every required house dry grows the chain.
  game.scoreTick += dt;
  if (game.scoreTick >= 1) {
    game.scoreTick = 0;
    const dry = housesDry(world);
    if (dry >= requiredDry(game)) {
      game.dryChainSeconds += 1;
      game.combo = Math.min(5, 1 + Math.floor(game.dryChainSeconds / 6));
      game.bestCombo = Math.max(game.bestCombo, game.combo);
      game.stats.bestChain = Math.max(game.stats.bestChain, Math.floor(game.dryChainSeconds));
      if (dry > 0) addScore(game, dry * game.combo);
    } else {
      game.dryChainSeconds = 0;
      game.combo = 1;
    }
  }

  if (game.timeLeft <= 0) finishDay(game);
}

function handleEvents(game, ev) {
  const world = game.world;
  for (const h of ev.houseFlooded) {
    game.stats.housesLost += 1;
    game.combo = 1;
    game.dryChainSeconds = 0;
    setBanner(game, 'HOUSE FLOODED!', `${h.name} is lost to the water`, '#ff7a5c', 2);
    splash(game, h.x, h.y, '#5aa7d6', 16);
    addFloater(game, h.x, h.y, 'HOUSE LOST', '#ff9a7a');
  }
  for (const a of ev.rescued) {
    game.stats.rescued += 1;
    const bonus = hasMark(game, 'otter') ? 1.5 : 1;
    const pts = addScore(game, 500 * bonus, a.x, a.y, 'RESCUED', '#8affc1');
    game.supplies += 6;
    splash(game, a.x, a.y, '#8affc1', 12);
    setBanner(game, 'ANIMAL RESCUED!', `The ${a.species} reached high ground (+${pts})`, '#8affc1', 1.8);
    checkRescueMarks(game);
  }
  for (const a of ev.lost) {
    game.stats.animalsLost += 1;
    addFloater(game, a.x, a.y, 'LOST TO THE FLOOD', '#ff9a7a');
  }
  for (const name of ev.fired) {
    if (name === 'DAM LEAK PULSE') setBanner(game, 'DAM LEAK!', 'The cracked dam spits another pulse', '#ff7a5c', 1.5);
    else if (name === 'RAIN BURST') addFloater(game, game.world.hazards[0]?.x ?? 4, 2, 'RAIN BURST', '#7db8e8');
    else if (name === 'BEAVER DAM') setBanner(game, 'BEAVER DAM!', 'The beavers raised the bank — water backs up', '#ffb35c', 1.7);
    else if (name === 'MUDSLIDE') setBanner(game, 'MUDSLIDE!', 'A ridge slumped into the channel', '#ffb35c', 1.7);
    else if (name === 'LEVEE CRACKS') addFloater(game, 13, 3, 'LEVEE CRACKS', '#ffb35c');
  }
  if (ev.barrelBonus) game.supplies += 4;
  if (ev.surge) setBanner(game, 'SURGE INBOUND!', 'THE DELUGE doubles its rivers — hold on!', '#ff7a5c', 2.2);
}

/** Grant a valley mark if not owned, with a banner. */
export function grantMark(game, id) {
  if (hasMark(game, id)) return;
  game.marks.push(id);
  const mark = MARKS.find((m) => m.id === id);
  setBanner(game, 'VALLEY MARK EARNED!', `${mark.name} — ${mark.line}`, '#7df0d4', 2.6);
}

function checkRescueMarks(game) {
  for (const [id, threshold] of Object.entries(MARK_RESCUE_THRESHOLDS)) {
    if (game.stats.rescued >= threshold) grantMark(game, id);
  }
}

/** The storm has passed: judge the day. */
export function finishDay(game) {
  const world = game.world;
  const dry = housesDry(world);
  const req = requiredDry(game);
  game.stats.housesHeldTotal += dry;
  if (dry < req) {
    game.result = 'defeat';
    game.message = `Day ${game.day}: only ${dry} of ${req} required houses stayed dry. The valley is lost.`;
    game.screen = SCREEN_END;
    return;
  }
  game.stats.daysHeld += 1;
  const dryBonus = dry * 150;
  const perfect = dry === world.houses.length;
  addScore(game, 800 + dryBonus + (perfect ? 500 : 0));
  setBanner(game, 'DAY HELD!', perfect ? 'Every house dry — perfect hold!' : `${dry}/${world.houses.length} houses dry`, '#8affc1', 2.4);
  if (game.day === 5) grantMark(game, 'clayseal');
  // Animals still waiting on dry ground at storm's end count as rescued.
  for (const a of world.animals) {
    if (a.state === 'waiting' && world.water[a.i] < 0.3) {
      a.state = 'saved';
      game.stats.rescued += 1;
      addScore(game, hasMark(game, 'otter') ? 750 : 500, a.x, a.y, 'RESCUED', '#8affc1');
    }
  }
  checkRescueMarks(game);
  if (game.day >= DAYS.length) {
    game.result = 'victory';
    game.message = 'THE DELUGE has passed and the village stands. You are the Floodwarden.';
    addScore(game, 5000);
    game.screen = SCREEN_END;
    return;
  }
  rollDraft(game);
  game.screen = SCREEN_DRAFT;
}

/** Offer 1-of-3 tools the player does not already own. */
export function rollDraft(game) {
  const pool = TOOLS.filter((t) => !hasTool(game, t.id));
  const rng = makeRng(game.seed + game.day * 31337 + game.stats.daysHeld * 17);
  game.draftChoices = rng.shuffled(pool).slice(0, 3).map((t) => t.id);
}

/** Take a drafted tool and march on to the next day. */
export function chooseDraft(game, toolId) {
  if (!game.draftChoices.includes(toolId)) return;
  game.tools.push(toolId);
  game.draftChoices = [];
  startDay(game, game.day + 1);
}

/** Buy emergency earth with supplies (the supplies currency sink). */
export function buyEarth(game) {
  if (game.supplies < 12 || game.screen !== SCREEN_PLAY) return false;
  game.supplies -= 12;
  game.earth += 5;
  addFloater(game, 13, 1, '+5 EARTH', '#ffd94d');
  return true;
}

/**
 * Apply a player edit to a cell: dig (lower) or levee (raise), paying earth.
 * Returns true when the edit landed. Tools change the shape of an edit here.
 */
export function applyEdit(game, x, y, mode) {
  const world = game.world;
  if (!world || game.screen !== SCREEN_PLAY) return false;
  if (x < 0 || y < 0 || x >= 27 || y >= 17) return false;
  const i = y * 27 + x;
  if (world.kind[i] !== 0) return false; // never edit sources/reservoirs/outflow
  if (world.houses.some((h) => h.i === i && !h.flooded)) return false;
  if (mode === 'dig') {
    let cost = 1;
    if (hasMark(game, 'oakroot') && game.rng.chance(0.25)) cost = 0;
    if (game.earth < cost) return false;
    const depth = hasTool(game, 'trowel') ? 2 : 1;
    const digCell = (cx, cy) => {
      const ci = cy * 27 + cx;
      if (world.kind[ci] !== 0) return;
      world.height[ci] = Math.max(0, world.height[ci] - depth);
      if (world.levee[ci] && world.height[ci] <= world.baseHeight[ci]) world.levee[ci] = 0;
    };
    digCell(x, y);
    if (hasTool(game, 'spade') && x + 1 < 27) digCell(x + 1, y);
    game.earth -= cost;
    game.stats.digs += 1;
    game.stats.earthMoved += depth;
    splash(game, x, y, '#c9a86a', 5);
    return true;
  }
  // levee
  const cost = hasTool(game, 'stone') ? 1 : 2;
  if (game.earth < cost) return false;
  world.height[i] = Math.min(9, world.height[i] + 1);
  world.levee[i] = 1;
  game.earth -= cost;
  game.stats.levees += 1;
  game.stats.earthMoved += 1;
  splash(game, x, y, '#e8e3d0', 5);
  return true;
}

/** Sandbag Line tool: an instant 3-cell levee east from the target cell. */
export function applySandbags(game, x, y) {
  const world = game.world;
  if (!world || !hasTool(game, 'sandbag') || game.screen !== SCREEN_PLAY) return false;
  if (game.earth < 3) return false;
  let placed = 0;
  for (let k = 0; k < 3; k += 1) {
    const cx = x + k;
    if (cx >= 27) break;
    const ci = y * 27 + cx;
    if (world.kind[ci] !== 0) continue;
    world.height[ci] = Math.min(9, world.height[ci] + 1);
    world.levee[ci] = 1;
    placed += 1;
  }
  if (!placed) return false;
  game.earth -= 3;
  game.stats.levees += placed;
  setBanner(game, 'SANDBAG LINE!', 'Three cells raised in one throw', '#ffd94d', 1.4);
  return true;
}

/** Letter rank for the end screen, from score and days held. */
export function rankFor(game) {
  if (game.result !== 'victory') return game.stats.daysHeld >= 6 ? 'B' : game.stats.daysHeld >= 3 ? 'C' : 'D';
  if (game.score >= 52000) return 'S';
  if (game.score >= 38000) return 'A';
  if (game.score >= 26000) return 'B';
  return 'C';
}
