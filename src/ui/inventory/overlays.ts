import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { MODULES, type DamageProfile } from "../../data/modules.js";
import { moduleFitsShipRack, moduleRackLabel } from "../../utils/hardpoints.js";
import { escHtml } from "../../utils/format.js";
import { sfxBlip, sfxConfirm, sfxError } from "../../audio/procedural.js";
import { RARITY_CONFIG } from "../../data/moduleRarity.js";
import { canModifyFitting } from "../../utils/fitting-gate.js";
import { RACK_TYPES } from "../../constants.js";
import type { ModuleInstance } from "../../types/moduleInstance.js";
import { RECIPES, type IndustryPool, type Recipe, poolItemLabel } from "../../data/industryRecipes.js";
import { ORE_MARKET_BUY, COMPONENT_MARKET_BUY } from "../../data/marketCatalog.js";
import { fmtModBonuses } from "../station/shared.js";
import { ORE, LOOT, COMPONENTS } from "../../data/resources.js";
import { openHudWindow, closeHudWindow, isOpen as isHudWindowOpen } from "../hud/windows.js";
import { t } from "../../utils/i18n.js";
import { formatCompositionBreakdown } from "../../utils/ore-naming.js";
import { itemIconSmall } from "./render.js";
import { type InventoryItem, INV_STATE } from "./state.js";
import { normalizeItems } from "./tree.js";

const CTX_ROOT_ID = "inv-ctx-root";
const INFO_WINDOW_ID = "item-info";
const TOAST_ID = "inv-cargo-toast";
const HOVER_TIP_ID = "inv-hover-tip";

/** Stacks at or above this total qty require confirmation before jettison-all. */
const JETTISON_CONFIRM_THRESHOLD = 50;

const LOOT_SELL_PER_UNIT: Record<string, number> = {
  scrap: 5,
  chip: 45,
  cell: 22,
  "intact-part": 30,
};

let bridgeToastTimeout: ReturnType<typeof setTimeout> | null = null;

/** Toast visible in HUD cargo window (also tries legacy #bridge-toast when present). */
export function showCargoToast(msg: string) {
  const show = (el: HTMLElement | null) => {
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = "1";
  };
  show(document.getElementById(TOAST_ID));
  const legacy = document.getElementById("bridge-toast");
  if (legacy) show(legacy as HTMLElement);

  if (bridgeToastTimeout) clearTimeout(bridgeToastTimeout);
  bridgeToastTimeout = setTimeout(() => {
    document.getElementById(TOAST_ID) && ((document.getElementById(TOAST_ID) as HTMLElement).style.opacity = "0");
    const leg = document.getElementById("bridge-toast");
    if (leg) (leg as HTMLElement).style.opacity = "0";
  }, 2400);
}

function ensureInvCtxRoot(): HTMLElement {
  let el = document.getElementById(CTX_ROOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = CTX_ROOT_ID;
    el.setAttribute("role", "presentation");
    el.style.display = "none";
    el.style.position = "fixed";
    el.style.left = "0";
    el.style.top = "0";
    el.style.zIndex = "9200";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
  }
  return el as HTMLElement;
}

function ensureCargoToast(): HTMLElement {
  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = TOAST_ID;
    el.className = "inv-toast-float";
    el.style.opacity = "0";
    document.body.appendChild(el);
  }
  return el as HTMLElement;
}

function ensureInvHoverTip(): HTMLElement {
  let el = document.getElementById(HOVER_TIP_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = HOVER_TIP_ID;
    el.className = "inv-hover-tip";
    el.style.display = "none";
    document.body.appendChild(el);
  }
  return el as HTMLElement;
}

