// FLOODWARDEN content tables: the three valleys, the hazard bestiary, the tool
// draft pool, the valley marks collection and the nine storm days. Everything
// the title screen advertises lives here and is wired into world.js/game.js —
// names, behaviours and effects are real, not decoration.

export const GRID_COLS = 27;
export const GRID_ROWS = 17;
export const TOTAL_DAYS = 9;

/** The three valleys, three storm days each, each with its own palette. */
export const VALLEYS = [
  {
    name: 'Green Hollow',
    days: 'Days 1-3',
    sky: '#1d3038',
    low: '#4d7a3d',
    mid: '#6f9a4a',
    high: '#a8bf6d',
    ridge: '#d8d99a',
    wet: '#2e5d50',
    accent: '#ffd94d',
    blurb: 'A gentle river valley. Learn the water, save the Hollow.',
  },
  {
    name: 'Ember Canyon',
    days: 'Days 4-6',
    sky: '#38231d',
    low: '#8a5a33',
    mid: '#b07a3f',
    high: '#d1a35e',
    ridge: '#eed49b',
    wet: '#6d4a35',
    accent: '#ff9a3d',
    blurb: 'Dry ridges, sudden cloudbursts. The cracked dam waits on Day 5.',
  },
  {
    name: 'Moon Fen',
    days: 'Days 7-9',
    sky: '#1c1a38',
    low: '#33526b',
    mid: '#47748c',
    high: '#6fa3ad',
    ridge: '#b7dde0',
    wet: '#27354f',
    accent: '#7df0d4',
    blurb: 'Twin rivers and a rising surge. Day 9 is THE DELUGE.',
  },
];

/**
 * The hazard bestiary: seven named hazards, each with a genuinely different
 * behaviour in the water simulation (see world.js hazardStep).
 */
export const HAZARDS = [
  {
    id: 'debris',
    name: 'Debris Dam',
    glyph: 'logs',
    colour: '#a9743f',
    line: 'Fallen logs jam a channel cell and block all flow through it.',
  },
  {
    id: 'sinkhole',
    name: 'Sinkhole',
    glyph: 'hole',
    colour: '#20242c',
    line: 'A hungry hole that drains water from its cell and its neighbours.',
  },
  {
    id: 'rainburst',
    name: 'Rain Burst',
    glyph: 'cloud',
    colour: '#7db8e8',
    line: 'A parked storm cell that dumps local rain in a 3x3 patch.',
  },
  {
    id: 'mudslide',
    name: 'Mudslide',
    glyph: 'slide',
    colour: '#8a6a45',
    line: 'Loose slopes slump downhill, lowering a ridge by 1-2 steps.',
  },
  {
    id: 'beaver',
    name: 'Beaver Dam',
    glyph: 'beaver',
    colour: '#c98d4b',
    line: 'Busy beavers raise a cell by 2 and back the water up behind it.',
  },
  {
    id: 'crack',
    name: 'Cracked Levee',
    glyph: 'crack',
    colour: '#e8e3d0',
    line: 'Old levees erode one step at a time until they give way.',
  },
  {
    id: 'damleak',
    name: 'Dam Leak',
    glyph: 'dam',
    colour: '#e84d4d',
    line: 'Boss hazard: the cracked dam spits a pulse of water every few seconds.',
  },
];

/** The tool draft pool: nine named tools, draft 1 of 3 after every held day. */
export const TOOLS = [
  {
    id: 'spade',
    name: 'Wider Spade',
    line: 'Every dig also digs the cell to the east — two channels for one click.',
  },
  {
    id: 'stone',
    name: 'Stone Levees',
    line: 'Your levees cost 1 less earth and never erode, even when cracked.',
  },
  {
    id: 'pumps',
    name: 'Pumps',
    line: 'A pump crew drains the wettest village cell every 4 seconds.',
  },
  {
    id: 'sandbag',
    name: 'Sandbag Line',
    line: 'Press Q to throw an instant 3-cell levee for a flat 3 earth.',
  },
  {
    id: 'surveyor',
    name: 'Surveyor',
    line: 'Flow-forecast arrows appear on the grid, showing where water will run.',
  },
  {
    id: 'gate',
    name: 'Reservoir Gate',
    line: 'Reservoirs hold 50% more, and captured water scores double.',
  },
  {
    id: 'trowel',
    name: 'Deep Trowel',
    line: 'Every dig lowers the ground by 2 steps instead of 1.',
  },
  {
    id: 'barrels',
    name: 'Rain Barrels',
    line: 'Rain bursts fill half as fast — and every burst pays +4 supplies.',
  },
  {
    id: 'whistle',
    name: 'Animal Whistle',
    line: 'Stranded animals hurry: they seek dry ground twice as often.',
  },
];

/**
 * Valley Marks: the collectible set of eight passives, earned from animal
 * rescues and boss days, each with a small real effect (see game.js hasMark).
 */
