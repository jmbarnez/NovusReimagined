/**
 * PixiJS Effects, Wrecks, and Pickups Renderer.
 * 
 * Migrates dynamic particles, debris, shockwaves, decals, and floating text to PixiJS:
 * - Wreck Debris: Dynamic polygons with 3D shadows and hit flashes.
 * - Salvage Pickups: Holographic resource icons, vertical energy pillars, ground glows, and floating name cards.
 * - Shockwaves: Expanding rings with alpha decay.
 * - Impact Decals: Fading high-composite poly impact markings.
 * - Floating Texts: Bouncing XP/damage text tags with translucent cards.
 */
import { Container, Graphics, Sprite, Texture, Text, TextStyle } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import type { System, LockSlot, SalvagePickup } from "../types/world.js";
import type { FloatText } from "../utils/entities.js";
import { effectLayer } from "../pixi.js";
import { lerp } from "../utils/math.js";
import { isVisible } from "../utils/game.js";
import { getUIFont } from "./ui-font.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { ORE, REFINED, LOOT, COMPONENTS } from "../data/resources.js";
import { getModule } from "../data/modules.js";
import { RARITY_CONFIG } from "../data/moduleRarity.js";
import { PICKUP_LIFE_S } from "../wreck.js";
import { drawTargetLockBrackets, drawSelectedTargetIndicator } from "./pixi-lock-brackets.js";

const TAU = Math.PI * 2;

// ─── Single-pass Graphics ────────────────────────────────────────────────────
let _wreckGfx: Graphics | null = null;
let _pickupGfx: Graphics | null = null;
let _shockwaveGfx: Graphics | null = null;
let _decalGfx: Graphics | null = null;
let _floatGfx: Graphics | null = null;

// Text labeling maps (keyed by item reference)
const _pickupLabels = new Map<SalvagePickup, Text>();
const _floatLabels = new Map<FloatText, Text>();

// Helper to convert hex colors
function hexStringToNumber(hex: string): number {
  const clean = hex.replace("#", "");
  return parseInt(clean, 16) || 0xffffff;
}

