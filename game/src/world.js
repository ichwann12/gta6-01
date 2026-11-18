// The world: one state object, one fixed step, and the rules that connect the
// modules — player, traffic, police, missions, particles and the screen the
// game is on. Everything here runs on state.time, never on the wall clock, so
// a staged scene replays exactly.
import { PLACES, START_CASH, STEP, VIEW_H, VIEW_W } from './config.js';
import { createCity } from './city.js';
import { makeRng } from './random.js';
import { AudioSys } from './audio.js';
import { createPlayer, stepBullets, stepPlayer } from './player.js';
import { createPolice, stepPolice } from './police.js';
import { createMissions, spawnPackages, startMission, stepMissions, stepSideJobs } from './missions.js';
import { collideCars, spawnParkedCars } from './vehicles.js';
import { stepPedestrians, stepTraffic } from './traffic.js';
import { loadSave, writeSave } from './storage.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WIN = 'win';

export function createWorld(seed) {
  const rng = makeRng(seed);
  const city = createCity(rng);
  const state = {
    seed,
    rng,
    city,
    time: 0,
    screen: SCREEN_TITLE,
    screenTimer: 0,
    camera: { x: 0, y: 0 },
    shake: 0,
    cash: START_CASH,
    player: createPlayer(PLACES.spawn.x, PLACES.spawn.y),
    cars: [],
    traffic: [],
    peds: [],
    bullets: [],
    particles: [],
    skids: [],
    police: createPolice(),
    missions: createMissions(),
    trafficTarget: 14,
    pedTarget: 26,
    banner: null,
    events: [],
    audio: new AudioSys(),
    input: null,
    stats: { missionsDone: 0, bestCash: START_CASH },
    save() {
      writeSave({
        cash: state.cash,
        mission: state.missions.index,
        bestCash: Math.max(state.stats.bestCash, state.cash),
        missionsDone: state.stats.missionsDone,
      });
    },
  };
  state.cars = spawnParkedCars(city, rng, 12);
  state.traffic = [];
  state.peds = [];
  spawnPackages(state);
  // A save resumes the story where it stopped.
  const save = loadSave();
  if (save && save.cash > 0) {
    state.cash = save.cash;
    state.stats.bestCash = save.bestCash || save.cash;
    state.stats.missionsDone = save.missionsDone || 0;
    state.missions.index = Math.min(save.mission || 0, 4);
    state.hasSave = true;
  }
  return state;
}

/** Reset the world to a fresh seeded state (used by the screenshot scenes). */
export function resetWorld(state, seed) {
  const fresh = createWorld(seed);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  state.input = null;
  // A staged scene is always a new story, never a resumed save.
  state.cash = START_CASH;
  state.stats.bestCash = START_CASH;
  state.hasSave = false;
}

/** One fixed step of the world. `input` is the live Input or a staged one. */
export function stepWorld(state, dt, input) {
  state.input = input;
  state.time += dt;
  if (state.banner) {
    state.banner.t -= dt;
    if (state.banner.t <= 0) state.banner = null;
  }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);

  if (state.screen === SCREEN_TITLE) {
    stepAmbient(state, dt);
    return;
  }
  if (state.screen === SCREEN_PAUSE) return;

  if (state.screen === SCREEN_BUSTED || state.screen === SCREEN_WASTED) {
    state.screenTimer += dt;
    stepAmbient(state, dt);
    if (state.screenTimer > 2.6) respawn(state);
    return;
  }
  if (state.screen === SCREEN_WIN) {
    stepAmbient(state, dt);
    return;
  }

  // Playing.
  stepPlayer(state, dt, input);
  stepTraffic(state, dt);
  stepPedestrians(state, dt);
  stepPolice(state, dt);
  stepMissions(state, dt);
  stepSideJobs(state, dt, input);
  stepBullets(state, dt);
  stepParticles(state, dt);
  stepCarCollisions(state);
  updateCamera(state);
  // The story starts on the first step of play.
  if (!state.missions.active && !state.missions.done && state.missions.index < 5 && !state.missionStarted) {
    state.missionStarted = true;
    startMission(state, state.missions.index);
  }
  for (const sk of state.skids) sk.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);
  drainEvents(state);
}

/** Traffic and pedestrians keep moving behind the title and end screens. */
function stepAmbient(state, dt) {
  stepTraffic(state, dt);
  stepPedestrians(state, dt);
  stepParticles(state, dt);
  updateCamera(state);
}

function stepParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.94;
    pt.vy *= 0.94;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}

/** Traffic cars bump into each other and into the player's car. */
function stepCarCollisions(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > 70) continue;
      const impact = collideCars(a, b);
      if (impact > 200) {
        state.audio.crash(Math.min(1, impact / 500));
        if (a.isPlayer || b.isPlayer) state.shake = Math.min(9, impact / 70);
      }
    }
  }
}

function updateCamera(state) {
  const p = state.player;
  const tx = Math.max(0, Math.min(state.city.width - VIEW_W, p.x - VIEW_W / 2));
  const ty = Math.max(0, Math.min(state.city.height - VIEW_H, p.y - VIEW_H / 2));
  // Smooth follow, then a shake offset on top.
  state.camera.x += (tx - state.camera.x) * 0.12;
  state.camera.y += (ty - state.camera.y) * 0.12;
  if (state.shake > 0.2) {
    state.camera.x += (state.rng() - 0.5) * state.shake;
    state.camera.y += (state.rng() - 0.5) * state.shake;
  }
}

/** Busted or wasted: pay the price, clear the heat, and wake up at the hospital. */
function respawn(state) {
  const p = state.player;
  if (state.screen === SCREEN_BUSTED) {
    state.cash = Math.max(0, state.cash - 200);
    state.banner = { text: 'Bailed out', sub: '-$200', t: 2.5 };
  } else {
    state.cash = Math.max(0, Math.floor(state.cash * 0.9));
    state.banner = { text: 'Patched up at St. Solmar', sub: 'The crew is still waiting', t: 2.5 };
  }
  if (p.inCar) {
    p.inCar.isPlayer = false;
    p.inCar.driver = null;
    p.inCar = null;
  }
  p.x = PLACES.hospital.x;
  p.y = PLACES.hospital.y;
  p.health = 100;
  p.invulnerable = 2;
  state.police.stars = 0;
  state.police.copCars = [];
  state.cars = state.cars.filter((c) => !c.isCop);
  state.police.footCops = [];
  state.screen = SCREEN_PLAY;
  state.screenTimer = 0;
  state.camera.x = Math.max(0, Math.min(state.city.width - VIEW_W, p.x - VIEW_W / 2));
  state.camera.y = Math.max(0, Math.min(state.city.height - VIEW_H, p.y - VIEW_H / 2));
  state.save();
}

/** Turn world events into screens. */
function drainEvents(state) {
  for (const e of state.events) {
    state.banner = null;
    if (e === 'busted') {
      state.screen = SCREEN_BUSTED;
      state.screenTimer = 0;
      state.audio.fail();
    } else if (e === 'wasted') {
      state.screen = SCREEN_WASTED;
      state.screenTimer = 0;
      state.audio.fail();
    } else if (e === 'win') {
      state.screen = SCREEN_WIN;
      state.screenTimer = 0;
      state.audio.cash();
    }
  }
  state.events = [];
}

export { STEP };
