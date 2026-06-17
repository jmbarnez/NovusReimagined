/**
 * Enemy sprite rendering and sync.
 */
import { Sprite, Graphics, Text, Texture, type ContainerChild } from "pixi.js";
import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import type { Enemy } from "../../types/enemy.js";
import type { LockSlot } from "../../types/combat.js";
import { ENEMY_DEFS } from "../../data/enemies.js";
import { entityLayer, effectLayer } from "../../pixi.js";
import { lerp } from "../../utils/math.js";
import { isVisible } from "../../utils/game.js";
import { hasCommsEquipment } from "../../player/player-stats.js";
import { getEnemyTexture, getEnemyLightTextures, lightDirIndex } from "./bake.js";
import { _nameStyle, _levelStyle, _speechStyle } from "./lifecycle.js";
import { getSunWorldPos } from "../../utils/sun-position.js";
import { getAiState } from "../../physics/npcs/ai-state.js";
import { getNpcSpeech } from "../npc-speech.js";

const TAU = Math.PI * 2;

function getLevelColor(level: number): number {
  return level <= 3 ? 0x44cc66 : level <= 6 ? 0xffcc44 : 0xff4444;
}

// ─── Per-enemy sprite bundle ──────────────────────────────────────────────────
interface EnemyBundle {
  hull: Sprite;
  hullLight: Sprite;
  lightTex: Texture[];
  hpBar: Graphics;
  shieldBar: Graphics;
  structureBar: Graphics;
  nameText: Text;
  levelBg: Graphics;
  levelText: Text;
  indicator: Graphics;
  speechText: Text;
  lastHp: number;
  lastShield: number;
  lastStructure: number;
  lastLockKey: string;
  wasLocked: boolean;
  lastTextColor: string;
  lastCardKey: string;
}

export const _bundles = new Map<string, EnemyBundle>();
const _lockMap = new Map<string, LockSlot>();
const _activeEnemyIds = new Set<string>();

function destroyDisplayObject(obj: ContainerChild): void {
  const parent = obj.parent;
  if (parent && !parent.destroyed) parent.removeChild(obj);
  if (!obj.destroyed) obj.destroy();
}

function createBundle(e: { id: string; type: string; name: string; level?: number; hp: number }): EnemyBundle {
  const hull = new Sprite(getEnemyTexture(e.type));
  hull.anchor.set(0.5);
  entityLayer!.addChild(hull);

  // Directional light overlay — sits directly above the hull, additive blend.
  const lightTex = getEnemyLightTextures(e.type);
  const hullLight = new Sprite(lightTex[0] ?? Texture.EMPTY);
  hullLight.anchor.set(0.5);
  hullLight.blendMode = "add";
  hullLight.alpha = 0.7;
  hullLight.visible = false;
  entityLayer!.addChild(hullLight);

  const hpBar = new Graphics();
  effectLayer!.addChild(hpBar);

  const shieldBar = new Graphics();
  effectLayer!.addChild(shieldBar);

  const structureBar = new Graphics();
  effectLayer!.addChild(structureBar);

  const nameText = new Text({ text: e.name, style: _nameStyle });
  nameText.anchor.set(0, 0.5);
  effectLayer!.addChild(nameText);

  const levelBg = new Graphics();
  effectLayer!.addChild(levelBg);

  const lvl = e.level ?? 1;
  const levelText = new Text({ text: String(lvl), style: _levelStyle });
  levelText.anchor.set(0.5, 0.5);
  effectLayer!.addChild(levelText);

  const indicator = new Graphics();
  effectLayer!.addChild(indicator);

  const speechText = new Text({ text: "", style: _speechStyle });
  speechText.anchor.set(0.5, 1.0);
  speechText.visible = false;
  effectLayer!.addChild(speechText);

  return { hull, hullLight, lightTex, hpBar, shieldBar, structureBar, nameText, levelBg, levelText, indicator, speechText, lastHp: e.hp, lastShield: -1, lastStructure: -1, lastLockKey: "", wasLocked: false, lastTextColor: "", lastCardKey: "" };
}

