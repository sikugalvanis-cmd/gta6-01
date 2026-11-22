// Cars: a box-built car mesh, arcade driving physics for the player's car,
// and traffic cars that cruise the road grid. No imported models.

import * as THREE from 'three';
import { CAR, TRAFFIC, PALETTE } from './config.js';

const CAR_COLORS = [0xd8d8e0, 0x22222e, 0x7a1f2b, 0x1f4d7a, 0xc2a23a, 0x3a7a4d, 0x8a5a2b, 0x5a3a7a];

export function buildCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.1, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.65, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.15, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.38, z);
    group.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    h.position.set(x, 0.6, 2.22);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  for (const x of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
    t.position.set(x, 0.6, -2.22);
    group.add(t);
  }
  let lightBar = null;
  if (isPolice) {
    lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    lightBar.position.set(0, 1.55, -0.2);
    group.add(lightBar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  group.userData.wheels = wheels;
  group.userData.lightBar = lightBar;
  return group;
}

export class Car {
  constructor(mesh, x, z, heading, color, opts = {}) {
    this.mesh = mesh;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.color = color;
    this.isPolice = !!opts.isPolice;
    this.isTraffic = !!opts.isTraffic;
    this.isParked = !!opts.isParked;
    this.occupied = !!opts.occupied; // traffic car with a driver inside
    this.model = opts.model || 'Sedan';
    this.health = 100;
    this.smoke = null;
  }

  get pos() { return { x: this.x, z: this.z }; }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.12;
    for (const w of this.mesh.userData.wheels || []) w.rotation.x += spin;
  }
}

/** Arcade driving: accelerate, brake, steer; buildings and cars block. */
export function driveCar(car, input, dt, city, others) {
  const fwd = input.forward ? 1 : 0;
  const back = input.back ? 1 : 0;
  const steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  if (fwd) car.speed += CAR.accel * dt;
  if (back) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (input.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const steerTarget = steerIn * CAR.steer * Math.min(1, Math.abs(car.speed) / 8);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * (car.speed / CAR.maxSpeed) * dt * 3.2 * Math.sign(car.speed || 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // Buildings stop the car with a thud.
  if (city.hitsSolid(nx, nz, CAR.radius * 0.8)) {
    if (Math.abs(car.speed) > 8) return { crashed: true, speed: Math.abs(car.speed) };
    car.speed *= -0.25;
    return { crashed: false };
  }
  // Other cars: soft push apart, lose speed.
  for (const o of others) {
    if (o === car) continue;
    const dx = nx - o.x;
    const dz = nz - o.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.4 && d > 0.01) {
      if (Math.abs(car.speed) > 10) return { crashed: true, speed: Math.abs(car.speed) };
      car.speed *= 0.4;
      return { crashed: false };
    }
  }
  const clamped = city.clampToCity(nx, nz, 6);
  if (clamped.x !== nx || clamped.z !== nz) car.speed *= 0.5;
  car.x = clamped.x;
  car.z = clamped.z;
  car.syncMesh();
  return { crashed: false };
}

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    const rand = city.rand;
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      const p = city.randomRoadPoint();
      const color = CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
      const mesh = buildCarMesh(color);
      scene.add(mesh);
      const car = new Car(mesh, p.x, p.z, rand() < 0.5 ? 0 : Math.PI / 2, color, { isTraffic: true, occupied: true });
      car.speed = TRAFFIC.speed * (0.7 + rand() * 0.6);
      car.axis = p.axis || 'z';
      car.dir = rand() < 0.5 ? 1 : -1;
      car.syncMesh();
      this.cars.push(car);
    }
    // Parked cars the player can steal.
    this.parked = [];
    for (let i = 0; i < 8; i += 1) {
      const p = city.randomRoadPoint();
      const color = CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
      const mesh = buildCarMesh(color);
      scene.add(mesh);
      const car = new Car(mesh, p.x + 3.4, p.z, rand() < 0.5 ? 0 : Math.PI / 2, color, { isParked: true, model: i === 0 ? 'Comet GT' : 'Sedan' });
      car.syncMesh();
      this.parked.push(car);
    }
    this.all = [...this.cars, ...this.parked];
  }

  update(dt, playerCar) {
    const half = 200;
    for (const car of this.cars) {
      // Brake if a car (or the player) is right ahead.
      let ahead = false;
      for (const o of [...this.cars, ...(playerCar ? [playerCar] : [])]) {
        if (o === car) continue;
        const dx = o.x - car.x;
        const dz = o.z - car.z;
        const along = car.axis === 'x' ? dx * car.dir : dz * car.dir;
        const side = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
        if (along > 0 && along < TRAFFIC.minGap && side < 3) { ahead = true; break; }
      }
      const target = ahead ? 0 : TRAFFIC.speed;
      car.speed += (target - car.speed) * Math.min(1, dt * 2);
      if (car.axis === 'x') car.x += car.dir * car.speed * dt;
      else car.z += car.dir * car.speed * dt;
      car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      // Wrap around the city edge; occasionally turn at a grid line.
      if (car.x > half || car.x < -half || car.z > half || car.z < -half) {
        const p = this.city.randomRoadPoint();
        car.x = p.x; car.z = p.z;
      }
      car.syncMesh();
    }
  }

  nearestCar(x, z, maxDist, filter = () => true) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.all) {
      if (!filter(car)) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }
}
