import "./styles/bridge.css";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { SHIPS } from "../data/ships.js";
import { dst } from "../utils/math.js";
import { escHtml, formatDistance } from "../utils/format.js";
import { curSys } from "../utils/game.js";
import { getSensorContactRangePx } from "../targeting.js";
import { enemyClassLabel } from "../targeting.js";
import { renderInventoryHTML, attachInventoryListeners, resetInventoryUI } from "./inventory/index.js";
import { sfxBlip } from "../audio/procedural.js";
import { on } from "../events.js";
import type { Enemy, Asteroid } from "../types/world.js";
import { t } from "../utils/i18n.js";
import { gateDestinationName, gateStableId } from "../utils/warp-gates.js";
import { getElement, query, createElement, setHtml, setText, setStyle, toggleClass, append, getStyleProperty, setPosition, onMouseDown, onClick, onWindowMouseMove, onWindowMouseUp, onWindowResize } from "./dom-helpers.js";

export { attachInventoryListeners, resetInventoryUI };

export interface OverviewRow {
  kind: "self" | "hostile" | "neutral" | "asteroid" | "station" | "gate";
  id: string;
  icon: string;
  cls: string;
  name: string;
  dist: number | string;
  sig: number | string;
  relV: number | string;
  status: string;
}

let _bridgeToastTimer: ReturnType<typeof setTimeout> | null = null;
let _cleanupBridgeResize: (() => void) | null = null;

export function showBridgeToast(msg: string) {
  const el = getElement("bridge-toast");
  if (!el) return;
  setText(el, msg);
  setStyle(el, { opacity: "1" });
  if (_bridgeToastTimer) clearTimeout(_bridgeToastTimer);
  _bridgeToastTimer = setTimeout(() => { setStyle(el, { opacity: "0" }); }, 2400);
}

