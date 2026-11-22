// Missions and story: a five-job chain for fixer Mara Voss. Each mission has
// a kind (goto, steal-deliver, heat, combat, getaway) and a target the HUD
// points at with a beacon, an arrow and a minimap blip.

import * as THREE from 'three';
import { MISSIONS, STORY_END } from './config.js';

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    this.state = 'idle'; // idle | active | done
    this.progress = 0;   // kills, or generic counter for the active mission
    this.heatReached = false;
    this.stolenCar = null;
    this.getawayCar = null;
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 60, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff2e88, transparent: true, opacity: 0.25,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 2.4, 4),
      new THREE.MeshBasicMaterial({ color: 0xff2e88 }),
    );
    this.marker.visible = false;
    this.marker.rotation.x = Math.PI;
    scene.add(this.marker);
    this.time = 0;
  }

  get current() { return MISSIONS[this.index] ?? null; }
  get finished() { return this.index >= MISSIONS.length; }

  start(index = 0, game = null) {
    this.index = index;
    this.state = 'active';
    this.progress = 0;
    this.heatReached = false;
    this.stolenCar = null;
    this.getawayCar = null;
    this.updateBeacon();
    if (game) this.onStart(game);
  }

  get targetPos() {
    const m = this.current;
    if (!m) return null;
    // Steal-deliver and getaway point at the pickup first, then the drop-off.
    if ((m.kind === 'steal-deliver' || m.kind === 'getaway') && this.progress === 1) return m.deliver;
    return m.target;
  }

  updateBeacon() {
    const t = this.targetPos;
    const show = this.state === 'active' && !!t;
    this.beacon.visible = show;
    this.marker.visible = show;
    if (show) {
      this.beacon.position.set(t.x, 30, t.z);
      this.marker.position.set(t.x, 8 + Math.sin(this.time * 3) * 0.6, t.z);
    }
  }

  update(dt) {
    this.time += dt;
    if (this.marker.visible) {
      this.marker.position.y = 8 + Math.sin(this.time * 3) * 0.6;
      this.marker.rotation.y += dt;
    }
  }

  /** Called every frame; returns an event string when something completes. */
  check(game) {
    const m = this.current;
    if (!m || this.state !== 'active') return null;
    const p = game.player;
    const t = this.targetPos;
    const dist = t ? Math.hypot(p.x - t.x, p.z - t.z) : Infinity;

    if (m.kind === 'goto' && dist < 6) return this.complete(game);
    if (m.kind === 'steal-deliver') {
      if (this.progress === 0 && this.stolenCar && game.inCar === this.stolenCar) {
        this.progress = 1;
        this.updateBeacon();
        game.toast('Now deliver the Comet GT to the garage on Palm Row.');
        return 'progress';
      }
      if (this.progress === 1 && game.inCar === this.stolenCar && dist < 8) return this.complete(game);
    }
    if (m.kind === 'heat') {
      if (!this.heatReached && game.wanted.stars >= 2) {
        this.heatReached = true;
        game.toast('Heat is on! Now lose the cops and reach the hideout.');
      }
      if (this.heatReached && game.wanted.stars === 0 && dist < 8) return this.complete(game);
    }
    if (m.kind === 'combat' && this.progress >= m.count) return this.complete(game);
    if (m.kind === 'getaway') {
      if (this.progress === 0 && this.getawayCar && game.inCar === this.getawayCar) {
        this.progress = 1;
        this.updateBeacon();
        game.wanted.add(140);
        game.toast('The whole city is after you — drive to the hideout!');
        return 'progress';
      }
      if (this.progress === 1 && game.inCar === this.getawayCar && dist < 8) return this.complete(game);
    }
    return null;
  }

  complete(game) {
    const m = this.current;
    game.cash += m.reward;
    game.sound.mission();
    this.state = 'done';
    this.beacon.visible = false;
    this.marker.visible = false;
    this.index += 1;
    if (this.finished) {
      game.storyEnd(STORY_END);
      return 'story-done';
    }
    this.start(this.index, game);
    game.toast(`${m.title} complete — $${m.reward}. Next: ${this.current.title}`);
    return 'mission-done';
  }

  /** Mission-specific spawns when a mission starts. */
  onStart(game) {
    const m = this.current;
    if (!m) return;
    if (m.kind === 'steal-deliver') {
      const car = game.traffic.parked.find((c) => c.model === 'Comet GT');
      if (car) {
        car.mesh.children[0].material.color.setHex(0xd21f3c);
        this.stolenCar = car;
      }
    }
    if (m.kind === 'combat') {
      game.gang.spawn(m.target.x, m.target.z, m.count + 1);
    }
    if (m.kind === 'getaway') {
      const p = m.target;
      const mesh = game.makeVanMesh();
      game.scene.add(mesh);
      const { Car } = game.vehicleModule;
      const van = new Car(mesh, p.x, p.z, 0, 0x2a2a3a, { isParked: true, model: 'Getaway Van' });
      van.syncMesh();
      game.traffic.parked.push(van);
      game.traffic.all.push(van);
      this.getawayCar = van;
    }
  }
}
