// People: the player on foot, wandering pedestrians, and the armed gang
// members of mission 4. Characters are simple articulated box figures.

import * as THREE from 'three';
import { PLAYER, PEDS } from './config.js';

const SHIRTS = [0xe8e8e8, 0xff6b6b, 0x4ecdc4, 0xffd166, 0x95d5b2, 0xf72585, 0x90caf9];
const PANTS = [0x2b2d42, 0x3d405b, 0x5a3a2a, 0x1d3557];

export function buildPersonMesh(shirt, pants, skin = 0xc68642) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirtMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);
  const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.24);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.15, 0.38, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.15, 0.38, 0);
  g.add(legR);
  const armGeo = new THREE.BoxGeometry(0.16, 0.65, 0.2);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.38, 1.15, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.38, 1.15, 0);
  g.add(armR);
  g.userData = { legL, legR, armL, armR, head };
  return g;
}

export class Person {
  constructor(mesh, x, z) {
    this.mesh = mesh;
    this.x = x;
    this.z = z;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 0;
    this.health = 100;
    this.alive = true;
    this.walkPhase = Math.random() * 6;
    this.fleeing = false;
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const s = Math.sin(this.walkPhase) * Math.min(1, this.speed / 4) * 0.6;
    this.mesh.userData.legL.rotation.x = s;
    this.mesh.userData.legR.rotation.x = -s;
    this.mesh.userData.armL.rotation.x = -s * 0.8;
    this.mesh.userData.armR.rotation.x = s * 0.8;
  }
}

export class Player extends Person {
  constructor(mesh, x, z) {
    super(mesh, x, z);
    this.health = PLAYER.health;
    this.weapon = 'fists';
    this.ammo = WEAPON_AMMO.fists;
    this.reserve = 0;
    this.punchTimer = 0;
    this.shootTimer = 0;
    this.hurtTimer = 0;
    this.regenTimer = 0;
  }
}

const WEAPON_AMMO = { fists: Infinity, pistol: 12 };

export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.list = [];
    for (let i = 0; i < PEDS.count; i += 1) {
      const p = city.randomSidewalkPoint();
      const mesh = buildPersonMesh(
        SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
        PANTS[Math.floor(Math.random() * PANTS.length)],
      );
      scene.add(mesh);
      const person = new Person(mesh, p.x, p.z);
      person.target = city.randomSidewalkPoint();
      person.speed = 1 + Math.random() * 0.8;
      person.syncMesh();
      this.list.push(person);
    }
  }

  update(dt, danger) {
    for (const p of this.list) {
      if (!p.alive) continue;
      // Flee from gunfire and speeding cars.
      if (danger && Math.hypot(p.x - danger.x, p.z - danger.z) < 25) p.fleeing = true;
      const target = p.fleeing
        ? { x: p.x + (p.x - (danger?.x ?? p.x)) * 0.1, z: p.z + (p.z - (danger?.z ?? p.z)) * 0.1 }
        : p.target;
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5 && !p.fleeing) {
        p.target = this.city.randomSidewalkPoint();
        p.fleeing = false;
      } else if (d > 0.01) {
        const sp = p.fleeing ? p.speed * 2.4 : p.speed;
        p.heading = Math.atan2(dx, dz);
        p.x += Math.sin(p.heading) * sp * dt;
        p.z += Math.cos(p.heading) * sp * dt;
        p.walkPhase += dt * sp * 2.2;
      }
      const clamped = this.city.clampToCity(p.x, p.z, 4);
      p.x = clamped.x; p.z = clamped.z;
      p.syncMesh();
    }
  }
}

/** Armed gang members who guard the docks in mission 4. */
export class Gang {
  constructor(scene) {
    this.scene = scene;
    this.members = [];
  }

  spawn(x, z, count) {
    for (let i = 0; i < count; i += 1) {
      const mesh = buildPersonMesh(0x1a1a2e, 0x1a1a2e);
      // Purple bandana: a bright headband box.
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.1, 0.36),
        new THREE.MeshBasicMaterial({ color: 0x9d4edd }),
      );
      band.position.y = 1.86;
      mesh.add(band);
      this.scene.add(mesh);
      const m = new Person(mesh, x + (Math.random() - 0.5) * 14, z + (Math.random() - 0.5) * 14);
      m.health = 80;
      m.shootTimer = 1 + Math.random();
      m.syncMesh();
      this.members.push(m);
    }
  }

  update(dt, player, onShoot) {
    for (const m of this.members) {
      if (!m.alive) continue;
      const dx = player.x - m.x;
      const dz = player.z - m.z;
      const d = Math.hypot(dx, dz);
      m.heading = Math.atan2(dx, dz);
      // Close in to shooting range, then stand and fire.
      if (d > 14) {
        m.speed = 3.4;
        m.x += Math.sin(m.heading) * m.speed * dt;
        m.z += Math.cos(m.heading) * m.speed * dt;
        m.walkPhase += dt * 7;
      } else {
        m.speed = 0;
        m.shootTimer -= dt;
        if (m.shootTimer <= 0) {
          m.shootTimer = 1.1 + Math.random() * 0.8;
          onShoot(m, d);
        }
      }
      m.syncMesh();
    }
  }

  get aliveCount() { return this.members.filter((m) => m.alive).length; }

  clear() {
    for (const m of this.members) this.scene.remove(m.mesh);
    this.members = [];
  }
}
