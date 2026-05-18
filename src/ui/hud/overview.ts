import "../styles/hud-overview.css";
import { G } from "../../state.js";
import { GATE_RANGE } from "../../constants.js";
import { dst } from "../../utils/math.js";
import { buildLocalOverviewRows } from "../bridge.js";
import { hudState } from "./state.js";

/* ── Overview Panel ── */
export function updateHudOverviewPanel() {
  if (!hudState.ovEntries) return;
  const rows = buildLocalOverviewRows();
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
      existing.delete(r.id);
    }
  }
  for (const tr of existing.values()) (tr as HTMLElement).remove();
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
