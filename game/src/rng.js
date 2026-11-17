// Deterministic seeded randomness for FLOODWARDEN.
// Every valley, storm day, hazard placement and draft offer comes from these
// generators, so a seed always replays the same run and the screenshot scenes
// are stable frame for frame.

/** A small fast PRNG (mulberry32) wrapped as an object with helpers. */
export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** A random element of a non-empty array. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** A shuffled copy of the list (Fisher-Yates with this stream). */
    shuffled(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    },
  };
}

/** A stable 0..1 hash of integer coordinates, for terrain grain and speckles. */
export function hash2(x, y, salt) {
  let h = (x * 374761393 + y * 668265263 + salt * 974634211) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
