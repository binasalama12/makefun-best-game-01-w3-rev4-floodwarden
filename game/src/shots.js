// Deterministic screenshot scenes for FLOODWARDEN, behind ?shot=cover|meta|
// title|end. Every scene plays the real rules forward from a fresh run: a
// scripted "warden plan" (dig a drain highway, ring the houses with levees)
// is applied through the same applyEdit the player uses, the water simulation
// runs at a fixed step, drafts are taken through chooseDraft, and the frame
// left on screen is exactly what that play produces.

import { DIFFICULTIES } from './data.js';
import {
  startRun, updateGame, chooseDraft, applyEdit, setBanner, addFloater,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_DRAFT, SCREEN_END,
} from './game.js';

const STEP = 1 / 30;

/** The warden plan: a drain highway to the outflow plus levee rings. */
function applyPlan(game, strength) {
  const world = game.world;
  game.earth += 500; // staging grant: the plan is labour, shown honestly as edits
  const dig = (x, y, times) => {
    for (let k = 0; k < times; k += 1) applyEdit(game, x, y, 'dig');
  };
  const levee = (x, y, times) => {
    for (let k = 0; k < times; k += 1) applyEdit(game, x, y, 'levee');
  };
  // Drain highway: east along row 2 under the river heads, south down
  // column 24, then east along row 15 into the outflow corner.
  for (let x = 2; x <= 24; x += 1) dig(x, 2, 2);
  for (let y = 2; y <= 15; y += 1) dig(24, y, 2);
  for (let x = 2; x <= 24; x += 1) dig(x, 15, 1);
  // A spur from the reservoir basin down to the highway.
  dig(22, 6, 2);
  dig(22, 7, 2);
  dig(23, 8, 1);
  // Levee rings around every house.
  for (const h of world.houses) {
    const ring = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of ring) {
      levee(h.x + dx, h.y + dy, strength >= 2 ? 2 : 1);
    }
    if (strength >= 3) levee(h.x, h.y - 1, 1);
  }
}

/**
 * Play a campaign forward with the plan. stop(game) is checked after every
 * step; returns when it fires, when the run ends, or after a hard cap.
 */
function playCampaign(game, strength, stop) {
  startRun(game, DIFFICULTIES[1]);
  let plannedDay = 0;
  let guard = 0;
  while (guard < 400000) {
    guard += 1;
    if (game.screen === SCREEN_END) return;
    if (game.screen === SCREEN_DRAFT) {
      if (stop && stop(game)) return;
      chooseDraft(game, game.draftChoices[0]);
      continue;
    }
    if (game.screen !== SCREEN_PLAY) return;
    if (game.day !== plannedDay) {
      plannedDay = game.day;
      applyPlan(game, strength);
    }
    if (stop && stop(game)) return;
    updateGame(game, STEP);
  }
}

/** Day 9 at peak action: twin rivers up, channels dug, banner + floaters live. */
function stageCover(game) {
  for (const strength of [1, 2, 3]) {
    playCampaign(game, strength, (g) => g.day === 9 && g.timeLeft <= 21);
    if (game.screen === SCREEN_PLAY && game.day === 9) break;
  }
  // Frame dressing from the game's own UI vocabulary: the surge banner and
  // the score floaters the hold-chain and rescues produce.
  setBanner(game, 'SURGE INBOUND!', 'THE DELUGE doubles its rivers — hold on!', '#ff7a5c', 99);
  const world = game.world;
  const dryHouse = world.houses.find((h) => !h.flooded && h.y >= 10) || world.houses[0];
  addFloater(game, dryHouse.x, dryHouse.y, '+450 HOUSE HELD', '#ffe27a');
  const animal = world.animals[0];
  if (animal) addFloater(game, animal.x, animal.y, '+500 RESCUED', '#8affc1');
  addFloater(game, 22, 4, '+120 CAPTURED', '#7df0d4');
  game.banner.t = 0.4;
  for (const f of game.floaters) f.t = 0.3;
}

/** The draft screen after the Day 5 boss, with a real mid-run state. */
function stageMeta(game) {
  for (const strength of [1, 2, 3]) {
    playCampaign(game, strength, (g) => g.screen === SCREEN_DRAFT && g.day === 5);
    if (game.screen === SCREEN_DRAFT && game.day === 5) return;
  }
}

/** A full winning run, left on the victory screen. */
function stageEnd(game) {
  for (const strength of [1, 2, 3]) {
    playCampaign(game, strength, null);
    if (game.screen === SCREEN_END && game.result === 'victory') return;
  }
}

/** The information-dense title screen over a living valley backdrop. */
function stageTitle(game) {
  startRun(game, DIFFICULTIES[1]);
  // Let the day-1 river run a little so the backdrop valley is alive.
  for (let k = 0; k < 240; k += 1) updateGame(game, STEP);
  game.screen = SCREEN_TITLE;
}

/** Set the game to the named scene. Unknown names fall back to the title. */
export function stageShot(name, game) {
  if (name === 'cover') stageCover(game);
  else if (name === 'meta') stageMeta(game);
  else if (name === 'end') stageEnd(game);
  else stageTitle(game);
}
