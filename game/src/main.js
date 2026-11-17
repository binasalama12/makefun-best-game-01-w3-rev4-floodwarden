// FLOODWARDEN entry point: boot, the frame loop, mouse and keyboard input,
// difficulty and draft picking, and the ?shot= staging hook the screenshots
// are rendered through.

import { DIFFICULTIES } from './data.js';
import {
  createGame, startRun, updateGame, chooseDraft, applyEdit, applySandbags, buyEarth,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_DRAFT, SCREEN_END,
} from './game.js';
import { createWorld } from './world.js';
import { drawGame, cellAt, difficultyRect, draftCardRect, endRestartRect, VIEW_W, VIEW_H } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 20261117) >>> 0;
const game = createGame(seed);
// A backdrop world for the title screen before the first run starts.
game.world = createWorld(1, seed + 7919);

const view = { hover: null, mode: 'dig', time: 0, hoverDiff: -1, hoverDraft: -1 };
game.hoverDiff = -1;
game.hoverDraft = -1;

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
  canvas.style.left = `${Math.floor((window.innerWidth - VIEW_W * scale) / 2)}px`;
  canvas.style.top = `${Math.floor((window.innerHeight - VIEW_H * scale) / 2)}px`;
  canvas.style.position = 'fixed';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function toGameCoords(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW_W,
    y: ((event.clientY - rect.top) / rect.height) * VIEW_H,
  };
}
function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

canvas.addEventListener('mousemove', (event) => {
  const { x, y } = toGameCoords(event);
  view.hover = cellAt(x, y);
  view.mode = event.shiftKey ? 'levee' : 'dig';
  game.hoverDiff = -1;
  DIFFICULTIES.forEach((d, i) => {
    if (inRect(x, y, difficultyRect(i))) game.hoverDiff = i;
  });
  game.hoverDraft = -1;
  game.draftChoices.forEach((id, i) => {
    if (inRect(x, y, draftCardRect(i))) game.hoverDraft = i;
  });
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

canvas.addEventListener('mousedown', (event) => {
  const { x, y } = toGameCoords(event);
  if (game.screen === SCREEN_TITLE) {
    DIFFICULTIES.forEach((d, i) => {
      if (inRect(x, y, difficultyRect(i))) startRun(game, d);
    });
    return;
  }
  if (game.screen === SCREEN_DRAFT) {
    game.draftChoices.forEach((id, i) => {
      if (inRect(x, y, draftCardRect(i))) chooseDraft(game, id);
    });
    return;
  }
  if (game.screen === SCREEN_END) {
    if (inRect(x, y, endRestartRect())) startRun(game, game.difficulty);
    return;
  }
  if (game.screen === SCREEN_PLAY) {
    const cell = cellAt(x, y);
    if (!cell) return;
    const mode = event.button === 2 || event.shiftKey ? 'levee' : 'dig';
    applyEdit(game, cell.x, cell.y, mode);
  }
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (game.screen === SCREEN_DRAFT && ['1', '2', '3'].includes(key)) {
    const id = game.draftChoices[Number(key) - 1];
    if (id) chooseDraft(game, id);
    return;
  }
  if (game.screen === SCREEN_END && key === 'r') {
    startRun(game, game.difficulty);
    return;
  }
  if (game.screen === SCREEN_TITLE && ['1', '2', '3'].includes(key)) {
    startRun(game, DIFFICULTIES[Number(key) - 1]);
    return;
  }
  if (game.screen !== SCREEN_PLAY) return;
  if (key === 'b') buyEarth(game);
  if (key === 'q' && view.hover) applySandbags(game, view.hover.x, view.hover.y);
});

// Screenshot staging: ?shot=cover|meta|title|end renders one deterministic
// scene and freezes the simulation (the frame is the scene, every load).
const shotName = params.get('shot');
if (shotName) {
  stageShot(shotName, game);
  view.time = 6.4; // a fixed clock so shimmer and rain sit in a lively pose
  drawGame(ctx, game, view);
  if (status) status.textContent = `FLOODWARDEN scene: ${shotName}`;
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    view.time += dt;
    updateGame(game, dt);
    drawGame(ctx, game, view);
    if (status && game.world) {
      status.textContent = `Day ${game.day} of 9. Score ${game.score}.`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