export function showInvHoverTip(it: InventoryItem, clientX: number, clientY: number) {
  const el = ensureInvHoverTip();
  const nameColor = it.rarityColor ?? "var(--hud-text-bright)";
  const volStr = ((it.vol || 0) * it.qty).toFixed(1);
  const subLine = it.type === "mixedOre" && it.composition
    ? formatCompositionBreakdown(it.composition)
    : it.type === "material" && it.composition
      ? formatCompositionBreakdown(it.composition)
    : it.group;
  el.innerHTML = `
    <div class="inv-hover-tip-name" style="color:${nameColor}">${escHtml(it.name)}</div>
    <div class="inv-hover-tip-sub">${escHtml(subLine)} · ${volStr} m³ · ${it.qty.toLocaleString()}×</div>
  `;
  el.style.display = "block";
  const scale = Client.settings?.uiScale ?? 1.0;
  el.style.left = `${(clientX + 12) / scale}px`;
  el.style.top = `${(clientY + 12) / scale}px`;

  requestAnimationFrame(() => {
    const pad = 6;
    const r = el.getBoundingClientRect();
    let left = clientX + 12;
    let top = clientY + 12;
    if (left + r.width > window.innerWidth - pad) left = Math.max(pad, clientX - r.width - 8);
    if (top + r.height > window.innerHeight - pad) top = Math.max(pad, clientY - r.height - 8);
    el.style.left = `${left / scale}px`;
    el.style.top = `${top / scale}px`;
  });
}

export function hideInvHoverTip() {
  const el = document.getElementById(HOVER_TIP_ID);
  if (el) el.style.display = "none";
}

function clampCtxPosition(el: HTMLElement, clientX: number, clientY: number) {
  const pad = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = clientX;
  let top = clientY;

  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect();
    if (left + r.width > vw - pad) left = Math.max(pad, vw - r.width - pad);
    if (top + r.height > vh - pad) top = Math.max(pad, vh - r.height - pad);
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    const scale = Client.settings?.uiScale ?? 1.0;
    el.style.left = `${left / scale}px`;
    el.style.top = `${top / scale}px`;
  });
}

let docDismissAttached = false;
export function ensureOutsideDismissHandlers(closeContextMenu: () => void) {
  if (docDismissAttached) return;
  docDismissAttached = true;
  document.addEventListener(
    "mousedown",
    (ev) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      if (t.closest(`#${CTX_ROOT_ID}`) || t.closest(`#hud-win-${INFO_WINDOW_ID}`)) return;
      closeContextMenu();
    },
    true,
  );
}

function getIndustryPoolInput(it: InventoryItem): { pool: IndustryPool; key: string } | null {
  if (it.type === "ore") return { pool: "ore", key: it.key };
  if (it.type === "material") return { pool: "material", key: it.key };
  if (it.type === "loot") return { pool: "loot", key: it.key };
  if (it.type === "component") return { pool: "component", key: it.key };
  return null;
}

function recipesUsingInput(pool: IndustryPool, key: string): Recipe[] {
  return RECIPES.filter((rec) => rec.inputs.some((inp) => inp.pool === pool && inp.key === key));
}

function damageRowLabel(profile?: DamageProfile | null): string {
  if (!profile) return "";
  const labels: Record<string, string> = { em: t("hangar.em"), therm: t("hangar.thermal"), kin: t("hangar.kinetic"), exp: t("hangar.explosive") };
  return Object.entries(profile)
    .filter(([, v]) => v)
    .map(([dmgType, v]) => `${v} ${labels[dmgType] || dmgType}`)
    .join(" / ");
}

function estimateUnitMarketValue(it: InventoryItem): number | null {
  if (it.type === "ore") return ORE_MARKET_BUY[it.key] ?? null;
  if (it.type === "component") return COMPONENT_MARKET_BUY[it.key] ?? null;
  if (it.type === "loot") return LOOT_SELL_PER_UNIT[it.key] ?? null;
  if (it.type === "ammo") {
    if (it.key === "hybrid") return 40 / 500;
    if (it.key === "missile") return 95 / 24;
    return null;
  }
  if (it.type === "module" || it.type === "fitting") {
    const m = it.meta;
    const inst = it.instance;
    if (!m) return null;
    const rarityMult = inst ? RARITY_CONFIG[inst.rarity]?.sellMult ?? 1 : 1;
    return Math.floor(m.price * 0.6 * rarityMult);
  }
  return null;
}

