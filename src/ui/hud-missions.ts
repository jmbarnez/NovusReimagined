import "./styles/hud-missions.css";
import { G, Client } from "../state.js";
import { fmtCompact } from "../utils/format.js";
import type { MissionContract } from "../data/missions.js";

let _panel: HTMLElement | null = null;

const TYPE_ICONS: Record<string, string> = {
  bounty: "⌖",
  mining: "⛏",
  delivery: "▲",
  salvage: "◈",
};

export function initMissionsPanel(overlay: HTMLElement) {
  if (_panel) return;
  _panel = document.createElement("div");
  _panel.id = "hud-missions";
  // We no longer append here, switchTab handles it
}

export function getMissionsPanelEl() {
  return _panel;
}

export function updateMissionsPanel() {
  if (!_panel || Client.stationOpen) return;

  const contracts = G.P?.contracts ?? [];
  const active = contracts.filter(c => c.status === "active" || c.status === "complete");

  if (active.length === 0) {
    _panel.innerHTML = `<div class="hm-empty">NO ACTIVE<br>CONTRACTS</div>`;
    return;
  }

  const rows = active.slice(0, 3).map(c => renderContract(c)).join("");
  _panel.innerHTML = `<div class="hm-header">CONTRACTS</div>${rows}`;
}

function renderContract(c: MissionContract): string {
  const { current, required } = c.objective;
  const pct = Math.min(current / required, 1);
  const filled = Math.round(pct * 8);
  const empty = 8 - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const complete = c.status === "complete";
  const cls = complete ? "hm-contract complete" : "hm-contract";
  const icon = TYPE_ICONS[c.type] ?? "○";
  const statusText = complete
    ? `<span class="hm-done">TURN IN</span>`
    : `<span class="hm-prog">${bar} ${current}/${required}</span>`;
  return `
    <div class="${cls}">
      <div class="hm-title">${icon} ${escTitle(c.title)}</div>
      <div class="hm-row">${statusText}<span class="hm-reward">${fmtCompact(c.reward)} CR</span></div>
    </div>`;
}

function escTitle(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