function destroyBundle(id: string) {
  const b = _bundles.get(id);
  if (!b) return;
  destroyDisplayObject(b.hull);
  destroyDisplayObject(b.hullLight);
  destroyDisplayObject(b.hpBar);
  destroyDisplayObject(b.shieldBar);
  destroyDisplayObject(b.structureBar);
  destroyDisplayObject(b.nameText);
  destroyDisplayObject(b.levelBg);
  destroyDisplayObject(b.levelText);
  destroyDisplayObject(b.indicator);
  destroyDisplayObject(b.speechText);
  _bundles.delete(id);
}

export function destroyPixiEntityBundles(): void {
  for (const id of Array.from(_bundles.keys())) {
    destroyBundle(id);
  }
  _lockMap.clear();
  _activeEnemyIds.clear();
}

function hideBundleVisuals(b: EnemyBundle): void {
  b.hull.visible = false;
  b.hullLight.visible = false;
  b.hpBar.alpha = 0;
  b.shieldBar.alpha = 0;
  b.structureBar.alpha = 0;
  b.nameText.alpha = 0;
  b.levelBg.alpha = 0;
  b.levelText.alpha = 0;
  b.indicator.alpha = 0;
  b.speechText.visible = false;
}

// ─── Health bars ───────────────────────────────────────────────────────────────
// Unified horizontal bar divided into 3 side-by-side segments (Shield, HP, Structure),
// positioned statically right below the name text.
const HP_BAR_H = 3;
const BAR_Y = -24;
const NAME_Y = -34;

function rebuildBarSegment(g: Graphics, frac: number, secIdx: number, barW: number, secW: number, gap: number, color: number) {
  const x = -barW / 2 + secIdx * (secW + gap);
  g.clear();
  g.rect(x, BAR_Y, secW, HP_BAR_H).fill({ color: 0x000000, alpha: 0.6 });
  if (frac > 0) {
    const f = Math.min(1, Math.max(0, frac));
    g.rect(x + secW * (1 - f), BAR_Y, secW * f, HP_BAR_H).fill({ color });
  }
}

// ─── Targeting indicator ──────────────────────────────────────────────────────
function rebuildIndicator(g: Graphics, color: number) {
  g.clear();
  // Small downward-pointing triangle — matches original Canvas 2D shape.
  g.poly([0, 0, -5, -6, 5, -6], true).fill({ color });
}

/**
 * Sync enemy sprites with G state. Call once per render frame after physics.
 * alpha is the render interpolation factor (0–1) between the last two ticks.
 */
