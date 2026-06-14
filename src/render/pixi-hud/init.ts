import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { hudOverlayLayer } from "../../pixi.js";
import { getUIFont } from "../ui-font.js";
import { hudState } from "./state.js";

function isHudContainerAttachedToCurrentLayer(): boolean {
  return !!hudOverlayLayer
    && !!hudState.hudContainer
    && !hudState.hudContainer.destroyed
    && hudState.hudContainer.parent === hudOverlayLayer;
}

function resetPixiHudFrameCache(): void {
  hudState.lastZoom = Number.NaN;
  hudState.lastPlayerAngle = Number.NaN;
  hudState.lastIsCritical = false;
  hudState.lastBoostFx = false;
  hudState.lastBoostPulse = -1;
  hudState.lastSpdPct = -1;
  hudState.lastShieldFrac = -1;
  hudState.lastDriftAngle = Number.NaN;
  hudState.lastDriftSpeed = -1;
  hudState.lastDriftVisible = false;
}

function destroyStaleHudContainer(): void {
  if (!hudState.hudContainer) return;
  const parent = hudState.hudContainer.parent;
  if (parent && !parent.destroyed) parent.removeChild(hudState.hudContainer);
  if (!hudState.hudContainer.destroyed) {
    hudState.hudContainer.destroy({ children: true });
  }
}

export function initPixiHUD(): void {
  if (!hudOverlayLayer) return;
  if (isHudContainerAttachedToCurrentLayer()) return;
  destroyStaleHudContainer();
  resetPixiHudFrameCache();

  hudState.hudContainer = new Container();
  hudState.hudContainer.label = "hud-core";
  hudOverlayLayer.addChild(hudState.hudContainer);

  hudState.horizonLine = new Graphics();
  hudState.hudContainer.addChild(hudState.horizonLine);

  hudState.speedArcBg = new Graphics();
  hudState.hudContainer.addChild(hudState.speedArcBg);

  hudState.speedArcFill = new Graphics();
  hudState.hudContainer.addChild(hudState.speedArcFill);

  hudState.shieldArcBg = new Graphics();
  hudState.hudContainer.addChild(hudState.shieldArcBg);

  hudState.shieldArcFill = new Graphics();
  hudState.hudContainer.addChild(hudState.shieldArcFill);

  hudState.driftVectors = new Graphics();
  hudState.hudContainer.addChild(hudState.driftVectors);

  const font = getUIFont();
  hudState.speedStyle = new TextStyle({
    fontFamily: font,
    fontSize: 8,
    fill: "#ffffff",
  });
  hudState.shieldStyle = new TextStyle({
    fontFamily: font,
    fontSize: 8,
    fill: "#ffffff",
  });
  hudState.warningStyle = new TextStyle({
    fontFamily: font,
    fontSize: 9,
    fontWeight: "bold",
    fill: "#ff4444",
  });
  hudState.targetStyle = new TextStyle({
    fontFamily: font,
    fontSize: 9,
    fill: "#ffffff",
  });

  hudState.speedLabel = new Text({ text: "", style: hudState.speedStyle });
  hudState.speedLabel.anchor.set(1, 0.5);
  hudState.hudContainer.addChild(hudState.speedLabel);

  hudState.shieldLabel = new Text({ text: "", style: hudState.shieldStyle });
  hudState.shieldLabel.anchor.set(0, 0.5);
  hudState.hudContainer.addChild(hudState.shieldLabel);

  hudState.warningBanner = new Text({ text: "", style: hudState.warningStyle });
  hudState.warningBanner.anchor.set(0.5, 0.5);
  hudState.warningBanner.visible = false;
  hudState.hudContainer.addChild(hudState.warningBanner);

  hudState.targetLabel = new Text({ text: "", style: hudState.targetStyle });
  hudState.targetLabel.anchor.set(0, 0.5);
  hudState.targetLabel.visible = false;
  hudState.hudContainer.addChild(hudState.targetLabel);
}

export function ensurePixiHUDReady(): boolean {
  if (!isHudContainerAttachedToCurrentLayer()) initPixiHUD();
  return isHudContainerAttachedToCurrentLayer();
}