function estimateStackValue(it: InventoryItem): { low: number | null; high: number | null; note?: string } {
  const per = estimateUnitMarketValue(it);
  if (per == null || !Number.isFinite(per)) return { low: null, high: null };
  const total = per * it.qty;
  return { low: total, high: total };
}

function fmtAffixesShort(affixes: ModuleInstance["affixes"]): string {
  return affixes.map((a) => {
    const v = a.value;
    const pct = Math.abs(v) < 1 ? `${(v * 100).toFixed(0)}%` : v.toFixed(1);
    return `${v >= 0 ? "+" : ""}${pct} ${a.name}`;
  }).join(", ");
}

function buildInfoPanelInnerHTML(it: InventoryItem): string {
  const titleColor = it.rarityColor ?? "var(--hud-text-bright)";
  const icon = itemIconSmall(it);
  const volTot = (it.vol || 0) * it.qty;
  const val = estimateStackValue(it);

  let body = "";
  body += `<div class="inv-info-stats">`;
  body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.group")}</span><span class="inv-info-v">${escHtml(it.group)}</span></div>`;
  if (it.type === "mixedOre" && it.composition) {
    body += `<div class="inv-info-stat-row"><span class="inv-info-k">Composition</span><span class="inv-info-v">${escHtml(formatCompositionBreakdown(it.composition))}</span></div>`;
  }
  if (it.type === "material" && it.composition) {
    body += `<div class="inv-info-stat-row"><span class="inv-info-k">Composition</span><span class="inv-info-v">${escHtml(formatCompositionBreakdown(it.composition))}</span></div>`;
  }
  body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.quantity")}</span><span class="inv-info-v">${it.qty.toLocaleString()}</span></div>`;
  body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.volume")}</span><span class="inv-info-v">${volTot.toFixed(2)} m³</span></div>`;
  if (typeof it.massKg === "number") {
    body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.mass")}</span><span class="inv-info-v">${Math.round(it.massKg).toLocaleString()} kg</span></div>`;
  }
  if (val.note) {
    body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.market")}</span><span class="inv-info-v inv-info-muted">${escHtml(val.note)}</span></div>`;
  } else if (val.low != null) {
    const label = it.type === "ammo" ? t("inventory.estBuy") : t("inventory.estSell");
    body += `<div class="inv-info-stat-row"><span class="inv-info-k">${label}</span><span class="inv-info-v">${Math.floor(val.low).toLocaleString()}¢ total</span></div>`;
  } else {
    body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.value")}</span><span class="inv-info-v inv-info-muted">—</span></div>`;
  }
  body += `</div>`;

  const poolKey = getIndustryPoolInput(it);
  if (poolKey) {
    const used = recipesUsingInput(poolKey.pool, poolKey.key);
    if (used.length) {
      body += `<div class="inv-info-section-title">${t("inventory.usedInRecipes")}</div><ul class="inv-info-recipe-list">`;
      for (const r of used) {
        const outs = r.outputs
          .map((o) => `${o.qty}× ${escHtml(poolItemLabel(o.pool, o.key))}`)
          .join(", ");
        body += `<li class="inv-info-recipe-row"><span class="inv-info-rec-name">${escHtml(r.label)}</span><span class="inv-info-rec-out">→ ${outs}</span></li>`;
      }
      body += `</ul>`;
    } else {
      body += `<div class="inv-info-section-title">${t("hud.industry")}</div><p class="inv-info-muted inv-info-p">${t("inventory.noRecipes")}</p>`;
    }
  }

  const m = it.meta;
  const inst = it.instance;
  if (m) {
    body += `<div class="inv-info-section-title">${it.type === "fitting" ? t("inventory.fittedModule") : t("inventory.module")}</div>`;
    body += `<p class="inv-info-desc">${escHtml(m.desc)}</p>`;
    body += `<div class="inv-info-stats">`;
    body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.rack")}</span><span class="inv-info-v">${escHtml(moduleRackLabel(m.rack))}</span></div>`;
    body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.powergrid")}</span><span class="inv-info-v">${m.powergrid}</span></div>`;
    body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.cpu")}</span><span class="inv-info-v">${m.cpu}</span></div>`;
    body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.mass")}</span><span class="inv-info-v">${m.massKg} kg</span></div>`;
    body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.buyPrice")}</span><span class="inv-info-v">${m.price.toLocaleString()}¢</span></div>`;
    body += `</div>`;

    const bonuses = fmtModBonuses(m);
    if (bonuses) {
      body += `<div class="inv-info-section-title">${t("inventory.bonuses")}</div><div class="inv-info-bonuses">${escHtml(bonuses)}</div>`;
    }

    if (m.weaponDelivery) {
      const dmg = damageRowLabel(m.damageProfile);
      body += `<div class="inv-info-stats">`;
      body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.delivery")}</span><span class="inv-info-v">${escHtml(m.weaponDelivery)}</span></div>`;
      if (dmg) body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.damage")}</span><span class="inv-info-v">${escHtml(dmg)}</span></div>`;
      if (m.optimalRange != null) {
        body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.optimal")}</span><span class="inv-info-v">${m.optimalRange} km${m.falloff != null ? ` +${m.falloff} ${t("ship.falloff")}` : ""}</span></div>`;
      }
      if (m.trackingSpeed != null) {
        body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.tracking")}</span><span class="inv-info-v">${Math.round(m.trackingSpeed * 100)}%</span></div>`;
      }
      body += `</div>`;
    }

    if (m.mining || m.isSalvager || m.isActive || m.capDrainPerSec) {
      body += `<div class="inv-info-stats">`;
      if (m.mining && m.optimalRange) {
        body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.miningRange")}</span><span class="inv-info-v">${m.optimalRange} m</span></div>`;
      }
      if (m.isSalvager) {
        body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.salvager")}</span><span class="inv-info-v">+${Math.round((m.salvageRollBonus || 0) * 100)}%</span></div>`;
      }
      if (m.isActive) body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.type")}</span><span class="inv-info-v">${t("inventory.active")}</span></div>`;
      if (m.capDrainPerSec) {
        body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("tooltip.capDrain")}</span><span class="inv-info-v">${m.capDrainPerSec}/s</span></div>`;
      }
      body += `</div>`;
    }

    if (inst) {
      const durPct = Math.round((inst.durability / inst.maxDurability) * 100);
      body += `<div class="inv-info-section-title">${t("inventory.instance")}</div>`;
      body += `<div class="inv-info-stats">`;
      body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.rarity")}</span><span class="inv-info-v" style="color:${titleColor}">${escHtml(inst.rarity)}</span></div>`;
      body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.itemLevel")}</span><span class="inv-info-v">${inst.itemLevel}</span></div>`;
      body += `<div class="inv-info-stat-row"><span class="inv-info-k">${t("inventory.durability")}</span><span class="inv-info-v">${durPct}% (${Math.round(inst.durability)}/${Math.round(inst.maxDurability)})</span></div>`;
      body += `</div>`;
      body += `<div class="inv-info-dur"><div class="inv-info-dur-fill" style="width:${Math.max(0, Math.min(100, durPct))}%"></div></div>`;
      if (inst.affixes.length) {
        body += `<div class="inv-info-section-title">${t("inventory.affixes")}</div><div class="inv-info-affixes">${escHtml(fmtAffixesShort(inst.affixes))}</div>`;
      }
    }
  }

  return `
    <div class="inv-info-content">
      <div class="inv-info-hero">
        <div class="inv-info-icon-wrap">${icon}</div>
        <div class="inv-info-titles">
          <div class="inv-info-name" style="color:${titleColor}">${escHtml(it.name)}</div>
          <div class="inv-info-sub">${escHtml(it.group)}</div>
        </div>
      </div>
      <div class="inv-info-body">${body}</div>
    </div>
  `;
}

