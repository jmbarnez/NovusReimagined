/**
 * Enemy sprite lifecycle management.
 */
import { TextStyle } from "pixi.js";
import { getUIFont } from "../ui-font.js";
import { Client } from "../../state.js";
import { clearEnemyTextureCaches as clearTextures } from "./bake.js";
import { _bundles, destroyPixiEntityBundles } from "./render.js";

// ─── Text styles ─────────────────────────────────────────────────────────────
// Shared name style — mutating its fontFamily updates every live enemy name/level labels.
export const _nameStyle = new TextStyle({ fontFamily: getUIFont(), fontSize: 9, fill: "#cc7777" });
export const _levelStyle = new TextStyle({ fontFamily: getUIFont(), fontSize: 9, fontWeight: "bold", fill: "#000000" });
export const _speechStyle = new TextStyle({
  fontFamily: getUIFont(),
  fontSize: 10,
  fill: "#ffffff",
  stroke: { color: "#000000", width: 2 },
  align: "center",
  wordWrap: true,
  wordWrapWidth: 180,
});

export function initPixiEntities(): void {
  // Sprites are created on demand in syncPixiEntities — nothing to do at boot.
}

/** Re-apply the active UI font to all live enemy name/level labels. */
export function refreshEntityFonts() {
  const font = getUIFont();
  const scale = Client.settings?.fontScale ?? 1.2;
  _nameStyle.fontFamily = font;
  _nameStyle.fontSize = 9 * scale;
  _levelStyle.fontFamily = font;
  _levelStyle.fontSize = 9 * scale;
  _speechStyle.fontFamily = font;
  _speechStyle.fontSize = 10 * scale;
}

/** Clear all cached enemy hull/light textures and destroy live bundles so they re-bake at the current DPR. */
export function clearEnemyTextureCachesAndBundles(): void {
  clearTextures();
  // Destroy all live bundles — they'll be recreated on next syncPixiEntities call.
  for (const id of _bundles.keys()) destroyBundle(id);
}

function destroyBundle(id: string) {
  const b = _bundles.get(id);
  if (!b) return;
  if (b.hull.parent && !b.hull.parent.destroyed) b.hull.parent.removeChild(b.hull);
  if (b.hullLight.parent && !b.hullLight.parent.destroyed) b.hullLight.parent.removeChild(b.hullLight);
  if (b.hpBar.parent && !b.hpBar.parent.destroyed) b.hpBar.parent.removeChild(b.hpBar);
  if (b.shieldBar.parent && !b.shieldBar.parent.destroyed) b.shieldBar.parent.removeChild(b.shieldBar);
  if (b.structureBar.parent && !b.structureBar.parent.destroyed) b.structureBar.parent.removeChild(b.structureBar);
  if (b.nameText.parent && !b.nameText.parent.destroyed) b.nameText.parent.removeChild(b.nameText);
  if (b.levelBg.parent && !b.levelBg.parent.destroyed) b.levelBg.parent.removeChild(b.levelBg);
  if (b.levelText.parent && !b.levelText.parent.destroyed) b.levelText.parent.removeChild(b.levelText);
  if (b.indicator.parent && !b.indicator.parent.destroyed) b.indicator.parent.removeChild(b.indicator);
  if (b.speechText.parent && !b.speechText.parent.destroyed) b.speechText.parent.removeChild(b.speechText);
  if (!b.hull.destroyed) b.hull.destroy();
  if (!b.hullLight.destroyed) b.hullLight.destroy();
  if (!b.hpBar.destroyed) b.hpBar.destroy();
  if (!b.shieldBar.destroyed) b.shieldBar.destroy();
  if (!b.structureBar.destroyed) b.structureBar.destroy();
  if (!b.nameText.destroyed) b.nameText.destroy();
  if (!b.levelBg.destroyed) b.levelBg.destroy();
  if (!b.levelText.destroyed) b.levelText.destroy();
  if (!b.indicator.destroyed) b.indicator.destroy();
  if (!b.speechText.destroyed) b.speechText.destroy();
  _bundles.delete(id);
}

export function destroyPixiEntities(): void {
  destroyPixiEntityBundles();
}
