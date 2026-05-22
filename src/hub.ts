import { G } from "./state.js";
import type { HubJob } from "./state.js";
import { dst } from "./utils/math.js";
import { floatText } from "./utils/fx.js";
import { curSys } from "./utils/game.js";
import { removeSensorLock } from "./targeting.js";
import { removeWreckPiece } from "./utils/entities.js";
import { rollWreckSalvage } from "./wreck.js";
import { addSkillXp } from "./player/player-data.js";
import { generateModuleInstance } from "./loot/generateModule.js";
import { logEvent } from "./ui/hud/logs.js";
import type { Station } from "./types/world.js";

export const ORE_KEYS = ["iron", "crystal", "exotic"] as const;

function getHub(): Station | null {
  const sys = curSys();
  if (!sys) return null;
  return sys.stations.find((st: Station) => st.isProcessingHub) ?? null;
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

export function updateHub(_dt: number) {
  const hub = getHub();
  if (!hub) return;

  const collectR: number = hub.collectRadius ?? 220;
  const now = Date.now() / 1000;

  // Absorb wreck pieces
  for (let i = G.wreckPieces.length - 1; i >= 0; i--) {
    const p = G.wreckPieces[i];
    if (dst(p.x, p.y, hub.x, hub.y) >= collectR) continue;

    const mass = p.radius * p.radius * 0.8;
    const duration = 50 + mass / 40;
    const job: HubJob = {
      id: `hub-d-${Date.now()}-${i}`,
      kind: "debris",
      startTime: now,
      duration,
      mass,
      salvagePool: p.salvagePool ? [...p.salvagePool] : [],
    };
    G.P.hubQueue.push(job);
    removeSensorLock(p.id);
    removeWreckPiece(i);
    floatText(hub.x, hub.y - 30, "Debris absorbed", "#ffaa44");
    logEvent("Debris absorbed — processing", "loot");
  }

  // Absorb asteroids
  const sys = curSys();
  if (!sys) return;
  for (let i = sys.asteroids.length - 1; i >= 0; i--) {
    const ast = sys.asteroids[i];
    if (ast.depleted || ast.hp <= 0) continue;
    if (dst(ast.x, ast.y, hub.x, hub.y) >= collectR) continue;

    const mass = ast.radius * ast.radius * 1.8;
    const duration = 110 + mass / 30;
    const job: HubJob = {
      id: `hub-a-${Date.now()}-${i}`,
      kind: "asteroid",
      startTime: now,
      duration,
      mass,
      oreWeights: [...(ast.oreWeights ?? [1, 0, 0])],
    };
    G.P.hubQueue.push(job);
    removeSensorLock(ast.id);
    // Mark depleted so it respawns naturally
    ast.depleted = true;
    ast.hp = 0;
    ast.respawnTimer = 90 + Math.random() * 60;
    floatText(hub.x, hub.y - 30, "Asteroid absorbed", "#ffaa44");
    logEvent("Asteroid absorbed — processing", "loot");
  }
}

export function tickHubQueue() {
  if (!G.P.hubQueue?.length) return;
  const now = Date.now() / 1000;
  const completed: number[] = [];

  for (let i = 0; i < G.P.hubQueue.length; i++) {
    const job = G.P.hubQueue[i];
    if (now - job.startTime < job.duration) continue;
    completed.push(i);

    if (job.kind === "debris") {
      const rollBonus = G._statsCache?.salvageBonus ?? 0;
      const drops = rollWreckSalvage(job.salvagePool, rollBonus);
      for (const drop of drops) {
        if (drop.kind === "loot") {
          const cur = G.P.hubOutput.loot[drop.payload] ?? 0;
          G.P.hubOutput.loot[drop.payload] = cur + drop.qty;
        } else if (drop.kind === "module" && drop.instance) {
          G.P.hubOutput.modules.push(drop.instance);
        }
      }
      const xp = Math.max(5, Math.floor(job.mass * 0.015));
      addSkillXp("salvage", xp);
      logEvent(`Debris processed — salvage ready · Salvage +${xp} XP`, "loot");
    } else if (job.kind === "asteroid") {
      // Roll ore type weighted by oreWeights
      const weights = job.oreWeights ?? [1, 0, 0];
      const total = weights.reduce((a, b) => a + b, 0) || 1;
      const roll = Math.random() * total;
      let cum = 0;
      let key: string = ORE_KEYS[0];
      for (let k = 0; k < ORE_KEYS.length; k++) {
        cum += weights[k] ?? 0;
        if (roll < cum) { key = ORE_KEYS[k]; break; }
      }

      const skillLv = G.P.skills?.["metallurgy"] ?? 0;
      const yieldMult = 0.6 + skillLv * 0.03;
      const qty = Math.max(1, Math.floor((10 + job.mass / 80) * yieldMult));
      const cur = G.P.hubOutput.ore[key] ?? 0;
      G.P.hubOutput.ore[key] = cur + qty;

      const xp = Math.max(10, Math.floor(job.mass * 0.025));
      addSkillXp("metallurgy", xp);
      logEvent(`Asteroid processed — ${qty}× ${key} ore ready · Metallurgy +${xp} XP`, "loot");
    }
  }

  // Remove completed jobs back-to-front
  for (let i = completed.length - 1; i >= 0; i--) {
    G.P.hubQueue.splice(completed[i], 1);
  }
}

export function collectHubOutput(): {
  loot: Record<string, number>;
  ore: Record<string, number>;
  modules: typeof G.P.hubOutput.modules;
} {
  const out = {
    loot: { ...G.P.hubOutput.loot },
    ore: { ...G.P.hubOutput.ore },
    modules: [...G.P.hubOutput.modules],
  };

  // Transfer loot into player cargo
  for (const [key, qty] of Object.entries(out.loot)) {
    const cur = G.P.loot[key] ?? 0;
    G.P.loot[key] = cur + qty;
  }

  // Transfer ore into player cargo
  for (const [key, qty] of Object.entries(out.ore)) {
    const cur = G.P.ore[key] ?? 0;
    G.P.ore[key] = cur + qty;
  }

  // Transfer modules into player cargo
  for (const inst of out.modules) {
    G.P.moduleCargo.push(inst);
  }

  // Clear output
  G.P.hubOutput = { loot: {}, ore: {}, modules: [] };
  return out;
}

export function hasHubOutput(): boolean {
  const o = G.P.hubOutput;
  return (
    Object.values(o.loot).some(v => v > 0) ||
    Object.values(o.ore).some(v => v > 0) ||
    o.modules.length > 0
  );
}
