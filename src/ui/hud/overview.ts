import "../styles/hud-overview.css";
import { getState } from "../../state-access.js";
import type { System } from "../../types/world.js";
import { GATE_RANGE } from "../../constants.js";
import { dst } from "../../utils/math.js";
import { buildLocalOverviewRows } from "../bridge.js";
import { hudState } from "./state.js";
import { showEnemyCtxMenu } from "./enemy-menu.js";
import { formatDistance } from "../../utils/format.js";
import { t } from "../../utils/i18n.js";

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

  const existing = new Map<string, HTMLElement>();
  for (const tr of hudState.ovEntries.querySelectorAll("tr[data-id]")) {
    const id = (tr as HTMLElement).getAttribute("data-id");
    if (id) {
      existing.set(id, tr as HTMLElement);
    }
  }

  for (const r of rows) {
    let tr = existing.get(r.id);
    if (!tr) {
      tr = document.createElement("tr");
      tr.className = `ov-row ov-row-${r.kind}`;
      tr.setAttribute("data-id", r.id);
      const dist = typeof r.dist === "number" ? formatDistance(r.dist) : r.dist;
      const sig = String(r.sig);
      const relV = typeof r.relV === "number" ? Math.round(r.relV).toString() : String(r.relV);
      tr.innerHTML = `
        <td class="ov-icon">${r.icon}</td>
        <td class="ov-st">${r.status}</td>
        <td>${r.cls}</td>
        <td class="ov-name">${r.name.slice(0, 12)}</td>
        <td class="ov-num ov-dist">${dist}</td>
        <td class="ov-num ov-sig">${sig}</td>
        <td class="ov-num ov-relV">${relV}</td>`;

      tr.addEventListener("contextmenu", (ev) => {
        if (r.kind === "hostile" || r.kind === "neutral") {
          ev.preventDefault();
          ev.stopPropagation();
          showEnemyCtxMenu(ev.clientX, ev.clientY, r.id);
        }
      });

      hudState.ovEntries.appendChild(tr);
    } else {
      const dist = typeof r.dist === "number" ? formatDistance(r.dist) : r.dist;
      const sig = String(r.sig);
      const relV = typeof r.relV === "number" ? Math.round(r.relV).toString() : String(r.relV);
      const dCell = tr.querySelector(".ov-dist");
      const sigCell = tr.querySelector(".ov-sig");
      const rCell = tr.querySelector(".ov-relV");
      const sCell = tr.querySelector(".ov-st");
      if (dCell && dCell.textContent !== dist) dCell.textContent = dist;
      if (sigCell && sigCell.textContent !== sig) sigCell.textContent = sig;
      if (rCell && rCell.textContent !== relV) rCell.textContent = relV;
      if (sCell && sCell.innerHTML !== r.status) sCell.innerHTML = r.status;

      // Only re-append if this row is not already the last child (or not in correct position)
      const lastChild = hudState.ovEntries.lastElementChild;
      if (tr !== lastChild) {
        hudState.ovEntries.appendChild(tr);
      }

      existing.delete(r.id);
    }
  }
  for (const tr of existing.values()) tr.remove();
}

export function updateHudOverviewPanelHeaders() {
  if (!hudState.ovPanel) return;
  const ths = hudState.ovPanel.querySelectorAll("thead th[data-sort]");
  for (const th of ths) {
    const key = (th as HTMLElement).dataset.sort;
    const label = key === "state" ? t("hud.state") : key === "class" ? t("hud.class") : key === "name" ? t("common.name") : t("hud.dist");
    const ind = hudState.ovSortKey === key ? (hudState.ovSortDir === 1 ? " ↑" : " ↓") : "";
    const textEl = th.querySelector(".th-text");
    if (textEl) {
      textEl.textContent = label + ind;
    } else {
      th.textContent = label + ind;
    }
  }
}

export function initOverviewResizers(panelEl: HTMLElement) {
  const table = panelEl.querySelector(".ov-table") as HTMLElement;
  if (!table) return;
  const ths = table.querySelectorAll("thead th") as NodeListOf<HTMLElement>;

  // Function to compute total width of table to match the column sum (Excel-style)
  const updateTableTotalWidth = () => {
    let total = 0;
    ths.forEach((th) => {
      total += th.getBoundingClientRect().width;
    });
    table.style.minWidth = "100%";
    table.style.width = total + "px";
  };

  // Load custom widths from localStorage
  const savedWidths = localStorage.getItem("hud-overview-widths");
  if (savedWidths) {
    try {
      const widths = JSON.parse(savedWidths) as number[];
      ths.forEach((th, idx) => {
        if (widths[idx] !== undefined) {
          th.style.width = widths[idx] + "px";
        }
      });
      // Also adjust table total width to fit the saved values exactly
      let totalSaved = widths.reduce((sum, w) => sum + w, 0);
      table.style.minWidth = "100%";
      table.style.width = totalSaved + "px";
    } catch (e) {
      console.error("Failed to load saved column widths", e);
    }
  } else {
    // If no saved widths, set the initial table total width
    updateTableTotalWidth();
  }

  // Bind drag listeners to each resizer
  ths.forEach((th, index) => {
    const resizer = th.querySelector(".ov-resizer") as HTMLElement;
    if (!resizer) return;

    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation(); // Stop sorting trigger on th click!

      const startX = e.clientX;
      const startWidth = th.getBoundingClientRect().width;

      resizer.classList.add("resizing");

      // Record widths of all columns initially to adjust table width during drag
      const colWidths = Array.from(ths).map(t => t.getBoundingClientRect().width);

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const newWidth = Math.max(15, startWidth + dx); // min width 15px
        th.style.width = newWidth + "px";

        // Sum current widths to update total table width
        colWidths[index] = newWidth;
        const total = colWidths.reduce((sum, w) => sum + w, 0);
        table.style.minWidth = "100%";
        table.style.width = total + "px";
      };

      const onMouseUp = () => {
        resizer.classList.remove("resizing");
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        // Compute final actual widths and persist
        const finalWidths = Array.from(ths).map(t => t.getBoundingClientRect().width);
        localStorage.setItem("hud-overview-widths", JSON.stringify(finalWidths));
        
        // Finalize total table width
        const total = finalWidths.reduce((sum, w) => sum + w, 0);
        table.style.minWidth = "100%";
        table.style.width = total + "px";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  });
}

/* ── Dock Prompt ── */
export function updateDockPrompt(sys: System | null | undefined) {
  // Gate prompt takes priority
  if (sys?.gates) {
    for (const g of sys.gates) {
      if (dst(getState().player.x, getState().player.y, g.x, g.y) < g.radius + GATE_RANGE) {
        const tgt = getState().GALAXY[g.targetSysIdx];
        if (hudState.dockPrompt) {
          hudState.dockPrompt.textContent = t("hud.jumpTo", { name: tgt?.name || t("bridge.gateFallback") });
          hudState.dockPrompt.classList.add("visible");
        }
        return;
      }
    }
  }

  // Processing hub proximity check
  if (sys?.stations) {
    for (const st of sys.stations) {
      if (!st.isProcessingHub) continue;
      const interactR = (st.collectRadius ?? 220) + 80;
      if (dst(getState().player.x, getState().player.y, st.x, st.y) < interactR) {
        if (hudState.dockPrompt) {
          hudState.dockPrompt.textContent = t("hud.processingHub");
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
