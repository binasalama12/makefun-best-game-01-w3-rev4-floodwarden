// FLOODWARDEN rendering: procedurally textured terrain (height grain, wet/dry
// shading), shimmering water, the full action HUD (WIN/LOSE lines, dual bars,
// threat queue, valley marks), floating score numbers, event banners, rain,
// and the title / draft / end screens. Canvas 2D only, no assets.

import { VALLEYS, HAZARDS, TOOLS, MARKS, DIFFICULTIES, hazardById } from './data.js';
import { COLS, ROWS, KIND_SOURCE, KIND_RESERVOIR, KIND_OUTFLOW, housesDry } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_DRAFT, SCREEN_END, requiredDry, hasTool, rankFor } from './game.js';
import { hash2 } from './rng.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const CELL = 32;
export const GRID_X = 14;
export const GRID_Y = 68;
export const PANEL_X = 892;
export const PANEL_W = 374;

export function cellAt(px, py) {
  const x = Math.floor((px - GRID_X) / CELL);
  const y = Math.floor((py - GRID_Y) / CELL);
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
  return { x, y };
}
export function cellCenter(x, y) {
  return { px: GRID_X + x * CELL + CELL / 2, py: GRID_Y + y * CELL + CELL / 2 };
}
export function difficultyRect(i) {
  return { x: 948, y: 218 + i * 86, w: 292, h: 76 };
}
export function draftCardRect(i) {
  return { x: 70 + i * 400, y: 250, w: 370, h: 210 };
}
export function endRestartRect() {
  return { x: 490, y: 584, w: 300, h: 48 };
}

// ---------- small drawing helpers ----------

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function lerpColour(a, b, t) {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function terrainColour(palette, h) {
  if (h <= 2) return lerpColour(palette.low, palette.mid, h / 2);
  if (h <= 5) return lerpColour(palette.mid, palette.high, (h - 2) / 3);
  return lerpColour(palette.high, palette.ridge, Math.min(1, (h - 5) / 3));
}
function panel(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill || 'rgba(8,16,24,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(160,200,220,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function text(ctx, str, x, y, size, colour, align, bold) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = colour;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(str, x, y);
}
function wrapText(ctx, str, x, y, w, size, colour, lineH) {
  ctx.font = `${size}px 'Segoe UI', system-ui, sans-serif`;
  const words = str.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > w && line) {
      ctx.fillStyle = colour;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(line, x, cy);
      cy += lineH;
      line = word;
    } else line = trial;
  }
  if (line) {
    ctx.fillStyle = colour;
    ctx.fillText(line, x, cy);
    cy += lineH;
  }
  return cy;
}
function bar(ctx, x, y, w, h, frac, colour, back) {
  ctx.fillStyle = back || 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

// ---------- the valley ----------

function drawValley(ctx, game, time) {
  const world = game.world;
  const palette = VALLEYS[world.cfg.valley];
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const i = y * COLS + x;
      const px = GRID_X + x * CELL;
      const py = GRID_Y + y * CELL;
      const h = world.height[i];
      const w = world.water[i];
      ctx.fillStyle = terrainColour(palette, h);
      ctx.fillRect(px, py, CELL, CELL);
      // Procedural grain: speckles and a contour shade from the cell hash.
      const g1 = hash2(x, y, 11);
      const g2 = hash2(x, y, 47);
      ctx.fillStyle = g1 > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(px + 3 + g1 * 20, py + 4 + g2 * 18, 3, 2);
      ctx.fillRect(px + 6 + g2 * 16, py + 16 + g1 * 10, 2, 2);
      if (h >= 5) {
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(px, py, CELL, 2);
      }
      // Wet shading creeping in before open water.
      if (w > 0.02 && w <= 0.12) {
        ctx.fillStyle = 'rgba(30,60,80,0.35)';
        ctx.fillRect(px, py, CELL, CELL);
      }
      // Special ground.
      if (world.kind[i] === KIND_RESERVOIR) {
        ctx.fillStyle = '#175263';
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.strokeStyle = '#7df0d4';
        ctx.strokeRect(px + 2.5, py + 2.5, CELL - 5, CELL - 5);
      } else if (world.kind[i] === KIND_OUTFLOW) {
        ctx.fillStyle = '#0d2f42';
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = '#7db8e8';
        ctx.beginPath();
        ctx.moveTo(px + 9, py + 10);
        ctx.lineTo(px + 23, py + 16);
        ctx.lineTo(px + 9, py + 22);
        ctx.closePath();
        ctx.fill();
      } else if (world.kind[i] === KIND_SOURCE) {
        ctx.fillStyle = '#1d6fa8';
        ctx.fillRect(px, py, CELL, CELL);
      }
      // Open water with a moving shimmer.
      if (w > 0.03) {
        const depth = Math.min(1, w / 1.6);
        ctx.fillStyle = `rgba(38,110,178,${0.45 + depth * 0.45})`;
        ctx.fillRect(px, py, CELL, CELL);
        const shimmer = ((time * 26 + (x * 13 + y * 29)) % 32) - 8;
        ctx.fillStyle = 'rgba(190,230,255,0.35)';
        ctx.fillRect(px + shimmer, py + 6 + ((x + y) % 3) * 7, 9, 2);
        if (w > 0.5) ctx.fillRect(px + ((shimmer + 14) % 30), py + 20, 7, 2);
      }
      // Player levee: a pale packed-earth cap.
      if (world.levee[i]) {
        ctx.fillStyle = 'rgba(240,235,210,0.85)';
        ctx.fillRect(px + 3, py + 3, CELL - 6, 5);
        ctx.fillRect(px + 6, py + 10, 4, 3);
        ctx.fillRect(px + 20, py + 10, 4, 3);
      }
      if (world.blocked[i]) drawGlyph(ctx, 'logs', px, py, '#00000000');
    }
  }
  ctx.strokeStyle = 'rgba(10,20,30,0.55)';
  ctx.strokeRect(GRID_X - 1.5, GRID_Y - 1.5, COLS * CELL + 2, ROWS * CELL + 2);
  // Labels for the waterworks.
  text(ctx, 'RESERVOIR', GRID_X + 21 * CELL + 2, GRID_Y + 3 * CELL - 13, 10, '#7df0d4', 'left', true);
  text(ctx, 'OUTFLOW', GRID_X + 24 * CELL + 4, GRID_Y + 15 * CELL - 13, 10, '#7db8e8', 'left', true);
  text(ctx, 'THE RIVER', GRID_X + 2 * CELL, GRID_Y - 14, 10, '#7db8e8', 'left', true);

  drawHazards(ctx, world, time);
  drawHouses(ctx, world, time);
  drawAnimals(ctx, world, time);
  if (hasTool(game, 'surveyor')) drawForecast(ctx, world);
  drawRain(ctx, time);
}