export function buildLocalOverviewRows(): OverviewRow[] {
  const ship = SHIPS[getState().player.shipId];
  const range = getSensorContactRangePx(ship);
  const rows: OverviewRow[] = [];
  rows.push({
    kind: "self",
    id: "__player",
    icon: "◆",
    cls: "YOU",
    name: ship.name,
    dist: 0,
    sig: Math.round(ship.signatureRadius || 45),
    relV: 0,
    status: "—",
  });
  const sys = curSys();
  if (!sys) return rows;
  for (const e of sys.enemies) {
    if (!e.alive) continue;
    const d = dst(getState().player.x, getState().player.y, e.x, e.y);
    if (d > range) continue;
    const slot = getState().player.lockQueue.find((s) => s.id === e.id);
    let status = "";
    if (slot?.resolving) status += `<span class="ov-plock ov-scanning">${t("bridge.scan")}</span>`;
    else if (slot && !slot.resolving) status += `<span class="ov-plock${getState().player.targetLock?.id === e.id ? " ov-primary" : ""}">${getState().player.targetLock?.id === e.id ? t("bridge.lockPrimary") : t("bridge.lock")}</span>`;
    if (e.hasLockOnPlayer) status += `<span class="ov-threat ov-threat-locked" title="${t("bridge.hasLockedYou")}">◉</span>`;
    else if (e.targetingPlayer) status += `<span class="ov-threat ov-threat-scan" title="${t("bridge.lockingYou")}">▲</span>`;
    if (!status) status = "—";
    rows.push({
      kind: e.faction === "neutral" ? "neutral" : "hostile",
      id: e.id,
      icon: "⚑",
      cls: e.faction === "neutral" ? "NEUT" : enemyClassLabel(e.type),
      name: e.name,
      dist: Math.round(d),
      sig: Math.round(e.sigRadius || 30),
      relV: Math.round(Math.hypot(getState().player.vx - (e.vx || 0), getState().player.vy - (e.vy || 0))),
      status,
    });
  }
  for (const a of sys.asteroids) {
    if (a.depleted || a.hp <= 0) continue;
    const d = dst(getState().player.x, getState().player.y, a.x, a.y) - a.radius;
    if (d > range) continue;
    const slot = getState().player.lockQueue.find((s) => s.id === a.id);
    let status = t("bridge.dash");
    if (slot?.resolving) status = t("bridge.scan");
    else if (slot && !slot.resolving) status = getState().player.targetLock?.id === a.id ? t("bridge.lockPrimary") : t("bridge.lock");
    rows.push({
      kind: "asteroid",
      id: a.id,
      icon: "▫",
      cls: "AST",
      name: a.name || t("hud.asteroidFallback", { id: a.id.split("-").pop() || "" }),
      dist: Math.round(Math.max(0, d)),
      sig: Math.round(a.radius * 2),
      relV: "—",
      status,
    });
  }
  for (const st of sys.stations) {
    const d = dst(getState().player.x, getState().player.y, st.x, st.y);
    if (d > range) continue;
    rows.push({
      kind: "station",
      id: st.id,
      icon: "⌂",
      cls: "STRUCT",
      name: st.name,
      dist: Math.round(d),
      sig: "—",
      relV: "—",
      status: "—",
    });
  }
  for (let gi = 0; gi < sys.gates.length; gi++) {
    const g = sys.gates[gi];
    const d = dst(getState().player.x, getState().player.y, g.x, g.y);
    const alwaysShowTutorialGate = sys.idx === 0 && getState().player.sysIdx === 0;
    if (!alwaysShowTutorialGate && d > range) continue;
    const destination = gateDestinationName(g, getState().GALAXY);
    const gateId = gateStableId(g);
    const slot = getState().player.lockQueue.find((s) => s.id === gateId);
    let status = t("bridge.dash");
    if (slot?.resolving) status = t("bridge.scan");
    else if (slot && !slot.resolving) status = getState().player.targetLock?.id === gateId ? t("bridge.lockPrimary") : t("bridge.lock");
    rows.push({
      kind: "gate",
      id: gateId,
      icon: "◇",
      cls: "GATE",
      name: `↩ ${destination}`,
      dist: Math.round(d),
      sig: "—",
      relV: "—",
      status,
    });
  }
  rows.sort((a, b) => {
    if (a.kind === "self") return -1;
    if (b.kind === "self") return 1;
    const pri = (k: string) => (k === "hostile" ? 0 : k === "neutral" ? 1 : k === "station" ? 2 : k === "gate" ? 3 : 4);
    const pa = pri(a.kind);
    const pb = pri(b.kind);
    if (pa !== pb) return pa - pb;
    const da = typeof a.dist === "number" ? a.dist : 999999;
    const db = typeof b.dist === "number" ? b.dist : 999999;
    return da - db;
  });
  return rows;
}

