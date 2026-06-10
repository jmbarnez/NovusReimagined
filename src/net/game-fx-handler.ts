import type { GameEffect } from "../state.js";
import { floatText, spawnExplosion, spawnShockwave, spawnImpactFlash, spawnBeam } from "../utils/fx.js";
import { addParticle } from "../utils/entities.js";
import { random } from "../utils/math.js";
import { sfxWeaponFire, sfxProjectileImpact, sfxShipExplosion, sfxShieldImpact, sfxHullImpact, sfxHostileLocking, sfxHostileLock, sfxUnderAttackPulse, sfxIndustrialBeam, sfxBlip, sfxBeamImpact } from "../audio/procedural.js";

export function handleGameEffect(eff: GameEffect): void {
  const p = eff.payload;
  if (!p) return;
  switch (eff.type) {
    case "floatText":
      floatText(p.x ?? 0, p.y ?? 0, p.text ?? "", p.color, p.bgColor);
      break;
    case "explosion":
      spawnExplosion(p.x ?? 0, p.y ?? 0, p.color ?? "#ffffff", p.scale, typeof p.tier === "string" ? p.tier : undefined);
      sfxShipExplosion(p.x ?? 0, p.y ?? 0, typeof p.scale === "number" ? p.scale : 1);
      break;
    case "shockwave":
      spawnShockwave(p.x ?? 0, p.y ?? 0, p.color ?? "#ffffff", p.scale);
      break;
    case "impact":
      spawnImpactFlash(p.x ?? 0, p.y ?? 0, p.color ?? "#ffffff");
      if (p.delivery === "mining") {
        sfxBeamImpact("mining", p.x ?? 0, p.y ?? 0);
      } else {
        sfxProjectileImpact(p.x ?? 0, p.y ?? 0, p.delivery ?? "projectile");
      }
      break;
    case "beam":
      spawnBeam(p.x1 ?? 0, p.y1 ?? 0, p.x2 ?? 0, p.y2 ?? 0, p.color ?? "#ffffff", p.width);
      break;
    case "weaponFire":
      sfxWeaponFire(p.delivery ?? "projectile", p.typeId ?? "default", p.vol ?? 1, p.x ?? 0, p.y ?? 0);
      break;
    case "shieldImpact":
      sfxShieldImpact(p.vol ?? 1);
      break;
    case "hullImpact":
      sfxHullImpact(p.vol ?? 1);
      break;
    case "hostileLocking":
      sfxHostileLocking(p.x ?? 0, p.y ?? 0);
      break;
    case "hostileLock":
      sfxHostileLock(p.x ?? 0, p.y ?? 0);
      break;
    case "underAttackPulse":
      sfxUnderAttackPulse(p.count ?? 1, p.x ?? 0, p.y ?? 0);
      break;
    case "industrialBeam":
      sfxIndustrialBeam((p.delivery as "mining" | "salvage") ?? "mining", p.x ?? 0, p.y ?? 0);
      break;
    case "blip":
      sfxBlip(p.x ?? 880, p.y ?? 0.06);
      break;
    case "gateBoostParticles": {
      const gateX = p.x ?? 0;
      const gateY = p.y ?? 0;
      const gateAngle = p.angle ?? 0;
      const halfWidth = p.halfWidth ?? 108;
      const isForward = p.isForward ?? true;
      const perp = gateAngle + Math.PI / 2;
      const cos = Math.cos(perp);
      const sin = Math.sin(perp);
      const left = { x: gateX + cos * halfWidth, y: gateY + sin * halfWidth };
      const right = { x: gateX - cos * halfWidth, y: gateY - sin * halfWidth };
      const baseAngle = gateAngle + (isForward ? 0 : Math.PI);
      for (let i = 0; i < 32; i++) {
        const t = random();
        const bx = left.x + (right.x - left.x) * t;
        const by = left.y + (right.y - left.y) * t;
        const a = baseAngle + (random() - 0.5) * 0.5;
        const sp = 180 + random() * 100;
        addParticle({
          x: bx + (random() - 0.5) * 8,
          y: by + (random() - 0.5) * 8,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.6 + random() * 0.3,
          color: "#aaddff",
          r: 1 + random() * 1,
        });
      }
      break;
    }
    default:
      break;
  }
}
