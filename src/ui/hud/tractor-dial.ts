import { getState } from "../../state-access.js";
import { MODULES, MODULE_FLAGS, type ModuleDef } from "../../data/modules.js";
import { getInstance } from "../../utils/items.js";
import { hudState } from "./state.js";
import { sfxBlip } from "../../audio/procedural.js";
import { queueFrameAction } from "../../sim/input.js";
import { getElement, createElement, append, setHtml, setStyle, setPosition, onWheel, onMouseDown, onDocumentMouseMove, onDocumentMouseUp } from "../dom-helpers.js";

const DIAL_EL_ID = "tractor-dial";
let _isDragging = false;
let _startY = 0;
let _startVal = 0;
let _removeDragMove: (() => void) | null = null;
let _removeDragUp: (() => void) | null = null;

function queueTractorTightness(value: number): void {
  queueFrameAction({ type: "setTractorTightness", payload: { value } }, { replaceByType: true });
}

function getDialEl(): HTMLElement {
  let el = getElement(DIAL_EL_ID);
  if (!el) {
    el = createElement("div", "hud-glass-panel");
    el.id = DIAL_EL_ID;
    setStyle(el, { display: "none", position: "absolute", zIndex: "10" });
    const overlay = getElement("hud-overlay");
    if (overlay) append(overlay, el);

    // Mouse wheel listener
    onWheel(el, (e) => {
      const ev = e as WheelEvent;
      ev.preventDefault();
      ev.stopPropagation();
      const current = getState().player.tractorTightness ?? 0.5;
      const dir = ev.deltaY < 0 ? 1 : -1;
      const next = Math.max(0, Math.min(1, current + dir * 0.05));
      if (next !== current) {
        queueTractorTightness(next);
        sfxBlip(800 + next * 600, 0.02);
      }
    }, { passive: false });

    // Click & Drag listener
    onMouseDown(el, (e) => {
      const ev = e as MouseEvent;
      ev.preventDefault();
      ev.stopPropagation();
      _isDragging = true;
      _startY = ev.clientY;
      _startVal = getState().player.tractorTightness ?? 0.5;
      _removeDragMove = onDocumentMouseMove(onDragMove);
      _removeDragUp = onDocumentMouseUp(onDragEnd);
    });
  }
  return el;
}

function onDragMove(e: Event) {
  const ev = e as MouseEvent;
  if (!_isDragging) return;
  const deltaY = _startY - ev.clientY; // drag UP = tighten
  const sensitivity = 0.005; // 200px drag covers full 0-1 range
  const current = getState().player.tractorTightness ?? 0.5;
  const next = Math.max(0, Math.min(1, _startVal + deltaY * sensitivity));
  if (next !== current) {
    const oldStep = Math.round(current * 20);
    const newStep = Math.round(next * 20);
    if (oldStep !== newStep) {
      sfxBlip(800 + next * 600, 0.02);
    }
    queueTractorTightness(next);
  }
}

function onDragEnd() {
  if (_isDragging) {
    _isDragging = false;
    if (_removeDragMove) { _removeDragMove(); _removeDragMove = null; }
    if (_removeDragUp) { _removeDragUp(); _removeDragUp = null; }
  }
}

export function updateTractorDial() {
  const el = getDialEl();

  const ft = getState().player.fitting?.turret || [];
  let tractorIdx = -1;
  let tractorMod: ModuleDef | null = null;
  for (let i = 0; i < ft.length; i++) {
    const uid = ft[i];
    if (!uid) continue;
    const inst = getInstance(uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (m && MODULE_FLAGS.isTractor(m)) {
      if (getState().player.turretPower?.[i]) {
        tractorIdx = i;
        tractorMod = m;
        break;
      }
    }
  }

  const minimized = localStorage.getItem("tractor-dial-minimized") === "true";
  if (tractorIdx === -1 || !tractorMod || minimized) {
    setStyle(el, { display: "none" });
    return;
  }

  setStyle(el, { display: "flex" });
  const node = hudState.slotNodes.get(`turret|${tractorIdx}`);
  if (node && node.el) {
    const rect = node.el.getBoundingClientRect();
    const overlayEl = getElement("hud-overlay");
    const parentRect = overlayEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const dialLeft = rect.left - parentRect.left + rect.width / 2;
    const dialTop = rect.top - parentRect.top;
    setPosition(el, `${dialLeft}px`, `${dialTop - 8}px`);
    setStyle(el, { transform: "translate(-50%, -100%)" });
  }

  const t = getState().player.tractorTightness ?? 0.5;
  const pct = Math.round(t * 100);
  const pullMult = 0.45 + t * 1.10;
  const baseCap = tractorMod.capDrainPerSec ?? 3;
  const drainMult = 0.5 + t * 1.5;
  const capVal = baseCap * drainMult;

  const angle = -135 + t * 270;
  // Circumference of radius 16 is 2 * PI * 16 = 100.53
  const circ = 100.53;
  const maxArc = 75.4; // 270 degrees
  const offset = circ - (t * maxArc);

  setHtml(el, `
    <div class="td-dial-pane">
      <div class="td-knob-wrapper">
        <svg width="40" height="40" viewBox="0 0 40 40" class="td-svg">
          <!-- Background track (270 deg) -->
          <circle cx="20" cy="20" r="16" class="td-track" 
            stroke-dasharray="${circ}" stroke-dashoffset="${circ - maxArc}"
            transform="rotate(135 20 20)">
          </circle>
          <!-- Active fill arc -->
          <circle cx="20" cy="20" r="16" class="td-fill" 
            stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
            transform="rotate(135 20 20)">
          </circle>
          <!-- Rotating Needle -->
          <line x1="20" y1="20" x2="20" y2="4" class="td-needle"
            transform="rotate(${angle} 20 20)">
          </line>
        </svg>
        <div class="td-value-overlay">${pct}%</div>
      </div>
      <div class="td-labels">
        <span class="td-title">TRACTOR GRIP</span>
        <div class="td-stats">
          <div class="td-stat-row">
            <span class="td-stat-lbl">PULL:</span>
            <span class="td-stat-val">${pullMult.toFixed(2)}x</span>
          </div>
          <div class="td-stat-row">
            <span class="td-stat-lbl">DRAIN:</span>
            <span class="td-stat-val">${capVal.toFixed(1)}/s</span>
          </div>
        </div>
      </div>
    </div>
  `);
}
