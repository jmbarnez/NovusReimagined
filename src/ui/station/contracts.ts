import "../styles/station-contracts.css";
import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { escHtml } from "../../utils/format.js";
import { stationState, MAX_ACTIVE_CONTRACTS, CONTRACT_TYPE_ICONS } from "./shared.js";
import { getElement, setHtml } from "../dom-helpers.js";

export function renderContracts() {
  const div = getElement("panel-contracts");
  if (!div) return;

  const active = getState().player.contracts.filter(c => c.status === "active" || c.status === "complete");
  const activeCount = active.length;
  const atCap = activeCount >= MAX_ACTIVE_CONTRACTS;
  const activeStation = Client.activeStation;

  const availableRows = stationState._stationContracts.map(c => {
    const alreadyActive = getState().player.contracts.some(ac => ac.id === c.id);
    const disabled = alreadyActive || atCap ? "disabled" : "";
    const label = alreadyActive ? "Accepted" : atCap ? "Full" : "Accept";
    return `
      <div class="ct-card ct-available">
        <div class="ct-card-top">
          <span class="ct-icon">${CONTRACT_TYPE_ICONS[c.type] ?? "○"}</span>
          <span class="ct-title">${escHtml(c.title)}</span>
          <span class="ct-reward">${c.reward} CR</span>
        </div>
        <div class="ct-desc">${escHtml(c.description)}</div>
        <div class="ct-actions">
          <button class="st-btn-sm" data-action="acceptContract" data-contract-id="${escHtml(c.id)}" ${disabled}>${label}</button>
        </div>
      </div>`;
  }).join("");

  const activeRows = active.map(c => {
    const { current, required } = c.objective;
    const pct = Math.min(current / required, 1);
    const filled = Math.round(pct * 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    const canTurnIn = c.status === "complete" && activeStation?.id === c.stationId;
    const turnInBtn = canTurnIn
      ? `<button class="st-btn-sm ct-turnin" data-action="turnInContract" data-contract-id="${escHtml(c.id)}">Claim ${c.reward} CR</button>`
      : c.status === "complete"
        ? `<span class="ct-complete-note">Return to issuing station</span>`
        : `<button class="st-btn-sm ct-abandon" data-action="abandonContract" data-contract-id="${escHtml(c.id)}">Abandon</button>`;
    const statusCls = c.status === "complete" ? "ct-active ct-done" : "ct-active";
    return `
      <div class="ct-card ${statusCls}">
        <div class="ct-card-top">
          <span class="ct-icon">${CONTRACT_TYPE_ICONS[c.type] ?? "○"}</span>
          <span class="ct-title">${escHtml(c.title)}</span>
          <span class="ct-reward">${c.reward} CR</span>
        </div>
        <div class="ct-progress">
          <span class="ct-bar">${bar}</span>
          <span class="ct-count">${current} / ${required}</span>
        </div>
        <div class="ct-actions">${turnInBtn}</div>
      </div>`;
  }).join("");

  setHtml(div, `
    <div class="ct-section-head">Active Contracts <span class="ct-cap">${activeCount} / ${MAX_ACTIVE_CONTRACTS}</span></div>
    ${active.length ? activeRows : `<div class="ct-empty">No active contracts.</div>`}
    <div class="ct-section-head">Available</div>
    ${stationState._stationContracts.length ? availableRows : `<div class="ct-empty">No contracts available.</div>`}
  `);
}