export function renderBridgeOverviewHTML(): string {
  const ship = SHIPS[getState().player.shipId];
  const rangePx = Math.round(getSensorContactRangePx(ship));
  const sys = curSys();
  const rows = buildLocalOverviewRows();
  const body = rows
    .map((r: OverviewRow) => {
      const dist = typeof r.dist === "number" ? formatDistance(r.dist) : r.dist;
      return `<tr class="ov-row ov-row-${r.kind}" data-id="${escHtml(r.id)}">
      <td class="ov-icon">${r.icon}</td>
      <td class="ov-st">${r.status}</td>
      <td>${r.cls}</td>
      <td class="ov-name">${escHtml(r.name)}</td>
      <td class="ov-num ov-dist">${dist}</td>
      <td class="ov-num ov-sig">${r.sig}</td>
      <td class="ov-num ov-relV">${r.relV}</td>
    </tr>`;
    })
    .join("");
  return `
    <div class="ov-meta">${escHtml(sys?.name ?? "—")} · passive scan <b>${rangePx}</b> m · SEC ${(sys?.security ?? 0).toFixed(1)}</div>
    <div class="ov-wrap">
      <table class="ov-table">
        <thead><tr>
          <th></th><th>${t("hud.state")}</th><th>${t("hud.class")}</th><th>${t("common.name")}</th><th>${t("hud.dist")}</th><th>${t("hud.sig")}</th><th>${t("bridge.overviewDv")}</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

export function updateBridgeOverview() {
  if (!Client.overviewOpen) return;
  const tbody = query("#bridge-pane-overview .ov-table tbody");
  if (!tbody) return;

  const rows = buildLocalOverviewRows();
  const existing = new Map<string, HTMLTableRowElement>();
  for (const tr of tbody.querySelectorAll("tr[data-id]")) {
    existing.set((tr as HTMLElement).dataset.id!, tr as HTMLTableRowElement);
  }

  for (const r of rows) {
    let tr = existing.get(r.id);
    if (!tr) {
      tr = createElement("tr", `ov-row ov-row-${r.kind}`) as HTMLTableRowElement;
      tr.dataset.id = r.id;
      const dist = typeof r.dist === "number" ? formatDistance(r.dist) : r.dist;
      setHtml(tr, `
        <td class="ov-icon">${r.icon}</td>
        <td class="ov-st">${r.status}</td>
        <td>${r.cls}</td>
        <td class="ov-name">${escHtml(r.name)}</td>
        <td class="ov-num ov-dist">${dist}</td>
        <td class="ov-num ov-sig">${r.sig}</td>
        <td class="ov-num ov-relV">${r.relV}</td>`);
      append(tbody, tr);
    } else {
      const dist = typeof r.dist === "number" ? formatDistance(r.dist) : r.dist;
      const dCell = tr.querySelector(".ov-dist") as HTMLElement | null;
      const sCell = tr.querySelector(".ov-st") as HTMLElement | null;
      const rCell = tr.querySelector(".ov-relV") as HTMLElement | null;
      const sigCell = tr.querySelector(".ov-sig") as HTMLElement | null;
      if (dCell) setText(dCell, dist);
      if (sCell) setHtml(sCell, r.status);
      if (rCell) setText(rCell, String(r.relV));
      if (sigCell) setText(sigCell, String(r.sig));
      existing.delete(r.id);
    }
  }

  for (const tr of existing.values()) {
    tr.remove();
  }
}

export function renderBridgeCargoHTML(): string {
  return renderInventoryHTML();
}

export function ensureBridgeUI() {
  const el = getElement("bridge-overlay");
  if (!el || el.getAttribute("data-initialized") === "true") return;
  el.setAttribute("data-initialized", "true");

  on("ui:close-overlays", () => {
    setStyle(el, { display: "none" });
    Client.bridgeOpen = false;
    Client.overviewOpen = false;
    Client.skillsOpen = false;
  });
  initBridgeWindows(el);
}

export function initBridgeWindows(rootEl: HTMLElement) {
  const workspace = rootEl.querySelector(".bridge-workspace");
  if (!workspace) return;
  const wins = Array.from(workspace.querySelectorAll(".eve-window")) as HTMLElement[];
  const clampWindow = (win: HTMLElement) => {
    if (win.classList.contains("is-expanded")) return;
    const ws = workspace.getBoundingClientRect();
    const wr = win.getBoundingClientRect();
    if (wr.width === 0) return; // Hidden, skip
    const leftVal = getStyleProperty(win, "left");
    const topVal = getStyleProperty(win, "top");
    const x = Number(leftVal.replace("px", "")) || wr.left - ws.left;
    const y = Number(topVal.replace("px", "")) || wr.top - ws.top;
    const maxX = Math.max(0, ws.width - wr.width);
    const maxY = Math.max(0, ws.height - wr.height);
    setPosition(win, `${Math.max(0, Math.min(x, maxX))}px`, `${Math.max(0, Math.min(y, maxY))}px`);
    setStyle(win, { right: "auto" });
  };
  for (const win of wins) {
    const r = win.getBoundingClientRect();
    const ws = workspace.getBoundingClientRect();
    if (r.width > 0) {
      if (!getStyleProperty(win, "left")) { setPosition(win, `${r.left - ws.left}px`, getStyleProperty(win, "top")); setStyle(win, { right: "auto" }); }
      if (!getStyleProperty(win, "top")) setPosition(win, getStyleProperty(win, "left"), `${r.top - ws.top}px`);
      if (!getStyleProperty(win, "width")) setStyle(win, { width: `${r.width}px` });
      if (!getStyleProperty(win, "height")) setStyle(win, { height: `${r.height}px` });
    }
    const head = win.querySelector(".eve-win-head");
    const expandBtn = win.querySelector(".eve-win-expand");
    if (!head) continue;
    const bringToFront = () => {
      Client.bridgeWindowZ += 1;
      setStyle(win, { zIndex: String(Client.bridgeWindowZ) });
    };
    clampWindow(win);
    onMouseDown(head, (ev) => {
      const mev = ev as MouseEvent;
      if (mev.button !== 0) return;
      if ((mev.target as HTMLElement).closest("button") || win.classList.contains("is-expanded")) return;
      mev.preventDefault();
      bringToFront();
      win.classList.add("is-dragging");
      const leftVal = getStyleProperty(win, "left");
      const topVal = getStyleProperty(win, "top");
      if (!leftVal || !topVal) {
        const wr = win.getBoundingClientRect();
        const wsr = workspace.getBoundingClientRect();
        if (!leftVal) { setPosition(win, `${wr.left - wsr.left}px`, topVal); setStyle(win, { right: "auto" }); }
        if (!topVal) setPosition(win, getStyleProperty(win, "left"), `${wr.top - wsr.top}px`);
      }
      const baseX = parseFloat(leftVal) || 0;
      const baseY = parseFloat(topVal) || 0;
      const sx = mev.clientX;
      const sy = mev.clientY;
      let removeMove: (() => void) | null = null;
      let removeUp: (() => void) | null = null;
      const onMove = (e: Event) => {
        const mv = e as MouseEvent;
        setPosition(win, `${baseX + (mv.clientX - sx)}px`, `${baseY + (mv.clientY - sy)}px`);
        clampWindow(win);
      };
      const onUp = () => {
        win.classList.remove("is-dragging");
        if (removeMove) { removeMove(); removeMove = null; }
        if (removeUp) { removeUp(); removeUp = null; }
      };
      removeMove = onWindowMouseMove(onMove);
      removeUp = onWindowMouseUp(onUp);
    });
    if (expandBtn) {
      onClick(expandBtn, (ev) => {
        (ev as MouseEvent).stopPropagation();
        sfxBlip();
        const expand = !win.classList.contains("is-expanded");
        wins.forEach((w) => {
          w.classList.remove("is-expanded");
          const btn = w.querySelector(".eve-win-expand");
          if (btn) setText(btn as HTMLElement, "▢");
          if (w.dataset.prevLeft != null) {
            setPosition(w, w.dataset.prevLeft, w.dataset.prevTop!);
            setStyle(w, { width: w.dataset.prevWidth!, height: w.dataset.prevHeight! });
          }
        });
        if (expand) {
          bringToFront();
          const leftVal2 = getStyleProperty(win, "left");
          const widthVal2 = getStyleProperty(win, "width");
          if (!leftVal2 || !widthVal2) {
            const wr = win.getBoundingClientRect();
            const wsr = workspace.getBoundingClientRect();
            if (!leftVal2) { setPosition(win, `${wr.left - wsr.left}px`, getStyleProperty(win, "top")); setStyle(win, { right: "auto" }); }
            if (!getStyleProperty(win, "top")) setPosition(win, getStyleProperty(win, "left"), `${wr.top - wsr.top}px`);
            if (!widthVal2) setStyle(win, { width: `${wr.width}px` });
            if (!getStyleProperty(win, "height")) setStyle(win, { height: `${wr.height}px` });
          }
          win.dataset.prevLeft = getStyleProperty(win, "left");
          win.dataset.prevTop = getStyleProperty(win, "top");
          win.dataset.prevWidth = getStyleProperty(win, "width");
          win.dataset.prevHeight = getStyleProperty(win, "height");
          win.classList.add("is-expanded");
          setText(expandBtn as HTMLElement, "▣");
        }
      });
    }
    onMouseDown(win, bringToFront);
  }
  _cleanupBridgeResize = onWindowResize(() => {
    wins.forEach((w) => clampWindow(w));
  });
}

export function cleanupBridgeResize() {
  if (_cleanupBridgeResize) {
    _cleanupBridgeResize();
    _cleanupBridgeResize = null;
  }
}
