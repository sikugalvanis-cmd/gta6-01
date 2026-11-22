// Screenshot scenes behind ?shot=start|drive|foot|chase&seed=N.
// Each scene plays the real game forward from a fresh world with a scripted
// setup, so the frame is what the game really looks like and the same seed
// always gives the same frame. The harness waits for window.__shotReady.

// Put a car on a real road, heading along it, so a screenshot drive never
// runs straight into a building.
function placeOnRoad(game, car, laneIndex, z) {
  const centres = game.city.roadCentres();
  const c = centres[laneIndex % centres.length];
  car.x = c;
  car.z = z;
  car.heading = 0; // +z, along the road
  car.speed = 0;
  car.syncMesh();
}

export function stageShot(name, game) {
  const g = game;
  if (name === 'drive') {
    g.startGame({ skipIntro: true });
    const car = g.traffic.parked[0];
    placeOnRoad(g, car, 4, -120);
    g.enterCar(car);
    g.player.x = g.inCar.x; g.player.z = g.inCar.z;
    g.inCar.speed = 26;
    g.wanted.add(40);
    g.missions.start(1, g);
    return { ready: true };
  }
  if (name === 'foot') {
    g.startGame({ skipIntro: true });
    g.player.x = -108; g.player.z = 88;
    g.player.heading = Math.PI * 0.9;
    g.missions.start(3, g);
    // Aim the camera at the gang at the docks.
    g.camYaw = Math.atan2(g.missions.current.target.x - g.player.x, g.missions.current.target.z - g.player.z);
    g.wanted.add(0);
    return { ready: true };
  }
  if (name === 'chase') {
    g.startGame({ skipIntro: true });
    const car = g.traffic.parked[1];
    placeOnRoad(g, car, 5, -120);
    g.enterCar(car);
    g.inCar.speed = 30;
    g.wanted.add(200);
    g.missions.start(4, g);
    return { ready: true };
  }
  // start: the title screen over the city at dusk.
  g.showStart();
  return { ready: true };
}
