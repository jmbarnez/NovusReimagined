import type { Player } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import { addSkillXp } from "../player/player-data.js";
import type { HiddenSite } from "../types/system.js";

export interface DecryptionReward {
  credits: number;
  chip: number;
  cell: number;
  sensor: number;
  skillXp: number;
}

export function getDecryptionReward(
  site: HiddenSite,
  payload: number,
  integrity: number,
  partial = false,
): DecryptionReward {
  const quality = Math.max(1, payload + integrity);
  return {
    credits: 120 + quality * 55 + Math.round((site.decryptDifficulty ?? 1) * 40),
    chip: site.family === "resource" ? Math.max(1, Math.floor(payload / 2)) : 0,
    cell: site.family === "relic"
      ? Math.max(1, Math.floor((payload + integrity) / 3))
      : Math.max(0, Math.floor(payload / 3)),
    sensor: site.family === "relic"
      ? Math.max(1, Math.floor((payload + 1) / 2))
      : site.family === "derelict"
        ? Math.max(0, Math.floor(payload / 2))
        : 0,
    skillXp: 18 + payload * 8 + (partial ? 0 : 12),
  };
}

export function applyDecryptionReward(
  site: HiddenSite,
  payload: number,
  integrity: number,
  partial = false,
  p: Player = getState().player,
): DecryptionReward {
  const reward = getDecryptionReward(site, payload, integrity, partial);
  PlayerAccess.modifyCredits(reward.credits, p);
  if (reward.chip > 0) PlayerAccess.setLoot("chip", (p.loot.chip || 0) + reward.chip, p);
  if (reward.cell > 0) PlayerAccess.setLoot("cell", (p.loot.cell || 0) + reward.cell, p);
  if (reward.sensor > 0) {
    PlayerAccess.setComponents("sensor_cluster", (p.components.sensor_cluster || 0) + reward.sensor, p);
  }
  addSkillXp("decryption", reward.skillXp, p);
  return reward;
}
