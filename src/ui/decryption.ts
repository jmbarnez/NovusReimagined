import "./styles/decryption.css";

import { WorldAccess, PlayerAccess, getState } from "../state-access.js";
import { queueFrameAction } from "../sim/input.js";
import { openHudWindow, closeHudWindow, isOpen } from "./hud/windows.js";
import { curSys } from "../utils/game.js";
import { dst, mulberry32 } from "../utils/math.js";
import type { HiddenSite } from "../types/world.js";
import { getStats } from "../player/player-stats.js";
import { sfxBlip, sfxConfirm, sfxError } from "../audio/procedural.js";
import { logEvent } from "../feedback.js";
import { applyDecryptionReward } from "../sites/decryption-rewards.js";
import { t } from "../utils/i18n.js";

type NodeType = "entry" | "access" | "cache" | "reveal" | "stabilize" | "corrupt" | "counter" | "dead";

interface DecryptNode {
  id: string;
  col: number;
  row: number;
  type: NodeType;
  revealed: boolean;
  visited: boolean;
  payload: number;
}

interface DecryptRun {
  siteId: string;
  title: string;
  securityClass: string;
  family: HiddenSite["family"];
  difficulty: number;
  trace: number;
  traceCap: number;
  integrity: number;
  maxIntegrity: number;
  payload: number;
  currentNodeId: string;
  nodes: DecryptNode[];
  stabilizeCharges: number;
  ended: boolean;
}

let activeRun: DecryptRun | null = null;
let listenersBound = false;

function getSite(siteId: string): HiddenSite | null {
  const sys = curSys(getState().player);
  return sys?.hiddenSites?.find((site) => site.id === siteId) ?? null;
}

function securityLabel(site: HiddenSite): string {
  if (site.decryptDifficulty == null) return t("decrypt.open");
  if (site.decryptDifficulty < 1.05) return t("decrypt.civA");
  if (site.decryptDifficulty < 1.25) return t("decrypt.milB");
  if (site.decryptDifficulty < 1.45) return t("decrypt.relicC");
  return t("decrypt.blackD");
}

function buildRun(site: HiddenSite): DecryptRun {
  const stats = getStats(getState().player);
  const seed = (site.rewardSeed ^ Math.floor((site.decryptDifficulty ?? 1) * 1000)) >>> 0;
  const rng = mulberry32(seed);
  const cols = 5;
  const maxRows = 3;
  const nodes: DecryptNode[] = [];
  nodes.push({ id: "n-0-0", col: 0, row: 0, type: "entry", revealed: true, visited: true, payload: 0 });
  for (let col = 1; col < cols; col++) {
    const rowCount = col === cols - 1 ? 2 : (rng() < 0.55 ? 2 : maxRows);
    for (let row = 0; row < rowCount; row++) {
      const roll = rng();
      let type: NodeType = "access";
      if (col === cols - 1 && row === 0) type = "cache";
      else if (col >= 2 && roll < 0.22) type = "cache";
      else if (roll < 0.34) type = "reveal";
      else if (roll < 0.48) type = "stabilize";
      else if (roll < 0.66) type = "access";
      else if (roll < 0.80) type = "corrupt";
      else if (roll < 0.92) type = "counter";
      else type = "dead";
      const isNearStart = col === 1 && row === 0;
      const tutorialReveal = site.isTutorialSite && (isNearStart || col === 1);
      nodes.push({
        id: `n-${col}-${row}`,
        col,
        row,
        type,
        revealed: tutorialReveal || isNearStart || (stats.decryptPower >= 1.35 && col <= 2),
        visited: false,
        payload: type === "cache" ? 1 + Math.floor(rng() * 3) + (col >= 3 ? 1 : 0) : 0,
      });
    }
  }
  const tutorial = !!site.isTutorialSite;
  return {
    siteId: site.id,
    title: site.name,
    securityClass: securityLabel(site),
    family: site.family,
    difficulty: site.decryptDifficulty ?? 1,
    trace: 0,
    traceCap: tutorial ? 5 : 7,
    integrity: tutorial ? 6 : 5,
    maxIntegrity: tutorial ? 6 : 5,
    payload: 0,
    currentNodeId: "n-0-0",
    nodes,
    stabilizeCharges: tutorial ? 3 : (stats.decryptTraceResist >= 1.25 ? 2 : 1),
    ended: false,
  };
}

function currentNode(run: DecryptRun): DecryptNode {
  return run.nodes.find((node) => node.id === run.currentNodeId) ?? run.nodes[0];
}

function nextNodes(run: DecryptRun): DecryptNode[] {
  const current = currentNode(run);
  return run.nodes.filter((node) => node.col === current.col + 1);
}

function revealAhead(run: DecryptRun, colOffset = 1) {
  const current = currentNode(run);
  const targetCol = current.col + colOffset;
  for (const node of run.nodes) {
    if (node.col === targetCol) node.revealed = true;
  }
}

