// The wanted system: crime points turn into stars, stars turn into police
// cars and officers who chase the player, and quiet time cools the heat off.

import * as THREE from 'three';
import { WANTED, POLICE } from './config.js';
import { buildCarMesh, Car } from './vehicles.js';
import { buildPersonMesh, Person } from './people.js';

export class Wanted {
  constructor() {
    this.points = 0;
    this.quiet = 0;
  }

  get stars() {
    let s = 0;
    for (let i = 0; i < WANTED.thresholds.length; i += 1) {
      if (this.points >= WANTED.thresholds[i]) s = i;
    }
    return s;
  }

  add(points) {
    this.points = Math.min(600, this.points + points);
    this.quiet = 0;
  }

  clear() { this.points = 0; this.quiet = 0; }

  /** dt seconds pass; returns true when a star just decayed. */
  update(dt, inDanger) {
    if (inDanger) { this.quiet = 0; return false; }
    this.quiet += dt;
    if (this.quiet >= WANTED.decaySeconds && this.points > 0) {
      this.quiet = 0;
      this.points = Math.max(0, this.points - WANTED.thresholds[this.stars] + WANTED.thresholds[Math.max(0, this.stars - 1)]);
      if (this.stars === 0) this.points = 0;
      return true;
    }
    return false;
  }
}

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    this.officers = [];
    this.flash = 0;
  }

  get count() { return this.cars.length + this.officers.length; }

  wantedCars(stars) { return Math.min(POLICE.maxCars, stars); }

  spawnCarNear(x, z) {
    const angle = Math.random() * Math.PI * 2;
    const px = x + Math.sin(angle) * 70;
    const pz = z + Math.cos(angle) * 70;
    const mesh = buildCarMesh(0x11131a, true);
    this.scene.add(mesh);
    const car = new Car(mesh, px, pz, Math.atan2(x - px, z - pz), 0x11131a, { isPolice: true });
    car.speed = 10;
    car.syncMesh();
    this.cars.push(car);
    return car;
  }

  spawnOfficerNear(x, z) {
    const angle = Math.random() * Math.PI * 2;
    const mesh = buildPersonMesh(0x1a2a5e, 0x1a2a5e);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.1, 0.36),
      new THREE.MeshBasicMaterial({ color: 0x0a1030 }),
    );
    cap.position.y = 1.88;
    mesh.add(cap);
    this.scene.add(mesh);
    const o = new Person(mesh, x + Math.sin(angle) * 30, z + Math.cos(angle) * 30);
    o.health = 60;
    o.syncMesh();
    this.officers.push(o);
    return o;
  }

  update(dt, target, stars, onCaught) {
    this.flash += dt;
    // Keep the force matched to the wanted level.
    while (this.cars.length < this.wantedCars(stars)) this.spawnCarNear(target.x, target.z);
    while (this.cars.length > this.wantedCars(stars)) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    while (this.officers.length < Math.min(POLICE.maxFoot, Math.max(0, stars - 1))) {
      this.spawnOfficerNear(target.x, target.z);
    }
    while (this.officers.length > Math.min(POLICE.maxFoot, Math.max(0, stars - 1))) {
      const o = this.officers.pop();
      this.scene.remove(o.mesh);
    }
    // Police cars ram the player.
    for (const car of this.cars) {
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
      car.speed += ((d > 8 ? POLICE.carSpeed : 12) - car.speed) * Math.min(1, dt * 1.5);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      if (this.city.hitsSolid(car.x, car.z, 2)) {
        car.x -= Math.sin(car.heading) * car.speed * dt;
        car.z -= Math.cos(car.heading) * car.speed * dt;
        car.heading += 0.6;
        car.speed *= 0.5;
      }
      if (d < 3.2) onCaught(car);
      // Flashing light bar.
      if (car.mesh.userData.lightBar) {
        car.mesh.userData.lightBar.material.color.setHex(
          Math.floor(this.flash * 4) % 2 === 0 ? 0x2244ff : 0xff2233,
        );
      }
      car.syncMesh();
    }
    // Officers chase on foot and punch.
    for (const o of this.officers) {
      if (!o.alive) continue;
      const dx = target.x - o.x;
      const dz = target.z - o.z;
      const d = Math.hypot(dx, dz);
      o.heading = Math.atan2(dx, dz);
      if (d > 1.6) {
        o.speed = POLICE.footSpeed;
        o.x += Math.sin(o.heading) * o.speed * dt;
        o.z += Math.cos(o.heading) * o.speed * dt;
        o.walkPhase += dt * 9;
      } else {
        o.speed = 0;
        onCaught(o);
      }
      o.syncMesh();
    }
  }

  clear() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.cars = [];
    this.officers = [];
  }
}
