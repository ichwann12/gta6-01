// The screens over the game: title, pause, busted, wasted and the win screen.
// They draw over the live city, so the title already shows the world.
import { VIEW_H, VIEW_W } from './config.js';
import { MISSION_DEFS } from './missions.js';

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(8, 12, 22, ${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function centred(ctx, y, text, font, color) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, VIEW_W / 2, y);
}

export function drawTitle(ctx, state) {
  dim(ctx, 0.45);
  // Sun-soaked title.
  const grad = ctx.createLinearGradient(0, 120, 0, 220);
  grad.addColorStop(0, '#fde68a');
  grad.addColorStop(1, '#f97316');
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText('SOLMAR CITY', VIEW_W / 2 + 4, 204);
  ctx.fillStyle = grad;
  ctx.fillText('SOLMAR CITY', VIEW_W / 2, 200);
  centred(ctx, 246, 'An open-world crime story — drive, steal, run, and bring the crew home rich.', '19px system-ui, sans-serif', '#e2e8f0');
  const save = state.hasSave;
  const lines = [
    'WASD / Arrows — move and drive      Mouse — aim      Click — shoot',
    'E — enter / exit a car      Shift — sprint      P — pause      M — mute',
    '',
    save ? `Continue: $${state.cash.toLocaleString('en-US')} in the pocket, mission ${Math.min(state.missions.index + 1, 5)} of 5` : 'New story: Leo Marín, driver for hire, takes a job from Marta Sol.',
    '',
    'Press ENTER or click to play',
  ];
  lines.forEach((line, i) => {
    centred(ctx, 330 + i * 30, line, i === 5 ? 'bold 20px system-ui, sans-serif' : '16px system-ui, sans-serif', i === 5 ? '#fde68a' : '#cbd5e1');
  });
  // The five jobs, as a story card.
  centred(ctx, 560, 'THE CREW\'S JOBS', 'bold 14px system-ui, sans-serif', '#facc15');
  MISSION_DEFS.forEach((m, i) => {
    const done = i < state.missions.index;
    centred(ctx, 590 + i * 24, `${done ? '✓' : `${i + 1}.`} ${m.title}`, '15px system-ui, sans-serif', done ? '#4ade80' : '#e2e8f0');
  });
}

export function drawPause(ctx, state) {
  dim(ctx, 0.6);
  centred(ctx, 300, 'PAUSED', 'bold 56px system-ui, sans-serif', '#fff');
  centred(ctx, 350, 'Press P or Esc to keep playing', '18px system-ui, sans-serif', '#cbd5e1');
  centred(ctx, 400, `Cash $${state.cash.toLocaleString('en-US')} · Missions done ${state.stats.missionsDone} · Wanted ${'★'.repeat(state.police.stars)}`, '16px system-ui, sans-serif', '#fde68a');
}

export function drawBusted(ctx, state) {
  dim(ctx, 0.55);
  centred(ctx, 300, 'BUSTED', 'bold 72px system-ui, sans-serif', '#60a5fa');
  centred(ctx, 350, 'The Solmar police caught up with you.', '19px system-ui, sans-serif', '#e2e8f0');
  centred(ctx, 390, 'Bail: -$200 — you wake up at the police station, and the crew is still waiting.', '16px system-ui, sans-serif', '#cbd5e1');
}

export function drawWasted(ctx, state) {
  dim(ctx, 0.55);
  centred(ctx, 300, 'WASTED', 'bold 72px system-ui, sans-serif', '#ef4444');
  centred(ctx, 350, 'Leo went down in the streets of Solmar.', '19px system-ui, sans-serif', '#e2e8f0');
  centred(ctx, 390, 'You wake up patched up at St. Solmar Hospital.', '16px system-ui, sans-serif', '#cbd5e1');
}

export function drawWin(ctx, state) {
  dim(ctx, 0.5);
  const grad = ctx.createLinearGradient(0, 180, 0, 280);
  grad.addColorStop(0, '#fde68a');
  grad.addColorStop(1, '#f97316');
  ctx.font = 'bold 68px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = grad;
  ctx.fillText('CITY LEGEND', VIEW_W / 2, 260);
  centred(ctx, 310, 'The Solmar heist is done. The crew is rich, and the city is yours.', '19px system-ui, sans-serif', '#e2e8f0');
  centred(ctx, 360, `Cash $${state.cash.toLocaleString('en-US')} · All 5 missions complete`, '17px system-ui, sans-serif', '#fde68a');
  centred(ctx, 420, 'Press ENTER to keep playing free roam', '16px system-ui, sans-serif', '#cbd5e1');
}