function clampRun(run: DecryptRun) {
  run.trace = Math.max(0, Math.min(run.traceCap, run.trace));
  run.integrity = Math.max(0, Math.min(run.maxIntegrity, run.integrity));
}

function applyNode(run: DecryptRun, nodeId: string) {
  if (run.ended) return;
  const node = run.nodes.find((entry) => entry.id === nodeId);
  if (!node || !node.revealed || node.visited) return;
  const current = currentNode(run);
  if (node.col !== current.col + 1) return;

  node.visited = true;
  run.currentNodeId = node.id;
  run.trace += 1;

  switch (node.type) {
    case "cache":
      run.payload += node.payload;
      run.trace += 1;
      sfxConfirm();
      break;
    case "reveal":
      revealAhead(run, 1);
      revealAhead(run, 2);
      sfxBlip(1120, 0.05);
      break;
    case "stabilize":
      run.trace -= 1;
      run.integrity = Math.min(run.maxIntegrity, run.integrity + 1);
      sfxBlip(980, 0.05);
      break;
    case "corrupt":
      run.integrity -= 1;
      run.trace += 1;
      sfxError();
      break;
    case "counter":
      run.trace += 2;
      sfxError();
      break;
    case "dead":
      run.trace += 1;
      sfxBlip(440, 0.08);
      break;
    default:
      sfxBlip(880, 0.04);
      break;
  }

  revealAhead(run, 1);
  clampRun(run);
  if (run.trace >= run.traceCap || run.integrity <= 0) {
    collapseRun(run);
    return;
  }
  renderDecryptionWindow();
}

function payReward(site: HiddenSite, payload: number, integrity: number, partial = false) {
  const reward = applyDecryptionReward(site, payload, integrity, partial, getState().player);
  const details = [
    `${reward.credits}¢`,
    reward.chip > 0 ? `${reward.chip} chip` : "",
    reward.cell > 0 ? `${reward.cell} cell` : "",
    reward.sensor > 0 ? `${reward.sensor} sensor cluster` : "",
  ].filter(Boolean);
  logEvent(`${partial ? "Partial" : "Recovered"} datacore payload from ${site.name}: ${details.join(", ")}`, partial ? "system" : "loot");
}

function finalizeSite(siteId: string) {
  PlayerAccess.addCompletedSiteId(siteId);
  WorldAccess.setHiddenSiteState(getState().player.sysIdx, siteId, "cleared");
}

function extractRun(run: DecryptRun) {
  if (run.ended) return;
  const site = getSite(run.siteId);
  if (!site) return;
  run.ended = true;
  queueFrameAction({
    type: "completeSite",
    payload: {
      siteId: site.id,
      payload: run.payload,
      integrity: run.integrity,
      partial: false,
    },
  });
  sfxConfirm();
  renderDecryptionWindow(true, t("decrypt.success"));
}

function collapseRun(run: DecryptRun) {
  if (run.ended) return;
  run.ended = true;
  const site = getSite(run.siteId);
  const salvageable = run.payload > 0 && run.integrity > 0;
  if (site) {
    queueFrameAction({
      type: "completeSite",
      payload: {
        siteId: site.id,
        payload: salvageable ? Math.max(1, Math.floor(run.payload / 2)) : 0,
        integrity: salvageable ? Math.max(1, run.integrity - 1) : 0,
        partial: true,
      },
    });
    sfxError();
    renderDecryptionWindow(
      true,
      salvageable
        ? t("decrypt.partial")
        : t("decrypt.collapse"),
    );
    return;
  }
  PlayerAccess.setEnergy(Math.max(0, getState().player.energy - 12));
  sfxError();
  renderDecryptionWindow(true, t("decrypt.collapse"));
}

function stabilizeRun(run: DecryptRun) {
  if (run.ended || run.stabilizeCharges <= 0) return;
  run.stabilizeCharges -= 1;
  run.trace = Math.max(0, run.trace - 2);
  clampRun(run);
  sfxBlip(1040, 0.06);
  renderDecryptionWindow();
}

function abortRun(run: DecryptRun) {
  run.ended = true;
  sfxBlip(360, 0.08);
  renderDecryptionWindow(true, t("decrypt.aborted"));
}

function nodeLabel(node: DecryptNode): string {
  if (!node.revealed && !node.visited) return t("decrypt.hidden");
  switch (node.type) {
    case "entry": return t("decrypt.entry");
    case "cache": return t("decrypt.payload");
    case "reveal": return t("decrypt.reveal");
    case "stabilize": return t("decrypt.stabilize");
    case "corrupt": return t("decrypt.corrupt");
    case "counter": return t("decrypt.counter");
    case "dead": return t("decrypt.dead");
    default: return t("decrypt.default");
  }
}

function meterSegments(current: number, max: number, cls: string) {
  let html = "";
  for (let i = 0; i < max; i++) {
    html += `<span class="decrypt-seg ${cls}${i < current ? " on" : ""}"></span>`;
  }
  return html;
}

