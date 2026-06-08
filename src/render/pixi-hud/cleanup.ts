import { hudOverlayLayer } from "../../pixi.js";
import { hudState } from "./state.js";

export function destroyPixiHUD(): void {
  if (!hudState.hudContainer) return;

  if (hudState.horizonLine) { hudState.horizonLine.destroy(); hudState.horizonLine = null; }
  if (hudState.speedArcBg) { hudState.speedArcBg.destroy(); hudState.speedArcBg = null; }
  if (hudState.speedArcFill) { hudState.speedArcFill.destroy(); hudState.speedArcFill = null; }
  if (hudState.shieldArcBg) { hudState.shieldArcBg.destroy(); hudState.shieldArcBg = null; }
  if (hudState.shieldArcFill) { hudState.shieldArcFill.destroy(); hudState.shieldArcFill = null; }
  if (hudState.driftVectors) { hudState.driftVectors.destroy(); hudState.driftVectors = null; }
  if (hudState.warningBanner) { hudState.warningBanner.destroy(); hudState.warningBanner = null; }
  if (hudState.targetLabel) { hudState.targetLabel.destroy(); hudState.targetLabel = null; }
  if (hudState.speedLabel) { hudState.speedLabel.destroy(); hudState.speedLabel = null; }
  if (hudState.shieldLabel) { hudState.shieldLabel.destroy(); hudState.shieldLabel = null; }

  hudOverlayLayer?.removeChild(hudState.hudContainer);
  hudState.hudContainer.destroy();
  hudState.hudContainer = null;
}
