// The story: five jobs for Marta Sol's crew, from a pickup to the Solmar
// heist, plus side work — scattered packages and taxi fares — for cash between
// jobs. Each mission is a small chain of steps with a marker on the map.
import { BUST_FINE, MISSION_REWARDS, PACKAGE_VALUE, PLACES, TAXI_MAX, TAXI_MIN } from './config.js';
import { nearestIntersection } from './city.js';
import { intRange, pick } from './random.js';
import { makeCar } from './vehicles.js';
import { addWanted } from './police.js';

export const MISSION_DEFS = [
  {
    title: 'The Pickup',
    brief: "Marta needs a package from the corner of 5th & Coral. Get it, then bring it back to the garage.",
    steps: [
      { kind: 'goto', at: PLACES.pickup, label: 'Pick up the package' },
      { kind: 'goto', at: PLACES.garage, label: 'Bring it to Marta\'s Garage' },
    ],
  },
  {
    title: 'Getaway Driver',
    brief: 'Nico is waiting in the marked sedan — get in and drive him to the safehouse. The cops are already on their way.',
    steps: [
      { kind: 'enterCar', label: 'Get in the marked sedan' },
      { kind: 'driveTo', at: PLACES.safehouse, time: 90, label: 'Reach the safehouse' },
    ],
  },
  {
    title: 'The Delivery',
    brief: 'A package for the docks, and it cannot be late. Drive it there in 75 seconds.',
    steps: [
      { kind: 'driveTo', at: PLACES.docks, time: 75, label: 'Deliver to the docks' },
    ],
  },
  {
    title: 'Heat Wave',
    brief: 'Three stars and the whole city is looking for you. Stay alive for a minute, then slip into the hideout.',
    steps: [
      { kind: 'survive', time: 60, label: 'Lose the cops — survive 60 seconds' },
      { kind: 'goto', at: PLACES.hideout, label: 'Slip into the hideout' },
    ],
  },
  {
    title: 'The Solmar Heist',
    brief: 'The last job: steal the armored van outside Solmar Bank and drive it to the docks. Bring the crew home rich.',
    steps: [
      { kind: 'enterCar', label: 'Steal the armored van' },
      { kind: 'driveTo', at: PLACES.docks, time: 120, label: 'Drive the van to the docks' },
    ],
  },
];

export function createMissions() {
  return {
    index: 0,
    step: 0,
    timer: 0,
    active: false,
    done: false,
    marker: null,
    markedCar: null,
    packages: [],
    taxi: null,
    taxiTimer: 0,
  };
}

/** The current mission definition, or null when the story is finished. */
export function currentMission(state) {
  const m = state.missions;
  return m.index < MISSION_DEFS.length ? MISSION_DEFS[m.index] : null;
}

/** The current step definition, or null. */
function currentStep(state) {
  const def = currentMission(state);
  if (!def) return null;
  return def.steps[state.missions.step] || null;
}

/** Start (or restart) the current mission from its first step. */
export function startMission(state, index) {
  const m = state.missions;
  m.index = index;
  m.step = 0;
  m.timer = 0;
  m.active = true;
  m.done = false;
  m.markedCar = null;
  const def = currentMission(state);
  if (!def) {
    m.active = false;
    return;
  }
  state.banner = { text: `Mission: ${def.title}`, sub: def.brief, t: 4 };
  state.audio.missionStart();
  setupStep(state);
}

/** Prepare the current step: its marker, its timer, its marked car. */
function setupStep(state) {
  const m = state.missions;
  const step = currentStep(state);
  m.timer = 0;
  m.marker = null;
  m.markedCar = null;
  if (!step) return;
  if (step.at) m.marker = { x: step.at.x, y: step.at.y, label: step.label };
  if (step.kind === 'enterCar') {
    const def = currentMission(state);
    if (def.title === 'The Solmar Heist') {
      const van = makeCar(PLACES.bank.x + 60, PLACES.bank.y, Math.PI / 2, { color: '#334155', model: 'van' });
      van.hp = 200;
      m.markedCar = van;
      state.cars.push(van);
      m.marker = { x: van.x, y: van.y, label: 'Armored van' };
    } else {
      const sedan = makeCar(PLACES.garage.x + 80, PLACES.garage.y, 0, { color: '#f2b01e', model: 'sedan' });
      m.markedCar = sedan;
      state.cars.push(sedan);
      m.marker = { x: sedan.x, y: sedan.y, label: 'Marked sedan' };
    }
  }
  if (step.kind === 'survive') {
    addWanted(state, 3, 'The heat is on');
    m.marker = null;
  }
}

/** Finish the current step and move to the next, or pay out the mission. */
function advanceStep(state) {
  const m = state.missions;
  const def = currentMission(state);
  m.step += 1;
  if (m.step >= def.steps.length) {
    const reward = MISSION_REWARDS[m.index];
    state.cash += reward;
    state.stats.missionsDone += 1;
    state.banner = { text: `Mission complete: ${def.title}`, sub: `+$${reward}`, t: 3 };
    state.audio.cash();
    state.missions.index += 1;
    state.missions.step = 0;
    state.missions.active = false;
    state.missions.marker = null;
    state.missions.markedCar = null;
    state.save();
    if (state.missions.index >= MISSION_DEFS.length) {
      state.missions.done = true;
      state.events.push('win');
    }
    return;
  }
  state.banner = { text: currentStep(state).label, sub: '', t: 2 };
  setupStep(state);
}

