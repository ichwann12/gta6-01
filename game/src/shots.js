// The screenshot scenes behind ?shot=start|drive|mission|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (follow the road grid to the mission marker
// when driving, walk straight at it on foot), so the frame is what a real game
// looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { findPath, nearestIntersection } from './city.js';
import { resetWorld, stepWorld, SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE } from './world.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 8;
const MISSION_SECONDS = 6;
const END_LIMIT_SECONDS = 30;

/** A stand-in for the live Input: the autopilot writes its axis each step. */
class FakeInput {
  constructor() {
    this.axis = { x: 0, y: 0 };
    this.mouse = { x: 640, y: 360, down: false, clicked: false };
    this.brake = false;
  }

  moveAxis() {
    return this.axis;
  }

  down(key) {
    return key === ' ' ? this.brake : false;
  }

  justPressed() {
    return false;
  }

  endFrame() {}
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Drive the player's car toward the mission marker along the road grid.
 * Recomputes the route when the next waypoint is reached.
 */
function driveAutopilot(state, input, pilot) {
  const p = state.player;
  const car = p.inCar;
  if (!car) {
    input.axis = { x: 0, y: 0 };
    return;
  }
  const marker = state.missions.marker;
  if (!marker) {
    input.axis = { x: 0, y: 0 };
    return;
  }
  if (!pilot.path || pilot.pathAge > 120) {
    const from = nearestIntersection(state.city, car.x, car.y);
    const to = nearestIntersection(state.city, marker.x, marker.y);
    pilot.path = findPath(state.city, from, to);
    pilot.pathAge = 0;
  }
  pilot.pathAge += 1;
  while (pilot.path.length > 1 && Math.hypot(pilot.path[0].x - car.x, pilot.path[0].y - car.y) < 60) {
    pilot.path.shift();
  }
  const wp = pilot.path[0] || { x: marker.x, y: marker.y };
  const want = Math.atan2(wp.y - car.y, wp.x - car.x);
  const diff = angleDiff(want, car.angle);
  const steer = clamp(diff * 2.4, -1, 1);
  // Brake into sharp turns: at full speed the car cannot make a 90-degree
  // corner and cuts across the block. Coast and brake keep it on the road.
  input.brake = Math.abs(diff) > 0.9;
  // stepPlayer reads axis.y < 0 as throttle and -axis.x as steer.
  input.axis = { x: -steer, y: input.brake ? 0 : -1 };
}

/** Walk toward the mission marker, sidestepping when a building blocks the way. */
function walkAutopilot(state, input, pilot) {
  const p = state.player;
  const marker = state.missions.marker;
  if (!marker) {
    input.axis = { x: 0, y: 0 };
    return;
  }
  const dx = marker.x - p.x;
  const dy = marker.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 40) {
    input.axis = { x: 0, y: 0 };
    return;
  }
  // Stuck detection: barely moved in half a second.
  if (pilot.lastX !== undefined) {
    const moved = Math.hypot(p.x - pilot.lastX, p.y - pilot.lastY);
    pilot.stuckTime = moved < 4 ? (pilot.stuckTime || 0) + STEP : 0;
  }
  pilot.lastX = p.x;
  pilot.lastY = p.y;
  let dirX = dx / d;
  let dirY = dy / d;
  if ((pilot.stuckTime || 0) > 0.4) {
    // Sidestep around the block, then try again.
    const t = state.time;
    dirX = Math.cos(t * 2) * 0.9;
    dirY = Math.sin(t * 2) * 0.9;
    if (pilot.stuckTime > 1.2) pilot.stuckTime = 0;
  }
  input.axis = { x: dirX, y: dirY };
}

function stepFor(state, input, seconds, pilotFn, pilot) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (pilotFn) pilotFn(state, input, pilot);
    stepWorld(state, STEP, input);
    if (state.screen !== SCREEN_PLAY && state.screen !== SCREEN_TITLE) break;
  }
}

/**
 * Set `state` to the named scene (start, drive, mission or end; any other name
 * is start) and return the screen to draw over it.
 */
export function stageShot(name, state) {
  const input = new FakeInput();
  if (name === 'drive') {
    resetWorld(state, 1);
    state.screen = SCREEN_PLAY;
    state.camera.x = Math.max(0, state.player.x - 640);
    state.camera.y = Math.max(0, state.player.y - 360);
    startMission(state, 1);
    // The getaway: Leo is already in the marked sedan, two stars up, cops coming.
    const sedan = state.missions.markedCar;
    if (sedan) {
      state.player.inCar = sedan;
      sedan.isPlayer = true;
      sedan.driver = 'player';
      sedan.parked = false;
      state.player.x = sedan.x;
      state.player.y = sedan.y;
      state.player.angle = sedan.angle;
    }
    addWanted(state, 2, 'Getaway!');
    const pilot = { path: null, pathAge: 0 };
    stepFor(state, input, DRIVE_SECONDS, driveAutopilot, pilot);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    resetWorld(state, 1);
    state.screen = SCREEN_PLAY;
    state.camera.x = Math.max(0, state.player.x - 640);
    state.camera.y = Math.max(0, state.player.y - 360);
    startMission(state, 0);
    const pilot = {};
    stepFor(state, input, MISSION_SECONDS, walkAutopilot, pilot);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    resetWorld(state, 1);
    state.screen = SCREEN_PLAY;
    state.camera.x = Math.max(0, state.player.x - 640);
    state.camera.y = Math.max(0, state.player.y - 360);
    state.player.health = 30;
    addWanted(state, 5, 'The whole city is after you');
    // Cops already on top of him: the bust is seconds away.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      state.police.footCops.push({
        x: state.player.x + Math.cos(a) * 70,
        y: state.player.y + Math.sin(a) * 70,
        angle: a + Math.PI,
        speed: 170,
        hp: 100,
        dead: false,
        fade: 0,
        punch: 0,
      });
    }
    const limit = Math.round(END_LIMIT_SECONDS / STEP);
    for (let i = 0; i < limit; i++) {
      input.axis = { x: 0, y: 0 };
      stepWorld(state, STEP, input);
      if (state.screen === SCREEN_BUSTED) break;
    }
    return { screen: state.screen === SCREEN_BUSTED ? SCREEN_BUSTED : SCREEN_PLAY };
  }
  // start: the title over a living city.
  resetWorld(state, 1);
  state.screen = SCREEN_TITLE;
  state.camera.x = Math.max(0, state.player.x - 640);
  state.camera.y = Math.max(0, state.player.y - 360);
  stepFor(state, input, START_SECONDS, null, null);
  return { screen: SCREEN_TITLE };
}
