import { type Player } from "./state.js";
import { getState } from "./state-access.js";
import { PlayerAccess } from "./state-access.js";
import type { HubJob } from "./state.js";
import type { ModuleInstance } from "./types/moduleInstance.js";
import { dst, random } from "./utils/math.js";
import { floatText } from "./utils/fx.js";
import { curSys } from "./utils/game.js";
import { removeSensorLock } from "./targeting.js";
import { removeWreckPiece } from "./utils/entities.js";
import { rollWreckSalvage } from "./wreck.js";
import { addSkillXp } from "./player/player-data.js";
import { getStats } from "./player/player-stats.js";
import { logEvent } from "./feedback.js";
import { getRecipe } from "./data/industryRecipes.js";
import { C } from "./config/index.js";
import type { Station, WreckSalvageEntry } from "./types/world.js";

export const ORE_KEYS = ["iron", "crystal", "exotic"] as const;

const ORE_TO_SMELT_RECIPE: Record<string, string> = {
  iron: "bar",
  crystal: "lat",
  exotic: "con",
};

function getHub(p: Player): Station | null {
  const sys = curSys(p);
  if (!sys) return null;
  return sys.stations.find((st: Station) => st.isProcessingHub) ?? null;
}

export function getDropZoneCenter(hub: Station): { x: number; y: number; radius: number } {
  const dx = hub.dropZoneOffset?.dx ?? 180;
  const dy = hub.dropZoneOffset?.dy ?? 0;
  return {
    x: hub.x + dx,
    y: hub.y + dy,
    radius: hub.dropZoneRadius ?? 140,
  };
}

