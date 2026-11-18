// The Solmar police: a wanted level that rises with every crime, cop cars
// and foot cops that spawn and chase, and a bust when they catch you on foot.
import { WANTED } from './config.js';
import { clampToWorld, findPath, nearestIntersection, randomRoadPoint, resolveBuildingCollision } from './city.js';
import { pick, range } from './random.js';
import { collideCars, makeCar, stepCar } from './vehicles.js';

export function createPolice() {
  return {
    stars: 0,
    copCars: [],
    footCops: [],
    decayTimer: 0,
    bustTimer: 0,
    lastReason: '',
  };
}

/** Raise the wanted level and show why in the HUD. */
export function addWanted(state, n, reason) {
  const pol = state.police;
  const before = pol.stars;
  pol.stars = Math.min(WANTED.maxStars, pol.stars + n);
  pol.decayTimer = 0;
  if (pol.stars > before) {
    pol.lastReason = reason || '';
    state.banner = { text: reason || 'Wanted level up', sub: `Wanted: ${'★'.repeat(pol.stars)}`, t: 2.2 };
    if (pol.stars >= 3) state.audio.siren(true, 0.5);
  }
}

/** How many cop cars the stars call for right now. */
function wantedCopCars(stars) {
  return Math.min(WANTED.maxCopCars, stars);
}

function wantedFootCops(stars) {
  return Math.min(WANTED.maxFootCops, stars);
}

function spawnCopCar(state) {
  const { city, rng, player } = state;
  // Spawn on a road a good distance away, never on top of the player.
  let x;
  let y;
  for (let tries = 0; tries < 12; tries++) {
    const p = randomRoadPoint(city, rng);
    if (Math.hypot(p.x - player.x, p.y - player.y) > 550) {
      x = p.x;
      y = p.y;
      break;
    }
  }
  if (x === undefined) {
    x = player.x + 700;
    y = player.y;
  }
  const car = makeCar(x, y, 0, { color: '#111827', model: 'cruiser', isCop: true, driver: 'cop' });
  car.hp = 140;
  car.path = [];
  car.pathTarget = null;
  state.police.copCars.push(car);
  state.cars.push(car);
  return car;
}

function spawnFootCop(state) {
  const { city, rng, player } = state;
  const angle = rng() * Math.PI * 2;
  const dist = range(rng, 320, 480);
  const cop = {
    x: player.x + Math.cos(angle) * dist,
    y: player.y + Math.sin(angle) * dist,
    angle: 0,
    speed: range(rng, 150, 185),
    hp: 100,
    dead: false,
    fade: 0,
    punch: 0,
  };
  const body = { x: cop.x, y: cop.y, r: 12 };
  resolveBuildingCollision(city, body);
  clampToWorld(city, body);
  cop.x = body.x;
  cop.y = body.y;
  state.police.footCops.push(cop);
  return cop;
}

