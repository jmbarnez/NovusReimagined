import { MODULES, type DamageProfile } from "../../../data/modules.js";
import { moduleRackLabel } from "../../../utils/hardpoints.js";
import { escHtml } from "../../../utils/format.js";
import { RARITY_CONFIG } from "../../../data/moduleRarity.js";
import type { ModuleInstance } from "../../../types/moduleInstance.js";
import { RECIPES, type IndustryPool, type Recipe, poolItemLabel } from "../../../data/industryRecipes.js";
import { ORE_MARKET_BUY, COMPONENT_MARKET_BUY } from "../../../data/marketCatalog.js";
import { fmtModBonuses } from "../../station/shared.js";
import { ORE, LOOT, COMPONENTS } from "../../../data/resources.js";
import { t } from "../../../utils/i18n.js";
import { formatCompositionBreakdown } from "../../../utils/ore-naming.js";
import { itemIconSmall } from "../render.js";
import type { InventoryItem } from "../state.js";

const LOOT_SELL_PER_UNIT: Record<string, number> = {
  scrap: 5,
  chip: 45,
  cell: 22,
  "intact-part": 30,
};

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

export function buildInfoPanelInnerHTML(it: InventoryItem): string {
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
