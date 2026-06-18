import { sfxBlip } from "../../../audio/procedural.js";
import { queueFrameAction } from "../../../sim/input.js";
import { createElement, append, setText, onClick } from "../../dom-helpers.js";
import { hudState } from "../state.js";
import type { LockCard } from "./types.js";

export function createLockCard(id: string): LockCard {
  const el = createElement("div", "lock-card");
  el.dataset.id = id;

  // 1. Hologram Viewport on the left (clean, no grid)
  const holoViewport = createElement("div", "lc-hologram-viewport");

  const canvas = createElement("canvas", "lc-canvas") as HTMLCanvasElement;
  canvas.width = 56;
  canvas.height = 56;
  append(holoViewport, canvas);

  append(el, holoViewport);

  // 2. Content Area on the right
  const contentArea = createElement("div", "lc-content-area");

  // Header: level + name
  const header = createElement("div", "lc-header");

  const name = createElement("div", "lc-name");
  append(header, name);

  const level = createElement("div", "lc-level");
  append(header, level);

  const targetInd = createElement("div", "lc-target");
  append(header, targetInd);

  append(contentArea, header);

  // Info row: distance + class label
  const infoRow = createElement("div", "lc-info-row");

  const distEl = createElement("div", "lc-dist");
  append(infoRow, distEl);

  const metaEl = createElement("div", "lc-meta-inline");
  append(infoRow, metaEl);

  append(contentArea, infoRow);

  // Scan overlay (shown while resolving)
  const scanEl = createElement("div", "lc-scan");
  append(contentArea, scanEl);

  append(el, contentArea);

  // Orphan elements kept for type compatibility (old telemetry grid)
  const _spdMetric = createElement("div", "lc-metric");
  const _sigMetric = createElement("div", "lc-metric");
  const _trsMetric = createElement("div", "lc-metric");

  // 3. Health bars (flex child of content-area, not absolute)
  const bars = createElement("div", "lc-bars");

  // Shield bar
  const shieldBar = createElement("div", "lc-bar shield");
  const shieldInner = createElement("span");
  const shieldLabel = createElement("div", "lc-bar-label");
  append(shieldBar, shieldInner);
  append(shieldBar, shieldLabel);
  append(bars, shieldBar);

  // Hull (HP) bar
  const hpBar = createElement("div", "lc-bar hp");
  const hpInner = createElement("span");
  const hpLabel = createElement("div", "lc-bar-label");
  append(hpBar, hpInner);
  append(hpBar, hpLabel);
  append(bars, hpBar);

  // Structure bar
  const structBar = createElement("div", "lc-bar struct");
  const structInner = createElement("span");
  const structLabel = createElement("div", "lc-bar-label");
  append(structBar, structInner);
  append(structBar, structLabel);
  append(bars, structBar);

  append(contentArea, bars);

  // 4. Badges / overlays (absolute positioned over base container)
  const assign = createElement("div", "lc-assign");
  append(el, assign);

  const close = createElement("div", "lc-close");
  setText(close, "\u00D7");
  onClick(close, (e) => {
    (e as MouseEvent).stopPropagation();
    sfxBlip();
    queueFrameAction({ type: "removeSensorLock", payload: { id } });
  });
  append(el, close);

  onClick(el, () => {
    sfxBlip();
    queueFrameAction({ type: "selectLockTarget", payload: { id } });
  });

  append(hudState.lockRail!, el);
  return {
    el,
    headerEl: header,
    iconEl: canvas,
    canvasEl: canvas,
    nameEl: name,
    levelEl: level,
    targetIndEl: targetInd,
    barsEl: bars,
    shieldInner,
    shieldLabel,
    hpInner,
    hpLabel,
    structInner,
    structLabel,
    telemetryEl: infoRow,
    spdMetric: _spdMetric,
    distMetric: distEl,
    sigMetric: _sigMetric,
    trsMetric: _trsMetric,
    metaEl,
    scanEl,
    assignEl: assign,
  };
}
