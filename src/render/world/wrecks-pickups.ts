import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { ctx } from "../../canvas.js";
import { TAU } from "../../constants.js";
import { dst } from "../../utils/math.js";
import { isVisible } from "../../utils/game.js";
import { ENEMY_DEFS } from "../../data/enemies.js";
import { ORE, REFINED, LOOT, COMPONENTS } from "../../data/resources.js";
import { getModule } from "../../data/modules.js";
import { RARITY_CONFIG } from "../../data/moduleRarity.js";
import { PICKUP_LIFE_S } from "../../wreck.js";
import { getUIFont } from "../ui-font.js";
import type { LockSlot } from "../../types/world.js";

// ── Wreck debris pieces ───────────────────────────────────────────────────
const _wreckLockMap = new Map<string, LockSlot>();

export function drawWreckPieces(now: number) {
  _wreckLockMap.clear();
  const state = getState();
  const primaryId = state.player.targetLock?.id;
  if (Array.isArray(state.player.lockQueue)) {
    for (const slot of state.player.lockQueue) _wreckLockMap.set(slot.id, slot);
  }
  for (const p of state.wreckPieces) {
    if (!isVisible(p.x, p.y, 50)) continue;
    const def = ENEMY_DEFS[p.type];
    const fill = def?.render?.fill ?? "#332016";
    const stroke = def?.render?.stroke ?? "#aa6633";
    const fade = Math.min(1, p.despawnTimer / 30);
    const explosionPhase = Math.max(0, 1 - p.age / 1.0);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    const pts = p.pts;
    if (!pts?.length) { ctx.restore(); continue; }

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();

    ctx.globalAlpha = 0.78 * fade;
    ctx.fillStyle = fill;
    ctx.lineJoin = "round";
    ctx.fill();

    if (Client.settings?.directionalLighting !== false && explosionPhase < 0.85) {
      const wpSun = Math.atan2(-p.y, -p.x) - p.angle;
      const wsdx = Math.cos(wpSun), wsdy = Math.sin(wpSun);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.clip();
      ctx.globalAlpha = (1 - explosionPhase) * 0.9 * fade;
      const wpShade = ctx.createLinearGradient(wsdx * 30, wsdy * 30, -wsdx * 30, -wsdy * 30);
      wpShade.addColorStop(0.0, "rgba(255,255,255,0.08)");
      wpShade.addColorStop(0.32, "rgba(0,0,0,0)");
      wpShade.addColorStop(0.65, "rgba(0,0,0,0.35)");
      wpShade.addColorStop(1.0, "rgba(0,0,0,0.58)");
      ctx.fillStyle = wpShade;
      ctx.fillRect(-40, -40, 80, 80);
      ctx.restore();
    }

    ctx.globalAlpha = (0.55 + explosionPhase * 0.45) * fade;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.1 + explosionPhase * 1.4;
    ctx.stroke();

    if (explosionPhase > 0) {
      ctx.globalAlpha = explosionPhase * 0.55 * fade;
      ctx.fillStyle = "#ffb060";
      ctx.fill();
    }

    if (p.hitFlash > 0) {
      ctx.globalAlpha = (p.hitFlash / 0.18) * 0.7 * fade;
      ctx.fillStyle = "#9fffe5";
      ctx.fill();
    }

    ctx.rotate(-p.angle);

    if (p.hp < p.maxHp) {
      const frac = Math.max(0, p.hp / p.maxHp);
      const w = 16;
      ctx.globalAlpha = 0.85 * fade;
      ctx.fillStyle = "#0a1a1a";
      ctx.fillRect(-w / 2 - 1, -16, w + 2, 3);
      ctx.fillStyle = "#00e8c8";
      ctx.fillRect(-w / 2, -15, w * frac, 1);
    }

    const slot = _wreckLockMap.get(p.id);
    if (slot && !slot.resolving) {
      const isPrimary = p.id === primaryId;
      const sz = isPrimary ? 22 : 18;
      const lw = isPrimary ? 8 : 6;
      const brA = 0.72 + 0.28 * Math.sin(now * 0.0048);
      ctx.save();
      ctx.strokeStyle = isPrimary ? "#e0a868" : "#7a8a9c";
      ctx.lineWidth = isPrimary ? 2.35 : 1.65;
      ctx.globalAlpha = brA * fade;
      ctx.beginPath(); ctx.moveTo(-sz + lw, -sz); ctx.lineTo(-sz, -sz); ctx.lineTo(-sz, -sz + lw); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sz - lw, -sz); ctx.lineTo(sz, -sz); ctx.lineTo(sz, -sz + lw); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sz - lw, sz); ctx.lineTo(sz, sz); ctx.lineTo(sz, sz - lw); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-sz + lw, sz); ctx.lineTo(-sz, sz); ctx.lineTo(-sz, sz - lw); ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(p.angle);

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ── Resource Icon Helper ──────────────────────────────────────────────────
export function drawResourceIcon(icon: string, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1.2;

  switch (icon) {
    case "shard":
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.45, -size * 0.25);
      ctx.lineTo(size * 0.75, size * 0.45);
      ctx.lineTo(0, size * 0.9);
      ctx.lineTo(-size * 0.75, size * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.stroke();
      break;

    case "box":
      const bs = size * 0.85;
      ctx.fillRect(-bs, -bs, bs * 2, bs * 2);
      ctx.strokeRect(-bs, -bs, bs * 2, bs * 2);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(-bs, -2, bs * 2, 4);
      ctx.fillRect(-2, -bs, 4, bs * 2);
      break;

    case "bolt":
      const bw = size * 0.45;
      ctx.beginPath();
      ctx.moveTo(-bw, -size); ctx.lineTo(bw, -size);
      ctx.lineTo(bw, size);   ctx.lineTo(-bw, size);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      for (let y = -size + 4; y < size - 2; y += 4) {
        ctx.beginPath(); ctx.moveTo(-bw, y); ctx.lineTo(bw, y); ctx.stroke();
      }
      break;

    case "chip":
      const cw = size * 1.1, ch = size * 0.7;
      ctx.fillRect(-cw, -ch, cw * 2, ch * 2);
      ctx.strokeRect(-cw, -ch, cw * 2, ch * 2);
      ctx.fillStyle = "#ffcc44";
      for (let x = -cw + 3; x < cw - 2; x += 4) {
        ctx.fillRect(x, -ch - 2, 2, 2);
        ctx.fillRect(x, ch, 2, 2);
      }
      break;

    case "cell":
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.65, size, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-size * 0.3, -size - 2, size * 0.6, 3);
      break;

    case "gear":
      ctx.beginPath();
      const teeth = 8;
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * TAU;
        const r1 = size * 0.7, r2 = size;
        ctx.lineTo(Math.cos(a - 0.18) * r1, Math.sin(a - 0.18) * r1);
        ctx.lineTo(Math.cos(a - 0.1) * r2, Math.sin(a - 0.1) * r2);
        ctx.lineTo(Math.cos(a + 0.1) * r2, Math.sin(a + 0.1) * r2);
        ctx.lineTo(Math.cos(a + 0.18) * r1, Math.sin(a + 0.18) * r1);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath(); ctx.arc(0, 0, size * 0.3, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.stroke();
      break;

    case "plate":
      ctx.fillRect(-size * 1.1, -size * 0.4, size * 2.2, size * 0.8);
      ctx.strokeRect(-size * 1.1, -size * 0.4, size * 2.2, size * 0.8);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.arc(-size * 0.8, 0, 1.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 0.8, 0, 1.5, 0, TAU); ctx.fill();
      break;

    case "canister":
      ctx.beginPath();
      ctx.moveTo(-size * 0.55, -size); ctx.lineTo(size * 0.55, -size);
      ctx.lineTo(size * 0.55, size);   ctx.lineTo(-size * 0.55, size);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(-size * 0.55, -size * 0.4, size * 1.1, size * 0.8);
      break;

    default:
      ctx.beginPath(); ctx.arc(0, 0, size, 0, TAU); ctx.fill(); ctx.stroke();
  }

  ctx.restore();
}

