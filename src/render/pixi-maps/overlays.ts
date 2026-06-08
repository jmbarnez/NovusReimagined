import { getState } from "../../state-access.js";
import { curSys } from "../../utils/game.js";
import {
  computeSystemMapTransform,
  worldToMapScreen,
  drawMapSurveyOverlay,
  drawPassiveRadarOverlay,
} from "../../ui/map-survey.js";
import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { drawTutorialTracksOnMap } from "../pixi-tutorial-track.js";
import { pixiMapState } from "./state.js";
import { lastMapTransform } from "./render.js";

export function drawPixiSystemMapCanvasOverlays(Wc: number, Hc: number, now: number): void {
  const player = getState().player;
  const sys = curSys();
  const mapTransform = lastMapTransform ?? computeSystemMapTransform(Wc, Hc);
  if (!player || !sys || !mapTransform || !pixiMapState.overlayGfx) return;

  pixiMapState.overlayGfx.clear();
  const navStep = player.tutorial?.active ? getCurrentTutorialStep(player) : null;
  if (navStep?.nav?.trackId) {
    drawTutorialTracksOnMap(pixiMapState.overlayGfx, (wx, wy) => worldToMapScreen(wx, wy, mapTransform), navStep.nav.trackId);
  }
  drawPassiveRadarOverlay(mapTransform, now, pixiMapState.overlayGfx);
  drawMapSurveyOverlay(mapTransform, now, pixiMapState.overlayGfx);
}
