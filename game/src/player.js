// Leo Marín, on foot and behind the wheel: walking, sprinting, shooting,
// stealing cars and getting out again. Every crime here feeds the wanted level.
import { CAR, PLAYER } from './config.js';
import { clampToWorld, resolveBuildingCollision } from './city.js';
import { collideCars, stepCar } from './vehicles.js';
import { scarePeds } from './traffic.js';
import { addWanted } from './police.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    inCar: null,
    fireCooldown: 0,
    invulnerable: 0,
    walkCycle: 0,
  };
}

/** The nearest drivable car to a point, within `radius`. */
export function nearestCar(state, x, y, radius) {
  let best = null;
  let bestD = radius;
  for (const car of state.cars) {
    if (car.dead || car.isPlayer) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function fireBullet(state) {
  const p = state.player;
  const mx = state.camera.x + state.input.mouse.x;
  const my = state.camera.y + state.input.mouse.y;
  const angle = Math.atan2(my - p.y, mx - p.x);
  p.angle = angle;
  state.bullets.push({
    x: p.x + Math.cos(angle) * 20,
    y: p.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: 0.9,
    from: 'player',
  });
  p.fireCooldown = PLAYER.fireRate;
  state.audio.shot();
  state.particles.push({ x: p.x + Math.cos(angle) * 26, y: p.y + Math.sin(angle) * 26, vx: Math.cos(angle) * 120, vy: Math.sin(angle) * 120, life: 0.12, max: 0.12, color: '#ffd166', size: 5 });
  scarePeds(state, p.x, p.y, 420);
  addWanted(state, 1, 'Shots fired');
}

export function stepPlayer(state, dt, input) {
  const p = state.player;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;

  // Getting in and out of cars.
  if (input.justPressed('e')) {
    if (p.inCar) {
      const car = p.inCar;
      car.isPlayer = false;
      car.driver = null;
      p.inCar = null;
      p.x = car.x - Math.sin(car.angle) * 34;
      p.y = car.y + Math.cos(car.angle) * 34;
      p.angle = car.angle;
      const body = { x: p.x, y: p.y, r: PLAYER.radius };
      resolveBuildingCollision(state.city, body);
      clampToWorld(state.city, body);
      p.x = body.x;
      p.y = body.y;
    } else {
      const car = nearestCar(state, p.x, p.y, 64);
      if (car) {
        car.isPlayer = true;
        car.driver = 'player';
        car.parked = false;
        p.inCar = car;
        if (car.isCop) {
          addWanted(state, 2, 'Police car stolen');
        } else {
          addWanted(state, 1, 'Car stolen');
        }
        state.audio.pickup();
      }
    }
  }

  if (p.inCar) {
    const car = p.inCar;
    const axis = input.moveAxis();
    const throttle = axis.y < 0 ? 1 : axis.y > 0 ? -0.7 : 0;
    const steer = -axis.x;
    const brake = input.down(' ') ? 1 : 0;
    const impact = stepCar(state.city, car, dt, { throttle, steer, brake });
    if (impact > 200) {
      state.audio.crash(Math.min(1, impact / 500));
      state.shake = Math.min(10, impact / 60);
      spawnCrashSparks(state, car.x, car.y, impact);
    }
    // Skid marks when the car slides sideways at speed.
    if (Math.abs(car.speed) > 320 && Math.abs(steer) > 0.6 && state.skids.length < 240) {
      state.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 5 });
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    state.audio.engine(true, Math.abs(car.speed) / CAR.maxSpeed);
    return;
  }

  state.audio.engine(false, 0);
  // On foot.
  const axis = input.moveAxis();
  const len = Math.hypot(axis.x, axis.y);
  const sprint = input.down('Shift');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (len > 0) {
    const nx = p.x + (axis.x / len) * speed * dt;
    const ny = p.y + (axis.y / len) * speed * dt;
    p.x = nx;
    p.y = ny;
    p.walkCycle += dt * (sprint ? 13 : 9);
    // Aim where the mouse points while walking.
    const mx = state.camera.x + input.mouse.x;
    const my = state.camera.y + input.mouse.y;
    p.angle = Math.atan2(my - p.y, mx - p.x);
  }
  const body = { x: p.x, y: p.y, r: PLAYER.radius };
  resolveBuildingCollision(state.city, body);
  clampToWorld(state.city, body);
  p.x = body.x;
  p.y = body.y;
  // Bump into parked and traffic cars: they are solid.
  for (const car of state.cars) {
    if (car.dead) continue;
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < PLAYER.radius + 24 && d > 0.001) {
      p.x = car.x + (dx / d) * (PLAYER.radius + 24);
      p.y = car.y + (dy / d) * (PLAYER.radius + 24);
    }
  }
  // Shooting.
  if ((input.mouse.down || input.mouse.clicked) && p.fireCooldown <= 0) {
    fireBullet(state);
  }
}

function spawnCrashSparks(state, x, y, impact) {
  const n = Math.min(10, Math.floor(impact / 60));
  for (let i = 0; i < n; i++) {
    const a = state.rng() * Math.PI * 2;
    const s = 60 + state.rng() * 160;
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, max: 0.4, color: '#ffd166', size: 3 });
  }
}

/** Bullets fly, hit peds, cops and cars, and fade out. */
export function stepBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    // Buildings stop bullets.
    const body = { x: b.x, y: b.y, r: 2 };
    if (resolveBuildingCollision(state.city, body)) {
      b.life = 0;
      state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, max: 0.2, color: '#cbd5e1', size: 3 });
      continue;
    }
    if (b.life <= 0) continue;
    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
        b.life = 0;
        ped.hp -= PLAYER.bulletDamage;
        if (ped.hp <= 0) {
          ped.dead = true;
          ped.fade = 0;
          addWanted(state, 1, 'Pedestrian down');
        }
        blood(state, ped.x, ped.y);
        break;
      }
    }
    if (b.life <= 0) continue;
    // Foot cops.
    for (const cop of state.police.footCops) {
      if (cop.dead) continue;
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 15) {
        b.life = 0;
        cop.hp -= PLAYER.bulletDamage;
        if (cop.hp <= 0) {
          cop.dead = true;
          addWanted(state, 1, 'Officer down');
        }
        blood(state, cop.x, cop.y);
        break;
      }
    }
    if (b.life <= 0) continue;
    // Cars.
    for (const car of state.cars) {
      if (car.dead) continue;
      if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
        b.life = 0;
        car.hp -= PLAYER.bulletDamage / 2;
        if (car.hp <= 0) {
          car.dead = true;
          state.particles.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.6, max: 0.6, color: '#f97316', size: 14 });
        }
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < state.city.width && b.y > 0 && b.y < state.city.height);
}

function blood(state, x, y) {
  for (let i = 0; i < 6; i++) {
    const a = state.rng() * Math.PI * 2;
    const s = 40 + state.rng() * 90;
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35, max: 0.35, color: '#dc2626', size: 3 });
  }
}

/** Damage the player; returns true when the player is wasted. */
export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.invulnerable > 0) return false;
  p.health -= amount;
  p.invulnerable = 0.4;
  if (p.health <= 0) {
    p.health = 0;
    return true;
  }
  return false;
}
