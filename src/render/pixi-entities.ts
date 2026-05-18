/**
 * PixiJS entity renderer — Phase 3.
 *
 * Migrates enemies from Canvas 2D to PixiJS Sprites. Each enemy type's hull
 * (polygon + panel lines + lights) is rasterised to a Canvas 2D HTMLCanvasElement
 * once at first use and uploaded to the GPU as a PixiJS Texture. All live enemies
 * that share a type share that one texture — the WebGL batch renderer then issues
 * a single draw call for every enemy of the same type.
 *
 * What this eliminates per frame:
 *   - 4× enemyPath() canvas-path rebuilds per enemy
 *   - 1× createLinearGradient (directional lighting) per enemy
 *   - All enemy ctx.save/restore/translate/rotate overhead
 *
 * What remains in Canvas 2D (drawEnemyOverlays):
 *   - Lock brackets (resolving ring + corner brackets + PRIM label)
 *
 * Per-enemy directional lighting is restored via a set of pre-baked sun-angle
 * "light map" textures (hull silhouette filled with a directional gradient) —
 * the live enemy picks the texture nearest its local sun direction each frame,
 * so the lit edge tracks the system star without any per-frame gradient work.
 *
 * Player and asteroids are deferred to Phase 4 — both require dynamic
 * per-frame gradients (thrust flames, HP-dependent asteroid fill) that need
 * a different approach.
 */
import { ImageSource, Sprite, Graphics, Text, TextStyle, Texture } from "pixi.js";
import { G, Client } from "../state.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { entityLayer, effectLayer, pixiDpr } from "../pixi.js";
import { lerp } from "../utils/math.js";

const TAU = Math.PI * 2;
/** Supersampling multiplier — baked canvas physical pixels per logical texel. */
const TEX_SCALE = 3;

// ─── Texture baking ──────────────────────────────────────────────────────────
// 192×192 canvas with the enemy centered at (96, 96).  Large enough for the
// biggest enemy type; smaller types are centred in blank space (no cost).
const TEX_SIZE = 192;
const TEX_HALF = TEX_SIZE / 2;

// ─── Colour helpers ─────────────────────────────────────────────────────────
function lightenCol(col: string, amt: number): string {
  const m = col.match(/rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)/);
  if (!m) return col;
  const r = Math.min(255, parseInt(m[1]) + amt);
  const g = Math.min(255, parseInt(m[2]) + amt);
  const b = Math.min(255, parseInt(m[3]) + amt);
  const a = m[4] ?? "1";
  return `rgba(${r},${g},${b},${a})`;
}
function darkenCol(col: string, amt: number): string {
  const m = col.match(/rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)/);
  if (!m) return col;
  const r = Math.max(0, parseInt(m[1]) - amt);
  const g = Math.max(0, parseInt(m[2]) - amt);
  const b = Math.max(0, parseInt(m[3]) - amt);
  const a = m[4] ?? "1";
  return `rgba(${r},${g},${b},${a})`;
}

const _texCache = new Map<string, Texture>();