function renderGrid(run: DecryptRun) {
  const cols = Math.max(...run.nodes.map((node) => node.col)) + 1;
  let html = `<div class="decrypt-grid" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));">`;
  for (let col = 0; col < cols; col++) {
    const colNodes = run.nodes.filter((node) => node.col === col);
    html += `<div class="decrypt-col">`;
    for (const node of colNodes) {
      const actionable = nextNodes(run).some((entry) => entry.id === node.id) && node.revealed && !run.ended;
      const cls = [
        "decrypt-node",
        `type-${node.type}`,
        node.visited ? "visited" : "",
        node.id === run.currentNodeId ? "current" : "",
        actionable ? "actionable" : "",
        !node.revealed && !node.visited ? "hidden" : "",
      ].filter(Boolean).join(" ");
      html += `
        <button type="button" class="${cls}" data-node-id="${node.id}" ${actionable ? "" : "disabled"}>
          <span class="decrypt-node-label">${nodeLabel(node)}</span>
        </button>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function renderDecryptionWindow(locked = false, message = "") {
  if (!activeRun) return;
  const run = activeRun;
  const body = document.createElement("div");
  body.id = "decryption-window-body";
  body.innerHTML = `
    <div class="decrypt-shell">
      <div class="decrypt-top">
        <div>
          <div class="decrypt-title">${run.title}</div>
          <div class="decrypt-meta">${run.securityClass} · ${run.family.toUpperCase()} ${t("decrypt.default")}</div>
        </div>
        <div class="decrypt-payload">${t("decrypt.payload")} ${run.payload}</div>
      </div>
      <div class="decrypt-board">
        ${renderGrid(run)}
        <div class="decrypt-side">
          <div class="decrypt-meter-block">
            <span class="decrypt-meter-label">${t("decrypt.trace")}</span>
            <div class="decrypt-meter">${meterSegments(run.trace, run.traceCap, "trace")}</div>
          </div>
          <div class="decrypt-meter-block">
            <span class="decrypt-meter-label">${t("decrypt.integrity")}</span>
            <div class="decrypt-meter">${meterSegments(run.integrity, run.maxIntegrity, "integrity")}</div>
          </div>
          <div class="decrypt-readout">
            <div><span>${t("decrypt.difficulty")}</span><b>${run.difficulty.toFixed(2)}</b></div>
            <div><span>${t("decrypt.stabilizeBtn")}</span><b>${run.stabilizeCharges}</b></div>
          </div>
        </div>
      </div>
      <div class="decrypt-actions">
        <button type="button" class="decrypt-action" data-decrypt-action="stabilize" ${run.stabilizeCharges > 0 && !run.ended ? "" : "disabled"}>${t("decrypt.stabilizeBtn")}</button>
        <button type="button" class="decrypt-action" data-decrypt-action="extract" ${run.payload > 0 && !run.ended ? "" : "disabled"}>${t("decrypt.extract")}</button>
        <button type="button" class="decrypt-action ghost" data-decrypt-action="abort" ${run.ended ? "" : ""}>${t("decrypt.abort")}</button>
      </div>
      <div class="decrypt-status">${message || (run.ended ? t("decrypt.linkClosed") : t("decrypt.prompt"))}</div>
    </div>`;

  openHudWindow("decryption", t("decrypt.consoleTitle"), body, () => {
    activeRun = null;
  });
  bindListeners();
  if (locked) {
    const win = document.getElementById("hud-win-decryption");
    if (win) win.classList.remove("is-expanded");
  }
}

function bindListeners() {
  if (listenersBound) return;
  document.body.addEventListener("click", onDecryptClick);
  listenersBound = true;
}

function onDecryptClick(ev: Event) {
  if (!isOpen("decryption") || !activeRun) return;
  const target = ev.target as HTMLElement | null;
  if (!target) return;
  const nodeBtn = target.closest("[data-node-id]") as HTMLElement | null;
  if (nodeBtn) {
    const nodeId = nodeBtn.getAttribute("data-node-id");
    if (nodeId) applyNode(activeRun, nodeId);
    return;
  }
  const actionBtn = target.closest("[data-decrypt-action]") as HTMLElement | null;
  if (!actionBtn) return;
  const action = actionBtn.getAttribute("data-decrypt-action");
  if (!action) return;
  if (action === "stabilize") stabilizeRun(activeRun);
  else if (action === "extract") extractRun(activeRun);
  else if (action === "abort") {
    abortRun(activeRun);
    closeHudWindow("decryption");
  }
}

export function openDecryptionWindowForSite(siteId: string) {
  const site = getSite(siteId);
  if (!site || !site.hasEncryptedContent || getState().player.completedSiteIds.includes(siteId)) return;
  if (dst(getState().player.x, getState().player.y, site.x, site.y) > 280) {
    logEvent(`Move within 280m of ${site.name} to establish a stable decrypt link.`, "system");
    sfxError();
    return;
  }
  WorldAccess.setHiddenSiteState(getState().player.sysIdx, site.id, "resolved");
  activeRun = buildRun(site);
  sfxConfirm();
  renderDecryptionWindow();
}
