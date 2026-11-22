// Neon Bay — game glue: renderer, input, camera, combat, car stealing,
// the loop and the screens. Everything original; three.js is vendored.

import * as THREE from 'three';
import { CITY, PLAYER, CAR, WANTED, WEAPONS, PALETTE, MISSIONS } from './config.js';
import { City } from './city.js';
import { Traffic, buildCarMesh, driveCar, Car } from './vehicles.js';
import { Player, Pedestrians, Gang, buildPersonMesh } from './people.js';
import { Police, Wanted } from './police.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { Sound } from './audio.js';
import { saveGame, loadSave, hasSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 1337);

export class Game {
  constructor() {
    this.vehicleModule = { Car };
    this.cash = 150;
    this.state = 'start'; // start | playing | paused | over | story
    this.keys = {};
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 9;
    this.dragging = false;
    this.inCar = null;
    this.time = 0;
    this.lastCrimeAt = 0;
    this.shotMode = !!SHOT;
    this.sound = new Sound();
    this.initThree();
    this.initWorld();
    this.hud = new HUD(document);
    this.bindInput();
    this.bindMenus();
    this.showStart();
    if (SHOT) {
      // Screenshot scene: stage it, then flag readiness after the world runs.
      stageShot(SHOT, this);
      setTimeout(() => { window.__shotReady = true; }, 3200);
    }
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  initThree() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.skyBottom);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 90, 320);
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 800);
    // Sunset: low warm sun, cool ambient, hemisphere fill.
    const sun = new THREE.DirectionalLight(0xffb347, 2.2);
    sun.position.set(-120, 90, -60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0x8a7bd8, 0x2a1a2a, 0.7));
    const amb = new THREE.AmbientLight(0x604a8a, 0.5);
    this.scene.add(amb);
    // A big low sun disc on the horizon.
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
    );
    sunDisc.position.set(-260, 34, -260);
    sunDisc.lookAt(0, 20, 0);
    this.scene.add(sunDisc);
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  initWorld() {
    this.city = new City(this.scene, SEED);
    this.traffic = new Traffic(this.scene, this.city);
    this.peds = new Pedestrians(this.scene, this.city);
    this.gang = new Gang(this.scene);
    this.police = new Police(this.scene, this.city);
    this.wanted = new Wanted();
    this.missions = new Missions(this.scene);
    const mesh = buildPersonMesh(0xff2e88, 0x1d1d2e, 0xd9a066);
    // Jax Rivera: pink jacket, dark jeans.
    this.scene.add(mesh);
    this.player = new Player(mesh, 0, 20);
    this.player.weapon = 'fists';
    this.player.ammo = Infinity;
    this.player.reserve = 0;
    this.player.syncMesh();
    // Crash smoke particles, one shared pool.
    this.particles = [];
    const pGeo = new THREE.SphereGeometry(0.35, 6, 5);
    for (let i = 0; i < 40; i += 1) {
      const p = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true }));
      p.visible = false;
      this.scene.add(p);
      this.particles.push({ mesh: p, life: 0 });
    }
  }

  makeVanMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.2, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.5, metalness: 0.3 }),
    );
    body.position.y = 1.4;
    body.castShadow = true;
    g.add(body);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.2, metalness: 0.6 }),
    );
    cab.position.set(0, 1.9, 2.2);
    g.add(cab);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wm = new THREE.MeshStandardMaterial({ color: 0x0a0a0c });
    const wheels = [];
    for (const [x, z] of [[-1, 1.8], [1, 1.8], [-1, -1.8], [1, -1.8]]) {
      const w = new THREE.Mesh(wheelGeo, wm);
      w.position.set(x, 0.42, z);
      g.add(w);
      wheels.push(w);
    }
    g.userData.wheels = wheels;
    return g;
  }

  // ---------- screens ----------

  showStart() {
    this.state = 'start';
    this.setOverlay('start-screen', true);
    this.setOverlay('pause-screen', false);
    this.setOverlay('over-screen', false);
    this.setOverlay('story-screen', false);
    document.getElementById('continue-btn').style.display = hasSave() ? 'block' : 'none';
    document.getElementById('best-line').textContent =
      `Best run: $${(Number(localStorage.getItem('neon-bay-best') || 0)).toLocaleString('en-US')} — Neon Bay, a neon coastal city. Steal cars, dodge the cops, run Mara's jobs.`;
  }

  setOverlay(id, show) {
    document.getElementById(id).style.display = show ? 'flex' : 'none';
  }

  startGame(opts = {}) {
    this.sound.unlock();
    this.setOverlay('start-screen', false);
    this.setOverlay('over-screen', false);
    this.setOverlay('story-screen', false);
    this.state = 'playing';
    if (this.missions.state === 'idle') this.missions.start(0, this);
    this.hud.setObjective(this.missions.current?.title ?? '', this.missions.current?.objective ?? '');
    this.toast(opts.skipIntro ? 'Neon Bay — good luck, Jax.' : 'Mara Voss is waiting. Follow the pink beacon.');
    if (this.shotMode) this.hud.setObjective(this.missions.current?.title ?? '', this.missions.current?.objective ?? '');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.setOverlay('pause-screen', true);
    document.exitPointerLock?.();
  }

  resume() {
    this.setOverlay('pause-screen', false);
    this.state = 'playing';
  }

  wasted() {
    this.state = 'over';
    this.sound.fail();
    this.cash = Math.max(0, Math.floor(this.cash * 0.9));
    document.getElementById('over-title').textContent = 'WASTED';
    document.getElementById('over-text').textContent =
      `Jax got caught out in Neon Bay. The hospital patched him up — and kept 10% of his cash. $${this.cash.toLocaleString('en-US')} left.`;
    this.setOverlay('over-screen', true);
    document.exitPointerLock?.();
  }

  storyEnd(text) {
    this.state = 'story';
    const best = Math.max(Number(localStorage.getItem('neon-bay-best') || 0), this.cash);
    localStorage.setItem('neon-bay-best', String(best));
    document.getElementById('story-text').textContent = text;
    document.getElementById('story-cash').textContent = `Final take: $${this.cash.toLocaleString('en-US')} — best run $${best.toLocaleString('en-US')}.`;
    this.setOverlay('story-screen', true);
    document.exitPointerLock?.();
  }

  toast(text) { this.hud.toast(text); }

  // ---------- input ----------

  bindInput() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.sound.unlock();
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (this.state !== 'playing') return;
      if (e.code === 'KeyE') this.tryEnterExitCar();
      if (e.code === 'KeyF') this.punch();
      if (e.code === 'KeyG') this.toggleWeapon();
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'KeyM') this.toggleMapSize();
      if (e.code === 'KeyH') this.saveNow();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    const cv = this.renderer.domElement;
    cv.addEventListener('mousedown', (e) => {
      this.sound.unlock();
      if (this.state !== 'playing') return;
      if (e.button === 0) {
        if (this.player.weapon === 'pistol' && !this.inCar) this.shoot();
        else if (document.pointerLockElement !== cv) cv.requestPointerLock?.();
      }
      this.dragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    addEventListener('mouseup', () => { this.dragging = false; });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === cv) {
        this.camYaw -= e.movementX * 0.0032;
        this.camPitch = Math.max(-0.15, Math.min(0.7, this.camPitch + e.movementY * 0.002));
      } else if (this.dragging && this.lastMouse) {
        this.camYaw -= (e.clientX - this.lastMouse.x) * 0.006;
        this.camPitch = Math.max(-0.15, Math.min(0.7, this.camPitch + (e.clientY - this.lastMouse.y) * 0.004));
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });
    cv.addEventListener('wheel', (e) => {
      this.camDist = Math.max(5, Math.min(16, this.camDist + e.deltaY * 0.01));
    }, { passive: true });
  }

  bindMenus() {
    const $ = (id) => document.getElementById(id);
    $('start-btn').onclick = () => this.startGame();
    $('continue-btn').onclick = () => {
      const s = loadSave();
      if (!s) return;
      this.startGame({ skipIntro: true });
      this.cash = s.cash;
      this.player.health = s.health;
      this.player.x = s.x; this.player.z = s.z;
      this.missions.start(Math.min(s.missionIndex, MISSIONS.length - 1), this);
      this.toast('Save loaded — welcome back to Neon Bay.');
    };
    $('resume-btn').onclick = () => this.resume();
    $('save-btn').onclick = () => { this.saveNow(); this.toast('Game saved.'); };
    $('restart-btn').onclick = () => location.reload();
    $('respawn-btn').onclick = () => {
      this.player.health = PLAYER.health;
      this.player.x = 0; this.player.z = 20;
      this.wanted.clear();
      this.police.clear();
      this.setOverlay('over-screen', false);
      this.state = 'playing';
    };
    $('story-btn').onclick = () => { this.showStart(); };
    $('sound-btn').onclick = () => {
      this.sound.enabled = !this.sound.enabled;
      $('sound-btn').textContent = `Sound: ${this.sound.enabled ? 'On' : 'Off'}`;
    };
    $('help-btn').onclick = () => {
      this.toast('WASD move/drive • Mouse drag or click to look • E enter/exit car • F punch • G pistol • Click shoot • R reload • Shift run • Space brake • H save • Esc pause', 7000);
    };
  }

  toggleMapSize() {
    const m = document.getElementById('minimap');
    const big = m.width === 180;
    m.width = big ? 300 : 180;
    m.height = big ? 300 : 180;
  }

  saveNow() {
    if (saveGame(this)) this.toast('Game saved.');
  }

  // ---------- actions ----------

  tryEnterExitCar() {
    if (this.inCar) {
      const car = this.inCar;
      this.inCar = null;
      const side = car.heading + Math.PI / 2;
      this.player.x = car.x + Math.sin(side) * 3;
      this.player.z = car.z + Math.cos(side) * 3;
      this.player.heading = car.heading;
      this.player.syncMesh();
      this.player.mesh.visible = true;
      this.sound.setEngine(0, false);
      return;
    }
    const car = this.traffic.nearestCar(this.player.x, this.player.z, 4.5);
    if (!car) { this.toast('No car close enough.'); return; }
    this.enterCar(car);
  }

  enterCar(car) {
    if (car.isTraffic && car.occupied) {
      // Yank the driver out: they flee on foot, and it is a crime.
      car.occupied = false;
      this.wanted.add(WANTED.stealCar);
      this.toast('You jacked a car! The driver ran — and someone called the cops.');
      const p = this.city.randomSidewalkPoint();
      const ped = this.peds.list[0];
      if (ped) { ped.x = car.x + 2; ped.z = car.z + 2; ped.fleeing = true; }
      void p;
    } else if (car.isParked) {
      this.wanted.add(10);
      this.toast(`You took the ${car.model}.`);
    }
    this.inCar = car;
    car.speed = 0;
    this.player.mesh.visible = false;
    this.player.x = car.x; this.player.z = car.z;
    this.sound.pickup();
  }

  punch() {
    const p = this.player;
    if (p.punchTimer > 0 || this.inCar) return;
    p.punchTimer = PLAYER.punchCooldown;
    this.sound.punch();
    const targets = [...this.gang.members, ...this.police.officers, ...this.peds.list];
    for (const t of targets) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < PLAYER.punchRange) {
        this.hitPerson(t, PLAYER.punchDamage, 'punch');
        break;
      }
    }
  }

  toggleWeapon() {
    const p = this.player;
    if (this.inCar) return;
    if (p.weapon === 'fists') {
      p.weapon = 'pistol';
      p.ammo = WEAPONS.pistol.ammo;
      p.reserve = WEAPONS.pistol.reserve;
      this.toast('Pistol drawn. Click to shoot.');
    } else {
      p.weapon = 'fists';
      p.ammo = Infinity;
    }
    this.hud.setCrosshair(p.weapon === 'pistol');
  }

  reload() {
    const p = this.player;
    if (p.weapon !== 'pistol' || p.reserve <= 0) return;
    const need = WEAPONS.pistol.ammo - p.ammo;
    const take = Math.min(need, p.reserve);
    p.ammo += take;
    p.reserve -= take;
    this.sound.pickup();
  }

  shoot() {
    const p = this.player;
    if (p.shootTimer > 0 || p.ammo <= 0 || this.inCar) return;
    p.shootTimer = WEAPONS.pistol.rate;
    if (p.ammo !== Infinity) p.ammo -= 1;
    this.sound.shoot();
    this.wanted.add(WANTED.shoot);
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: 0, y: 0 }, this.camera);
    ray.far = WEAPONS.pistol.range;
    const meshes = [];
    const owners = new Map();
    for (const t of [...this.gang.members, ...this.police.officers, ...this.peds.list]) {
      if (!t.alive) continue;
      t.mesh.traverse((o) => { if (o.isMesh) { meshes.push(o); owners.set(o.uuid, t); } });
    }
    for (const car of [...this.traffic.cars, ...this.traffic.parked, ...this.police.cars]) {
      car.mesh.traverse((o) => { if (o.isMesh) { meshes.push(o); owners.set(o.uuid, car); } });
    }
    const hits = ray.intersectObjects(meshes, false);
    if (hits.length) {
      const hit = hits[0];
      const owner = owners.get(hit.object.uuid);
      this.burst(hit.point, 0xffcc33);
      if (owner && owner.health !== undefined) this.hitPerson(owner, WEAPONS.pistol.damage, 'shot');
      else if (owner && owner instanceof Car) this.damageCar(owner, WEAPONS.pistol.damage);
    }
    if (p.ammo === 0) this.toast('Out of ammo — press R to reload.');
  }

  hitPerson(t, dmg, kind) {
    t.health -= dmg;
    this.burst({ x: t.x, y: 1.4, z: t.z }, 0xff4444);
    if (t.health <= 0 && t.alive) {
      t.alive = false;
      t.mesh.visible = false;
      if (this.gang.members.includes(t)) {
        this.missions.progress += 1;
        this.cash += 50;
        this.toast(`Cobalt King down — $${50} picked up. ${Math.max(0, (this.missions.current?.count ?? 0) - this.missions.progress)} left.`);
      } else if (this.police.officers.includes(t)) {
        this.wanted.add(WANTED.hitPolice);
        this.toast('You dropped a cop. The heat just went up.');
      } else {
        this.wanted.add(WANTED.killPed);
        this.toast('That was a civilian! Wanted level up.');
      }
    } else if (!this.gang.members.includes(t) && !this.police.officers.includes(t)) {
      this.wanted.add(WANTED.hitPed);
    }
    void kind;
  }

  damageCar(car, dmg) {
    car.health -= dmg;
    if (car.health <= 0 && car.speed !== undefined) {
      this.burst({ x: car.x, y: 1, z: car.z }, 0xff7733);
      this.sound.crash();
      car.speed = 0;
      if (car.isTraffic) car.occupied = false;
    }
  }

  burst(pos, color) {
    for (const p of this.particles) {
      if (p.life > 0) continue;
      p.life = 0.5;
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.position.set(pos.x + (Math.random() - 0.5), pos.y + Math.random(), pos.z + (Math.random() - 0.5));
      p.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
      break;
    }
  }

  hurtPlayer(dmg) {
    const p = this.player;
    if (p.hurtTimer > 0 || this.state !== 'playing') return;
    p.hurtTimer = 0.5;
    p.health -= dmg;
    p.regenTimer = 0;
    this.hud.flashDamage();
    this.sound.punch();
    if (p.health <= 0) this.wasted();
  }

  // ---------- frame ----------

  frame() {
    const dt = Math.min(0.05, this.clockDelta());
    this.time += dt;
    if (this.state === 'playing') this.update(dt);
    // Always render so the start screen shows the city behind it.
    this.updateCamera(dt);
    this.missions.update(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.state === 'playing') this.hud.drawMinimap(this);
  }

  clockDelta() {
    const now = performance.now() / 1000;
    const d = this._last ? now - this._last : 0.016;
    this._last = now;
    return d;
  }

  update(dt) {
    const p = this.player;
    p.punchTimer = Math.max(0, p.punchTimer - dt);
    p.shootTimer = Math.max(0, p.shootTimer - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    // Slow health regen after 6 quiet seconds.
    p.regenTimer += dt;
    if (p.regenTimer > 6 && p.health > 0 && p.health < PLAYER.health) {
      p.health = Math.min(PLAYER.health, p.health + dt * 4);
    }

    const input = {
      forward: this.keys['KeyW'] || this.keys['ArrowUp'],
      back: this.keys['KeyS'] || this.keys['ArrowDown'],
      left: this.keys['KeyA'] || this.keys['ArrowLeft'],
      right: this.keys['KeyD'] || this.keys['ArrowRight'],
      handbrake: this.keys['Space'],
    };
    const run = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    // Screenshot scenes drive themselves.
    if (this.shotMode && this.inCar) input.forward = true;

    if (this.inCar) {
      const res = driveCar(this.inCar, input, dt, this.city, [...this.traffic.all, ...this.police.cars]);
      if (res.crashed) {
        this.sound.crash();
        this.burst({ x: this.inCar.x, y: 1, z: this.inCar.z }, 0xffaa33);
        this.hurtPlayer(Math.min(25, res.speed * 0.7));
        this.wanted.add(5);
      }
      p.x = this.inCar.x; p.z = this.inCar.z;
      p.heading = this.inCar.heading;
      this.sound.setEngine(Math.abs(this.inCar.speed) / CAR.maxSpeed, true);
      this.hud.setSpeed(Math.abs(this.inCar.speed) * 3.6, true);
    } else {
      this.sound.setEngine(0, false);
      this.hud.setSpeed(0, false);
      // On foot: move relative to the camera.
      const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const mz = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
      if (mx || mz) {
        const len = Math.hypot(mx, mz);
        const fx = Math.sin(this.camYaw);
        const fz = Math.cos(this.camYaw);
        const rx = Math.cos(this.camYaw);
        const rz = -Math.sin(this.camYaw);
        const dx = (fx * mz + rx * mx) / len;
        const dz = (fz * mz + rz * mx) / len;
        const sp = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
        p.speed = sp;
        p.heading = Math.atan2(dx, dz);
        const nx = p.x + dx * sp * dt;
        const nz = p.z + dz * sp * dt;
        const fixed = this.city.resolveCircle(nx, nz, PLAYER.radius);
        const clamped = this.city.clampToCity(fixed.x, fixed.z, 4);
        p.x = clamped.x; p.z = clamped.z;
        p.walkPhase += dt * sp * 1.6;
        // Auto-align the camera behind the run direction.
        let dh = p.heading - this.camYaw;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        this.camYaw += dh * Math.min(1, dt * 1.2);
      } else {
        p.speed = 0;
      }
      p.syncMesh();
    }

    // Traffic, pedestrians, gang, police.
    this.traffic.update(dt, this.inCar);
    const danger = this.player.weapon === 'pistol' && this.keys['Mouse0'] ? { x: p.x, z: p.z } : null;
    this.peds.update(dt, danger);
    this.gang.update(dt, p, (m, d) => {
      // Gang member fires: hit chance falls with distance.
      this.sound.shoot();
      if (Math.random() < Math.max(0.08, 0.45 - d * 0.015)) this.hurtPlayer(8);
      else this.burst({ x: p.x + (Math.random() - 0.5) * 2, y: 1.4, z: p.z + (Math.random() - 0.5) * 2 }, 0xaaaaaa);
    });
    const inDanger = this.police.count > 0;
    if (this.wanted.update(dt, inDanger)) this.toast('The heat is cooling off…');
    this.police.update(dt, p, this.wanted.stars, (src) => {
      if (src instanceof Car) {
        this.hurtPlayer(6);
        // Rammed by a police car: slow the player's car too.
        if (this.inCar) this.inCar.speed *= 0.6;
      } else {
        this.hurtPlayer(5);
      }
    });
    this.sound.siren(dt, this.wanted.stars);

    // Car hits a pedestrian: a crime, and the ped goes down.
    const allCars = this.inCar ? [this.inCar] : [];
    for (const car of allCars) {
      for (const ped of this.peds.list) {
        if (!ped.alive) continue;
        if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.4 && Math.abs(car.speed) > 3) {
          ped.alive = false;
          ped.mesh.visible = false;
          this.wanted.add(WANTED.hitPed);
          this.sound.crash();
          this.toast('You hit a pedestrian!');
        }
      }
    }

    // Mission check + HUD.
    const ev = this.missions.check(this);
    if (ev === 'mission-done') saveGame(this);
    const m = this.missions.current;
    if (m) this.hud.setObjective(m.title, m.objective);
    this.hud.setCash(this.cash);
    this.hud.setHealth(p.health);
    this.hud.setStars(this.wanted.stars);
    this.hud.setWeapon(p.weapon === 'fists' ? WEAPONS.fists.name : WEAPONS.pistol.name, p.ammo);

    // Particles.
    for (const pt of this.particles) {
      if (pt.life <= 0) continue;
      pt.life -= dt;
      pt.mesh.position.y += dt * 2;
      pt.mesh.material.opacity = Math.max(0, pt.life * 2);
      if (pt.life <= 0) pt.mesh.visible = false;
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const target = new THREE.Vector3(p.x, 1.6, p.z);
    const dist = this.inCar ? this.camDist + 2.5 : this.camDist;
    const height = this.inCar ? 5 : 3.2;
    // In a car the camera trails the car's heading; on foot it uses camYaw.
    const yaw = this.inCar ? this.inCar.heading : this.camYaw;
    const cx = target.x - Math.sin(yaw) * dist * Math.cos(this.camPitch);
    const cz = target.z - Math.cos(yaw) * dist * Math.cos(this.camPitch);
    const cy = target.y + height * Math.sin(this.camPitch) + 1.6;
    this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 6 + 0.2));
    this.camera.lookAt(target.x, target.y + 0.4, target.z);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__game = new Game();
});