function bakeEnemyTexture(type: string): Texture {
  const def = ENEMY_DEFS[type];
  const cfg = def?.render;
  if (!cfg) return Texture.EMPTY;

  const dpr = pixiDpr;
  const c = document.createElement("canvas");
  c.width = c.height = TEX_SIZE * TEX_SCALE * dpr;
  const cx = c.getContext("2d")!;
  cx.scale(TEX_SCALE * dpr, TEX_SCALE * dpr);

  // Build the hull path at (HALF, HALF) in canvas coords.
  function buildHullPath() {
    cx.beginPath();
    for (let i = 0; i < cfg.path.length; i++) {
      const [px, py] = cfg.path[i];
      i === 0 ? cx.moveTo(TEX_HALF + px, TEX_HALF + py) : cx.lineTo(TEX_HALF + px, TEX_HALF + py);
    }
    cx.closePath();
  }

  // 1. Thick depth outline
  buildHullPath();
  cx.lineJoin = "round";
  cx.strokeStyle = "rgba(0,0,0,0.92)";
  cx.lineWidth = 3.8;
  cx.stroke();

  // 2. Cel-shaded fill (hard color bands for true cel-shaded look)
  buildHullPath();
  const baseCol = cfg.fill;
  const hullGrad = cx.createLinearGradient(TEX_HALF, TEX_HALF - 30, TEX_HALF, TEX_HALF + 30);
  
  // Flat highlight
  hullGrad.addColorStop(0.0, lightenCol(baseCol, 15));
  hullGrad.addColorStop(0.3, lightenCol(baseCol, 15));
  
  // Flat midtone
  hullGrad.addColorStop(0.31, baseCol);
  hullGrad.addColorStop(0.7, baseCol);
  
  // Flat shadow
  hullGrad.addColorStop(0.71, darkenCol(baseCol, 20));
  hullGrad.addColorStop(1.0, darkenCol(baseCol, 20));
  
  cx.fillStyle = hullGrad;
  cx.fill();

  // 3. Specular sheen + ambient occlusion (clipped to hull)
  cx.save();
  buildHullPath();
  cx.clip();
  const spec = cx.createRadialGradient(TEX_HALF + 6, TEX_HALF - 16, 0, TEX_HALF + 6, TEX_HALF - 16, 42);
  spec.addColorStop(0, "rgba(255,255,255,0.22)");
  spec.addColorStop(0.55, "rgba(255,255,255,0.07)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = spec;
  cx.fillRect(TEX_HALF - 50, TEX_HALF - 50, 100, 100);
  const ao = cx.createLinearGradient(TEX_HALF, TEX_HALF + 5, TEX_HALF, TEX_HALF + 35);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(0,0,0,0.35)");
  cx.fillStyle = ao;
  cx.fillRect(TEX_HALF - 50, TEX_HALF - 50, 100, 100);
  cx.restore();

  // 4. Coloured edge stroke (rim)
  buildHullPath();
  cx.strokeStyle = cfg.stroke;
  cx.lineWidth = 1.6;
  cx.lineJoin = "round";
  cx.stroke();

  // 5. Bold panel lines for distinct cel-shaded parts
  for (const line of cfg.panelLines ?? []) {
    cx.beginPath();
    for (let i = 0; i < line.length; i++) {
      const [px, py] = line[i];
      i === 0 ? cx.moveTo(TEX_HALF + px, TEX_HALF + py) : cx.lineTo(TEX_HALF + px, TEX_HALF + py);
    }
    cx.strokeStyle = "rgba(0,0,0,0.85)";
    cx.lineWidth = 2.5;
    cx.lineJoin = "round";
    cx.lineCap = "round";
    cx.stroke();
  }

  // 6. Lights with soft halos
  for (const l of cfg.lights ?? []) {
    const lx = TEX_HALF + l.x, ly = TEX_HALF + l.y;
    const lr = l.r ?? 1.2;
    const col = l.color ?? "rgba(200,200,255,0.5)";
    const halo = cx.createRadialGradient(lx, ly, 0, lx, ly, lr * 4);
    halo.addColorStop(0, col.replace(/[\d.]+\)$/, "0.35)"));
    halo.addColorStop(1, col.replace(/[\d.]+\)$/, "0)"));
    cx.fillStyle = halo;
    cx.beginPath(); cx.arc(lx, ly, lr * 4, 0, TAU); cx.fill();
    cx.beginPath();
    cx.arc(lx, ly, lr, 0, TAU);
    cx.fillStyle = col;
    cx.fill();
  }

  // 7. Type-specific decorations
  if (type === "drone") {
    cx.beginPath();
    cx.arc(TEX_HALF, TEX_HALF, 5, 0, TAU);
    cx.fillStyle = "#ffaa22";
    cx.fill();
  } else if (type === "raider") {
    cx.fillStyle = "#cc3333";
    cx.fillRect(TEX_HALF + 12, TEX_HALF - 14, 8, 4);
    cx.fillRect(TEX_HALF + 12, TEX_HALF + 10, 8, 4);
  }

  const mipmapping = Client.settings?.mipmapping ?? true;
  return new Texture({ source: new ImageSource({ resource: c, resolution: TEX_SCALE * dpr, scaleMode: 'linear', autoGenerateMipmaps: mipmapping }) });
}

function getEnemyTexture(type: string): Texture {
  let tex = _texCache.get(type);
  if (!tex) { tex = bakeEnemyTexture(type); _texCache.set(type, tex); }
  return tex;
}

// ─── Directional light maps ──────────────────────────────────────────────────
// LIGHT_DIRS hull-clipped textures per type, each lit from a different angle.
// At render time the enemy selects the texture nearest its local sun direction
// (sys.sunDir − entityRotation) and renders it additively over the hull.
const LIGHT_DIRS = 8;
const LIGHT_RGB = "255,248,230";
const _lightTexCache = new Map<string, Texture[]>();

