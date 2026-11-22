// Neon Bay — every tuning number, colour and story beat in one place.
// An original open-world crime game: a neon coastal city, on foot and by car,
// traffic, pedestrians, car stealing, a wanted system with police, missions
// with a story, combat, a HUD with a minimap, a start screen and a save.

export const CITY = {
  blocks: 9,          // blocks per side
  block: 30,          // block size in metres
  road: 12,           // road width in metres
  // pitch = block + road; city spans blocks * pitch, centred on (0, 0)
  get pitch() { return this.block + this.road; },
  get size() { return this.blocks * this.pitch; },
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  radius: 0.6,
  health: 100,
  punchDamage: 25,
  punchRange: 2.2,
  punchCooldown: 0.45,
};

export const CAR = {
  accel: 22,          // m/s^2
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 42,       // ~150 km/h
  maxReverse: 10,
  steer: 0.55,        // rad/s at full lock, scaled by speed
  grip: 3.2,
  radius: 2.2,
};

export const TRAFFIC = { count: 14, speed: 9, minGap: 7 };
export const PEDS = { count: 22 };
export const POLICE = { maxCars: 4, maxFoot: 4, carSpeed: 40, footSpeed: 7.5 };

// Wanted stars: crime points needed to reach each star level.
export const WANTED = {
  thresholds: [0, 20, 60, 140, 260, 420],
  stealCar: 20,
  hitPed: 30,
  killPed: 50,
  shoot: 15,
  hitPolice: 60,
  decaySeconds: 22,   // one star lost per this many quiet seconds
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 25, range: 2.2, rate: 0.45, ammo: Infinity },
  pistol: { name: 'P9 Pistol', damage: 34, range: 60, rate: 0.28, ammo: 12, reserve: 60 },
};

export const PALETTE = {
  skyTop: 0x1a1033,
  skyBottom: 0xff7e5f,
  sun: 0xffb347,
  fog: 0x2a1b3d,
  ground: 0x23202e,
  road: 0x191924,
  sidewalk: 0x3a3648,
  building: [0x2e2a4a, 0x3d2b52, 0x243b55, 0x4a2b3d, 0x2b4a44, 0x503a2a],
  neon: [0xff2e88, 0x00e5ff, 0xffd166, 0x7c4dff, 0x39ff88],
  police: 0x2255ff,
  taxi: 0xffc300,
  playerCar: 0xff2e88,
};

export const SAVE_KEY = 'neon-bay-save-v1';
export const BEST_KEY = 'neon-bay-best';

// The story: Jax Rivera, a wheelman fresh out of lockup, owes fixer Mara Voss
// one last job. Five missions, each with a title, briefing, target and reward.
export const MISSIONS = [
  {
    id: 'first-contact',
    title: 'Mission 1 — First Contact',
    brief: 'Mara Voss is waiting at the Velvet Room bar, east side. Get there. On foot or by car — your call, but don\'t be late.',
    objective: 'Reach the Velvet Room bar',
    kind: 'goto',
    target: { x: 105, z: -63 },
    reward: 200,
  },
  {
    id: 'hot-wheels',
    title: 'Mission 2 — Hot Wheels',
    brief: 'A red Comet GT is parked at the docks, south-west. Steal it and bring it to the garage on Palm Row. Cops hate car thieves.',
    objective: 'Steal the red Comet GT, deliver it to the garage',
    kind: 'steal-deliver',
    target: { x: -126, z: 105 },
    deliver: { x: 21, z: 63 },
    reward: 400,
  },
  {
    id: 'heat',
    title: 'Mission 3 — Heat',
    brief: 'Mara needs the heat off her crew. Make some noise — get 2 wanted stars — then lose the cops and reach the hideout in the north.',
    objective: 'Reach 2 wanted stars, then lose the cops and reach the hideout',
    kind: 'heat',
    target: { x: -63, z: -126 },
    reward: 500,
  },
  {
    id: 'dockside-war',
    title: 'Mission 4 — Dockside War',
    brief: 'The Cobalt Kings are moving product through the docks. Take down 4 of their crew. They shoot back — use cover, and watch your health.',
    objective: 'Defeat 4 Cobalt Kings at the docks',
    kind: 'combat',
    target: { x: -126, z: 105 },
    count: 4,
    reward: 800,
  },
  {
    id: 'big-score',
    title: 'Mission 5 — The Big Score',
    brief: 'One last job: grab the getaway van from the casino lot and drive it to the hideout while the whole city is after you. Don\'t stop. Don\'t crash.',
    objective: 'Take the getaway van and reach the hideout',
    kind: 'getaway',
    target: { x: 63, z: 21 },
    deliver: { x: -63, z: -126 },
    reward: 1500,
  },
];

export const STORY_END =
  'The van slides into the hideout as the sirens fade. Mara counts the cash, smiles, and slides you a key. "Neon Bay is yours now, Jax." — To be continued.';
