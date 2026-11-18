// Cars: one physics model for the player's ride, traffic and police. A car is a
// point with a heading and a speed; steering bites harder the faster it goes,
// and a hard hit costs health and throws sparks.
import { CAR } from './config.js';
import { clampToWorld, resolveBuildingCollision } from './city.js';
import { pick, range } from './random.js';

let nextCarId = 1;

export function makeCar(x, y, angle, opts = {}) {
  return {
    id: nextCarId++,
    x,
    y,
    angle,
    speed: 0,
    color: opts.color || '#e33f2f',
    model: opts.model || 'sedan',
    hp: CAR.hp,
    isCop: !!opts.isCop,
    isPlayer: !!opts.isPlayer,
    parked: !!opts.parked,
    driver: opts.driver || null, // 'traffic' | 'cop' | 'player' | null
    dead: false,
    siren: 0,
    smoke: 0,
  };
}

export function resetCarIds() {
  nextCarId = 1;
}

/** Two circles approximating a car: one at the nose, one at the tail. */
function carCircles(car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const off = CAR.length * 0.26;
  return [
    { x: car.x + fx * off, y: car.y + fy * off, r: CAR.width * 0.62 },
    { x: car.x - fx * off, y: car.y - fy * off, r: CAR.width * 0.62 },
  ];
}

/** Push two cars apart and trade a little speed; returns the impact strength. */
export function collideCars(a, b) {
  let impact = 0;
  const ca = carCircles(a);
  const cb = carCircles(b);
  for (const pa of ca) {
    for (const pb of cb) {
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      const d = Math.hypot(dx, dy);
      const min = pa.r + pb.r;
      if (d >= min || d < 0.001) continue;
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x += nx * push;
      a.y += ny * push;
      b.x -= nx * push;
      b.y -= ny * push;
      const rel = Math.abs(a.speed - b.speed);
      impact = Math.max(impact, rel);
      const loss = Math.min(a.speed, rel * 0.35);
      a.speed -= Math.sign(a.speed) * loss * 0.5;
      b.speed -= Math.sign(b.speed) * loss * 0.5;
    }
  }
  return impact;
}

/**
 * Drive a car one step. `ctrl` is {throttle: -1..1, steer: -1..1, brake: 0..1}.
 * Returns the impact strength when it hit a building (0 otherwise).
 */
export function stepCar(city, car, dt, ctrl) {
  if (car.dead) return 0;
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  // Steering: full lock at a crawl, gentle at speed; reversing flips it.
  const speedNorm = Math.min(1, Math.abs(car.speed) / 300);
  const steerAuthority = 1 - speedNorm * 0.55;
  car.angle += ctrl.steer * CAR.turnRate * steerAuthority * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 60 + 0.25);
  if (ctrl.throttle > 0) car.speed += CAR.accel * ctrl.throttle * dt;
  else if (ctrl.throttle < 0) car.speed += CAR.reverseAccel * ctrl.throttle * dt;
  if (ctrl.brake > 0) {
    const drop = CAR.brake * dt;
    car.speed = Math.abs(car.speed) <= drop ? 0 : car.speed - Math.sign(car.speed) * drop;
  }
  // Drag and the road's grip: the car mostly follows its heading.
  car.speed *= Math.max(0, 1 - 0.35 * dt);
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  const nx = car.x + forward * car.speed * dt;
  const ny = car.y + right * car.speed * dt;
  car.x = nx;
  car.y = ny;
  const body = { x: car.x, y: car.y, r: CAR.width * 0.62 };
  const hit = resolveBuildingCollision(city, body);
  car.x = body.x;
  car.y = body.y;
  clampToWorld(city, body);
  car.x = body.x;
  car.y = body.y;
  let impact = 0;
  if (hit) {
    impact = Math.abs(car.speed);
    if (impact > 140) {
      car.hp -= (impact - 140) / 14;
      if (car.hp <= 0) {
        car.hp = 0;
        car.dead = true;
      }
    }
    car.speed *= 0.4;
  }
  if (car.hp < 35) car.smoke = Math.min(1, car.smoke + dt * 0.5);
  return impact;
}

/** A parked car in a parking lot or along a road, for the player to steal. */
export function spawnParkedCars(city, rng, count) {
  const cars = [];
  const spots = [];
  for (const lot of city.parking) {
    for (let i = 0; i < 3; i++) {
      spots.push({ x: lot.x + 40 + i * 90, y: lot.y + lot.h / 2, angle: Math.PI / 2 });
    }
  }
  for (let i = 0; i < count; i++) {
    let x;
    let y;
    let angle;
    if (spots.length > 0 && rng() < 0.6) {
      const s = spots.splice(Math.floor(rng() * spots.length), 1)[0];
      x = s.x;
      y = s.y;
      angle = s.angle;
    } else {
      const av = pick(rng, city.avenues);
      const st = pick(rng, city.streets);
      if (rng() < 0.5) {
        x = av + (rng() < 0.5 ? -1 : 1) * 26;
        y = range(rng, 140, city.beachY - 80);
        angle = rng() < 0.5 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        x = range(rng, 140, city.width - 140);
        y = st + (rng() < 0.5 ? -1 : 1) * 26;
        angle = rng() < 0.5 ? 0 : Math.PI;
      }
    }
    cars.push(makeCar(x, y, angle, { color: pick(rng, ['#e33f2f', '#2f7fe3', '#f2b01e', '#3fae5a', '#e8e4da', '#5a6b7d']), parked: true }));
  }
  return cars;
}
