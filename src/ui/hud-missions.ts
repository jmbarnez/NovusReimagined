import "./styles/hud-missions.css";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { fmtCompact } from "../utils/format.js";
import type { MissionContract } from "../data/missions.js";
import { isTutorialContract } from "../data/missions.js";
import { getTutorialMissionForHud } from "../data/tutorial-mission.js";
import { attachMissionTooltipListeners } from "./hud-mission-tooltip.js";
import { setHtml } from "./dom-helpers.js";
import { on } from "../events.js";

let _panel: HTMLElement | null = null;

const TYPE_ICONS: Record<string, string> = {
  bounty: "⌖",
  mining: "⛏",
  delivery: "▲",
  salvage: "◈",
};

export function initMissionsPanel(mount: HTMLElement | null) {
  if (!mount) return;
  _panel = mount;
  _panel.id = "hud-missions";
  attachMissionTooltipListeners(_panel);
  bindMissionPanelEvents();
}

function bindMissionPanelEvents() {
  on("tutorial:step-change", updateMissionsPanel);
  on("mission:accepted", updateMissionsPanel);
  on("mission:completed", updateMissionsPanel);
}

export function getMissionsPanelEl() {
  return _panel;
}

export function updateMissionsPanel() {
  if (!_panel || Client.stationOpen) return;

  // Sync tutorial progress so the panel reflects the current step immediately.
  getTutorialMissionForHud();

  const contracts = getState().player?.contracts ?? [];
  const active = contracts.filter(c => c.status === "active" || c.status === "complete");

  if (active.length === 0) {
    setHtml(_panel, `<div class="hm-empty">NO ACTIVE<br>MISSIONS</div>`);
    return;
  }

  const rows = active.slice(0, 3).map(c => renderContract(c)).join("");
  setHtml(_panel, `<div class="hm-header">MISSIONS</div>${rows}`);
}

function renderContract(c: MissionContract): string {
  const { current, required } = c.objective;
  const pct = Math.min(current / required, 1);
  const filled = Math.round(pct * 8);
  const empty = 8 - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const complete = c.status === "complete";
  const cls = complete ? "hm-contract complete" : "hm-contract";
  const icon = isTutorialContract(c)
    ? (c.id === "mc_getting_started" ? "▲" : "★")
    : (TYPE_ICONS[c.type] ?? "○");
  const statusText = complete
    ? `<span class="hm-done">TURN IN</span>`
    : `<span class="hm-prog">${bar} ${current}/${required}</span>`;
  return `
    <div class="${cls}" data-contract-id="${escTitle(c.id)}">
      <div class="hm-title">${icon} ${escTitle(c.title)}</div>
      <div class="hm-row">${statusText}<span class="hm-reward">${fmtCompact(c.reward)} CR</span></div>
    </div>`;
}

function escTitle(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
