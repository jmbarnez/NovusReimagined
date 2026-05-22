import { hudState } from "./state.js";
import { ORE, LOOT } from "../../data/resources.js";
import { MODULES } from "../../data/modules.js";
import { RARITY_CONFIG } from "../../data/moduleRarity.js";
import type { ModuleInstance } from "../../types/moduleInstance.js";

const ICON_SVG = (paths: string, vb: string = "0 0 16 16") => 
  `<svg class="inv-svg-icon" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const ICONS: Record<string, string> = {
  ore:        ICON_SVG('<path d="M5 13L3 8l4-5 4 5-2 5z"/><path d="M5 8h6"/>'),
  ammo:       ICON_SVG('<rect x="6" y="2" width="4" height="10" rx="2"/><path d="M7 12v2"/>'),
  refined:    ICON_SVG('<rect x="3" y="6" width="10" height="7" rx="1"/><path d="M5 6V4h6v2"/>'),
  loot:       ICON_SVG('<path d="M4 13l2-9 4 0 2 9z"/><path d="M6 7h4"/>'),
  component:  ICON_SVG('<rect x="3" y="5" width="10" height="8" rx="1"/><path d="M6 5V3h4v2"/><path d="M5 9h6"/><path d="M5 11h4"/>'),
  module:     ICON_SVG('<rect x="3" y="3" width="10" height="10" rx="1"/><circle cx="8" cy="8" r="2"/>'),
  turret:     ICON_SVG('<circle cx="8" cy="8" r="5"/><path d="M8 3v3M8 10v3M3 8h3M10 8h3"/>'),
  high:       ICON_SVG('<path d="M8 2v6l4 2"/><circle cx="8" cy="8" r="5"/>'),
  med:        ICON_SVG('<path d="M8 2v4"/><path d="M3 13c0-3 2.2-5 5-5s5 2 5 5z"/>'),
  low:        ICON_SVG('<rect x="3" y="6" width="10" height="7" rx="1"/><path d="M5 6V4h6v2"/><path d="M3 10h10"/>'),
  credits:    ICON_SVG('<circle cx="8" cy="8" r="6"/><path d="M8 4v8M5.5 8h5"/>'),
};

export function showPickupToast(kind: string, payload: string, qty: number, instance?: ModuleInstance) {
  if (!hudState.pickupContainer) return;

  let name = "";
  let icon = "";
  let color = "#ffffff";

  if (kind === "ore") {
    const def = ORE[payload];
    name = def?.label || (payload.charAt(0).toUpperCase() + payload.slice(1) + " Ore");
    icon = ICONS.ore;
    color = def?.color || "#ffe066";
  } else if (kind === "loot") {
    const def = LOOT[payload];
    name = def?.label || (payload.charAt(0).toUpperCase() + payload.slice(1));
    icon = ICONS.loot;
    color = def?.color || "#aaffaa";
  } else if (kind === "credits") {
    name = "Credits";
    icon = ICONS.credits;
    color = "#ffe066";
  } else if (kind === "module") {
    const m = MODULES[payload];
    const rarityColor = instance ? RARITY_CONFIG[instance.rarity]?.color : "#00e8c8";
    name = instance ? `${instance.rarity} ${m?.name || payload}` : (m?.name || payload);
    color = rarityColor || "#00e8c8";

    const rack = m?.rack;
    if (rack === "turret") icon = ICONS.turret;
    else if (rack === "high") icon = ICONS.high;
    else if (rack === "med") icon = ICONS.med;
    else if (rack === "low") icon = ICONS.low;
    else icon = ICONS.module;
  }

  const toast = document.createElement("div");
  toast.className = "pickup-toast";
  toast.style.setProperty("--pickup-accent", color);

  toast.innerHTML = `
    <div class="pickup-icon" style="color: ${color};">${icon}</div>
    <div class="pickup-details">
      <span class="pickup-name">${name}</span>
      <span class="pickup-qty">x${qty}</span>
    </div>
  `;

  hudState.pickupContainer.appendChild(toast);

  // Trigger smooth fade-out and destruction after a standard period
  setTimeout(() => {
    toast.classList.add("fading");
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 2100);
}
