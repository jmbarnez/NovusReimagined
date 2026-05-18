import { TAU } from "../constants.js";
import { addParticle, addBeam, addFloatText, addShockwave } from "./entities.js";

export function spawnMuzzleFlash(x: number, y: number, angle: number, color: string, intensity = 6) {
  const n = Math.max(3, Math.round(intensity));
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - 0.5) * 0.7;
    const s = 70 + Math.random() * 110;
    addParticle({
      x, y, color,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: 1.1 + Math.random() * 2.2,
      life: 0.25 + Math.random() * 0.25,
      drag: 0.80 + Math.random() * 0.06,
      decay: 2.8 + Math.random() * 1.2,
    });
  }
  addParticle({
    x, y, color: "#ffffff",
    vx: Math.cos(angle) * 30 + (Math.random() - 0.5) * 20,
    vy: Math.sin(angle) * 30 + (Math.random() - 0.5) * 20,
    r: 2.5 + Math.random() * 2,
    life: 0.08 + Math.random() * 0.08,
    drag: 0.85,
    decay: 6,
  });
  for (let i = 0; i < 2; i++) {
    const a = angle + (Math.random() - 0.5) * 1.2;
    const s = 40 + Math.random() * 60;
    addParticle({
      x, y, color: "#ffcc88",
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: 0.6 + Math.random() * 0.8,
      life: 0.2 + Math.random() * 0.15,
      drag: 0.88,
      decay: 3.5,
    });
  }
}

export function spawnParticles(x: number, y: number, color: string, n = 8, spd = 100) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const s = spd * 0.4 + Math.random() * spd;
    addParticle({
      x, y, color,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: 1.2 + Math.random() * 2.2,
      life: 1,
      drag: 0.92 + Math.random() * 0.05,
      decay: 0.9 + Math.random() * 0.8,
    });
  }
}

export function spawnBeam(x1: number, y1: number, x2: number, y2: number, color: string, width = 2) {
  addBeam({ x1, y1, x2, y2, color, width, life: 1 });
}

export function floatText(x: number, y: number, text: string, color = "#fff", bgColor?: string) {
  addFloatText({ x, y, text, color, bgColor, life: 1, vy: -44 });
}

export function spawnImpactFlash(x: number, y: number, color: string) {
  spawnParticles(x, y, color, 2, 70);
}

export function spawnBeamImpact(x: number, y: number, color: string) {
  spawnParticles(x, y, color, 1, 55);
}

export function spawnBeamImpactSubtle(x: number, y: number, color: string) {
  spawnParticles(x, y, color, 1, 40);
}

export function spawnMiningImpact(x: number, y: number) {
  spawnParticles(x, y, "#ff8822", 1, 45);
}

export function spawnExplosion(x: number, y: number, color: string, scale = 1.0) {
  const n = Math.round(4 * scale);
  const s = 80 * scale;
  spawnParticles(x, y, color, n, s);
  spawnParticles(x, y, "#ffcc66", Math.round(n * 0.25), s * 0.6);
}

export function spawnShockwave(x: number, y: number, color: string, scale = 1.0) {
  addShockwave({
    x, y,
    maxRadius: 45 + scale * 55,
    life: 0.5 + scale * 0.35,
    color,
    width: 2 + scale * 2,
  });
}
