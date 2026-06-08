import { ORE } from "../../../../data/resources.js";
import { escHtml } from "../../../../utils/format.js";
import { stationState, iconSvg } from "../../shared.js";
import { MACHINES, poolItemLabel, type IndustryPool } from "../../../../data/industryRecipes.js";
import { HEAT_OPTIONS, selectedHeatMode } from "./state.js";
import { stockOf } from "./state.js";

export function formatVolume(volumeM3: number): string {
  return `${volumeM3.toFixed(2)} m³`;
}

export function formatMass(massKg: number): string {
  return `${Math.round(massKg).toLocaleString()} kg`;
}

export function formatQty(pool: IndustryPool, qty: number): string {
  return pool === "material" ? formatVolume(qty) : `${qty}×`;
}

export function oreColor(key: string): string {
  return ORE[key]?.color ?? "#b48a52";
}

export function renderHeatSelect(seed: string): string {
  const current = selectedHeatMode(seed);
  return `
    <label class="ind-heat-control">
      <span>Heat</span>
      <select class="ind-heat-select" data-heat-for="${seed}">
        ${HEAT_OPTIONS.map((option) => `<option value="${option.id}" ${option.id === current ? "selected" : ""}>${option.label}</option>`).join("")}
      </select>
    </label>
  `;
}

export function ioPill(pool: IndustryPool, key: string, qty: number, showStock: boolean): string {
  const label = escHtml(poolItemLabel(pool, key));
  const stock = stockOf(pool, key);
  const icon = iconSvg(key, 14);
  const insufficient = showStock && stock + 1e-6 < qty;
  const stockText = showStock ? ` <em>${pool === "material" ? formatVolume(stock) : stock}</em>` : "";
  return `<span class="io-pill io-pill--${pool} ${insufficient ? "insufficient" : ""}">${icon}${formatQty(pool, qty)} ${label}${stockText}</span>`;
}

export function formatTime(seconds: number): string {
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${minutes}m ${secs}s`;
}

export function renderRefineryStockEmpty(message: string): string {
  return `<div class="ind-stage-empty">${escHtml(message)}</div>`;
}

export function machineLabel(machineId: string): string {
  return MACHINES.find((machine) => machine.id === machineId)?.label ?? machineId;
}
