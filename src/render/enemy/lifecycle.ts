/**
 * Enemy sprite lifecycle management.
 */
import { TextStyle } from "pixi.js";
import { getUIFont } from "../ui-font.js";
import { Client } from "../../state.js";
import { clearEnemyTextureCaches as clearTextures } from "./bake.js";
import { entityLayer, effectLayer } from "../../pixi.js";
import { _bundles } from "./render.js";

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
  const scale = Client.settings?.fontScale ?? 1.0;
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
  entityLayer!.removeChild(b.hull);   b.hull.destroy();
  entityLayer!.removeChild(b.hullLight); b.hullLight.destroy();
  effectLayer!.removeChild(b.hpBar);  b.hpBar.destroy();
  effectLayer!.removeChild(b.shieldBar); b.shieldBar.destroy();
  effectLayer!.removeChild(b.structureBar); b.structureBar.destroy();
  effectLayer!.removeChild(b.nameText); b.nameText.destroy();
  effectLayer!.removeChild(b.levelBg); b.levelBg.destroy();
  effectLayer!.removeChild(b.levelText); b.levelText.destroy();
  effectLayer!.removeChild(b.indicator); b.indicator.destroy();
  effectLayer!.removeChild(b.speechText); b.speechText.destroy();
  _bundles.delete(id);
}
