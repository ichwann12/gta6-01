// The city of Solmar: a seeded road grid with blocks of buildings, parks and
// parking lots, and a beach along the south edge. The same seed always builds
// the same city, so a screenshot scene replays exactly.
import { BEACH_Y, ROAD_W, WATER_Y, WORLD_H, WORLD_W } from './config.js';
import { intRange, pick, range } from './random.js';

const AVENUES = [200, 560, 920, 1280, 1640, 2000, 2360, 2720, 3080];
const STREETS = [180, 500, 820, 1140, 1460, 1780, 2100];
const ROOF_COLORS = ['#d97b5f', '#c96f4a', '#b98a5a', '#8a9ba8', '#a8696e', '#7d8a6a', '#96705a', '#6b7f95'];

export function createCity(rng) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const parking = [];
  // Every block between two avenues and two streets gets a use.
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 14;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[si] + ROAD_W / 2 + 14;
      const y1 = STREETS[si + 1] - ROAD_W / 2 - 14;
      const roll = rng();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = intRange(rng, 4, 9);
        for (let i = 0; i < count; i++) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 9, 15) });
        }
        continue;
      }
      if (roll < 0.3) {
        parking.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // One to four buildings in the block, split along the longer side.
      const horizontal = x1 - x0 > y1 - y0;
      const parts = intRange(rng, 1, 3);
      for (let p = 0; p < parts; p++) {
        let bx;
        let by;
        let bw;
        let bh;
        if (horizontal) {
          bw = (x1 - x0 - (parts - 1) * 18) / parts;
          bh = range(rng, (y1 - y0) * 0.45, y1 - y0 - 8);
          bx = x0 + p * (bw + 18);
          by = y0 + range(rng, 0, Math.max(0, y1 - y0 - bh));
        } else {
          bh = (y1 - y0 - (parts - 1) * 18) / parts;
          bw = range(rng, (x1 - x0) * 0.45, x1 - x0 - 8);
          by = y0 + p * (bh + 18);
          bx = x0 + range(rng, 0, Math.max(0, x1 - x0 - bw));
        }
        buildings.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          color: pick(rng, ROOF_COLORS),
          height: intRange(rng, 1, 3),
          windows: intRange(rng, 4, 12),
        });
      }
    }
  }
  return {
    width: WORLD_W,
    height: WORLD_H,
    avenues: AVENUES,
    streets: STREETS,
    roadW: ROAD_W,
    buildings,
    parks,
    trees,
    parking,
    beachY: BEACH_Y,
    waterY: WATER_Y,
  };
}

/** Whether a point is on a road (within half the road width of an avenue or street). */
export function isOnRoad(city, x, y) {
  const half = city.roadW / 2;
  if (y > city.beachY) return Math.abs(y - 2180) < half + 40 && x > 100 && x < city.width - 100;
  for (const ax of city.avenues) if (Math.abs(x - ax) < half) return true;
  for (const sy of city.streets) if (Math.abs(y - sy) < half) return true;
  return false;
}

/** The nearest grid intersection to a point: {ai, si, x, y}. */
export function nearestIntersection(city, x, y) {
  let ai = 0;
  let best = Infinity;
  for (let i = 0; i < city.avenues.length; i++) {
    const d = Math.abs(city.avenues[i] - x);
    if (d < best) {
      best = d;
      ai = i;
    }
  }
  let si = 0;
  best = Infinity;
  for (let i = 0; i < city.streets.length; i++) {
    const d = Math.abs(city.streets[i] - y);
    if (d < best) {
      best = d;
      si = i;
    }
  }
  return { ai, si, x: city.avenues[ai], y: city.streets[si] };
}

/**
 * A path of intersections from (ai, si) to (bi, si2) over the road grid,
 * breadth-first, as [{x, y}...] including the destination. The grid is small
 * and regular, so this is cheap and always finds a way.
 */
export function findPath(city, from, to) {
  const cols = city.avenues.length;
  const rows = city.streets.length;
  const key = (ai, si) => si * cols + ai;
  const prev = new Map();
  const queue = [key(from.ai, from.si)];
  prev.set(key(from.ai, from.si), -1);
  while (queue.length > 0) {
    const cur = queue.shift();
    const ai = cur % cols;
    const si = Math.floor(cur / cols);
    if (ai === to.ai && si === to.si) break;
    for (const [dai, dsi] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nai = ai + dai;
      const nsi = si + dsi;
      if (nai < 0 || nai >= cols || nsi < 0 || nsi >= rows) continue;
      const nk = key(nai, nsi);
      if (prev.has(nk)) continue;
      prev.set(nk, cur);
      queue.push(nk);
    }
  }
  const target = key(to.ai, to.si);
  if (!prev.has(target)) return [{ x: city.avenues[to.ai], y: city.streets[to.si] }];
  const path = [];
  let cur = target;
  while (cur !== -1) {
    const ai = cur % cols;
    const si = Math.floor(cur / cols);
    path.unshift({ x: city.avenues[ai], y: city.streets[si] });
    cur = prev.get(cur);
  }
  return path;
}

/** Push a circle out of every building it overlaps; returns true when it hit one. */
export function resolveBuildingCollision(city, body) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= body.r * body.r) continue;
    hit = true;
    if (d2 < 0.0001) {
      // Dead centre: push out along the shortest side.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - body.r;
      else if (m === right) body.x = b.x + b.w + body.r;
      else if (m === top) body.y = b.y - body.r;
      else body.y = b.y + b.h + body.r;
      continue;
    }
    const d = Math.sqrt(d2);
    body.x = cx + (dx / d) * body.r;
    body.y = cy + (dy / d) * body.r;
  }
  return hit;
}

/** Keep a circle inside the world, off the water. */
export function clampToWorld(city, body) {
  body.x = Math.max(body.r, Math.min(city.width - body.r, body.x));
  body.y = Math.max(body.r, Math.min(city.waterY - body.r - 4, body.y));
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(city, rng) {
  if (rng() < 0.5) {
    return { x: pick(rng, city.avenues), y: range(rng, 120, city.beachY - 60) };
  }
  return { x: range(rng, 120, city.width - 120), y: pick(rng, city.streets) };
}

/** A random point on a sidewalk edge of a road. */
export function randomSidewalkPoint(city, rng) {
  const p = randomRoadPoint(city, rng);
  const onAvenue = city.avenues.includes(p.x);
  if (onAvenue) return { x: p.x + (rng() < 0.5 ? -1 : 1) * (city.roadW / 2 + 10), y: p.y };
  return { x: p.x, y: p.y + (rng() < 0.5 ? -1 : 1) * (city.roadW / 2 + 10) };
}