function bakeEnemyLightTextures(type: string): Texture[] {
  const def = ENEMY_DEFS[type];
  const cfg = def?.render;
  if (!cfg) return [];
  const dpr = pixiDpr;
  const out: Texture[] = [];

  for (let d = 0; d < LIGHT_DIRS; d++) {
    const a = (d / LIGHT_DIRS) * TAU;
    const c = document.createElement("canvas");
    c.width = c.height = TEX_SIZE * TEX_SCALE * dpr;
    const cx = c.getContext("2d")!;
    cx.scale(TEX_SCALE * dpr, TEX_SCALE * dpr);

    cx.beginPath();
    for (let i = 0; i < cfg.path.length; i++) {
      const [px, py] = cfg.path[i];
      i === 0 ? cx.moveTo(TEX_HALF + px, TEX_HALF + py) : cx.lineTo(TEX_HALF + px, TEX_HALF + py);
    }
    cx.closePath();
    cx.clip();

    const ex = Math.cos(a) * TEX_HALF, ey = Math.sin(a) * TEX_HALF;
    const g = cx.createLinearGradient(TEX_HALF - ex, TEX_HALF - ey, TEX_HALF + ex, TEX_HALF + ey);
    g.addColorStop(0.00, `rgba(${LIGHT_RGB},0)`);
    g.addColorStop(0.50, `rgba(${LIGHT_RGB},0)`);
    g.addColorStop(0.82, `rgba(${LIGHT_RGB},0.45)`);
    g.addColorStop(1.00, `rgba(${LIGHT_RGB},0.9)`);
    cx.fillStyle = g;
    cx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const mipmapping = Client.settings?.mipmapping ?? true;
    out.push(new Texture({ source: new ImageSource({ resource: c, resolution: TEX_SCALE * dpr, scaleMode: 'linear', autoGenerateMipmaps: mipmapping }) }));
  }
  return out;
}

function getEnemyLightTextures(type: string): Texture[] {
  let t = _lightTexCache.get(type);
  if (!t) { t = bakeEnemyLightTextures(type); _lightTexCache.set(type, t); }
  return t;
}

/** Pick the light-map index whose baked direction is nearest `localSunAngle`. */
export function lightDirIndex(localSunAngle: number): number {
  let di = Math.round((localSunAngle / TAU) * LIGHT_DIRS) % LIGHT_DIRS;
  if (di < 0) di += LIGHT_DIRS;
  return di;
}

// ─── Text styles ─────────────────────────────────────────────────────────────
const _nameStyle = new TextStyle({ fontFamily: "monospace", fontSize: 9, fill: "#cc7777" });

function makeLevelStyle(level: number): TextStyle {
  const fill = level <= 3 ? "#44cc66" : level <= 6 ? "#ffcc44" : "#ff4444";
  return new TextStyle({ fontFamily: "monospace", fontSize: 9, fill });
}

// ─── Per-enemy sprite bundle ──────────────────────────────────────────────────
interface EnemyBundle {
  hull: Sprite;
  hullLight: Sprite;
  lightTex: Texture[];
  hpBar: Graphics;
  nameText: Text;
  levelText: Text;
  indicator: Graphics;
  lastHp: number;
  lastLockKey: string;
}

const _bundles = new Map<string, EnemyBundle>();

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

  const nameText = new Text({ text: e.name, style: _nameStyle });
  nameText.anchor.set(0, 1);
  effectLayer!.addChild(nameText);

  const lvl = e.level ?? 1;
  const levelText = new Text({ text: `Lv.${lvl}`, style: makeLevelStyle(lvl) });
  levelText.anchor.set(0, 1);
  effectLayer!.addChild(levelText);

  const indicator = new Graphics();
  effectLayer!.addChild(indicator);

  return { hull, hullLight, lightTex, hpBar, nameText, levelText, indicator, lastHp: e.hp, lastLockKey: "" };
}

function destroyBundle(id: string) {
  const b = _bundles.get(id);
  if (!b) return;
  entityLayer!.removeChild(b.hull);   b.hull.destroy();
  entityLayer!.removeChild(b.hullLight); b.hullLight.destroy();
  effectLayer!.removeChild(b.hpBar);  b.hpBar.destroy();
  effectLayer!.removeChild(b.nameText); b.nameText.destroy();
  effectLayer!.removeChild(b.levelText); b.levelText.destroy();
  effectLayer!.removeChild(b.indicator); b.indicator.destroy();
  _bundles.delete(id);
}

// ─── HP bar ───────────────────────────────────────────────────────────────────
const HP_BAR_W = 36;
const HP_BAR_H = 5;

function rebuildHpBar(g: Graphics, frac: number) {
  g.clear();
  g.rect(-HP_BAR_W / 2, -30, HP_BAR_W, HP_BAR_H).fill({ color: 0x000000, alpha: 0.6 });
  const col = frac > 0.5 ? 0xdd3333 : frac > 0.25 ? 0xff8822 : 0xff2222;
  g.rect(-HP_BAR_W / 2, -30, HP_BAR_W * frac, HP_BAR_H).fill({ color: col });
}