// ── Sci-fi salvage/loot drops ─────────────────────────────────────────────
// Each drop gets: warp-in spawn animation, holographic flicker, scan line
// sweep, energy ring pulse, chromatic aberration (rare), vertical light pillar,
// ground glow, resource icon, name tag, and quantity badge.
export function drawSalvagePickups(now: number) {
  const state = getState();
  for (const s of state.salvagePickups) {
    if (!isVisible(s.x, s.y, 60)) continue;
    const fade = s.life < 8 ? s.life / 8 : 1;
    const bobY = Math.sin(s.bob) * 2.5;
    const pulse = 0.85 + 0.15 * Math.sin(now * 0.003 + s.bob);
    const globalPulse = fade * pulse;

    // ── Warp-in phase ──────────────────────────────────────────────────────
    // First 0.4s: item is materializing — over-bright, slightly overscaled.
    const warpInAge = Math.min(1, Math.max(0, (PICKUP_LIFE_S - s.life) / 0.4));
    const warpIn = 1 - warpInAge; // 1=just spawned, 0=fully materialized
    const warpScale = 1 + warpIn * 0.4; // scales from 1.4 → 1.0
    const warpFlash = 1 + warpIn * 2.0; // brightness multiplier fades

    // ── Holographic flicker (subtle) ────────────────────────────────────────
    const flicker = 0.92 + 0.08 * Math.sin(now * 0.025 + s.bob * 7);

    // Determine display properties
    let label: string;
    let color: string;
    let icon: string;
    let iconSize = 5;
    let isRare = false;

    if (s.kind === "credits") {
      label = `\xA2${s.qty}`;
      color = "#ffd700";
      icon = "box";
      iconSize = 4;
      isRare = true;
    } else if (s.kind === "ore") {
      const def = ORE[s.payload] || REFINED[s.payload];
      color = def?.color ?? "#a0a5aa";
      icon = def?.icon ?? "shard";
      label = def?.label ?? s.payload;
    } else if (s.kind === "module") {
      const def = getModule(s.payload);
      const rarityColor = s.instance ? RARITY_CONFIG[s.instance.rarity]?.color : null;
      color = rarityColor ?? "#00e8c8";
      icon = "shard";
      label = def?.short ?? def?.name ?? s.payload;
      iconSize = 5;
      isRare = s.instance?.rarity !== "Stock" && s.instance?.rarity !== undefined;
    } else {
      const def = LOOT[s.payload] || COMPONENTS[s.payload];
      color = def?.color ?? "#8899aa";
      icon = def?.icon ?? "bolt";
      label = def?.label ?? s.payload;
    }

    const qtyStr = s.qty > 1 && s.kind !== "credits" ? ` x${s.qty}` : "";
    const pillarH = 50;

    ctx.save();
    ctx.translate(s.x, s.y + bobY);

    // Warp-in scale
    if (warpIn > 0.01) {
      ctx.scale(warpScale, warpScale);
    }

    // ── Chromatic split for rare items ─────────────────────────────────────
    if (isRare) {
      ctx.globalAlpha = 0.12 * globalPulse * warpFlash * flicker;
      // Red offset
      ctx.translate(2, 0);
      drawRadialGlow(14, color);
      ctx.translate(-4, 0);
      // Cyan offset
      drawRadialGlow(14, "#00ffff");
      ctx.translate(2, 0);
    }

    // ── Scan line sweep ────────────────────────────────────────────────────
    const scanPos = ((now * 0.0025 + s.bob * 0.5) % 60) - 30;
    ctx.globalAlpha = 0.09 * globalPulse * warpFlash * flicker;
    ctx.strokeStyle = "#88ddff";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-8, scanPos);
    ctx.lineTo(8, scanPos);
    ctx.stroke();

    // ── Vertical light pillar ──────────────────────────────────────────────
    const pillarBright = 0.5 * globalPulse * warpFlash * flicker;
    ctx.globalAlpha = pillarBright;
    const pillarGl = ctx.createLinearGradient(0, 0, 0, -pillarH);
    pillarGl.addColorStop(0, color);
    pillarGl.addColorStop(1, "transparent");
    ctx.fillStyle = pillarGl;
    ctx.beginPath();
    ctx.moveTo(-2.5, 0);
    ctx.lineTo(-1, -pillarH);
    ctx.lineTo(1, -pillarH);
    ctx.lineTo(2.5, 0);
    ctx.closePath();
    ctx.fill();

    // Secondary wider, dimmer pillar for ambient glow
    ctx.globalAlpha = 0.2 * globalPulse * warpFlash * flicker;
    const pillarGl2 = ctx.createLinearGradient(0, 0, 0, -pillarH);
    pillarGl2.addColorStop(0, color);
    pillarGl2.addColorStop(1, "transparent");
    ctx.fillStyle = pillarGl2;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-2.5, -pillarH * 0.8);
    ctx.lineTo(2.5, -pillarH * 0.8);
    ctx.lineTo(5, 0);
    ctx.closePath();
    ctx.fill();

    // ── Ground glow ────────────────────────────────────────────────────────
    const glowBright = 0.45 * globalPulse * warpFlash * flicker;
    ctx.globalAlpha = glowBright;
    drawRadialGlow(16, color);

    // ── Energy ring pulse ──────────────────────────────────────────────────
    const ringPhase = ((now * 0.0025 + s.bob * 0.3) % 1);
    const ringRadius = 8 + ringPhase * 14;
    const ringAlpha = (1 - ringPhase) * 0.2 * fade * flicker;
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, TAU);
    ctx.stroke();

    // ── Item icon ───────────────────────────────────────────────────────────
    ctx.globalAlpha = 0.95 * fade * flicker;
    drawResourceIcon(icon, iconSize, color);

    // ── Name tag + quantity below ───────────────────────────────────────────
    ctx.globalAlpha = (0.85 + 0.15 * Math.sin(now * 0.002 + s.bob * 2)) * fade * flicker;
    ctx.font = `7px ${getUIFont()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const nameY = 8;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillText(label + qtyStr, 1, nameY + 1);
    ctx.fillStyle = color;
    ctx.fillText(label + qtyStr, 0, nameY);

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/** Helper: radial gradient circle centered at (0,0). */
function drawRadialGlow(radius: number, color: string) {
  const gl = ctx.createRadialGradient(0, 0, 1, 0, 0, radius);
  gl.addColorStop(0, color);
  gl.addColorStop(1, "transparent");
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();
}
