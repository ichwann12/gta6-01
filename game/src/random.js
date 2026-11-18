// A seeded random number generator (mulberry32) so the city, the traffic and the
// screenshot scenes are the same every time a seed is used.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max]. */
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One item of an array. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** An angle in radians, uniform. */
export function angle(rng) {
  return rng() * Math.PI * 2;
}