export function syncPixiEntities(alpha: number, now: number): void {
  if (!entityLayer || !effectLayer) return;

  const sys = getState().GALAXY?.[getState().player?.sysIdx ?? 0];
  const liveEnemies: Enemy[] = sys?._liveEnemies ?? [];
  const lod = Client.zoom < 0.4;
  const useFixedTickInterpolation = Client.multiplayerRole === "none";
  const lightOn = !lod && Client.settings?.directionalLighting !== false;
  const sunPos = getSunWorldPos(sys);
  const sunWorldX = sunPos.x;
  const sunWorldY = sunPos.y;

  // Build lock lookup (primary + queue)
  _lockMap.clear();
  if (Array.isArray(getState().player.lockQueue)) {
    for (const slot of getState().player.lockQueue) _lockMap.set(slot.id, slot);
  }

  _activeEnemyIds.clear();

  for (const e of liveEnemies) {
    _activeEnemyIds.add(e.id);

    if (!_bundles.has(e.id)) _bundles.set(e.id, createBundle(e));
    const b = _bundles.get(e.id)!;
    const visRadius = Math.max(28, ENEMY_DEFS[e.type]?.colRadius ?? e.sigRadius ?? 18) + 24;
    if (!isVisible(e.x, e.y, visRadius)) {
      hideBundleVisuals(b);
      continue;
    }

    const ix = useFixedTickInterpolation ? lerp(e.px, e.x, alpha) : e.x;
    const iy = useFixedTickInterpolation ? lerp(e.py, e.y, alpha) : e.y;
    const ia = useFixedTickInterpolation ? lerp(e.prevAngle ?? e.angle, e.angle, alpha) : e.angle;

    // Hull
    b.hull.visible = true;
    b.hull.x = ix;
    b.hull.y = iy;
    b.hull.rotation = ia;

    // Directional light overlay — texture picked by local sun direction so the
    // lit edge tracks the system star as the hull rotates.
    if (lightOn && b.lightTex.length) {
      const sunDir = Math.atan2(sunWorldY - iy, sunWorldX - ix);
      b.hullLight.texture = b.lightTex[lightDirIndex(sunDir - ia)];
      b.hullLight.x = ix;
      b.hullLight.y = iy;
      b.hullLight.rotation = ia;
      b.hullLight.visible = true;
    } else {
      b.hullLight.visible = false;
    }

    const lockSlot = _lockMap.get(e.id);
    const isLocked = !!(lockSlot && !lockSlot.resolving);
    const frac = e.hp / Math.max(1, e.maxHp);
    const hasShield = (e.maxShield ?? 0) > 0;
    const hasStruct = (e.maxStructure ?? 0) > 0;
    const shieldFrac = hasShield ? Math.max(0, e.shield ?? 0) / (e.maxShield ?? 1) : 0;
    const structFrac = hasStruct ? Math.max(0, e.structure ?? 0) / (e.maxStructure ?? 1) : 0;
    const hpDamaged = frac < 1;
    const shieldDamaged = hasShield && (e.shield ?? 0) < (e.maxShield ?? 0);
    const structDamaged = hasStruct && (e.structure ?? 0) < (e.maxStructure ?? 0);
    const showBars = !lod && (hpDamaged || shieldDamaged || structDamaged || isLocked);
    const lockStateChanged = b.wasLocked !== isLocked;

    // Unified health bar divided into 3 side-by-side segments
    if (showBars) {
      const barW = Math.max(24, b.nameText.width);
      const gap = 1.5;
      const secW = (barW - 2 * gap) / 3;

      // Shield bar (segment 0)
      if (lockStateChanged || b.lastShield !== e.shield) {
        rebuildBarSegment(b.shieldBar, shieldFrac, 0, barW, secW, gap, 0x3399ff);
        b.lastShield = e.shield ?? 0;
      }
      b.shieldBar.x = ix; b.shieldBar.y = iy; b.shieldBar.alpha = 1;

      // HP bar (segment 1)
      if (lockStateChanged || b.lastHp !== e.hp) {
        const hpCol = frac > 0.5 ? 0xdd3333 : frac > 0.25 ? 0xbb2222 : 0xff2222;
        rebuildBarSegment(b.hpBar, frac, 1, barW, secW, gap, hpCol);
        b.lastHp = e.hp;
      }
      b.hpBar.x = ix; b.hpBar.y = iy; b.hpBar.alpha = 1;

      // Structure bar (segment 2)
      if (lockStateChanged || b.lastStructure !== e.structure) {
        rebuildBarSegment(b.structureBar, structFrac, 2, barW, secW, gap, 0xee9944);
        b.lastStructure = e.structure ?? 0;
      }
      b.structureBar.x = ix; b.structureBar.y = iy; b.structureBar.alpha = 1;
    } else {
      b.shieldBar.alpha = 0;
      b.hpBar.alpha = 0;
      b.structureBar.alpha = 0;
    }

    b.wasLocked = isLocked;

    const playerHasComms = hasCommsEquipment();

    // Labels — level badge (left) and name box (right) connected flush, centered above unified bar
    if (!lod) {
      const nameY = iy + NAME_Y;
      const padX = 4;
      const padH = 13;
      
      // Dynamic text/color styling for factions
      let textColor = "#ff4444"; // hostile red
      let tagColor = 0xcc3333; // hostile red
      let lvlStr = String(e.level ?? 1);

      if (e.faction === "neutral") {
        textColor = "#a0a5aa"; // neutral gray
        tagColor = 0x7a828a; // neutral gray
        lvlStr = "NEUT";
      } else if (e.faction === "player" || e.faction === "friendly") {
        textColor = "#3399ff"; // friendly blue
        tagColor = 0x0088ff; // friendly blue
        lvlStr = e.level ? String(e.level) : "ALLY";
      }

      if (b.lastTextColor !== textColor) {
        b.nameText.style.fill = textColor;
        b.lastTextColor = textColor;
      }
      if (b.levelText.text !== lvlStr) {
        b.levelText.text = lvlStr;
      }

      const cardW = b.levelText.width + padX * 2;
      const namePadX = 6;
      const nameBoxW = b.nameText.width + namePadX * 2;
      const totalW = cardW + nameBoxW;
      const startX = ix - totalW / 2;

      // Only rebuild card geometry when dimensions or colors change
      const cardKey = `${tagColor}|${lvlStr}|${cardW}|${nameBoxW}`;
      if (b.lastCardKey !== cardKey) {
        b.levelBg.clear()
          .roundRect(0, -padH / 2, cardW, padH, 2.5)
          .fill({ color: tagColor })
          .stroke({ color: 0x000000, width: 1 })
          .roundRect(cardW, -padH / 2, nameBoxW, padH, 2.5)
          .fill({ color: 0x000000, alpha: 0.55 })
          .stroke({ color: 0x000000, width: 1 });
        b.lastCardKey = cardKey;
      }
      b.levelBg.x = startX;
      b.levelBg.y = nameY;
      b.levelBg.alpha = 1;

      // Position level text (centered in left card)
      b.levelText.x = Math.round(startX + cardW / 2);
      b.levelText.y = Math.round(nameY);
      b.levelText.alpha = 1;

      // Position name text (left-aligned, padded inside right box)
      b.nameText.x = Math.round(startX + cardW + namePadX);
      b.nameText.y = Math.round(nameY);
      b.nameText.alpha = 1;
    } else {
      b.nameText.alpha = 0;
      b.levelBg.alpha = 0;
      b.levelText.alpha = 0;
    }

    // Dialogue/Speech bubble display
    const speech = getNpcSpeech(e.id);
    if (speech && now < speech.until) {
      b.speechText.text = speech.text;
      b.speechText.x = Math.round(ix);
      b.speechText.y = Math.round(iy - 50);
      b.speechText.alpha = 1;
      b.speechText.visible = true;
    } else {
      b.speechText.visible = false;
    }

    // Targeting or hailing indicator (triangle or cyan pulsing ! above enemy)
    if (!lod && e.faction === "neutral" && e.hailable && playerHasComms) {
      const key = "hailable";
      if (b.lastLockKey !== key) {
        b.indicator.clear();
        b.indicator.rect(-1.5, -15, 3, 7).fill({ color: 0x00ffd0 });
        b.indicator.circle(0, -4, 1.8).fill({ color: 0x00ffd0 });
        b.lastLockKey = key;
      }
      b.indicator.x = ix; b.indicator.y = iy - 40;
      b.indicator.alpha = 0.5 + Math.sin(now / 150) * 0.4;
    } else if (!lod) {
      const ai = getAiState(e.id);
      if (ai.hasLockOnPlayer) {
        const key = "locked";
        if (b.lastLockKey !== key) { rebuildIndicator(b.indicator, 0xff4444); b.lastLockKey = key; }
        b.indicator.x = ix; b.indicator.y = iy - 40; b.indicator.alpha = 1;
      } else if (ai.targetingPlayer && ai.lockOnTimer > 0) {
        const key = "targeting";
        if (b.lastLockKey !== key) { rebuildIndicator(b.indicator, 0xffcc44); b.lastLockKey = key; }
        b.indicator.x = ix; b.indicator.y = iy - 40;
        b.indicator.alpha = Math.floor(now / 200) % 2 === 0 ? 1 : 0;
      } else {
        if (b.lastLockKey !== "none") { b.indicator.clear(); b.lastLockKey = "none"; }
      }
    } else {
      if (b.lastLockKey !== "none") { b.indicator.clear(); b.lastLockKey = "none"; }
      b.indicator.alpha = 0;
    }
  }

  // Destroy sprites for enemies no longer alive
  for (const id of _bundles.keys()) {
    if (!_activeEnemyIds.has(id)) destroyBundle(id);
  }
}