// ─── Targeting indicator ──────────────────────────────────────────────────────
function rebuildIndicator(g: Graphics, color: number) {
  g.clear();
  // Small downward-pointing triangle — matches original Canvas 2D shape.
  g.poly([0, 0, -5, -6, 5, -6], true).fill({ color });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initPixiEntities(): void {
  // Sprites are created on demand in syncPixiEntities — nothing to do at boot.
}

/** Clear all cached enemy hull/light textures and destroy live bundles so they re-bake at the current DPR. */
export function clearEnemyTextureCaches(): void {
  for (const t of _texCache.values()) t.destroy();
  _texCache.clear();
  for (const arr of _lightTexCache.values()) {
    for (const t of arr) t.destroy();
  }
  _lightTexCache.clear();
  // Destroy all live bundles — they'll be recreated on next syncPixiEntities call.
  for (const id of _bundles.keys()) destroyBundle(id);
}

/**
 * Sync enemy sprites with G state. Call once per render frame after physics.
 * alpha is the render interpolation factor (0–1) between the last two ticks.
 */
export function syncPixiEntities(alpha: number, now: number): void {
  if (!entityLayer || !effectLayer) return;

  const sys = G.GALAXY?.[G.P?.sysIdx ?? 0];
  const liveEnemies: any[] = sys?._liveEnemies ?? [];
  const lod = Client.zoom < 0.4;
  const sunDir = sys?.sunDir ?? 0;
  const lightOn = !lod && Client.settings?.directionalLighting !== false;

  // Build lock lookup (primary + queue)
  const lockMap = new Map<string, any>();
  const primaryId = G.P.targetLock?.id;
  if (Array.isArray(G.P.lockQueue)) {
    for (const slot of G.P.lockQueue) lockMap.set(slot.id, slot);
  }

  const activeIds = new Set<string>();

  for (const e of liveEnemies) {
    activeIds.add(e.id);

    if (!_bundles.has(e.id)) _bundles.set(e.id, createBundle(e));
    const b = _bundles.get(e.id)!;

    const ix = lerp(e.px, e.x, alpha);
    const iy = lerp(e.py, e.y, alpha);
    const ia = lerp(e.prevAngle ?? e.angle, e.angle, alpha);

    // Hull
    b.hull.x = ix;
    b.hull.y = iy;
    b.hull.rotation = ia;

    // Directional light overlay — texture picked by local sun direction so the
    // lit edge tracks the system star as the hull rotates.
    if (lightOn && b.lightTex.length) {
      b.hullLight.texture = b.lightTex[lightDirIndex(sunDir - ia)];
      b.hullLight.x = ix;
      b.hullLight.y = iy;
      b.hullLight.rotation = ia;
      b.hullLight.visible = true;
    } else {
      b.hullLight.visible = false;
    }

    const lockSlot = lockMap.get(e.id);
    const hasLock = !!(lockSlot && !lockSlot.resolving);
    const frac = e.hp / Math.max(1, e.maxHp);

    // HP bar — only when fully locked and not full HP
    if (!lod && hasLock && frac < 1) {
      if (b.lastHp !== e.hp) { rebuildHpBar(b.hpBar, frac); b.lastHp = e.hp; }
      b.hpBar.x = ix; b.hpBar.y = iy; b.hpBar.alpha = 1;
    } else {
      b.hpBar.alpha = 0;
    }

    // Labels — name + level side-by-side, centred above enemy
    if (!lod) {
      const nameY = hasLock && frac < 1 ? iy - 33 : iy - 28;
      const totalW = b.nameText.width + 5 + b.levelText.width;
      const startX = ix - totalW / 2;
      b.nameText.x = startX;          b.nameText.y = nameY; b.nameText.alpha = 1;
      b.levelText.x = startX + b.nameText.width + 5; b.levelText.y = nameY; b.levelText.alpha = 1;
    } else {
      b.nameText.alpha = 0; b.levelText.alpha = 0;
    }

    // Targeting indicator (triangle above enemy)
    if (!lod && e.hasLockOnPlayer) {
      const key = "locked";
      if (b.lastLockKey !== key) { rebuildIndicator(b.indicator, 0xff4444); b.lastLockKey = key; }
      b.indicator.x = ix; b.indicator.y = iy - 40; b.indicator.alpha = 1;
    } else if (!lod && e.targetingPlayer && e.lockOnTimer > 0) {
      const key = "targeting";
      if (b.lastLockKey !== key) { rebuildIndicator(b.indicator, 0xffcc44); b.lastLockKey = key; }
      b.indicator.x = ix; b.indicator.y = iy - 40;
      b.indicator.alpha = Math.floor(now / 200) % 2 === 0 ? 1 : 0;
    } else {
      if (b.lastLockKey !== "none") { b.indicator.clear(); b.lastLockKey = "none"; }
      b.indicator.alpha = 0;
    }
  }

  // Destroy sprites for enemies no longer alive
  for (const id of _bundles.keys()) {
    if (!activeIds.has(id)) destroyBundle(id);
  }
}
