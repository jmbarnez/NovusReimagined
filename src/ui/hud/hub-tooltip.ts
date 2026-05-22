import { G, Client } from "../../state.js";
import { dst } from "../../utils/math.js";
import { fmtDuration, hasHubOutput } from "../../hub.js";
import type { System, Station } from "../../types/world.js";

const TOOLTIP_EL_ID = "hud-hub-tooltip";

function getTooltipEl(): HTMLElement {
  let el = document.getElementById(TOOLTIP_EL_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = TOOLTIP_EL_ID;
    el.className = "hud-glass-panel";
    el.style.display = "none";
    el.style.position = "absolute";
    el.style.pointerEvents = "none";
    el.style.zIndex = "100";
    document.getElementById("hud-overlay")?.appendChild(el);
  }
  return el;
}

export function updateHubTooltip(sys: System | null) {
  const el = getTooltipEl();
  if (!sys) {
    el.style.display = "none";
    return;
  }

  const hub = sys.stations?.find((s: Station) => s.isProcessingHub);
  if (!hub) {
    el.style.display = "none";
    return;
  }

  const overlayOpen = Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen;
  const isHovered = !overlayOpen && dst(Client.mouseWorld.x, Client.mouseWorld.y, hub.x, hub.y) < hub.radius + 40;

  if (!isHovered) {
    el.style.display = "none";
    return;
  }

  const now = Date.now() / 1000;
  const queue = G.P.hubQueue ?? [];
  const output = G.P.hubOutput ?? { loot: {}, ore: {}, modules: [] };

  let html = `<div class="hub-tooltip-pane">`;
  html += `<div class="hub-tooltip-title">INDUSTRIAL PROCESSING HUB</div>`;

  if (queue.length > 0) {
    html += `<div class="hub-tooltip-section-title">ACTIVE PROCESSING</div>`;
    for (const job of queue) {
      const elapsed = now - job.startTime;
      const pct = Math.min(100, Math.floor((elapsed / job.duration) * 100));
      const label = job.kind === "asteroid" ? "Asteroid" : "Debris";
      const massTons = Math.round(job.mass / 100) / 10;
      const remaining = Math.max(0, job.duration - elapsed);
      
      html += `
        <div class="hub-tooltip-job">
          <div class="hub-tooltip-job-header">
            <span>${label} (${massTons}t)</span>
            <span class="hub-tooltip-eta">${remaining < 1 ? "Ready soon…" : fmtDuration(remaining)}</span>
          </div>
          <div class="hub-tooltip-progress-track">
            <div class="hub-tooltip-progress-fill ${job.kind}" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }
  }

  const hasOutput = hasHubOutput();
  if (hasOutput) {
    html += `<div class="hub-tooltip-section-title">CARGO READY FOR COLLECTION</div>`;
    html += `<div class="hub-tooltip-output-box">`;
    for (const [k, v] of Object.entries(output.loot)) {
      if ((v as number) > 0) {
        html += `<div class="hub-tooltip-output-item loot"><span>${k}</span><b class="pos-accent">${v}</b></div>`;
      }
    }
    for (const [k, v] of Object.entries(output.ore)) {
      if ((v as number) > 0) {
        html += `<div class="hub-tooltip-output-item ore"><span>${k} Ore</span><b class="ore-accent">${v}</b></div>`;
      }
    }
    for (const inst of output.modules) {
      html += `<div class="hub-tooltip-output-item module"><span>Module: ${inst.baseId}</span><b class="mod-accent">1</b></div>`;
    }
    html += `</div>`;
    html += `<div class="hub-tooltip-footer">[F] Dock to Collect</div>`;
  }

  if (queue.length === 0 && !hasOutput) {
    html += `<div class="hub-tooltip-idle">Idle — tow debris or asteroids into the ring.</div>`;
  }

  html += `</div>`;
  el.innerHTML = html;
  el.style.display = "block";

  // Position at mouse coords
  const rect = el.getBoundingClientRect();
  let left = Client.mouse.x + 14;
  let top = Client.mouse.y + 14;
  if (left + rect.width > window.innerWidth - 8) left = Client.mouse.x - rect.width - 14;
  if (top + rect.height > window.innerHeight - 8) top = Client.mouse.y - rect.height - 14;
  if (top < 8) top = 8;
  if (left < 8) left = 8;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