export function fmtDuration(seconds: number): string {
  const rounded = Math.ceil(seconds);
  if (rounded < 60) {
    return `${rounded}s`;
  }
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function getProcessFee(mass: number): number {
  return Math.max(
    C.HUB.PROCESS_MIN_FEE,
    Math.ceil(mass * C.HUB.PROCESS_FEE_PER_MASS),
  );
}

export function getSmeltFee(craftQty: number): number {
  return C.HUB.SMELT_FEE_PER_BATCH * craftQty;
}

function completeAsteroidProcessing(mass: number, oreWeights: number[], p: Player) {
  const weights = oreWeights.length ? oreWeights : [1, 0, 0];
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const roll = random() * total;
  let cum = 0;
  let key: string = ORE_KEYS[0];
  for (let k = 0; k < ORE_KEYS.length; k++) {
    cum += weights[k] ?? 0;
    if (roll < cum) { key = ORE_KEYS[k]; break; }
  }

  const skillLv = p.skills?.["refining"] ?? 0;
  const yieldMult = 0.6 + skillLv * 0.03;
  const qty = Math.max(1, Math.floor((10 + mass / 80) * yieldMult));
  const cur = p.hubDeposit?.ore?.[key] ?? 0;
  PlayerAccess.setHubDepositOre(key, cur + qty, p);

  const xp = Math.max(10, Math.floor(mass * 0.025));
  addSkillXp("refining", xp, p);
  if (p === getState().player) {
    logEvent(`Processing complete — ${qty}× ${key} ore ready · Refining +${xp} XP`, "loot");
  }
}

function completeDebrisProcessing(mass: number, salvagePool: WreckSalvageEntry[] | undefined, p: Player) {
  const rollBonus = getStats(p).salvageBonus;
  const drops = rollWreckSalvage(salvagePool, rollBonus);
  for (const drop of drops) {
    if (drop.kind === "loot") {
      const cur = p.hubDeposit?.loot?.[drop.payload] ?? 0;
      PlayerAccess.setHubDepositLoot(drop.payload, cur + drop.qty, p);
    } else if (drop.kind === "module" && drop.instance) {
      PlayerAccess.addHubDepositModule(drop.instance, p);
    }
  }
  const xp = Math.max(5, Math.floor(mass * 0.015));
  addSkillXp("salvage", xp, p);
  if (p === getState().player) {
    logEvent(`Processing complete — salvage ready · Salvage +${xp} XP`, "loot");
  }
}

export function updateHub(_dt: number) {
  // Sandbox physics mode: Automatic background ingestion is disabled.
  // Asteroids and salvage debris remain fully physical, floating in the docking bay
  // until the player interacts with the console and manually triggers deconstruction.
}

export interface ScanDepositItem {
  id: string;
  kind: "asteroid" | "debris";
  label: string;
  mass: number;
  oreWeights?: number[];
  salvagePool?: WreckSalvageEntry[];
}

export function getFloatingDeposits(hub: Station, p: Player): ScanDepositItem[] {
  const dropZone = getDropZoneCenter(hub);
  const items: ScanDepositItem[] = [];

  // 1. Scan floating salvage wreck pieces inside the docking bay
  for (const wp of getState().wreckPieces) {
    if (dst(wp.x, wp.y, dropZone.x, dropZone.y) < dropZone.radius) {
      const mass = wp.radius * wp.radius * 0.8;
      items.push({
        id: wp.id,
        kind: "debris",
        label: wp.name || "Wreck debris",
        mass,
        salvagePool: wp.salvagePool ? [...wp.salvagePool] : [],
      });
    }
  }

  // 2. Scan floating asteroids inside the docking bay
  const sys = curSys(p);
  if (sys) {
    for (const ast of sys.asteroids) {
      if (ast.depleted || ast.hp <= 0) continue;
      if (dst(ast.x, ast.y, dropZone.x, dropZone.y) < dropZone.radius) {
        const mass = ast.radius * ast.radius * 1.8;
        items.push({
          id: ast.id,
          kind: "asteroid",
          label: ast.name || "Asteroid",
          mass,
          oreWeights: ast.oreWeights ? [...ast.oreWeights] : [1, 0, 0],
        });
      }
    }
  }

  return items;
}

export function processFloatingItem(itemId: string, p: Player): { success: boolean; reason?: string } {
  const hub = getHub(p);
  if (!hub) return { success: false, reason: "No active reclamation hub detected" };

  const items = getFloatingDeposits(hub, p);
  const item = items.find(i => i.id === itemId);
  if (!item) return { success: false, reason: "Target matter is no longer located inside the docking bay" };

  const fee = getProcessFee(item.mass);
  if (p.credits < fee) {
    return { success: false, reason: `Need ${fee}¢ processing fee (have ${p.credits}¢)` };
  }

  // Deduct credits from account
  PlayerAccess.modifyCredits(-fee, p);

  // Deconstruct and remove the physical entity from the world
  if (item.kind === "debris") {
    const idx = getState().wreckPieces.findIndex(wp => wp.id === itemId);
    if (idx !== -1) {
      removeSensorLock(itemId, p);
      removeWreckPiece(idx);
    }
  } else if (item.kind === "asteroid") {
    const sys = curSys(p);
    if (sys) {
      const ast = sys.asteroids.find(a => a.id === itemId);
      if (ast) {
        removeSensorLock(itemId, p);
        ast.depleted = true;
        ast.hp = 0;
        ast.respawnTimer = 90 + random() * 60;
      }
    }
  }

  // Queue deconstruction job in Reclamation Array
  const now = Date.now() / 1000;
  const duration = item.kind === "asteroid"
    ? C.HUB.ASTEROID_PROCESS_BASE + item.mass / C.HUB.ASTEROID_PROCESS_PER_MASS
    : C.HUB.DEBRIS_PROCESS_BASE + item.mass / C.HUB.DEBRIS_PROCESS_PER_MASS;

  const job = {
    id: `hub-${item.kind}-${Date.now()}`,
    kind: item.kind,
    startTime: now,
    duration,
    mass: item.mass,
    oreWeights: item.oreWeights ? [...item.oreWeights] : undefined,
    salvagePool: item.salvagePool ? [...item.salvagePool] : undefined,
  };

  PlayerAccess.addHubJob(job, p);
  if (p === getState().player) {
    const dropZone = getDropZoneCenter(hub);
    floatText(dropZone.x, dropZone.y - 35, "Reclamation Initiated", "#ffaa44");
    logEvent(`Matter Reclamation Initiated: ${item.label} (${fee}¢ fee)`, "system");
  }

  return { success: true };
}

export function processDepositItem(itemId: string, p: Player): { success: boolean; reason?: string } {
  const item = p.hubDeposit?.raw?.find(i => i.id === itemId);
  if (!item) return { success: false, reason: "Item not found in drop bay" };

  const fee = getProcessFee(item.mass);
  if (p.credits < fee) {
    return { success: false, reason: `Need ${fee}¢ processing fee (have ${p.credits}¢)` };
  }

  PlayerAccess.modifyCredits(-fee, p);
  PlayerAccess.removeHubDepositItem(itemId, p);

  const now = Date.now() / 1000;
  const duration = item.kind === "asteroid"
    ? C.HUB.ASTEROID_PROCESS_BASE + item.mass / C.HUB.ASTEROID_PROCESS_PER_MASS
    : C.HUB.DEBRIS_PROCESS_BASE + item.mass / C.HUB.DEBRIS_PROCESS_PER_MASS;

  const job: HubJob = {
    id: `hub-${item.kind}-${Date.now()}`,
    kind: item.kind,
    startTime: now,
    duration,
    mass: item.mass,
    oreWeights: item.oreWeights ? [...item.oreWeights] : undefined,
    salvagePool: item.salvagePool ? [...item.salvagePool] : undefined,
  };
  PlayerAccess.addHubJob(job, p);
  if (p === getState().player) {
    logEvent(`Queued processing: ${item.label} (${fee}¢ fee)`, "system");
  }
  return { success: true };
}

export function smeltFromDeposit(oreKey: string, craftQty: number, p: Player): { success: boolean; reason?: string } {
  const recipeId = ORE_TO_SMELT_RECIPE[oreKey];
  if (!recipeId) return { success: false, reason: "No smelt recipe for this ore" };

  const recipe = getRecipe(recipeId);
  if (!recipe) return { success: false, reason: "Recipe not found" };

  const oreInput = recipe.inputs.find(i => i.pool === "ore" && i.key === oreKey);
  if (!oreInput) return { success: false, reason: "Invalid smelt recipe" };

  const oreNeeded = oreInput.qty * craftQty;
  const available = p.hubDeposit?.ore?.[oreKey] ?? 0;
  if (available < oreNeeded) {
    return { success: false, reason: `Need ${oreNeeded}× ${oreKey} ore (have ${available})` };
  }

  const fee = getSmeltFee(craftQty);
  if (p.credits < fee) {
    return { success: false, reason: `Need ${fee}¢ smelting fee (have ${p.credits}¢)` };
  }

  PlayerAccess.modifyCredits(-fee, p);
  PlayerAccess.setHubDepositOre(oreKey, available - oreNeeded, p);

  const now = Date.now() / 1000;
  const duration = (recipe.duration ?? 10) * craftQty;
  const job: HubJob = {
    id: `hub-smelt-${Date.now()}-${random().toString(36).slice(2, 7)}`,
    kind: "smelt",
    startTime: now,
    duration,
    mass: 0,
    smeltRecipeId: recipeId,
    smeltQty: craftQty,
  };
  PlayerAccess.addHubJob(job, p);
  if (p === getState().player) {
    logEvent(`Queued smelt: ${recipe.label} ×${craftQty} (${fee}¢ fee)`, "system");
  }
  return { success: true };
}

export function tickHubQueue(p: Player = getState().player) {
  if (!p) return;
  if (!p.hubQueue?.length) return;
  const now = Date.now() / 1000;
  const completed: number[] = [];

  for (let i = 0; i < p.hubQueue.length; i++) {
    const job = p.hubQueue[i];
    if (now - job.startTime < job.duration) continue;
    completed.push(i);

    if (job.kind === "debris") {
      completeDebrisProcessing(job.mass, job.salvagePool, p);
    } else if (job.kind === "asteroid") {
      completeAsteroidProcessing(job.mass, job.oreWeights ?? [1, 0, 0], p);
    } else if (job.kind === "smelt" && job.smeltRecipeId) {
      const recipe = getRecipe(job.smeltRecipeId);
      if (!recipe) continue;
      const qty = job.smeltQty ?? 1;
      const skillMult = recipe.outputSkill ? 1 + (p.skills[recipe.outputSkill] || 0) * 0.05 : 1;
      for (const out of recipe.outputs) {
        const totalQty = Math.floor(out.qty * qty * skillMult);
        if (out.pool === "refined") {
          const cur = p.hubOutput?.refined?.[out.key] ?? 0;
          PlayerAccess.setHubOutputRefined(out.key, cur + totalQty, p);
        } else if (out.pool === "ore") {
          const cur = p.hubOutput?.ore?.[out.key] ?? 0;
          PlayerAccess.setHubOutputOre(out.key, cur + totalQty, p);
        } else if (out.pool === "loot") {
          const cur = p.hubOutput?.loot?.[out.key] ?? 0;
          PlayerAccess.setHubOutputLoot(out.key, cur + totalQty, p);
        }
      }
      if (p === getState().player) {
        logEvent(`Smelting complete: ${recipe.label} ×${qty}`, "loot");
      }
    }
  }

  for (let i = completed.length - 1; i >= 0; i--) {
    PlayerAccess.spliceHubQueue(completed[i], 1, p);
  }
}

export function collectHubOutput(p: Player = getState().player): {
  loot: Record<string, number>;
  ore: Record<string, number>;
  refined: Record<string, number>;
  modules: ModuleInstance[];
} {
  const out = {
    loot: { ...p.hubOutput.loot, ...p.hubDeposit.loot },
    ore: { ...p.hubOutput.ore },
    refined: { ...(p.hubOutput.refined ?? {}) },
    modules: [...p.hubOutput.modules, ...p.hubDeposit.modules],
  };

  for (const [key, qty] of Object.entries(out.loot)) {
    const cur = p.loot[key] ?? 0;
    PlayerAccess.setLoot(key, cur + qty, p);
  }

  for (const [key, qty] of Object.entries(out.ore)) {
    const cur = p.ore[key] ?? 0;
    PlayerAccess.setOre(key, cur + qty, p);
  }

  for (const [key, qty] of Object.entries(out.refined)) {
    const cur = p.refined[key] ?? 0;
    PlayerAccess.setRefined(key, cur + qty, p);
  }

  for (const inst of out.modules) {
    PlayerAccess.addModuleCargo(inst, p);
  }

  PlayerAccess.setHubOutput({ loot: {}, ore: {}, refined: {}, modules: [] }, p);
  PlayerAccess.setHubDeposit({
    raw: [...p.hubDeposit.raw],
    ore: { ...p.hubDeposit.ore },
    loot: {},
    modules: [],
  }, p);
  return out;
}

export function hasHubDeposit(p: Player): boolean {
  const d = p.hubDeposit;
  if (!d) return false;
  return (
    (d.raw?.length ?? 0) > 0 ||
    Object.values(d.ore).some(v => v > 0) ||
    Object.values(d.loot).some(v => v > 0) ||
    d.modules.length > 0
  );
}

export function hasHubOutput(p: Player = getState().player): boolean {
  const o = p.hubOutput;
  const d = p.hubDeposit;
  return (
    Object.values(o.loot).some(v => v > 0) ||
    Object.values(o.ore).some(v => v > 0) ||
    Object.values(o.refined ?? {}).some(v => v > 0) ||
    o.modules.length > 0 ||
    Object.values(d?.loot ?? {}).some(v => v > 0) ||
    (d?.modules?.length ?? 0) > 0
  );
}

export function getSmeltRecipeForOre(oreKey: string): string | null {
  return ORE_TO_SMELT_RECIPE[oreKey] ?? null;
}