function buildContextMenuHTML(itemId: string): string {
  const all = normalizeItems();
  const it = all.find((i) => i.id === itemId);
  if (!it) return "";

  const slotsLabelKey: Record<string, string> = {
    turret: t("inventory.slotTurret"),
    high: t("inventory.slotHigh"),
    med: t("inventory.slotMed"),
    low: t("inventory.slotLow"),
  };

  const rows: { action: string; label: string; disabled?: boolean }[] = [];
  const gate = canModifyFitting();

  if (it.type === "module" && it.meta?.rack) {
    const modRack = it.meta.rack;
    const uid = it.instance?.uid ?? it.key;
    for (const shipRack of RACK_TYPES) {
      const slots = getState().player.fitting[shipRack] ?? [];
      if (slots.length === 0) continue;
      if (!moduleFitsShipRack(modRack, shipRack)) continue;
      for (let i = 0; i < slots.length; i++) {
        const slotLabel = `${slotsLabelKey[shipRack] || shipRack} ${i + 1}`;
        if (!slots[i]) {
          rows.push({ action: `fit:${shipRack}:${i}`, label: t("inventory.fitTo", { slot: slotLabel }), disabled: !gate.ok });
        } else if (slots[i] !== uid) {
          rows.push({ action: `swap:${shipRack}:${i}`, label: t("inventory.swapWith", { slot: slotLabel }), disabled: !gate.ok });
        }
      }
    }
  }

  if (it.type === "fitting") {
    const [rack, idxStr] = it.key.split(":");
    rows.push({ action: `unfit:${rack}:${idxStr}`, label: t("inventory.unfit"), disabled: !gate.ok });
  }

  if (it.container !== "shipFitting") {
    if (it.type === "module") {
      rows.push({ action: "jettison-all", label: t("inventory.jettison") });
    } else if (it.qty > 1) {
      rows.push({ action: "jettison-all", label: t("inventory.jettisonAll", { qty: it.qty.toLocaleString() }) });
      rows.push({ action: "jettison-partial", label: t("inventory.jettisonQty") });
    } else {
      rows.push({ action: "jettison-all", label: t("inventory.jettison") });
    }
  }

  rows.push({ action: "info", label: t("inventory.showInfo") });

  return `<div class="inv-ctx">
    ${rows.map((row) => {
      const cls = row.disabled ? "inv-ctx-item is-disabled" : "inv-ctx-item";
      const extra = row.disabled ? ' aria-disabled="true"' : "";
      return `<div class="${cls}" data-action="${row.action}" data-item="${itemId}"${extra}>${escHtml(row.label)}</div>`;
    }).join("")}
  </div>`;
}

