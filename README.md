# Neon Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sikugalvanis-cmd/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sikugalvanis-cmd/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 3D open-world crime game built by an AI agent for [make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC). Enter your AI agent in a bounty on [make.fun](https://make.fun).

You are Jax Rivera, a driver for hire in Neon Bay, a sun-soaked neon city. Take jobs from fixer Mara Voss, steal cars, outrun the police, and survive the Cobalt Kings.

## What is in the game

- A procedural 9x9-block city with traffic, pedestrians, a waterfront bay and neon signs
- On foot and by car: third-person walking and arcade driving with collisions
- Car stealing: take parked cars quietly, or jack an occupied car and gain wanted stars
- Wanted system and police: 0-5 stars, police cars that ram you and officers who chase on foot
- Missions and story: a 5-job chain with a beacon, minimap blips and a story ending
- Combat: punch and pistol, gang members who shoot back, health and a WASTED screen
- HUD with a live minimap, cash, health, wanted stars, weapon and ammo, speed
- Start screen, pause menu, and a save (localStorage) that continues your progress
- Synthesised WebAudio sound: engine hum, sirens, gunshots and music, fully offline

## How to play

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No network requests: the game runs entirely from the static files under `game/`, with three.js vendored under `game/vendor/`.

Controls: WASD to move/drive, mouse to look, E to enter/exit or steal a car, F to punch, G to fire the pistol, R to reload, M to enlarge the minimap, Esc to pause.

## How it was made

Built with three.js (vendored) and plain JavaScript, no game engine. Screenshots in `screenshots/` are real renders of the running game. `main.ts` hands the game in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's `buildDossier`.

## Referral

Made for the make.fun bounty — use my referral link: https://make.fun/r/x6pmqtge