function drawGlyph(ctx, glyph, px, py, _unused) {
  ctx.save();
  if (glyph === 'logs') {
    ctx.strokeStyle = '#7a4d22';
    ctx.lineWidth = 4;
    for (let k = 0; k < 3; k += 1) {
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 9 + k * 7);
      ctx.lineTo(px + 28, py + 7 + k * 7);
      ctx.stroke();
    }
  } else if (glyph === 'hole') {
    ctx.fillStyle = '#10131a';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 16, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,200,220,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (glyph === 'cloud') {
    ctx.fillStyle = 'rgba(50,70,95,0.9)';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 12, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7db8e8';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k += 1) {
      ctx.beginPath();
      ctx.moveTo(px + 9 + k * 7, py + 20);
      ctx.lineTo(px + 7 + k * 7, py + 27);
      ctx.stroke();
    }
  } else if (glyph === 'slide') {
    ctx.fillStyle = '#8a6a45';
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 6);
    ctx.lineTo(px + 28, py + 14);
    ctx.lineTo(px + 28, py + 28);
    ctx.lineTo(px + 4, py + 28);
    ctx.closePath();
    ctx.fill();
  } else if (glyph === 'beaver') {
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath();
    ctx.arc(px + 16, py + 17, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c98d4b';
    ctx.fillRect(px + 6, py + 24, 20, 4);
  } else if (glyph === 'crack') {
    ctx.strokeStyle = '#3a332a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 4);
    ctx.lineTo(px + 15, py + 13);
    ctx.lineTo(px + 11, py + 20);
    ctx.lineTo(px + 19, py + 28);
    ctx.stroke();
  } else if (glyph === 'dam') {
    ctx.fillStyle = '#5c6670';
    ctx.fillRect(px + 3, py + 8, 26, 14);
    ctx.strokeStyle = '#e84d4d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 16, py + 8);
    ctx.lineTo(px + 13, py + 15);
    ctx.lineTo(px + 18, py + 22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHazards(ctx, world, time) {
  for (const hz of world.hazards) {
    if (!hz.active || hz.id === 'debris') continue;
    const px = GRID_X + hz.x * CELL;
    const py = GRID_Y + hz.y * CELL;
    const def = hazardById(hz.id);
    drawGlyph(ctx, def.glyph, px, py);
    if (hz.timer < 1.6) {
      ctx.strokeStyle = `rgba(255,90,70,${0.5 + 0.4 * Math.sin(time * 10)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
    }
  }
}

function drawHouses(ctx, world, time) {
  for (const h of world.houses) {
    const px = GRID_X + h.x * CELL;
    const py = GRID_Y + h.y * CELL;
    ctx.save();
    if (h.flooded) {
      ctx.translate(px + 16, py + 16);
      ctx.rotate(0.18);
      ctx.translate(-16, -16);
      ctx.globalAlpha = 0.75;
    }
    ctx.fillStyle = h.flooded ? '#5c6a72' : '#e8dcc0';
    ctx.fillRect(px + 6, py + 13, 20, 14);
    ctx.fillStyle = h.flooded ? '#4a3f3a' : '#b0472f';
    ctx.beginPath();
    ctx.moveTo(px + 3, py + 14);
    ctx.lineTo(px + 16, py + 4);
    ctx.lineTo(px + 29, py + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(px + 13, py + 18, 6, 9);
    ctx.restore();
    if (!h.flooded && world.water[h.i] > 0.2) {
      // A house in danger flashes its warning ring.
      ctx.strokeStyle = `rgba(255,80,60,${0.55 + 0.35 * Math.sin(time * 8)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
    }
  }
}

const ANIMAL_COLOURS = { goat: '#e8e3d0', duck: '#ffe94d', calf: '#c98d4b', cat: '#f09a4d', piglet: '#f2a7b8' };
function drawAnimals(ctx, world, time) {
  for (const a of world.animals) {
    if (a.state !== 'waiting') continue;
    const { px, py } = cellCenter(a.x, a.y);
    const bobY = Math.sin(time * 3 + a.bob) * 1.6;
    ctx.fillStyle = ANIMAL_COLOURS[a.species] || '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py + bobY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 6, py - 5 + bobY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#12202c';
    ctx.font = "bold 11px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('!', px, py - 11 + bobY);
  }
}

/** Surveyor tool: arrows showing each wet cell's steepest descent. */
function drawForecast(ctx, world) {
  ctx.strokeStyle = 'rgba(255,240,170,0.75)';
  ctx.fillStyle = 'rgba(255,240,170,0.75)';
  ctx.lineWidth = 1.5;
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const i = y * COLS + x;
      if (world.water[i] < 0.12) continue;
      let best = null;
      let bestLevel = world.height[i] + world.water[i];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const j = ny * COLS + nx;
        const lvl = world.height[j] + world.water[j];
        if (lvl < bestLevel) {
          bestLevel = lvl;
          best = [dx, dy];
        }
      }
      if (!best) continue;
      const { px, py } = cellCenter(x, y);
      const tx = px + best[0] * 10;
      const ty = py + best[1] * 10;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRain(ctx, time) {
  ctx.strokeStyle = 'rgba(170,210,240,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 110; k += 1) {
    const hx = hash2(k, 3, 91);
    const hy = hash2(k, 8, 57);
    const x = GRID_X + ((hx * COLS * CELL + time * 60 * (0.5 + hy)) % (COLS * CELL));
    const y = GRID_Y + ((hy * ROWS * CELL + time * 340 * (0.6 + hx * 0.5)) % (ROWS * CELL));
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 9);
  }
  ctx.stroke();
}

// ---------- HUD ----------

function drawHud(ctx, game, time) {
  const world = game.world;
  const valley = VALLEYS[world.cfg.valley];
  // Top bar.
  ctx.fillStyle = 'rgba(6,12,18,0.92)';
  ctx.fillRect(0, 0, VIEW_W, 58);
  text(ctx, 'FLOODWARDEN', 14, 8, 24, '#ffd94d', 'left', true);
  text(ctx, `DAY ${game.day}/9 — ${valley.name}${world.cfg.boss ? ` — ${world.cfg.boss}` : ''}`, 14, 36, 13, '#bcd6e4');
  text(ctx, 'SCORE', 620, 6, 11, '#8fb6c9', 'center', true);
  text(ctx, `${game.score.toLocaleString('en-US')}`, 620, 20, 26, '#ffffff', 'center', true);
  text(ctx, `COMBO x${game.combo}`, 770, 14, 17, game.combo > 1 ? '#ffd94d' : '#8fb6c9', 'center', true);
  text(ctx, `BEST x${game.bestCombo}`, 770, 36, 11, '#8fb6c9', 'center');
  text(ctx, `EARTH ${game.earth}`, 1010, 10, 17, '#e8dcc0', 'center', true);
  text(ctx, `SUPPLIES ${Math.floor(game.supplies)}`, 1010, 32, 13, '#ffd94d', 'center', true);
  text(ctx, `RESCUED ${game.stats.rescued}`, 1180, 10, 17, '#8affc1', 'center', true);
  text(ctx, `DAY ${game.stats.daysHeld} HELD`, 1180, 32, 13, '#bcd6e4', 'center');

  // Right panel. Spacing is budgeted so the fullest state (Day 9: surge bar,
  // 5 threat types, 8 marks, 8 tools) still fits the 544px panel.
  const px = PANEL_X;
  panel(ctx, px, GRID_Y, PANEL_W, 544);
  let y = GRID_Y + 8;
  const dry = housesDry(world);
  const req = requiredDry(game);
  text(ctx, `WIN: keep ${req}+ houses dry until the storm passes`, px + 12, y, 14, '#8affc1', 'left', true);
  y += 19;
  text(ctx, `LOSE: fewer than ${req} dry when the storm ends`, px + 12, y, 14, '#ff9a7a', 'left', true);
  y += 23;
  text(ctx, `HOUSES DRY ${dry}/${world.houses.length}  (need ${req})`, px + 12, y, 15.5, dry >= req ? '#ffffff' : '#ff7a5c', 'left', true);
  y += 24;
  text(ctx, 'STORM LEFT', px + 12, y, 11, '#8fb6c9', 'left', true);
  bar(ctx, px + 96, y + 1, 250, 10, game.timeLeft / world.cfg.seconds, '#7db8e8');
  y += 16;
  text(ctx, 'FLOOD LEVEL', px + 12, y, 11, '#8fb6c9', 'left', true);
  const floodFrac = Math.min(1, (world.floodTotal || 0) / 260);
  bar(ctx, px + 96, y + 1, 250, 10, floodFrac, '#3f8fd2');
  y += 16;
  if (world.twin) {
    text(ctx, 'SURGE METER', px + 12, y, 11, '#ff9a7a', 'left', true);
    bar(ctx, px + 96, y + 1, 250, 10, 1 - world.surgeTimer / 11, '#e84d4d');
    y += 17;
  }
  text(ctx, `Captured water: ${Math.floor(world.captured)}  •  Supplies buy earth [B]`, px + 12, y, 11.5, '#bcd6e4');
  y += 21;

  // Threat panel: today's hazards with counts, and the next event timer.
  const threatTop = y - 4;
  text(ctx, "TODAY'S THREATS", px + 12, y, 13, '#ffb35c', 'left', true);
  y += 18;
  const counts = {};
  for (const hz of world.hazards) counts[hz.id] = (counts[hz.id] || 0) + 1;
  for (const [id, n] of Object.entries(counts)) {
    const def = hazardById(id);
    ctx.fillStyle = def.colour;
    ctx.fillRect(px + 12, y + 3, 9, 9);
    text(ctx, `${def.name} x${n}`, px + 27, y, 12, '#e8eef2');
    y += 15;
  }
  if (hasTool(game, 'surveyor') || game.marks.includes('mothlamp')) {
    const next = world.hazards.filter((h) => h.timer > 0).sort((a, b) => a.timer - b.timer)[0];
    if (next) {
      text(ctx, `Next event: ${hazardById(next.id).name} in ${Math.max(0, next.timer).toFixed(0)}s`, px + 12, y + 1, 11.5, '#ffd94d');
      y += 15;
    }
  }
  ctx.strokeStyle = 'rgba(160,200,220,0.25)';
  ctx.strokeRect(px + 8.5, threatTop + 0.5, PANEL_W - 17, y - threatTop + 4);
  y += 10;

  // Valley marks collection panel.
  text(ctx, `VALLEY MARKS ${game.marks.length}/8`, px + 12, y, 13, '#7df0d4', 'left', true);
  y += 18;
  if (!game.marks.length) {
    text(ctx, 'None yet — rescue animals to earn marks.', px + 12, y, 11.5, '#8fb6c9');
    y += 14;
  }
  for (const id of game.marks) {
    const mark = MARKS.find((m) => m.id === id);
    ctx.fillStyle = '#7df0d4';
    ctx.beginPath();
    ctx.arc(px + 17, y + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, mark.name, px + 27, y, 11.5, '#e8eef2');
    y += 14;
  }
  y += 6;
  text(ctx, `TOOLS ${game.tools.length}/9`, px + 12, y, 13, '#ffd94d', 'left', true);
  y += 18;
  if (!game.tools.length) text(ctx, 'Draft a tool after each held day.', px + 12, y, 11.5, '#8fb6c9');
  for (const id of game.tools) {
    const tool = TOOLS.find((t) => t.id === id);
    text(ctx, `• ${tool.name}`, px + 12, y, 11.5, '#e8eef2');
    y += 14;
  }

  // Bottom control strip.
  ctx.fillStyle = 'rgba(6,12,18,0.92)';
  ctx.fillRect(0, 622, VIEW_W, 98);
  text(ctx, 'CONTROLS', 14, 630, 12, '#8fb6c9', 'left', true);
  text(ctx, '[Click] Dig channel   [Right-click / Shift+Click] Raise levee   [Q] Sandbag Line (tool)   [B] Buy +5 earth for 12 supplies   Steer the water to the RESERVOIR and OUTFLOW — keep the houses dry!', 14, 650, 14.5, '#e8eef2');
  text(ctx, `Animals reach high dry ground on their own if you keep a dry path open. Flooded houses are lost for the run's tally; the day fails if dry houses fall below ${req} at storm's end.`, 14, 674, 12.5, '#8fb6c9');
  text(ctx, `Seed ${game.seed} • ${game.difficulty.name}`, 14, 694, 11, '#5f7d8c');
}

function drawFloaters(ctx, game) {
  for (const f of game.floaters) {
    const { px, py } = cellCenter(f.x, f.y);
    const rise = f.t * 34;
    const alpha = Math.max(0, 1 - f.t / f.life);
    ctx.globalAlpha = alpha;
    text(ctx, f.text, px, py - 26 - rise, 15, f.colour, 'center', true);
    ctx.globalAlpha = 1;
  }
}

function drawParticles(ctx, game) {
  // Particles live in cell coordinates (splash() is called with cell x/y);
  // each one sprays around its cell centre and drifts upward as it fades.
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.colour;
    const spray = Math.sin(p.t * 9 + p.x * 3 + p.y) * 7;
    ctx.fillRect(GRID_X + p.x * CELL + 14 + spray, GRID_Y + p.y * CELL + 14 - p.t * 20, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

function drawBanner(ctx, game) {
  if (!game.banner) return;
  const b = game.banner;
  const alpha = b.t < 0.25 ? b.t / 0.25 : b.t > b.life - 0.4 ? Math.max(0, (b.life - b.t) / 0.4) : 1;
  ctx.globalAlpha = alpha;
  const w = 560;
  const x = GRID_X + (COLS * CELL - w) / 2;
  const y = GRID_Y + 120;
  panel(ctx, x, y, w, 74, 'rgba(8,14,22,0.9)');
  text(ctx, b.text, x + w / 2, y + 10, 27, b.colour, 'center', true);
  if (b.sub) text(ctx, b.sub, x + w / 2, y + 44, 14, '#e8eef2', 'center');
  ctx.globalAlpha = 1;
}

function drawHover(ctx, game, view) {
  if (!view.hover) return;
  const { x, y } = view.hover;
  ctx.strokeStyle = view.mode === 'levee' ? '#ffd94d' : '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(GRID_X + x * CELL + 1, GRID_Y + y * CELL + 1, CELL - 2, CELL - 2);
}

// ---------- title screen ----------

function drawTitle(ctx, game, time) {
  // A living valley behind the panels: the day-1 world, dimmed.
  if (game.world) {
    drawValley(ctx, game, time);
    ctx.fillStyle = 'rgba(5,10,16,0.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  } else {
    ctx.fillStyle = '#0d1a24';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  text(ctx, 'FLOODWARDEN', 40, 22, 54, '#ffd94d', 'left', true);
  text(ctx, 'Dig trenches and raise levees to steer the flood — keep the village dry, rescue the stranded, hold all nine storms.', 42, 84, 16.5, '#e8eef2');

  // How to play (left).
  panel(ctx, 40, 122, 560, 252);
  text(ctx, 'HOW TO PLAY', 56, 132, 17, '#8affc1', 'left', true);
  const how = [
    '• Each day the river rises. Water flows downhill, cell to cell.',
    '• CLICK a cell to DIG a channel (-1 earth). RIGHT-CLICK or',
    '   SHIFT+CLICK to RAISE a levee (-2 earth). Earth is limited!',
    '• Steer water into the RESERVOIR and the OUTFLOW — captured',
    '   water pays supplies and score. [B] buys +5 earth for 12 supplies.',
    '• WIN the day: keep the required houses dry until the storm',
    '   timer runs out. LOSE the run if too many houses flood.',
    '• Stranded animals climb to dry ground by themselves — keep a',
    '   dry path open and every rescue pays +500 and earns marks.',
    '• After each held day, DRAFT 1 of 3 tools. Bosses: the Cracked',
    '   Dam leaks on Day 5; Day 9 is THE DELUGE, twin rivers + surge.',
  ];
  let hy = 158;
  for (const line of how) {
    text(ctx, line, 56, hy, 13.5, '#dbe7ee');
    hy += 19;
  }

  // Valley marks (left, below how-to).
  panel(ctx, 40, 386, 560, 236);
  text(ctx, 'VALLEY MARKS — collect all 8 (real passive effects)', 56, 396, 15, '#7df0d4', 'left', true);
  let my = 422;
  for (const mark of MARKS) {
    text(ctx, `◆ ${mark.name}`, 56, my, 12, '#ffd94d', 'left', true);
    text(ctx, mark.line, 222, my, 11.5, '#bcd6e4');
    my += 24;
  }

  // Hazard bestiary (middle).
  panel(ctx, 616, 122, 316, 500);
  text(ctx, 'HAZARD BESTIARY — 7 threats', 630, 132, 15, '#ffb35c', 'left', true);
  let zy = 160;
  for (const hz of HAZARDS) {
    ctx.fillStyle = hz.colour;
    ctx.fillRect(630, zy + 2, 10, 10);
    text(ctx, hz.name, 646, zy, 13, '#ffffff', 'left', true);
    zy = wrapText(ctx, hz.line, 646, zy + 16, 268, 11.5, '#bcd6e4', 14) + 8;
  }

  // Difficulty + tools (right).
  text(ctx, 'CHOOSE YOUR STORM', 948, 122, 15, '#ffffff', 'left', true);
  DIFFICULTIES.forEach((d, i) => {
    const r = difficultyRect(i);
    const hover = game.hoverDiff === i;
    panel(ctx, r.x, r.y, r.w, r.h, hover ? 'rgba(38,64,84,0.95)' : 'rgba(8,16,24,0.9)');
    text(ctx, d.name, r.x + 14, r.y + 10, 19, '#ffd94d', 'left', true);
    wrapText(ctx, d.line, r.x + 14, r.y + 38, r.w - 28, 12, '#dbe7ee', 15);
  });
  panel(ctx, 948, 486, 292, 136);
  text(ctx, 'TOOL DRAFT — 9 tools', 962, 496, 14, '#ffd94d', 'left', true);
  let ty = 520;
  for (let i = 0; i < TOOLS.length; i += 3) {
    const trio = TOOLS.slice(i, i + 3).map((t) => t.name).join(' • ');
    text(ctx, trio, 962, ty, 11, '#bcd6e4');
    ty += 17;
  }
  text(ctx, 'Draft 1 of 3 after every held day.', 962, ty + 4, 11.5, '#8fb6c9');

  // Valleys strip + footer spec line.
  let vx = 40;
  for (const v of VALLEYS) {
    text(ctx, `${v.name} (${v.days})`, vx, 640, 13.5, v.accent, 'left', true);
    vx += 200;
  }
  text(ctx, '9 STORM DAYS • 3 VALLEYS • 9 TOOLS • 8 VALLEY MARKS • 7 HAZARDS • 2 BOSSES: THE CRACKED DAM + THE DELUGE • 3 DIFFICULTIES', 40, 668, 14.5, '#ffd94d', 'left', true);
  text(ctx, 'A complete run scores in the tens of thousands: house-hold chains x5 combo, rescues, captured water and perfect-day bonuses.', 40, 692, 12.5, '#8fb6c9');
}

// ---------- draft (meta-progression) screen ----------

function drawDraft(ctx, game, time) {
  drawValley(ctx, game, time);
  drawHud(ctx, game, time);
  ctx.fillStyle = 'rgba(5,10,16,0.72)';
  ctx.fillRect(0, 58, VIEW_W, 564);
  text(ctx, `DAY ${game.day} HELD!`, 640, 84, 34, '#8affc1', 'center', true);
  text(ctx, 'The storm passes. Choose 1 of 3 tools for the rest of the run — click a card or press 1, 2, 3.', 640, 126, 16, '#e8eef2', 'center');
  text(ctx, `Score ${game.score.toLocaleString('en-US')} • Rescued ${game.stats.rescued} • Supplies ${Math.floor(game.supplies)} • Next: Day ${game.day + 1} — ${VALLEYS[game.world.cfg.valley].name}`, 640, 152, 14, '#bcd6e4', 'center');
  game.draftChoices.forEach((toolId, i) => {
    const tool = TOOLS.find((t) => t.id === toolId);
    const r = draftCardRect(i);
    panel(ctx, r.x, r.y, r.w, r.h, game.hoverDraft === i ? 'rgba(38,64,84,0.97)' : 'rgba(10,20,30,0.97)');
    ctx.strokeStyle = '#ffd94d';
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    text(ctx, `[${i + 1}]`, r.x + 18, r.y + 14, 15, '#8fb6c9', 'left', true);
    text(ctx, tool.name.toUpperCase(), r.x + 18, r.y + 40, 23, '#ffd94d', 'left', true);
    wrapText(ctx, tool.line, r.x + 18, r.y + 78, r.w - 36, 15, '#e8eef2', 20);
    text(ctx, 'CLICK TO TAKE THIS TOOL', r.x + 18, r.y + r.h - 34, 13, '#8affc1', 'left', true);
  });
  // Current run state: tools and marks already carried.
  panel(ctx, 70, 486, 1140, 118);
  text(ctx, `YOUR TOOLS (${game.tools.length}/9): ${game.tools.length ? game.tools.map((id) => TOOLS.find((t) => t.id === id).name).join(' • ') : 'none yet — this is your first draft'}`, 86, 498, 14, '#ffd94d', 'left', true);
  text(ctx, `VALLEY MARKS (${game.marks.length}/8): ${game.marks.length ? game.marks.map((id) => MARKS.find((m) => m.id === id).name).join(' • ') : 'none yet — rescue animals to earn marks'}`, 86, 524, 14, '#7df0d4', 'left', true);
  text(ctx, `Run so far: ${game.stats.daysHeld} days held • ${game.stats.housesHeldTotal} house-days dry • ${game.stats.rescued} rescued • ${Math.floor(game.stats.capturedTotal)} water captured • best combo x${game.bestCombo}`, 86, 550, 13.5, '#bcd6e4');
  text(ctx, 'Tools and marks stack for the whole run — Wider Spade + Deep Trowel carve canyons; Stone Levees + Clay Seal make walls that never fall.', 86, 574, 12.5, '#8fb6c9');
}

// ---------- end screen ----------

function drawEnd(ctx, game, time) {
  if (game.world) {
    drawValley(ctx, game, time);
    ctx.fillStyle = 'rgba(5,10,16,0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  const victory = game.result === 'victory';
  const rank = rankFor(game);
  panel(ctx, 90, 40, 1100, 590, 'rgba(8,15,23,0.97)');
  // Letter rank medallion.
  ctx.fillStyle = victory ? '#ffd94d' : '#8fb6c9';
  ctx.beginPath();
  ctx.arc(215, 165, 78, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, rank, 215, 108, 96, '#12202c', 'center', true);
  text(ctx, 'RANK', 215, 252, 14, '#8fb6c9', 'center', true);
  text(ctx, victory ? 'VICTORY — THE VALLEY STANDS!' : 'THE VALLEY IS LOST', 360, 66, 33, victory ? '#8affc1' : '#ff9a7a', 'left', true);
  text(ctx, game.message, 360, 106, 14.5, '#dbe7ee');
  text(ctx, 'FINAL SCORE', 360, 138, 13, '#8fb6c9', 'left', true);
  text(ctx, game.score.toLocaleString('en-US'), 360, 156, 44, '#ffffff', 'left', true);
  text(ctx, `${game.difficulty.name} • Seed ${game.seed}`, 700, 168, 14, '#8fb6c9');

  // Run statistics — twelve of them.
  const s = game.stats;
  const rows = [
    ['Days held', `${s.daysHeld} / 9`],
    ['Houses kept dry (house-days)', `${s.housesHeldTotal}`],
    ['Houses lost to the flood', `${s.housesLost}`],
    ['Animals rescued', `${s.rescued}`],
    ['Animals lost', `${s.animalsLost}`],
    ['Water captured (reservoir + outflow)', `${Math.floor(s.capturedTotal)}`],
    ['Earth moved', `${s.earthMoved}`],
    ['Channels dug', `${s.digs}`],
    ['Levees raised', `${s.levees}`],
    ['Best combo chain', `x${game.bestCombo}`],
    ['Longest dry chain', `${s.bestChain}s`],
    ['Time warden on duty', `${Math.floor(s.playSeconds / 60)}m ${Math.floor(s.playSeconds % 60)}s`],
  ];
  let ry = 236;
  rows.forEach(([label, value], i) => {
    const colX = i % 2 === 0 ? 360 : 790;
    if (i % 2 === 0 && i > 0) ry += 30;
    text(ctx, label, colX, ry, 14, '#8fb6c9');
    text(ctx, value, colX + 330, ry, 15, '#ffffff', 'right', true);
  });
  // Recaps.
  text(ctx, `TOOLS CARRIED (${game.tools.length}/9)`, 130, 452, 14, '#ffd94d', 'left', true);
  wrapText(ctx, game.tools.length ? game.tools.map((id) => TOOLS.find((t) => t.id === id).name).join(' • ') : 'No tools drafted.', 130, 474, 1020, 14, '#e8eef2', 19);
  text(ctx, `VALLEY MARKS EARNED (${game.marks.length}/8)`, 130, 522, 14, '#7df0d4', 'left', true);
  wrapText(ctx, game.marks.length ? game.marks.map((id) => MARKS.find((m) => m.id === id).name).join(' • ') : 'No marks earned — the animals needed safer paths.', 130, 544, 1020, 14, '#e8eef2', 19);
  const r = endRestartRect();
  panel(ctx, r.x, r.y, r.w, r.h, 'rgba(38,64,84,0.95)');
  text(ctx, 'PLAY AGAIN  [R]', r.x + r.w / 2, r.y + 13, 17, '#ffffff', 'center', true);
}

// ---------- dispatcher ----------

export function drawGame(ctx, game, view) {
  const time = view.time;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (game.screen === SCREEN_TITLE) {
    drawTitle(ctx, game, time);
    return;
  }
  if (game.screen === SCREEN_END) {
    drawEnd(ctx, game, time);
    return;
  }
  if (game.screen === SCREEN_DRAFT) {
    drawDraft(ctx, game, time);
    return;
  }
  // Play (and any transient state) shows the valley in action.
  drawValley(ctx, game, time);
  drawHud(ctx, game, time);
  drawParticles(ctx, game);
  drawFloaters(ctx, game);
  drawBanner(ctx, game);
  if (game.screen === SCREEN_PLAY) drawHover(ctx, game, view);
}
