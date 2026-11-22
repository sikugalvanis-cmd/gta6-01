// Neon Bay itself: a procedural grid city built from boxes, canvas window
// textures and neon signs. Everything is original geometry; no imported maps.
// Exposes the collision boxes, road lines and spawn helpers the rest of the
// game uses.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A windows texture painted on a canvas — one per building style. */
function windowTexture(rand, base, lit) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) {
    for (let x = 6; x < 58; x += 12) {
      const on = rand() < 0.45;
      g.fillStyle = on ? lit : '#0c0a18';
      g.fillRect(x, y, 7, 9);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function neonSignTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0616';
  g.fillRect(0, 0, 256, 64);
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, seed = 1337) {
    this.scene = scene;
    this.rand = mulberry32(seed);
    /** {minX, maxX, minZ, maxZ} boxes the player and cars cannot cross. */
    this.solids = [];
    /** Road centre lines, one per grid line, for traffic and the minimap. */
    this.roads = [];
    this.buildings = new THREE.Group();
    scene.add(this.buildings);
    this.build();
  }

  roadCentres() {
    const { blocks, pitch } = CITY;
    const centres = [];
    const start = -CITY.size / 2;
    for (let i = 0; i <= blocks; i += 1) centres.push(start + i * pitch - CITY.road / 2);
    return centres;
  }

  build() {
    const rand = this.rand;
    const { blocks, block, road, pitch, size } = CITY;
    const half = size / 2;

    // Ground, roads and sidewalks.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size + 200, size + 200),
      new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 0.9 });
    const walkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
    const centres = this.roadCentres();
    for (const c of centres) {
      const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(road, size), roadMat);
      vRoad.rotation.x = -Math.PI / 2;
      vRoad.position.set(c, 0.02, 0);
      this.scene.add(vRoad);
      const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(size, road), roadMat);
      hRoad.rotation.x = -Math.PI / 2;
      hRoad.position.set(0, 0.02, c);
      this.scene.add(hRoad);
      this.roads.push({ axis: 'x', at: c });
      this.roads.push({ axis: 'z', at: c });
      // Dashed centre lines.
      const dashMat = new THREE.MeshBasicMaterial({ color: 0x8a8a9a });
      for (let d = -half + 6; d < half - 6; d += 12) {
        const dv = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3), dashMat);
        dv.rotation.x = -Math.PI / 2;
        dv.position.set(c, 0.04, d);
        this.scene.add(dv);
        const dh = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.35), dashMat);
        dh.rotation.x = -Math.PI / 2;
        dh.position.set(d, 0.04, c);
        this.scene.add(dh);
      }
    }

    // Buildings, one to four per block, with lit windows.
    const palette = PALETTE.building;
    const litColors = ['#ffd166', '#7ce7ff', '#ff9ecf', '#c8ff9e'];
    const textures = palette.map((col, i) =>
      windowTexture(rand, `#${col.toString(16).padStart(6, '0')}`, litColors[i % litColors.length]));
    const signWords = ['NEON', 'BAR', 'HOTEL', '24H', 'CASINO', 'PIZZA', 'CLUB', 'MOTEL', 'TATTOO', 'DANCE'];
    for (let bx = 0; bx < blocks; bx += 1) {
      for (let bz = 0; bz < blocks; bz += 1) {
        const x0 = -half + bx * pitch + road / 2 + 2;
        const z0 = -half + bz * pitch + road / 2 + 2;
        const n = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k += 1) {
          const w = 8 + rand() * 14;
          const d = 8 + rand() * 14;
          const h = 8 + rand() * rand() * 42;
          const x = x0 + (block - 4 - w) * (n === 1 ? 0.5 : rand());
          const z = z0 + (block - 4 - d) * (n === 1 ? 0.5 : rand());
          const mat = new THREE.MeshStandardMaterial({
            map: textures[Math.floor(rand() * textures.length)],
            roughness: 0.85,
          });
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          mesh.position.set(x + w / 2, h / 2, z + d / 2);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.buildings.add(mesh);
          this.solids.push({ minX: x, maxX: x + w, minZ: z, maxZ: z + d });
          // Roof edge glow on tall towers.
          if (h > 30) {
            const edge = new THREE.Mesh(
              new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3),
              new THREE.MeshBasicMaterial({ color: PALETTE.neon[Math.floor(rand() * PALETTE.neon.length)] }),
            );
            edge.position.set(x + w / 2, h + 0.2, z + d / 2);
            this.buildings.add(edge);
          }
        }
        // Sidewalk slabs around each block.
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(block, block), walkMat);
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(x0 + block / 2 - 1, 0.01, z0 + block / 2 - 1);
        this.scene.add(walk);
      }
    }

    // Neon signs on a few buildings, facing the streets.
    for (let i = 0; i < 26; i += 1) {
      const word = signWords[i % signWords.length];
      const color = `#${PALETTE.neon[i % PALETTE.neon.length].toString(16).padStart(6, '0')}`;
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 2.5),
        new THREE.MeshBasicMaterial({ map: neonSignTexture(word, color), transparent: true }),
      );
      const c = centres[1 + Math.floor(rand() * (centres.length - 2))];
      const along = (rand() - 0.5) * (size - 40);
      const face = rand() < 0.5;
      sign.position.set(face ? c + road / 2 + 0.3 : along, 6 + rand() * 8, face ? along : c + road / 2 + 0.3);
      if (!face) sign.rotation.y = Math.PI / 2;
      this.scene.add(sign);
    }

    // Streetlights along the roads. Lamp globes glow; only a few real lights
    // (software renderers choke on dozens of point lights).
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x30303c, roughness: 0.6 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    let lightCount = 0;
    let lampIndex = 0;
    for (const c of centres) {
      for (let d = -half + 20; d < half; d += 42) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
        pole.position.set(c + road / 2 - 0.6, 3.5, d);
        this.scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
        lamp.position.set(c + road / 2 - 0.6, 7, d);
        this.scene.add(lamp);
        if (lightCount < 10 && lampIndex % 9 === 0) {
          const light = new THREE.PointLight(0xffd9a0, 12, 26, 1.8);
          light.position.set(c + road / 2 - 0.6, 6.8, d);
          this.scene.add(light);
          lightCount += 1;
        }
        lampIndex += 1;
      }
    }

    // A glowing bay and a pier to the south — Neon Bay's waterfront.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 90),
      new THREE.MeshStandardMaterial({ color: 0x0a2a44, roughness: 0.15, metalness: 0.6 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.3, half + 45);
    this.scene.add(water);
  }

  /** True when the circle (x, z, r) touches any building. */
  hitsSolid(x, z, r) {
    for (const s of this.solids) {
      if (x + r > s.minX && x - r < s.maxX && z + r > s.minZ && z - r < s.maxZ) return s;
    }
    return null;
  }

  /** Push a circle out of a solid it overlaps; returns the corrected position. */
  resolveCircle(x, z, r) {
    const s = this.hitsSolid(x, z, r);
    if (!s) return { x, z };
    const dxl = x + r - s.minX;
    const dxr = s.maxX - (x - r);
    const dzl = z + r - s.minZ;
    const dzr = s.maxZ - (z - r);
    const m = Math.min(dxl, dxr, dzl, dzr);
    if (m === dxl) x = s.minX - r;
    else if (m === dxr) x = s.maxX + r;
    else if (m === dzl) z = s.minZ - r;
    else z = s.maxZ + r;
    return { x, z };
  }

  clampToCity(x, z, margin = 4) {
    const half = CITY.size / 2 + 30;
    return {
      x: Math.max(-half, Math.min(half, x)),
      z: Math.max(-half, Math.min(half + 40, z)),
    };
  }

  /** A random point on a road, for traffic and pedestrian spawns. */
  randomRoadPoint() {
    const centres = this.roadCentres();
    const c = centres[Math.floor(this.rand() * centres.length)];
    const along = (this.rand() - 0.5) * (CITY.size - 20);
    return this.rand() < 0.5 ? { x: c, z: along, axis: 'z' } : { x: along, z: c, axis: 'x' };
  }

  /** A random point on a sidewalk (inside a block's edge). */
  randomSidewalkPoint() {
    const { blocks, pitch } = CITY;
    const bx = Math.floor(this.rand() * blocks);
    const bz = Math.floor(this.rand() * blocks);
    const x0 = -CITY.size / 2 + bx * pitch + CITY.road / 2;
    const z0 = -CITY.size / 2 + bz * pitch + CITY.road / 2;
    const edge = Math.floor(this.rand() * 4);
    const t = this.rand() * CITY.block;
    if (edge === 0) return { x: x0 + t, z: z0 + 1 };
    if (edge === 1) return { x: x0 + t, z: z0 + CITY.block - 3 };
    if (edge === 2) return { x: x0 + 1, z: z0 + t };
    return { x: x0 + CITY.block - 3, z: z0 + t };
  }
}
