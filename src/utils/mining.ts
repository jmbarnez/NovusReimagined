import { addXp, addSkillXp } from "../player/player-data.js";
import { spawnParticles } from "./fx.js";
import { addSalvagePickup } from "./entities.js";
import { logEvent } from "../ui/hud-overlay.js";
import { ORE } from "../data/resources.js";

export interface HarvestResult {
  depleted: boolean;
  dmg: number;
  oreKey: string | null;
  amount: number;
}

export function harvestAsteroid(asteroid: any, miningMult: number): HarvestResult {
  if (asteroid.depleted || asteroid.hp <= 0) {
    return { depleted: true, dmg: 0, oreKey: null, amount: 0 };
  }

  const yieldMult = miningMult * (1 + Math.random() * 0.2);
  const dmg = (5 + Math.random() * 5) * yieldMult;
  asteroid.hp -= dmg;

  // Resolve which ore type to yield (same roll-from-weights logic as before).
  const ores = ["iron", "crystal", "exotic"];
  const roll = Math.random();
  let cum = 0;
  let key = "iron";
  for (let i = 0; i < 3; i++) {
    cum += asteroid.oreWeights[i] || 0;
    if (roll < cum) { key = ores[i]; break; }
  }

  const oreDef = ORE[key] || ORE.iron;
  const depleted = asteroid.hp <= 0;
  if (depleted) asteroid.depleted = true;

  // Scatter ore as floating pickups instead of direct deposit.
  // Small trickle each strike; bigger burst on the finishing blow.
  const strikeAmt = Math.max(1, Math.floor((depleted ? 12 : 3) + Math.random() * (depleted ? 8 : 3) * Math.max(0.5, yieldMult)));
  const nPickups = depleted ? Math.min(6, Math.max(3, Math.ceil(strikeAmt / 4))) : 1;
  const perPickup = Math.max(1, Math.floor(strikeAmt / nPickups));

  for (let p = 0; p < nPickups; p++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 35 + Math.random() * 70;
    addSalvagePickup({
      x: asteroid.x + (Math.random() - 0.5) * asteroid.radius * 0.5,
      y: asteroid.y + (Math.random() - 0.5) * asteroid.radius * 0.5,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 90,
      bob: Math.random() * Math.PI * 2,
      kind: "ore",
      payload: key,
      qty: perPickup,
    });
  }

  if (depleted) {
    addXp(10);
    addSkillXp("mining", 15);
    spawnParticles(asteroid.x, asteroid.y, oreDef.color, 3, 80);
    logEvent(`Asteroid depleted — ${strikeAmt}× ${key} scattered · +10 XP · Mining +15`, "loot");
  }

  return { depleted, dmg, oreKey: key, amount: strikeAmt };
}