export const MARKS = [
  {
    id: 'otter',
    name: 'Otter Charm',
    line: 'Rescues score +50%. Earned by your first rescue.',
    earn: 'rescue',
  },
  {
    id: 'heron',
    name: 'Heron Feather',
    line: '+6 earth at the start of every day. Earned at 3 rescues.',
    earn: 'rescue',
  },
  {
    id: 'drystone',
    name: 'Dry Stone',
    line: 'Houses shrug off shallow water (+0.2 flood depth). Earned at 5 rescues.',
    earn: 'rescue',
  },
  {
    id: 'trout',
    name: 'Rainbow Trout',
    line: 'Water sent to the outflow scores +25%. Earned at 7 rescues.',
    earn: 'rescue',
  },
  {
    id: 'clayseal',
    name: 'Clay Seal',
    line: 'Levee erosion is halved. Earned by holding the Day 5 dam.',
    earn: 'boss',
  },
  {
    id: 'oakroot',
    name: 'Old Oak Root',
    line: 'One dig in four is free, the roots do the work. Earned at 9 rescues.',
    earn: 'rescue',
  },
  {
    id: 'mothlamp',
    name: 'Moon Moth Lantern',
    line: 'Threat panel shows the next hazard timer. Earned at 11 rescues.',
    earn: 'rescue',
  },
  {
    id: 'delugebell',
    name: 'Deluge Bell',
    line: 'Day 9 surge waves arrive weaker (-25%). Earned by reaching the Deluge.',
    earn: 'boss',
  },
];

/** Rescue counts at which rescue-earned marks are granted, in MARKS order. */
export const MARK_RESCUE_THRESHOLDS = { otter: 1, heron: 3, drystone: 5, trout: 7, oakroot: 9, mothlamp: 11 };

/** The three difficulties. */
export const DIFFICULTIES = [
  {
    id: 'calm',
    name: 'CALM',
    line: 'Slower rivers, deep earth budget. Learn the valley.',
    inflow: 0.8,
    earth: 34,
    requiredRatio: 0.7,
  },
  {
    id: 'storm',
    name: 'STORM',
    line: 'The intended flood. Every levee counts.',
    inflow: 1.0,
    earth: 28,
    requiredRatio: 0.8,
  },
  {
    id: 'tempest',
    name: 'TEMPEST',
    line: 'Twin fury: faster water, thin budget, hold almost all.',
    inflow: 1.25,
    earth: 22,
    requiredRatio: 0.9,
  },
];

/**
 * The nine storm days. hazards lists [hazardId, count] pairs; boss names the
 * set-piece event of the day when there is one.
 */
export const DAYS = [
  { day: 1, valley: 0, houses: 6, animals: 2, seconds: 40, inflow: 0.55, hazards: [['rainburst', 1]], boss: null },
  { day: 2, valley: 0, houses: 7, animals: 3, seconds: 42, inflow: 0.65, hazards: [['rainburst', 1], ['debris', 1]], boss: null },
  { day: 3, valley: 0, houses: 7, animals: 3, seconds: 44, inflow: 0.75, hazards: [['sinkhole', 1], ['debris', 2], ['rainburst', 1]], boss: null },
  { day: 4, valley: 1, houses: 8, animals: 3, seconds: 44, inflow: 0.85, hazards: [['mudslide', 2], ['rainburst', 2], ['debris', 1]], boss: null },
  { day: 5, valley: 1, houses: 8, animals: 4, seconds: 48, inflow: 0.9, hazards: [['damleak', 3], ['crack', 2], ['debris', 1]], boss: 'THE CRACKED DAM' },
  { day: 6, valley: 1, houses: 9, animals: 4, seconds: 46, inflow: 1.0, hazards: [['beaver', 2], ['mudslide', 1], ['rainburst', 2], ['crack', 1]], boss: null },
  { day: 7, valley: 2, houses: 9, animals: 4, seconds: 46, inflow: 1.05, hazards: [['sinkhole', 2], ['beaver', 1], ['rainburst', 2], ['debris', 2]], boss: null },
  { day: 8, valley: 2, houses: 10, animals: 5, seconds: 48, inflow: 1.15, hazards: [['beaver', 2], ['mudslide', 2], ['crack', 2], ['rainburst', 2]], boss: null },
  { day: 9, valley: 2, houses: 10, animals: 5, seconds: 55, inflow: 1.3, hazards: [['damleak', 2], ['beaver', 1], ['sinkhole', 1], ['rainburst', 3], ['crack', 2]], boss: 'THE DELUGE' },
];

export function hazardById(id) {
  return HAZARDS.find((h) => h.id === id);
}
export function toolById(id) {
  return TOOLS.find((t) => t.id === id);
}
export function markById(id) {
  return MARKS.find((m) => m.id === id);
}
