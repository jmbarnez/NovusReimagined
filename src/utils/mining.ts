import { addXp, addSkillXp } from "../player/player-data.js";
import { spawnParticles } from "./fx.js";
import { addSalvagePickup, addShockwave } from "./entities.js";
import { logEvent } from "../ui/hud-overlay.js";
import { ORE } from "../data/resources.js";
import { ctx } from "../canvas.js";
import { sfxShipExplosion } from "../audio/procedural.js";
import type { Asteroid } from "../types/world.js";

export interface HarvestResult {
  depleted: boolean;
  dmg: number;
  oreKey: string | null;
  amount: number;
}

export interface AsteroidDebris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  pts: [number, number][];
  radius: number;
  fill: string;
  stroke: string;
  life: number;
  maxLife: number;
}

export const asteroidDebrisList: AsteroidDebris[] = [];

export function updateAsteroidDebris(dt: number) {
  for (let i = asteroidDebrisList.length - 1; i >= 0; i--) {
    const d = asteroidDebrisList[i];
    d.life -= dt;
    if (d.life <= 0) {
      asteroidDebrisList.splice(i, 1);
      continue;
    }
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.angle += d.angularVel * dt;
    // apply linear drag to visual chunks so they slow down beautifully
    d.vx *= Math.pow(0.88, dt);
    d.vy *= Math.pow(0.88, dt);
    d.angularVel *= Math.pow(0.88, dt);
  }
}

export function drawAsteroidDebris() {
  for (const d of asteroidDebrisList) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle);

    // Fade out in the last 40% of the life span
    const fade = Math.min(1, d.life / (d.maxLife * 0.4));
    ctx.globalAlpha = fade;

    ctx.beginPath();
    ctx.moveTo(d.pts[0][0] * d.radius, d.pts[0][1] * d.radius);
    for (let i = 1; i < d.pts.length; i++) {
      ctx.lineTo(d.pts[i][0] * d.radius, d.pts[i][1] * d.radius);
    }
    ctx.closePath();

    ctx.fillStyle = d.fill;
    ctx.strokeStyle = d.stroke;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

export function harvestAsteroid(asteroid: Asteroid, miningMult: number): HarvestResult {
  if (asteroid.depleted || asteroid.hp <= 0) {
    return { depleted: true, dmg: 0, oreKey: null, amount: 0 };
  }

  // Ticking strikes chip away health.
  const yieldMult = miningMult * (1 + Math.random() * 0.2);
  const dmg = (5 + Math.random() * 5) * yieldMult;
  asteroid.hp = Math.max(0, asteroid.hp - dmg);

  const depleted = asteroid.hp <= 0;
  if (depleted) asteroid.depleted = true;

  // Roll weight to know which ore is targeted.
  const ores = ["iron", "crystal", "exotic"];
  const roll = Math.random();
  let cum = 0;
  let key = "iron";
  for (let i = 0; i < 3; i++) {
    cum += asteroid.oreWeights[i] || 0;
    if (roll < cum) { key = ores[i]; break; }
  }

  return { depleted, dmg, oreKey: key, amount: 0 };
}

export function destroyAsteroid(asteroid: Asteroid, isMiningLaser: boolean, miningMult = 1.0) {
  // 1. Roll which ore type is main yield
  const ores = ["iron", "crystal", "exotic"];
  const roll = Math.random();
  let cum = 0;
  let key = "iron";
  for (let i = 0; i < 3; i++) {
    cum += asteroid.oreWeights[i] || 0;
    if (roll < cum) { key = ores[i]; break; }
  }

  const oreDef = ORE[key] || ORE.iron;

  // 2. Calculate yield amount based on richness and destruction type
  const baseQty = Math.max(10, Math.floor((14 + Math.random() * 8) * (asteroid.richness || 1.0)));
  let totalQty = isMiningLaser ? Math.floor(baseQty * miningMult) : Math.floor(baseQty * 0.4);
  totalQty = Math.max(1, totalQty);

  // 3. Drop ores as physical floating items
  const nPickups = Math.min(6, Math.max(3, Math.ceil(totalQty / 4)));
  const perPickup = Math.max(1, Math.floor(totalQty / nPickups));
  const remainder = totalQty - perPickup * nPickups;

  for (let p = 0; p < nPickups; p++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 40 + Math.random() * 70;
    addSalvagePickup({
      x: asteroid.x + (Math.random() - 0.5) * asteroid.radius * 0.25,
      y: asteroid.y + (Math.random() - 0.5) * asteroid.radius * 0.25,
      vx: asteroid.vx + Math.cos(ang) * spd,
      vy: asteroid.vy + Math.sin(ang) * spd,
      life: 120, // ample time for player to collect
      bob: Math.random() * Math.PI * 2,
      kind: "ore",
      payload: key,
      qty: perPickup + (p < remainder ? 1 : 0),
    });
  }

  // 4. Spawn visual-only rocky debris chunks that drift and spin
  const numChunks = 3 + Math.floor(Math.random() * 3);
  const tintHue = asteroid.tintHue ?? 30;
  const tintSat = asteroid.tintSat ?? 13;
  const fill = `hsl(${tintHue}, ${tintSat}%, 22%)`;
  const stroke = `hsl(${tintHue}, ${tintSat}%, 42%)`;

  for (let c = 0; c < numChunks; c++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 45 + Math.random() * 75;
    const numVertices = 5 + Math.floor(Math.random() * 3);
    const pts: [number, number][] = [];
    for (let v = 0; v < numVertices; v++) {
      const a = (v / numVertices) * Math.PI * 2;
      const r = 0.65 + Math.random() * 0.45;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    asteroidDebrisList.push({
      x: asteroid.x,
      y: asteroid.y,
      vx: asteroid.vx + Math.cos(ang) * spd,
      vy: asteroid.vy + Math.sin(ang) * spd,
      angle: Math.random() * Math.PI * 2,
      angularVel: (Math.random() - 0.5) * 4.5,
      pts,
      radius: asteroid.radius * (0.22 + Math.random() * 0.24),
      fill,
      stroke,
      life: 1.1 + Math.random() * 0.7,
      maxLife: 2.0,
    });
  }

  // 5. FX: Shockwave + Dust particles
  addShockwave({
    x: asteroid.x,
    y: asteroid.y,
    maxRadius: asteroid.radius * 2.3,
    life: 0.48,
    color: oreDef.color,
    width: 2.4,
  });

  spawnParticles(asteroid.x, asteroid.y, oreDef.color, 12, 85);
  sfxShipExplosion(asteroid.x, asteroid.y, 0.4); // smaller sound for rock explosion

  // 6. Rewards and logs
  addXp(10);
  if (isMiningLaser) {
    addSkillXp("mining", 15);
    logEvent(`Asteroid mined — ${totalQty}× ${key} released · +10 XP · Mining +15`, "loot");
  } else {
    logEvent(`Asteroid shattered — ${totalQty}× ${key} released (40% yield) · +10 XP`, "loot");
  }
}
