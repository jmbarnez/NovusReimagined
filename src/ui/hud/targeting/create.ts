import { sfxBlip } from "../../../audio/procedural.js";
import { queueFrameAction } from "../../../sim/input.js";
import { createElement, append, setText, onClick } from "../../dom-helpers.js";
import { hudState } from "../state.js";
import type { LockCard } from "./types.js";

export function createLockCard(id: string): LockCard {
  const el = createElement("div", "lock-card");
  el.dataset.id = id;

  // 1. Hologram Viewport on the left
  const holoViewport = createElement("div", "lc-hologram-viewport");

  const canvas = createElement("canvas", "lc-canvas") as HTMLCanvasElement;
  canvas.width = 48;
  canvas.height = 48;
  append(holoViewport, canvas);

  const holoGrid = createElement("div", "lc-hologram-grid");
  append(holoViewport, holoGrid);

  append(el, holoViewport);

  // 2. Content Area on the right
  const contentArea = createElement("div", "lc-content-area");

  // Header row inside content area
  const header = createElement("div", "lc-header");

  const level = createElement("div", "lc-level");
  append(header, level);

  const name = createElement("div", "lc-name");
  append(header, name);

  const targetInd = createElement("div", "lc-target");
  append(header, targetInd);

  append(contentArea, header);

  // Body inside content area
  const body = createElement("div", "lc-body");

  // Telemetry row (visible when resolved)
  const telemetry = createElement("div", "lc-telemetry");

  const spdMetric = createElement("div", "lc-metric");
  append(telemetry, spdMetric);

  const distMetric = createElement("div", "lc-metric");
  append(telemetry, distMetric);

  const sigMetric = createElement("div", "lc-metric");
  append(telemetry, sigMetric);

  const trsMetric = createElement("div", "lc-metric");
  append(telemetry, trsMetric);

  append(body, telemetry);

  // Telemetry details / backup labels
  const meta = createElement("div", "lc-meta");
  append(body, meta);

  // Scan progress (resolving state)
  const scan = createElement("div", "lc-scan");
  append(body, scan);

  append(contentArea, body);
  append(el, contentArea);

  // 3. Health bars (visible when resolved, spanning full bottom)
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

  append(el, bars);

  // 4. Badges / overlays (absolute positioned over base container)
  const assign = createElement("div", "lc-assign");
  append(el, assign);

  const close = createElement("div", "lc-close");
  setText(close, "×");
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
    telemetryEl: telemetry,
    spdMetric,
    distMetric,
    sigMetric,
    trsMetric,
    metaEl: meta,
    scanEl: scan,
    assignEl: assign,
  };
}
