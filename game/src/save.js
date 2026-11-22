// Save and load: one localStorage slot with cash, mission progress, health
// and position. The save is the player's own browser only.

import { SAVE_KEY } from './config.js';

export function saveGame(game) {
  try {
    const data = {
      version: 1,
      cash: game.cash,
      missionIndex: game.missions.index,
      health: Math.max(1, Math.round(game.player.health)),
      x: Math.round(game.player.x * 10) / 10,
      z: Math.round(game.player.z * 10) / 10,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}
