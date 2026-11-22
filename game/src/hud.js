// HUD: cash, health, wanted stars, weapon, speed, mission objective, toasts,
// and a live 2D minimap drawn on a canvas — roads, player, cars, police and
// the mission marker.

import { CITY } from './config.js';

export class HUD {
  constructor(doc) {
    this.doc = doc;
    this.cashEl = doc.getElementById('cash');
    this.healthEl = doc.getElementById('health-fill');
    this.healthText = doc.getElementById('health-text');
    this.starsEl = doc.getElementById('stars');
    this.weaponEl = doc.getElementById('weapon');
    this.speedEl = doc.getElementById('speed');
    this.objectiveEl = doc.getElementById('objective');
    this.objectiveTitle = doc.getElementById('objective-title');
    this.toastEl = doc.getElementById('toast');
    this.crosshair = doc.getElementById('crosshair');
    this.damageEl = doc.getElementById('damage');
    this.map = doc.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.toastTimer = null;
  }

  setCash(cash) { this.cashEl.textContent = `$${cash.toLocaleString('en-US')}`; }

  setHealth(hp) {
    this.healthEl.style.width = `${Math.max(0, hp)}%`;
    this.healthEl.style.background = hp > 50 ? '#39ff88' : hp > 25 ? '#ffd166' : '#ff3b5c';
    this.healthText.textContent = `HP ${Math.ceil(Math.max(0, hp))}`;
  }

  setStars(n) {
    this.starsEl.textContent = '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
    this.starsEl.style.color = n === 0 ? '#8b93a3' : '#ffd166';
  }

  setWeapon(name, ammo) {
    this.weaponEl.textContent = ammo === Infinity ? name : `${name}  •  ${ammo}`;
  }

  setSpeed(kmh, inCar) {
    this.speedEl.textContent = inCar ? `${Math.round(kmh)} km/h` : '';
  }

  setObjective(title, text) {
    this.objectiveTitle.textContent = title;
    this.objectiveEl.textContent = text;
  }

  toast(text, ms = 4200) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastEl.style.opacity = '0'; }, ms);
  }

  flashDamage() {
    this.damageEl.style.opacity = '0.55';
    setTimeout(() => { this.damageEl.style.opacity = '0'; }, 120);
  }

  setCrosshair(show) { this.crosshair.style.display = show ? 'block' : 'none'; }

  /** Draw the minimap: roads, blocks, mission marker, cars, police, player. */
  drawMinimap(game) {
    const ctx = this.mapCtx;
    const W = this.map.width;
    const H = this.map.height;
    const half = CITY.size / 2 + 20;
    const scale = W / (half * 2);
    const toX = (x) => (x + half) * scale;
    const toY = (z) => (z + half) * scale;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10, 10, 22, 0.85)';
    ctx.fillRect(0, 0, W, H);
    // Blocks.
    ctx.fillStyle = '#3a3450';
    const { blocks, pitch, block, road } = CITY;
    for (let bx = 0; bx < blocks; bx += 1) {
      for (let bz = 0; bz < blocks; bz += 1) {
        const x0 = -half + bx * pitch + road / 2 + 20;
        const z0 = -half + bz * pitch + road / 2 + 20;
        ctx.fillRect(toX(x0), toY(z0), block * scale, block * scale);
      }
    }
    // Roads.
    ctx.strokeStyle = '#6a6580';
    ctx.lineWidth = Math.max(1, road * scale * 0.5);
    for (let i = 0; i <= blocks; i += 1) {
      const c = -CITY.size / 2 + i * pitch - road / 2;
      ctx.beginPath(); ctx.moveTo(toX(c), 0); ctx.lineTo(toX(c), H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toY(c)); ctx.lineTo(W, toY(c)); ctx.stroke();
    }
    const dot = (x, z, color, r = 3) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(toX(x), toY(z), r, 0, Math.PI * 2);
      ctx.fill();
    };
    // Mission marker.
    const t = game.missions.targetPos;
    if (t && game.missions.state === 'active') {
      const pulse = 4 + Math.sin(performance.now() / 300) * 1.5;
      dot(t.x, t.z, '#ff2e88', pulse);
    }
    // Traffic (yellow), police (blue/red flash), gang (purple).
    for (const car of game.traffic.cars) dot(car.x, car.z, '#ffd166', 2);
    for (const car of game.police.cars) dot(car.x, car.z, Math.floor(performance.now() / 300) % 2 ? '#3388ff' : '#ff3355', 3);
    for (const m of game.gang.members) if (m.alive) dot(m.x, m.z, '#9d4edd', 2.5);
    // Player arrow.
    const px = toX(game.player.x);
    const py = toY(game.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-game.player.heading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }
}