// Draw dynamic vector shapes for resources inside PixiJS Graphics in world space coordinates
function drawResourceIconGfx(g: Graphics, icon: string, size: number, colorNum: number, cx: number, cy: number, scale: number) {
  const s = size * scale;
  const strokeOpt = { color: 0x000000, width: 1.2 * scale };

  switch (icon) {
    case "shard":
      g.poly([
        cx, cy - s,
        cx + s * 0.45, cy - s * 0.25,
        cx + s * 0.75, cy + s * 0.45,
        cx, cy + s * 0.9,
        cx - s * 0.75, cy + s * 0.35
      ], true).fill({ color: colorNum }).stroke({ color: 0xffffff, width: 0.8 * scale, alpha: 0.2 });
      break;

    case "box":
      const bs = s * 0.85;
      g.rect(cx - bs, cy - bs, bs * 2, bs * 2).fill({ color: colorNum }).stroke(strokeOpt);
      g.rect(cx - bs, cy - 2 * scale, bs * 2, 4 * scale).fill({ color: 0x000000, alpha: 0.2 });
      g.rect(cx - 2 * scale, cy - bs, 4 * scale, bs * 2).fill({ color: 0x000000, alpha: 0.2 });
      break;

    case "bolt":
      const bw = s * 0.45;
      g.rect(cx - bw, cy - s, bw * 2, s * 2).fill({ color: colorNum }).stroke(strokeOpt);
      for (let y = -size + 4; y < size - 2; y += 4) {
        g.rect(cx - bw, cy + y * scale, bw * 2, 1.2 * scale).fill({ color: 0x000000, alpha: 0.25 });
      }
      break;

    case "chip":
      const cw = s * 1.1, ch = s * 0.7;
      g.rect(cx - cw, cy - ch, cw * 2, ch * 2).fill({ color: colorNum }).stroke(strokeOpt);
      for (let x = -size + 3; x < size - 2; x += 4) {
        g.rect(cx + x * scale, cy - ch - 2 * scale, 2 * scale, 2 * scale).fill({ color: 0xffcc44 });
        g.rect(cx + x * scale, cy + ch, 2 * scale, 2 * scale).fill({ color: 0xffcc44 });
      }
      break;

    case "cell":
      g.ellipse(cx, cy, s * 0.65, s).fill({ color: colorNum }).stroke(strokeOpt);
      g.rect(cx - s * 0.3, cy - s - 2 * scale, s * 0.6, 3 * scale).fill({ color: 0xffffff });
      break;

    case "gear":
      const teeth = 8;
      const polyPts: number[] = [];
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * TAU;
        const r1 = s * 0.7, r2 = s;
        polyPts.push(cx + Math.cos(a - 0.18) * r1, cy + Math.sin(a - 0.18) * r1);
        polyPts.push(cx + Math.cos(a - 0.1) * r2, cy + Math.sin(a - 0.1) * r2);
        polyPts.push(cx + Math.cos(a + 0.1) * r2, cy + Math.sin(a + 0.1) * r2);
        polyPts.push(cx + Math.cos(a + 0.18) * r1, cy + Math.sin(a + 0.18) * r1);
      }
      g.poly(polyPts, true).fill({ color: colorNum }).stroke(strokeOpt);
      // Inner circle hole
      g.circle(cx, cy, s * 0.3).fill({ color: 0x0a0c10 }).stroke(strokeOpt);
      break;

    case "plate":
      g.rect(cx - s * 1.1, cy - s * 0.4, s * 2.2, s * 0.8).fill({ color: colorNum }).stroke(strokeOpt);
      g.circle(cx - s * 0.8, cy, 1.5 * scale).fill({ color: 0x000000, alpha: 0.3 });
      g.circle(cx + s * 0.8, cy, 1.5 * scale).fill({ color: 0x000000, alpha: 0.3 });
      break;

    case "canister":
      g.rect(cx - s * 0.55, cy - s, s * 1.1, s * 2).fill({ color: colorNum }).stroke(strokeOpt);
      g.rect(cx - s * 0.55, cy - s * 0.4, s * 1.1, s * 0.8).fill({ color: 0xffffff, alpha: 0.25 });
      break;

    default:
      g.circle(cx, cy, s).fill({ color: colorNum }).stroke(strokeOpt);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function initPixiEffects(parent: Container): void {
  destroyPixiEffects();

  // Unified graphics
  _wreckGfx = new Graphics();
  parent.addChild(_wreckGfx);

  _pickupGfx = new Graphics();
  parent.addChild(_pickupGfx);

  _shockwaveGfx = new Graphics();
  parent.addChild(_shockwaveGfx);

  _decalGfx = new Graphics();
  parent.addChild(_decalGfx);

  _floatGfx = new Graphics();
  parent.addChild(_floatGfx);
}

export function syncPixiEffects(now: number, alpha: number, dt: number, sys: System): void {
  if (!_wreckGfx || !_pickupGfx || !_shockwaveGfx || !_decalGfx || !_floatGfx) return;

  // ── 1. Sync Wreck Pieces ───────────────────────────────────────────────────
  _wreckGfx.clear();
  const primaryId = getState().player.targetLock?.id;
  const selectedId = getState().player._assignTargetId;
  const lockSlotById = new Map<string, LockSlot>();
  if (Array.isArray(getState().player.lockQueue)) {
    for (const slot of getState().player.lockQueue) lockSlotById.set(slot.id, slot);
  }

  if (getState().wreckPieces) {
    for (const p of getState().wreckPieces) {
      if (!isVisible(p.x, p.y, 50)) continue;
      const def = ENEMY_DEFS[p.type];
      const fillCol = hexStringToNumber(def?.render?.fill ?? "#332016");
      const strokeCol = hexStringToNumber(def?.render?.stroke ?? "#aa6633");
      const fade = Math.min(1, p.despawnTimer / 30);
      const explosionPhase = Math.max(0, 1 - p.age / 1.0);

      const pts = p.pts;
      if (!pts?.length) continue;

      // Outer border styling
      const borderAlpha = (0.55 + explosionPhase * 0.45) * fade;
      const borderWidth = 0.85 + explosionPhase * 0.55;

      // Flat rotated/translated polygon points in world space
      const cos = Math.cos(p.angle);
      const sin = Math.sin(p.angle);
      const flatPts: number[] = [];
      for (const pt of pts) {
        flatPts.push(pt[0] * cos - pt[1] * sin + p.x, pt[0] * sin + pt[1] * cos + p.y);
      }

      // Draw the main body
      _wreckGfx.poly(flatPts, true)
        .fill({ color: fillCol, alpha: 0.78 * fade })
        .stroke({ color: strokeCol, width: borderWidth, alpha: borderAlpha });

      // Explosion/Hit overlays
      if (explosionPhase > 0) {
        _wreckGfx.poly(flatPts, true).fill({ color: 0xffb060, alpha: explosionPhase * 0.55 * fade });
      }
      if (p.hitFlash > 0) {
        _wreckGfx.poly(flatPts, true).fill({ color: 0x9fffe5, alpha: (p.hitFlash / 0.18) * 0.7 * fade });
      }

      // Standard HP Bar below wreck
      if (p.hp < p.maxHp) {
        const hpFrac = Math.max(0, p.hp / p.maxHp);
        const w = 16;
        _wreckGfx.rect(p.x - w / 2 - 1, p.y - 16, w + 2, 3).fill({ color: 0x0a1a1a, alpha: 0.85 * fade })
          .rect(p.x - w / 2, p.y - 15, w * hpFrac, 1).fill({ color: 0x00e8c8, alpha: 0.85 * fade });
      }

      // Target lock brackets (corner boxes drawn flat in world space)
      const slot = lockSlotById.get(p.id);
      if (slot) {
        drawTargetLockBrackets(
          _wreckGfx, p.x, p.y, p.radius ?? 14, slot, p.id === primaryId, now, "neutral", undefined, fade,
        );
        if (p.id === selectedId) {
          drawSelectedTargetIndicator(_wreckGfx, p.x, p.y, p.radius ?? 14, now);
        }
      }
    }
  }

  // ── 2. Sync Salvage Pickups ────────────────────────────────────────────────
  _pickupGfx.clear();
  const activePickupRefs = new Set<SalvagePickup>();

  if (getState().salvagePickups) {
    for (const s of getState().salvagePickups) {
      if (!isVisible(s.x, s.y, 60)) continue;
      activePickupRefs.add(s);

      const fade = s.life < 8 ? s.life / 8 : 1;
      const bobY = Math.sin(s.bob) * 2.5;
      const pulse = 0.85 + 0.15 * Math.sin(now * 0.003 + s.bob);
      const globalPulse = fade * pulse;

      // Warp-in materialize
      const warpInAge = Math.min(1, Math.max(0, (PICKUP_LIFE_S - s.life) / 0.4));
      const warpIn = 1 - warpInAge; 
      const warpScale = 1 + warpIn * 0.4;
      const warpFlash = 1 + warpIn * 2.0;

      // Holographic flicker
      const flicker = 0.92 + 0.08 * Math.sin(now * 0.025 + s.bob * 7);

      // Display metrics
      let label: string;
      let colStr: string;
      let icon: string;
      let iconSize = 5;
      let isRare = false;

      if (s.kind === "credits") {
        label = `\xA2${s.qty}`;
        colStr = "#ffd700";
        icon = "box";
        iconSize = 4;
        isRare = true;
      } else if (s.kind === "ore") {
        const def = ORE[s.payload] || REFINED[s.payload];
        colStr = def?.color ?? "#a0a5aa";
        icon = def?.icon ?? "shard";
        label = def?.label ?? s.payload;
      } else if (s.kind === "module") {
        const def = getModule(s.payload);
        const rarityColor = s.instance ? RARITY_CONFIG[s.instance.rarity]?.color : null;
        colStr = rarityColor ?? "#00e8c8";
        icon = "shard";
        label = def?.short ?? def?.name ?? s.payload;
        iconSize = 5;
        isRare = s.instance?.rarity !== "Stock" && s.instance?.rarity !== undefined;
      } else {
        const def = LOOT[s.payload] || COMPONENTS[s.payload];
        colStr = def?.color ?? "#8899aa";
        icon = def?.icon ?? "bolt";
        label = def?.label ?? s.payload;
      }

      const colorNum = hexStringToNumber(colStr);
      const qtyStr = s.qty > 1 && s.kind !== "credits" ? ` x${s.qty}` : "";
      const pillarH = 50;

      const px = s.x;
      const py = s.y + bobY;

      // Chromatic splits for rare items
      if (isRare) {
        // Red split
        _pickupGfx.circle(px + 2 * warpScale, py, 14 * warpScale).fill({ color: colorNum, alpha: 0.12 * globalPulse * warpFlash * flicker * 0.35 });
        // Cyan split
        _pickupGfx.circle(px - 2 * warpScale, py, 14 * warpScale).fill({ color: 0x00ffff, alpha: 0.12 * globalPulse * warpFlash * flicker * 0.35 });
      }

      // Vertical energy pillar
      _pickupGfx.poly([
        px - 2.5 * warpScale, py,
        px - 1.0 * warpScale, py - pillarH * warpScale,
        px + 1.0 * warpScale, py - pillarH * warpScale,
        px + 2.5 * warpScale, py
      ], true).fill({ color: colorNum, alpha: 0.25 * globalPulse * warpFlash * flicker });

      // Ground glow halo
      _pickupGfx.circle(px, py, 16 * warpScale).fill({ color: colorNum, alpha: 0.45 * globalPulse * warpFlash * flicker * 0.35 });

      // Expanding energy pulses
      const ringPhase = ((now * 0.0025 + s.bob * 0.3) % 1);
      const ringRadius = 8 + ringPhase * 14;
      const ringAlpha = (1 - ringPhase) * 0.2 * fade * flicker;
      _pickupGfx.circle(px, py, ringRadius * warpScale).stroke({ color: colorNum, width: 1.0, alpha: ringAlpha });

      // Vector Icon shape in world space coordinates
      drawResourceIconGfx(_pickupGfx, icon, iconSize, colorNum, px, py, warpScale);

      // Text labeling inside effectLayer
      let textObj = _pickupLabels.get(s);
      if (!textObj) {
        const textStyle = new TextStyle({
          fontFamily: getUIFont(),
          fontSize: 7,
          fontWeight: "bold",
          align: "center",
          fill: colStr,
          stroke: { color: "#000000", width: 2.5 },
        });
        textObj = new Text({ text: label + qtyStr, style: textStyle });
        textObj.anchor.set(0.5, 0);
        effectLayer!.addChild(textObj);
        _pickupLabels.set(s, textObj);
      }

      // Position text card below pickup
      textObj.x = px;
      textObj.y = py + 8 * warpScale;
      textObj.alpha = (0.85 + 0.15 * Math.sin(now * 0.002 + s.bob * 2)) * fade * flicker;
    }
  }

  // Clean obsolete pickup text objects
  for (const [s, textObj] of _pickupLabels.entries()) {
    if (!activePickupRefs.has(s)) {
      effectLayer!.removeChild(textObj);
      textObj.destroy();
      _pickupLabels.delete(s);
    }
  }

  // ── 3. Sync Shockwaves ─────────────────────────────────────────────────────
  _shockwaveGfx.clear();
  if (getState().shockwaves) {
    for (const s of getState().shockwaves) {
      if (!isVisible(s.x, s.y, s.maxRadius)) continue;
      const a = s.life / Math.max(0.001, s.maxLife);
      const colNum = hexStringToNumber(s.color);

      _shockwaveGfx.circle(s.x, s.y, s.radius || 0)
        .stroke({ color: colNum, width: s.width * a, alpha: a * 0.55 });
    }
  }

  // ── 4. Sync Impact Decals ──────────────────────────────────────────────────
  _decalGfx.clear();
  if (getState().impactDecals) {
    for (const d of getState().impactDecals) {
      if (!isVisible(d.x, d.y, 30)) continue;
      const a = (d.life / d.maxLife) * 0.6;
      const colNum = hexStringToNumber(d.color);

      // Decal polygon points (drawn flat in world space coordinates)
      const flatPts: number[] = [];
      for (const pt of d.poly) {
        flatPts.push(pt[0] + d.x, pt[1] + d.y);
      }

      _decalGfx.poly(flatPts, true)
        .fill({ color: colNum, alpha: a });
    }
  }

  // ── 5. Sync Floating Text Cards ────────────────────────────────────────────
  _floatGfx.clear();
  const activeFloatRefs = new Set<FloatText>();

  if (getState().floatTexts) {
    for (const f of getState().floatTexts) {
      if (!isVisible(f.x, f.y, 20)) continue;
      activeFloatRefs.add(f);

      const alphaVal = f.life ?? 1;

      let textObj = _floatLabels.get(f);
      if (!textObj) {
        const textStyle = new TextStyle({
          fontFamily: getUIFont(),
          fontSize: 11.5,
          fontWeight: "bold",
          fill: f.color ?? "#ffffff",
          align: "center",
          stroke: f.bgColor ? undefined : { color: "#000000", width: 3.5 },
        });
        // Translucent card format
        if (f.bgColor) {
          textStyle.fill = "#000000";
        }
        textObj = new Text({ text: f.text, style: textStyle });
        textObj.anchor.set(0.5, 0.5);
        effectLayer!.addChild(textObj);
        _floatLabels.set(f, textObj);
      }

      textObj.x = f.x;
      textObj.y = f.y;
      textObj.alpha = alphaVal;

      // Draw background card roundRect on _floatGfx if card format is active
      if (f.bgColor) {
        const padX = 6;
        const padY = 3.5;
        const cardW = textObj.width + padX * 2;
        const cardH = textObj.height + padY * 2;
        const bgColNum = hexStringToNumber(f.bgColor);

        _floatGfx.roundRect(f.x - cardW / 2, f.y - cardH / 2, cardW, cardH, 3.5)
          .fill({ color: bgColNum, alpha: alphaVal * 0.9 })
          .stroke({ color: 0x000000, width: 1.0, alpha: alphaVal * 0.7 });
      }
    }
  }

  // Clean obsolete float texts
  for (const [f, textObj] of _floatLabels.entries()) {
    if (!activeFloatRefs.has(f)) {
      effectLayer!.removeChild(textObj);
      textObj.destroy();
      _floatLabels.delete(f);
    }
  }
}

export function destroyPixiEffects(): void {
  if (_wreckGfx) { _wreckGfx.destroy(); _wreckGfx = null; }
  if (_pickupGfx) { _pickupGfx.destroy(); _pickupGfx = null; }
  if (_shockwaveGfx) { _shockwaveGfx.destroy(); _shockwaveGfx = null; }
  if (_decalGfx) { _decalGfx.destroy(); _decalGfx = null; }
  if (_floatGfx) { _floatGfx.destroy(); _floatGfx = null; }

  // Clean text labels
  for (const textObj of _pickupLabels.values()) {
    effectLayer!.removeChild(textObj);
    textObj.destroy();
  }
  _pickupLabels.clear();

  for (const textObj of _floatLabels.values()) {
    effectLayer!.removeChild(textObj);
    textObj.destroy();
  }
  _floatLabels.clear();
}
