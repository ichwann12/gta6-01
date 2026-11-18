// SOLMAR CITY — bootstrap and the fixed-step loop.
//
// The game runs at a fixed 60 steps a second, so the rules play the same on
// every machine. With ?shot=start|drive|mission|end in the URL, the game
// stages that screenshot scene instead of starting the title, plays it
// forward, and sets window.__shotReady once the frame is drawn.
import { STEP, VIEW_H, VIEW_W } from './config.js';
import { Input } from './input.js';
import { createWorld, stepWorld, SCREEN_BUSTED, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED, SCREEN_WIN } from './world.js';
import { draw } from './render.js';
import { drawBusted, drawPause, drawTitle, drawWasted, drawWin } from './ui.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 1) || 1;

const state = createWorld(seed);
const input = new Input(canvas);
state.input = input;

let stagedScreen = null;
if (shotName) {
  stagedScreen = stageShot(shotName, state).screen;
} else {
  // Centre the camera on the player for the title.
  state.camera.x = Math.max(0, Math.min(state.city.width - VIEW_W, state.player.x - VIEW_W / 2));
  state.camera.y = Math.max(0, Math.min(state.city.height - VIEW_H, state.player.y - VIEW_H / 2));
}

function render() {
  draw(ctx, state);
  if (state.screen === SCREEN_TITLE) drawTitle(ctx, state);
  else if (state.screen === SCREEN_PAUSE) drawPause(ctx, state);
  else if (state.screen === SCREEN_BUSTED) drawBusted(ctx, state);
  else if (state.screen === SCREEN_WASTED) drawWasted(ctx, state);
  else if (state.screen === SCREEN_WIN) drawWin(ctx, state);
}

function handleScreenKeys() {
  // Enter or a click starts the game from the title or the win screen.
  if (state.screen === SCREEN_TITLE || state.screen === SCREEN_WIN) {
    if (input.justPressed('Enter') || input.mouse.clicked) {
      state.audio.unlock();
      state.screen = SCREEN_PLAY;
      // The first step of play starts the story (see stepWorld).
    }
  }
  if (state.screen === SCREEN_PLAY) {
    if (input.justPressed('p') || input.justPressed('Escape')) state.screen = SCREEN_PAUSE;
  } else if (state.screen === SCREEN_PAUSE) {
    if (input.justPressed('p') || input.justPressed('Escape')) state.screen = SCREEN_PLAY;
  }
  if (input.justPressed('m')) {
    state.audio.setMuted(!state.audio.muted);
  }
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  accumulator += elapsed;
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    handleScreenKeys();
    if (state.screen === SCREEN_PLAY || state.screen === SCREEN_TITLE || state.screen === SCREEN_BUSTED || state.screen === SCREEN_WASTED || state.screen === SCREEN_WIN) {
      stepWorld(state, STEP, input);
    }
    input.endFrame();
    accumulator -= STEP;
    steps += 1;
  }
  if (steps === 5) accumulator = 0;
  render();
  requestAnimationFrame(frame);
}

if (shotName) {
  // A staged scene: draw the frame once and say it is ready.
  render();
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
