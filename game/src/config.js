// SOLMAR CITY tuning: every number the game balances on, in one place.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const STEP = 1 / 60;

// The city: a road grid over a world bigger than the screen, with a beach along the south edge.
export const WORLD_W = 3400;
export const WORLD_H = 2600;
export const ROAD_W = 72;
export const BEACH_Y = 2320;
export const WATER_Y = 2470;

// Player on foot.
export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  sprintSpeed: 265,
  health: 100,
  fireRate: 0.24,
  bulletSpeed: 780,
  bulletDamage: 34,
};

// Cars: length along their heading, width across it.
export const CAR = {
  length: 48,
  width: 23,
  accel: 540,
  brake: 980,
  reverseAccel: 300,
  maxSpeed: 640,
  maxReverse: 220,
  turnRate: 2.9,
  grip: 8.5,
  hp: 100,
};

// Wanted level: stars 0-5, cops scale with stars, wanted cools off when unseen.
export const WANTED = {
  maxStars: 5,
  decaySecondsPerStar: 10,
  unseenDistance: 420,
  maxCopCars: 4,
  maxFootCops: 3,
  bustSeconds: 1.2,
};

// Story: five missions, then the city is yours.
export const MISSION_REWARDS = [300, 500, 700, 900, 2000];
export const START_CASH = 120;
export const PACKAGE_VALUE = 50;
export const TAXI_MIN = 80;
export const TAXI_MAX = 150;
export const BUST_FINE = 200;
export const WASTED_LOSS = 0.1;

// Named places, all on the road grid so a car can reach them.
export const PLACES = {
  garage: { x: 920, y: 820, label: "Marta's Garage" },
  pickup: { x: 1280, y: 500, label: 'Pickup Corner' },
  safehouse: { x: 2360, y: 1460, label: 'Safehouse' },
  docks: { x: 3080, y: 2100, label: 'Solmar Docks' },
  hideout: { x: 560, y: 1780, label: 'Hideout' },
  bank: { x: 1640, y: 1140, label: 'Solmar Bank' },
  hospital: { x: 200, y: 180, label: 'St. Solmar Hospital' },
  station: { x: 2720, y: 500, label: 'Police Station' },
  spawn: { x: 920, y: 700, label: 'Palm Ave' },
};

// Car colours the city paints its traffic with (police use their own black and white).
export const CAR_COLORS = [
  '#e33f2f', '#2f7fe3', '#f2b01e', '#3fae5a', '#8a5cf6', '#e87ab0', '#e8e4da',
  '#2fb3a3', '#e07b2f', '#5a6b7d', '#c9a227', '#7dd3fc',
];
