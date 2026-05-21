import "../styles/hud-overview.css";
import { G } from "../../state.js";
import { GATE_RANGE } from "../../constants.js";
import { dst } from "../../utils/math.js";
import { buildLocalOverviewRows } from "../bridge.js";
import { hudState } from "./state.js";

/* ── Overview Panel ── */
export function updateHudOverviewPanel() {
  if (!hudState.ovEntries) return;
  let rows = buildLocalOverviewRows();
  
  // Sort rows while keeping player ("self") fixed at the top
  const playerRow = rows.find((r) => r.kind === "self");
  const otherRows = rows.filter((r) => r.kind !== "self");

  const key = hudState.ovSortKey;
  const dir = hudState.ovSortDir;

  otherRows.sort((a, b) => {
    if (key === "dist") {
      const da = typeof a.dist === "number" ? a.dist : 999999;
      const db = typeof b.dist === "number" ? b.dist : 999999;
      return dir * (da - db);
    } else if (key === "class") {
      return dir * a.cls.localeCompare(b.cls);
    } else if (key === "name") {
      return dir * a.name.localeCompare(b.name);
    } else if (key === "state") {
      const sa = a.status.replace(/<[^>]*>/g, "");
      const sb = b.status.replace(/<[^>]*>/g, "");
      return dir * sa.localeCompare(sb);
    }
    return 0;
  });

  rows = playerRow ? [playerRow, ...otherRows] : otherRows;

  const existing = new Map();
  for (const tr of hudState.ovEntries.querySelectorAll("tr[data-id]")) {
    existing.set((tr as HTMLElement).dataset.id, tr);
  }

  for (const r of rows) {
    let tr: HTMLElement = existing.get(r.id);
    if (!tr) {
      tr = document.createElement("tr");
      tr.className = `ov-row ov-row-${r.kind}`;
      (tr as any).dataset.id = r.id;
      const lockBtn = (r.kind === "hostile" || r.kind === "asteroid")
        ? `<button type="button" class="ov-lock" data-lock-id="${r.id}">Lock</button>`
        : "—";
      const dist = typeof r.dist === "number" ? String(r.dist) : r.dist;
      tr.innerHTML = `
        <td class="ov-icon">${r.icon}</td>
        <td class="ov-st">${r.status}</td>
        <td>${r.cls}</td>
        <td class="ov-name">${r.name.slice(0, 12)}</td>
        <td class="ov-num ov-dist">${dist}</td>
        <td>${lockBtn}</td>`;
      hudState.ovEntries.appendChild(tr);
    } else {
      const dist = typeof r.dist === "number" ? String(r.dist) : r.dist;
      const dCell = tr.querySelector(".ov-dist");
      const sCell = tr.querySelector(".ov-st");
      if (dCell && dCell.textContent !== dist) dCell.textContent = dist;
      if (sCell && sCell.innerHTML !== r.status) sCell.innerHTML = r.status;
      
      // Re-append to ensure the DOM elements match the sorted rows order
      hudState.ovEntries.appendChild(tr);
      
      existing.delete(r.id);
    }
  }
  for (const tr of existing.values()) (tr as HTMLElement).remove();
}

export function updateHudOverviewPanelHeaders() {
  if (!hudState.ovPanel) return;
  const ths = hudState.ovPanel.querySelectorAll("thead th[data-sort]");
  for (const th of ths) {
    const key = (th as HTMLElement).dataset.sort;
    const label = key === "state" ? "State" : key === "class" ? "Class" : key === "name" ? "Name" : "Dist";
    const ind = hudState.ovSortKey === key ? (hudState.ovSortDir === 1 ? " ↑" : " ↓") : "";
    th.textContent = label + ind;
  }
}

/* ── Dock Prompt ── */
export function updateDockPrompt(sys: any) {
  // Gate prompt takes priority
  if (sys?.gates) {
    for (const g of sys.gates) {
      if (dst(G.P.x, G.P.y, g.x, g.y) < g.radius + GATE_RANGE) {
        const tgt = G.GALAXY[g.targetSysIdx];
        if (hudState.dockPrompt) {
          hudState.dockPrompt.textContent = `[F] Jump to ${tgt?.name || "Gate"}`;
          hudState.dockPrompt.classList.add("visible");
        }
        return;
      }
    }
  }

  if (hudState.dockPrompt) {
    hudState.dockPrompt.classList.remove("visible");
  }
}