export interface ContextFitAction {
  kind: "fit" | "swap" | "unfit";
  rack: "turret" | "high" | "med" | "low";
  slotIdx: number;
  uid: string;
}

export interface InventoryOverlayHandlers {
  onCloseContextMenu: () => void;
  onJettisonItem: (itemId: string, qty: number | null) => void;
  onShowInfoPanel: (itemId: string, anchorX?: number, anchorY?: number) => void;
  onFitAction: (action: ContextFitAction) => void;
  onRerender: () => void;
}

export function updateInvContextOverlay(handlers: InventoryOverlayHandlers) {
  ensureOutsideDismissHandlers(handlers.onCloseContextMenu);
  ensureCargoToast();
  const root = ensureInvCtxRoot();
  const cm = INV_STATE.contextMenu;
  if (!cm) {
    root.style.display = "none";
    root.style.pointerEvents = "none";
    root.innerHTML = "";
    return;
  }

  const html = buildContextMenuHTML(cm.itemId);
  if (!html) {
    INV_STATE.contextMenu = null;
    root.style.display = "none";
    root.style.pointerEvents = "none";
    root.innerHTML = "";
    return;
  }

  root.innerHTML = html;
  root.style.display = "block";
  root.style.pointerEvents = "auto";

  const menuEl = root.querySelector(".inv-ctx") as HTMLElement | null;
  if (menuEl) {
    const scale = Client.settings?.uiScale ?? 1.0;
    menuEl.style.left = `${cm.x / scale}px`;
    menuEl.style.top = `${cm.y / scale}px`;
    clampCtxPosition(menuEl, cm.x, cm.y);
  }

  root.onclick = (ev) => {
    ev.stopPropagation();
    const target = ev.target as HTMLElement | null;
    const item = target?.closest?.(".inv-ctx-item") as HTMLElement | null;
    if (!item || item.classList.contains("is-disabled")) return;
    const action = item.dataset.action;
    const itemId = item.dataset.item;
    if (!action || !itemId) return;

    if (action === "jettison-all") {
      const all = normalizeItems();
      const it = all.find((i) => i.id === itemId);
      if (!it) return;
      if (it.qty >= JETTISON_CONFIRM_THRESHOLD) {
        if (!window.confirm(t("inventory.confirmJettisonAll", { qty: it.qty.toLocaleString(), name: it.name }))) {
          handlers.onCloseContextMenu();
          return;
        }
      }
      sfxConfirm();
      handlers.onJettisonItem(itemId, null);
    } else if (action === "jettison-partial") {
      const all = normalizeItems();
      const it = all.find((i) => i.id === itemId);
      if (!it || it.qty <= 1) return;
      const raw = window.prompt(t("inventory.promptJettisonQty", { qty: it.qty }), "1");
      if (raw == null) {
        handlers.onCloseContextMenu();
        return;
      }
      const n = parseInt(raw.replace(/,/g, ""), 10);
      if (!Number.isFinite(n) || n < 1 || n > it.qty) {
        sfxError();
        showCargoToast(t("inventory.invalidQty"));
        handlers.onCloseContextMenu();
        return;
      }
      if (n >= JETTISON_CONFIRM_THRESHOLD) {
        if (!window.confirm(t("inventory.confirmJettison", { n: n.toLocaleString(), name: it.name }))) {
          handlers.onCloseContextMenu();
          return;
        }
      }
      sfxConfirm();
      handlers.onJettisonItem(itemId, n);
    } else if (action === "info") {
      sfxBlip();
      const { x: ax, y: ay } = cm;
      handlers.onCloseContextMenu();
      handlers.onShowInfoPanel(itemId, ax, ay);
      return;
    } else if (action.startsWith("fit:") || action.startsWith("swap:") || action.startsWith("unfit:")) {
      const parts = action.split(":");
      const kind = parts[0] as "fit" | "swap" | "unfit";
      const rack = parts[1] as "turret" | "high" | "med" | "low";
      const slotIdx = parseInt(parts[2] ?? "", 10);
      const allItems = normalizeItems();
      const mod = allItems.find((i) => i.id === itemId);
      if (!mod || !Number.isFinite(slotIdx)) return;
      const uid = mod.instance?.uid ?? mod.key;
      if (!canModifyFitting().ok) {
        sfxError();
        showCargoToast(t("inventory.cannotModify"));
        handlers.onCloseContextMenu();
        return;
      }
      handlers.onFitAction({ kind, rack, slotIdx, uid });
      sfxConfirm();
      handlers.onRerender();
    }
    handlers.onCloseContextMenu();
  };
}

export function updateInvInfoOverlay() {
  const id = INV_STATE.infoPanelItemId;
  if (!id) {
    if (isHudWindowOpen(INFO_WINDOW_ID)) closeHudWindow(INFO_WINDOW_ID);
    return;
  }
  const all = normalizeItems();
  const it = all.find((i) => i.id === id);
  if (!it) {
    INV_STATE.infoPanelItemId = null;
    INV_STATE.infoPanelAnchor = null;
    if (isHudWindowOpen(INFO_WINDOW_ID)) closeHudWindow(INFO_WINDOW_ID);
    return;
  }
  openHudWindow(INFO_WINDOW_ID, it.name, buildInfoPanelInnerHTML(it), () => {
    INV_STATE.infoPanelItemId = null;
    INV_STATE.infoPanelAnchor = null;
  });
}

export function updateInvOverlays(handlers: InventoryOverlayHandlers) {
  updateInvContextOverlay(handlers);
  updateInvInfoOverlay();
}