/** Fail the current mission (timer ran out): the crew lets you try again. */
function failMission(state, why) {
  const m = state.missions;
  state.banner = { text: `Mission failed: ${why}`, sub: 'Try again — the crew is waiting', t: 3 };
  state.audio.fail();
  m.step = 0;
  m.timer = 0;
  m.marker = null;
  m.markedCar = null;
  setupStep(state);
}

export function stepMissions(state, dt) {
  const m = state.missions;
  const p = state.player;
  if (!m.active) return;
  const step = currentStep(state);
  if (!step) return;
  // Timed steps count down.
  if (step.time) {
    m.timer += dt;
    if (m.timer >= step.time) {
      failMission(state, 'Out of time');
      return;
    }
  }
  if (step.kind === 'goto' || step.kind === 'driveTo') {
    const target = m.marker;
    if (!target) return;
    const inCar = !!p.inCar;
    if (step.kind === 'driveTo' && !inCar) {
      // A delivery needs wheels: the marker waits until you are driving.
      return;
    }
    if (Math.hypot(p.x - target.x, p.y - target.y) < 56) {
      advanceStep(state);
    }
    return;
  }
  if (step.kind === 'enterCar') {
    if (p.inCar === m.markedCar) {
      advanceStep(state);
    }
    return;
  }
  if (step.kind === 'survive') {
    if (m.timer >= step.time) {
      advanceStep(state);
    }
  }
}

/** Scatter glowing packages around the city for side cash. */
export function spawnPackages(state) {
  const { city, rng } = state;
  const spots = [];
  for (let i = 0; i < 8; i++) {
    const p = pick(rng, [PLACES.pickup, PLACES.safehouse, PLACES.hideout, PLACES.docks, PLACES.bank]);
    spots.push({ x: p.x + (rng() < 0.5 ? -1 : 1) * 120, y: p.y + (rng() < 0.5 ? -1 : 1) * 90, taken: false });
  }
  state.missions.packages = spots;
}

/** Pick up packages by walking over them; start a taxi fare by pressing E near a waving pedestrian. */
export function stepSideJobs(state, dt, input) {
  const m = state.missions;
  const p = state.player;
  // Packages.
  for (const pkg of m.packages) {
    if (pkg.taken) continue;
    if (Math.hypot(p.x - pkg.x, p.y - pkg.y) < 30) {
      pkg.taken = true;
      state.cash += PACKAGE_VALUE;
      state.banner = { text: `Package found`, sub: `+$${PACKAGE_VALUE}`, t: 1.6 };
      state.audio.pickup();
    }
  }
  // Taxi: a fare waves from the sidewalk.
  if (!m.taxi && state.time - (m.lastTaxiAt || -999) > 25 && !p.inCar) {
    const near = state.peds.find((ped) => !ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 70);
    if (near && state.rng() < 0.02) {
      m.taxi = { ped: near, state: 'waiting', dest: pick(state.rng, [PLACES.docks, PLACES.safehouse, PLACES.hospital, PLACES.bank]) };
      m.taxi.marker = { x: near.x, y: near.y, label: 'Fare waving' };
    }
  }
  if (m.taxi) {
    const taxi = m.taxi;
    if (taxi.state === 'waiting') {
      taxi.marker = { x: taxi.ped.x, y: taxi.ped.y, label: 'Fare waving — drive up to them' };
      if (p.inCar && Math.hypot(p.x - taxi.ped.x, p.y - taxi.ped.y) < 90) {
        taxi.state = 'riding';
        taxi.marker = { x: taxi.dest.x, y: taxi.dest.y, label: `Take the fare to ${taxi.dest.label}` };
        taxi.fare = intRange(state.rng, TAXI_MIN, TAXI_MAX);
        taxi.ped.dead = true;
        taxi.ped.fade = 0;
        state.banner = { text: 'Fare picked up', sub: `Take them to ${taxi.dest.label}`, t: 2 };
      }
    } else if (taxi.state === 'riding') {
      if (!p.inCar) {
        taxi.state = 'waiting';
        taxi.ped.dead = false;
        taxi.ped.x = p.x + 40;
        taxi.ped.y = p.y + 40;
        taxi.marker = { x: taxi.ped.x, y: taxi.ped.y, label: 'Fare waving — drive up to them' };
      } else if (Math.hypot(p.x - taxi.dest.x, p.y - taxi.dest.y) < 56) {
        state.cash += taxi.fare;
        state.banner = { text: 'Fare delivered', sub: `+$${taxi.fare}`, t: 2 };
        state.audio.cash();
        m.taxi = null;
        m.lastTaxiAt = state.time;
      }
    }
  }
}
