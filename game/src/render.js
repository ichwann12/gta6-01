// Drawing: the city from above, the cars and people in it, and the HUD —
// cash, wanted stars, health, the mission line and a live minimap. Everything
// is drawn from the state, so a staged scene looks like the real game.
import { CAR, VIEW_H, VIEW_W } from './config.js';
import { currentMission } from './missions.js';

const MINIMAP_W = 196;
const MINIMAP_H = 152;

export function draw(ctx, state) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  const camX = state.camera.x;
  const camY = state.camera.y;
  drawGround(ctx, state, camX, camY);
  drawRoads(ctx, state, camX, camY);
  drawParks(ctx, state, camX, camY);
  drawSkids(ctx, state, camX, camY);
  drawMarkers(ctx, state, camX, camY);
  drawCars(ctx, state, camX, camY);
  drawPeds(ctx, state, camX, camY);
  drawPlayer(ctx, state, camX, camY);
  drawBullets(ctx, state, camX, camY);
  drawParticles(ctx, state, camX, camY);
  // Warm late-afternoon light over everything.
  ctx.fillStyle = 'rgba(255, 190, 90, 0.06)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawHUD(ctx, state);
  drawMinimap(ctx, state);
  if (state.banner) drawBanner(ctx, state);
}

function drawGround(ctx, state, camX, camY) {
  // City blocks: pale concrete; the beach is sand, then water.
  ctx.fillStyle = '#b8b39a';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const beachTop = state.city.beachY - camY;
  if (beachTop < VIEW_H) {
    ctx.fillStyle = '#e8d5a0';
    ctx.fillRect(0, Math.max(0, beachTop), VIEW_W, VIEW_H - Math.max(0, beachTop));
  }
  const waterTop = state.city.waterY - camY;
  if (waterTop < VIEW_H) {
    const grad = ctx.createLinearGradient(0, waterTop, 0, VIEW_H);
    grad.addColorStop(0, '#3aa7c9');
    grad.addColorStop(1, '#1d6f9e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, Math.max(0, waterTop), VIEW_W, VIEW_H - Math.max(0, waterTop));
    // Slow waves.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const wy = waterTop + 12 + i * 22 + Math.sin(state.time * 1.2 + i * 2) * 3;
      ctx.beginPath();
      for (let x = -20; x <= VIEW_W + 20; x += 40) {
        const y = wy + Math.sin(x * 0.02 + state.time + i) * 4;
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}

function drawRoads(ctx, state, camX, camY) {
  const city = state.city;
  const half = city.roadW / 2;
  ctx.fillStyle = '#3f4550';
  for (const ax of city.avenues) {
    ctx.fillRect(ax - half - camX, -camY, city.roadW, city.height);
  }
  for (const sy of city.streets) {
    ctx.fillRect(-camX, sy - half - camY, city.width, city.roadW);
  }
  // The coastal road along the beach.
  ctx.fillRect(-camX, 2180 - half - camY, city.width, city.roadW);
  // Sidewalks: a lighter edge on each road.
  ctx.fillStyle = '#9aa0a8';
  for (const ax of city.avenues) {
    ctx.fillRect(ax - half - 8 - camX, -camY, 8, city.height);
    ctx.fillRect(ax + half - camX, -camY, 8, city.height);
  }
  for (const sy of city.streets) {
    ctx.fillRect(-camX, sy - half - 8 - camY, city.width, 8);
    ctx.fillRect(-camX, sy + half - camY, city.width, 8);
  }
  // Centre dashes.
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const ax of city.avenues) {
    ctx.beginPath();
    ctx.moveTo(ax - camX, -camY);
    ctx.lineTo(ax - camX, city.height - camY);
    ctx.stroke();
  }
  for (const sy of city.streets) {
    ctx.beginPath();
    ctx.moveTo(-camX, sy - camY);
    ctx.lineTo(city.width - camX, sy - camY);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Buildings, with a drop shadow and a lit roof.
  for (const b of city.buildings) {
    const bx = b.x - camX;
    const by = b.y - camY;
    if (bx > VIEW_W || by > VIEW_H || bx + b.w < 0 || by + b.h < 0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(bx + 6, by + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(bx, by, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(bx, by, b.w, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, b.w - 2, b.h - 2);
    // Windows.
    ctx.fillStyle = 'rgba(255, 240, 180, 0.5)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + b.windows) % 3 === 0) continue;
        ctx.fillRect(bx + 8 + i * 26, by + 10 + j * 26, 12, 9);
      }
    }
  }
}

function drawParks(ctx, state, camX, camY) {
  for (const park of state.city.parks) {
    const px = park.x - camX;
    const py = park.y - camY;
    ctx.fillStyle = '#5da864';
    ctx.fillRect(px, py, park.w, park.h);
    ctx.strokeStyle = '#4a8f52';
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 1, py + 1, park.w - 2, park.h - 2);
  }
  for (const t of state.city.trees) {
    const tx = t.x - camX;
    const ty = t.y - camY;
    if (tx < -20 || tx > VIEW_W + 20 || ty < -20 || ty > VIEW_H + 20) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(tx + 3, ty + 4, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f7d3a';
    ctx.beginPath();
    ctx.arc(tx, ty, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f9e4d';
    ctx.beginPath();
    ctx.arc(tx - 3, ty - 3, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSkids(ctx, state, camX, camY) {
  ctx.strokeStyle = 'rgba(20,20,20,0.22)';
  ctx.lineWidth = 4;
  for (const s of state.skids) {
    const x = s.x - camX;
    const y = s.y - camY;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(s.angle) * 14, y - Math.sin(s.angle) * 14);
    ctx.lineTo(x + Math.cos(s.angle) * 14, y + Math.sin(s.angle) * 14);
    ctx.stroke();
  }
}

function drawMarkers(ctx, state, camX, camY) {
  const m = state.missions;
  const markers = [];
  if (m.marker) markers.push({ x: m.marker.x, y: m.marker.y, label: m.marker.label, color: '#facc15' });
  for (const pkg of m.packages) {
    if (!pkg.taken) markers.push({ x: pkg.x, y: pkg.y, label: '', color: '#4ade80', small: true });
  }
  if (m.taxi && m.taxi.marker) {
    markers.push({ x: m.taxi.marker.x, y: m.taxi.marker.y, label: m.taxi.marker.label, color: '#38bdf8' });
  }
  for (const mk of markers) {
    const x = mk.x - camX;
    const y = mk.y - camY;
    const pulse = 1 + 0.18 * Math.sin(state.time * 5);
    const r = (mk.small ? 14 : 26) * pulse;
    ctx.strokeStyle = mk.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = mk.color;
    ctx.beginPath();
    ctx.arc(x, y, mk.small ? 5 : 8, 0, Math.PI * 2);
    ctx.fill();
    if (mk.label) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(mk.label, x + 1, y - r - 9);
      ctx.fillStyle = '#fff';
      ctx.fillText(mk.label, x, y - r - 10);
    }
  }
  // A waypoint arrow at the screen edge points at the mission marker.
  if (m.marker) {
    const mx = m.marker.x - camX;
    const my = m.marker.y - camY;
    if (mx < 0 || mx > VIEW_W || my < 0 || my > VIEW_H) {
      const cx = VIEW_W / 2;
      const cy = VIEW_H / 2;
      const angle = Math.atan2(my - cy, mx - cx);
      const ex = cx + Math.cos(angle) * 300;
      const ey = cy + Math.sin(angle) * 210;
      const dist = Math.round(Math.hypot(m.marker.x - state.player.x, m.marker.y - state.player.y));
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(angle);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.fillText(`${dist}m`, ex, ey + 28);
    }
  }
}

function drawCars(ctx, state, camX, camY) {
  for (const car of state.cars) {
    if (car.dead && car.hp > 0) continue;
    const x = car.x - camX;
    const y = car.y - camY;
    if (x < -80 || x > VIEW_W + 80 || y < -80 || y > VIEW_H + 80) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width);
    // Body.
    ctx.fillStyle = car.dead ? '#3f3f46' : car.color;
    roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = car.dead ? '#52525b' : '#1e293b';
    roundRect(ctx, -8, -CAR.width / 2 + 4, 18, CAR.width - 8, 4);
    ctx.fill();
    // Headlights.
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 3, 3, 5);
    ctx.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 8, 3, 5);
    // Police light bar, flashing.
    if (car.isCop) {
      const on = Math.sin(state.time * 10 + car.id) > 0;
      ctx.fillStyle = on ? '#ef4444' : '#3b82f6';
      ctx.fillRect(-4, -CAR.width / 2 + 2, 8, 6);
      ctx.fillStyle = on ? '#3b82f6' : '#ef4444';
      ctx.fillRect(-4, CAR.width / 2 - 8, 8, 6);
    }
    // The marked mission car gets a gold outline.
    if (state.missions.markedCar === car) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      roundRect(ctx, -CAR.length / 2 - 3, -CAR.width / 2 - 3, CAR.length + 6, CAR.width + 6, 9);
      ctx.stroke();
    }
    // Smoke from a wreck.
    if (car.hp < 35 && !car.dead) {
      ctx.fillStyle = 'rgba(100,100,100,0.5)';
      ctx.beginPath();
      ctx.arc(-CAR.length / 2, 0, 6 + Math.sin(state.time * 6) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPeds(ctx, state, camX, camY) {
  for (const ped of state.peds) {
    if (ped.fade > 5) continue;
    const x = ped.x - camX;
    const y = ped.y - camY;
    if (x < -30 || x > VIEW_W + 30 || y < -30 || y > VIEW_H + 30) continue;
    ctx.save();
    ctx.globalAlpha = ped.dead ? Math.max(0, 1 - ped.fade / 6) : 1;
    ctx.translate(x, y);
    ctx.rotate(ped.angle);
    if (ped.dead) {
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const bob = Math.sin(state.time * 10 + ped.x) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(2, 3, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(4 + bob, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // Foot cops: dark blue, with a cap.
  for (const cop of state.police.footCops) {
    if (cop.dead) continue;
    const x = cop.x - camX;
    const y = cop.y - camY;
    if (x < -30 || x > VIEW_W + 30 || y < -30 || y > VIEW_H + 30) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(5, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPlayer(ctx, state, camX, camY) {
  const p = state.player;
  if (p.inCar) return;
  const x = p.x - camX;
  const y = p.y - camY;
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Leo: teal jacket, dark jeans, facing the mouse.
  const bob = Math.sin(p.walkCycle) * 2;
  ctx.rotate(p.angle);
  ctx.fillStyle = '#0d9488';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fcd34d';
  ctx.beginPath();
  ctx.arc(7 + bob * 0.3, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Pistol.
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(8, -2, 12, 4);
  ctx.restore();
  // A faint ring so the player is easy to find in a crowd.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 17 + Math.sin(state.time * 3) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBullets(ctx, state, camX, camY) {
  ctx.fillStyle = '#fde047';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x - camX, b.y - camY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, state, camX, camY) {
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x - camX, pt.y - camY, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHUD(ctx, state) {
  const p = state.player;
  // Cash, top left.
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, 18, 38);
  ctx.fillStyle = '#4ade80';
  ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, 16, 36);
  // Wanted stars, top centre.
  const stars = state.police.stars;
  if (stars > 0) {
    ctx.font = '30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const text = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(text, VIEW_W / 2 + 2, 42);
    ctx.fillStyle = '#facc15';
    ctx.fillText(text, VIEW_W / 2, 40);
    if (state.police.lastReason) {
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#fecaca';
      ctx.fillText(state.police.lastReason, VIEW_W / 2, 62);
    }
  }
  // Health bar, bottom left.
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(16, VIEW_H - 44, 204, 18);
  ctx.fillStyle = p.health > 40 ? '#4ade80' : '#ef4444';
  ctx.fillRect(18, VIEW_H - 42, 200 * (p.health / 100), 14);
  ctx.fillStyle = '#fff';
  ctx.fillText(`HEALTH ${Math.ceil(p.health)}`, 22, VIEW_H - 30);
  // Speed, bottom right, while driving.
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.32);
    ctx.textAlign = 'right';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(`${kmh}`, VIEW_W - 18, VIEW_H - 56);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${kmh}`, VIEW_W - 20, VIEW_H - 58);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('km/h', VIEW_W - 20, VIEW_H - 36);
  }
  // Mission line, bottom centre.
  const def = currentMission(state);
  if (state.missions.active && def) {
    const step = def.steps[state.missions.step];
    const label = step ? step.label : '';
    let line = `${def.title} — ${label}`;
    if (step && step.time) {
      const left = Math.max(0, Math.ceil(step.time - state.missions.timer));
      line += `  •  ${left}s`;
    }
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(line).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, VIEW_W / 2 - w / 2, VIEW_H - 40, w, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.fillText(line, VIEW_W / 2, VIEW_H - 21);
  }
  // Controls hint, first seconds of play.
  if (state.screen === 'play' && state.time < 12) {
    ctx.textAlign = 'left';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('WASD move · Mouse aim · Click shoot · E enter car · Shift sprint · P pause · M mute', 16, VIEW_H - 60);
  }
}

function drawMinimap(ctx, state) {
  const x0 = VIEW_W - MINIMAP_W - 16;
  const y0 = 16;
  const sx = MINIMAP_W / state.city.width;
  const sy = MINIMAP_H / state.city.height;
  ctx.fillStyle = 'rgba(10, 15, 25, 0.72)';
  roundRect(ctx, x0 - 4, y0 - 4, MINIMAP_W + 8, MINIMAP_H + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x0, y0, MINIMAP_W, MINIMAP_H, 4);
  ctx.clip();
  // Water and sand.
  ctx.fillStyle = '#1d6f9e';
  ctx.fillRect(x0, y0 + state.city.waterY * sy, MINIMAP_W, MINIMAP_H);
  ctx.fillStyle = '#e8d5a0';
  ctx.fillRect(x0, y0 + state.city.beachY * sy, MINIMAP_W, (state.city.waterY - state.city.beachY) * sy);
  ctx.fillStyle = '#3f4550';
  for (const ax of state.city.avenues) ctx.fillRect(x0 + ax * sx - 1, y0, 2, MINIMAP_H);
  for (const sy2 of state.city.streets) ctx.fillRect(x0, y0 + sy2 * sy - 1, MINIMAP_W, 2);
  // Mission marker.
  if (state.missions.marker) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(x0 + state.missions.marker.x * sx, y0 + state.missions.marker.y * sy, 4 + Math.sin(state.time * 5) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cop cars.
  ctx.fillStyle = '#ef4444';
  for (const car of state.police.copCars) {
    if (car.dead) continue;
    ctx.beginPath();
    ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player, as a white arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Viewport rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + state.camera.x * sx, y0 + state.camera.y * sy, VIEW_W * sx, VIEW_H * sy);
  ctx.restore();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR CITY', x0, y0 + MINIMAP_H + 16);
}

function drawBanner(ctx, state) {
  const b = state.banner;
  const alpha = Math.min(1, b.t / 0.6);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(b.text, VIEW_W / 2 + 2, 122);
  ctx.fillStyle = '#fff';
  ctx.fillText(b.text, VIEW_W / 2, 120);
  if (b.sub) {
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(b.sub, VIEW_W / 2, 148);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