export function stepPolice(state, dt) {
  const pol = state.police;
  const p = state.player;
  // Keep the force at the level the stars call for.
  while (pol.copCars.length < wantedCopCars(pol.stars)) spawnCopCar(state);
  while (pol.footCops.filter((c) => !c.dead).length < wantedFootCops(pol.stars)) spawnFootCop(state);
  // Drop the force when the heat falls.
  if (pol.copCars.length > wantedCopCars(pol.stars)) {
    const extra = pol.copCars.pop();
    state.cars = state.cars.filter((c) => c !== extra);
  }
  pol.footCops = pol.footCops.filter((c) => !c.dead || c.fade < 4);

  // Wanted cools off only while no cop can see the player.
  const nearestCop = nearestCopDistance(state);
  if (pol.stars > 0 && nearestCop > WANTED.unseenDistance) {
    pol.decayTimer += dt;
    if (pol.decayTimer >= WANTED.decaySecondsPerStar) {
      pol.decayTimer = 0;
      pol.stars -= 1;
      if (pol.stars === 0) state.banner = { text: 'You lost the cops', sub: 'Wanted level clear', t: 2 };
    }
  } else {
    pol.decayTimer = 0;
  }

  // Cop cars: follow the road grid to the player, then ram.
  for (const car of pol.copCars) {
    if (car.dead) continue;
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const dist = Math.hypot(dx, dy);
    car.siren = 0.5 + 0.5 * Math.sin(state.time * 8 + car.id);
    let ctrl;
    if (dist < 260) {
      const want = Math.atan2(dy, dx);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ctrl = { throttle: 1, steer: Math.max(-1, Math.min(1, diff * 2.5)), brake: 0 };
    } else {
      if (!car.pathTarget || car.path.length === 0) {
        const from = nearestIntersection(state.city, car.x, car.y);
        const to = nearestIntersection(state.city, p.x, p.y);
        car.path = findPath(state.city, from, to);
        car.pathTarget = car.path[1] || car.path[0];
      }
      const wp = car.pathTarget;
      const wdx = wp.x - car.x;
      const wdy = wp.y - car.y;
      if (Math.hypot(wdx, wdy) < 40) {
        car.path.shift();
        car.pathTarget = car.path[0] || null;
        continue;
      }
      const want = Math.atan2(wdy, wdx);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ctrl = { throttle: 1, steer: Math.max(-1, Math.min(1, diff * 2.5)), brake: 0 };
    }
    const before = car.speed;
    const impact = stepCar(state.city, car, dt, ctrl);
    if (impact > 120) {
      state.audio.crash(Math.min(1, impact / 500));
      state.shake = Math.min(8, impact / 80);
    }
    // Ramming the player's car hurts it; ramming the player on foot busts them.
    if (p.inCar) {
      const hit = collideCars(car, p.inCar);
      if (hit > 120) {
        p.inCar.hp -= (hit - 120) / 10;
        state.audio.crash(0.7);
        state.shake = Math.min(9, hit / 70);
        if (p.inCar.hp <= 0) {
          p.inCar.dead = true;
          state.banner = { text: 'Your car is wrecked', sub: 'Get out and run', t: 2.5 };
        }
      }
    } else if (dist < 34 && Math.abs(car.speed) > 60) {
      if (hurt(state, 22)) state.events.push('wasted');
    }
    if (before > 200 && car.speed < 60) car.pathTarget = null;
  }

  // Foot cops: run the player down and, up close, make the arrest.
  let busting = false;
  for (const cop of pol.footCops) {
    if (cop.dead) {
      cop.fade += dt;
      continue;
    }
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (p.inCar) {
      // Cops give up chasing a car: they head for the nearest road and wait.
      if (dist > 500) continue;
      cop.angle = Math.atan2(dy, dx);
      cop.x += Math.cos(cop.angle) * cop.speed * 0.5 * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * 0.5 * dt;
      continue;
    }
    cop.angle = Math.atan2(dy, dx);
    const speed = dist > 60 ? cop.speed : cop.speed * 0.7;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    const body = { x: cop.x, y: cop.y, r: 12 };
    resolveBuildingCollision(state.city, body);
    clampToWorld(state.city, body);
    cop.x = body.x;
    cop.y = body.y;
    if (dist < 30) {
      busting = true;
      cop.punch += dt;
      if (cop.punch > 0.6) {
        cop.punch = 0;
        if (hurt(state, 9)) state.events.push('wasted');
      }
    }
  }
  if (busting && !p.inCar) {
    pol.bustTimer += dt;
    if (pol.bustTimer >= WANTED.bustSeconds) {
      pol.bustTimer = 0;
      state.events.push('busted');
    }
  } else {
    pol.bustTimer = 0;
  }

  // The siren follows the nearest cop car.
  const nearest = nearestCopDistance(state);
  state.audio.siren(pol.stars > 0 && pol.copCars.length > 0, nearest / 900);
}

function nearestCopDistance(state) {
  let best = Infinity;
  const p = state.player;
  for (const car of state.police.copCars) {
    if (car.dead) continue;
    best = Math.min(best, Math.hypot(car.x - p.x, car.y - p.y));
  }
  for (const cop of state.police.footCops) {
    if (cop.dead) continue;
    best = Math.min(best, Math.hypot(cop.x - p.x, cop.y - p.y));
  }
  return best;
}

/** Hurt the player; returns true when wasted. Shared with the foot-cop punch. */
function hurt(state, amount) {
  const p = state.player;
  if (p.invulnerable > 0) return false;
  p.health -= amount;
  p.invulnerable = 0.4;
  state.shake = Math.max(state.shake, 4);
  if (p.health <= 0) {
    p.health = 0;
    return true;
  }
  return false;
}
