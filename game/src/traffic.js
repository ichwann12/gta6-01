// The city's other road users: traffic cars that follow the road grid, and
// pedestrians on the sidewalks who scatter when shots are fired.
import { CAR_COLORS } from './config.js';
import { clampToWorld, findPath, nearestIntersection, randomRoadPoint, randomSidewalkPoint, resolveBuildingCollision } from './city.js';
import { intRange, pick, range } from './random.js';
import { makeCar, stepCar } from './vehicles.js';

export function spawnTrafficCar(state) {
  const { city, rng } = state;
  const p = randomRoadPoint(city, rng);
  const car = makeCar(p.x, p.y, pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), {
    color: pick(rng, CAR_COLORS),
    driver: 'traffic',
  });
  car.speed = range(rng, 90, 170);
  car.path = [];
  car.pathTarget = null;
  car.cruise = range(rng, 90, 170);
  state.traffic.push(car);
  return car;
}

export function spawnPedestrian(state) {
  const { city, rng } = state;
  const p = randomSidewalkPoint(city, rng);
  const ped = {
    x: p.x,
    y: p.y,
    angle: pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
    speed: range(rng, 34, 62),
    color: pick(rng, ['#f2c94c', '#7dd3fc', '#f9a8d4', '#a7f3d0', '#fca5a5', '#e2e8f0']),
    shirt: pick(rng, ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316']),
    hp: 100,
    dead: false,
    fade: 0,
    flee: 0,
    target: null,
  };
  state.peds.push(ped);
  return ped;
}

/** Pick the next intersection for a traffic car: a random turn, never a U-turn. */
function nextIntersection(state, car) {
  const cur = nearestIntersection(state.city, car.x, car.y);
  const dirs = [];
  if (cur.ai > 0) dirs.push({ ai: cur.ai - 1, si: cur.si });
  if (cur.ai < state.city.avenues.length - 1) dirs.push({ ai: cur.ai + 1, si: cur.si });
  if (cur.si > 0) dirs.push({ ai: cur.ai, si: cur.si - 1 });
  if (cur.si < state.city.streets.length - 1) dirs.push({ ai: cur.ai, si: cur.si + 1 });
  const prev = car.lastIntersection;
  const choices = dirs.filter((d) => !(prev && d.ai === prev.ai && d.si === prev.si));
  const next = pick(state.rng, choices.length > 0 ? choices : dirs);
  car.lastIntersection = cur;
  return { x: state.city.avenues[next.ai], y: state.city.streets[next.si] };
}

export function stepTraffic(state, dt) {
  // Keep the streets busy: top the traffic up, but never past the cap.
  while (state.traffic.length < state.trafficTarget) spawnTrafficCar(state);
  for (const car of state.traffic) {
    if (car.dead) continue;
    if (!car.pathTarget) car.pathTarget = nextIntersection(state, car);
    const dx = car.pathTarget.x - car.x;
    const dy = car.pathTarget.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 26) {
      car.pathTarget = nextIntersection(state, car);
      continue;
    }
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    // Slow down for the car ahead so traffic does not pile up.
    let ahead = 1;
    for (const other of state.traffic) {
      if (other === car || other.dead) continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const od = Math.hypot(ox, oy);
      if (od < 70 && ox * Math.cos(car.angle) + oy * Math.sin(car.angle) > 0) ahead = 0;
    }
    stepCar(state.city, car, dt, { throttle: ahead, steer, brake: ahead ? 0 : 0.6 });
    if (car.speed < 40) car.speed = 40;
    if (car.speed > car.cruise) car.speed = car.cruise;
  }
  // A slow car that has been stuck against a building gets a fresh target.
  for (const car of state.traffic) {
    if (!car.dead && Math.abs(car.speed) < 5) car.pathTarget = nextIntersection(state, car);
  }
}

export function stepPedestrians(state, dt) {
  while (state.peds.length < state.pedTarget) spawnPedestrian(state);
  for (const ped of state.peds) {
    if (ped.dead) {
      ped.fade += dt;
      continue;
    }
    if (ped.flee > 0) ped.flee -= dt;
    // Fleeing: run from the last gunshot; otherwise stroll the sidewalk.
    let tx;
    let ty;
    if (ped.flee > 0 && ped.fleeFrom) {
      const dx = ped.x - ped.fleeFrom.x;
      const dy = ped.y - ped.fleeFrom.y;
      const d = Math.hypot(dx, dy) || 1;
      tx = ped.x + (dx / d) * 120;
      ty = ped.y + (dy / d) * 120;
    } else if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 20) {
      ped.target = randomSidewalkPoint(state.city, state.rng);
      continue;
    } else {
      tx = ped.target.x;
      ty = ped.target.y;
    }
    const dx = tx - ped.x;
    const dy = ty - ped.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = ped.flee > 0 ? ped.speed * 2.6 : ped.speed;
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * speed * dt;
    ped.y += (dy / d) * speed * dt;
    // Pedestrians keep out of buildings and the water.
    const body = { x: ped.x, y: ped.y, r: 10 };
    resolveBuildingCollision(state.city, body);
    clampToWorld(state.city, body);
    ped.x = body.x;
    ped.y = body.y;
  }
  // Drop the long-dead and respawn fresh faces.
  state.peds = state.peds.filter((p) => !p.dead || p.fade < 6);
}

/** Every pedestrian near a gunshot starts running. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.flee = 3;
      ped.fleeFrom = { x, y };
    }
  }
}
