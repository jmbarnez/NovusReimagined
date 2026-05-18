import "../styles/station-hangar.css";
import { G, Client } from "../../state.js";
import { SHIPS } from "../../data/ships.js";
import { MODULES } from "../../data/modules.js";
import { getStats, computeStats } from "../../player/player-stats.js";
import { escHtml } from "../../utils/format.js";
import { MODULE_HP_MAX } from "../../constants.js";
import { stationState, CONTRACT_TYPE_ICONS, fmtModBonuses, iconSvg } from "./shared.js";
import { getInstance } from "../../utils/items.js";
import { ModuleInstance } from "../../types/moduleInstance.js";
import { RARITY_CONFIG } from "../../data/moduleRarity.js";
import { poolItemLabel } from "../../data/industryRecipes.js";

export function buildStatHtml(st: any, pst: any): string {
  const getValue = (obj: any, k: string) => k.split('.').reduce((o: any, i: string) => o?.[i], obj);
  const renderStat = (label: string, key: string, unit: string = "", invert: boolean = false, maxKey?: string) => {
    const cur = getValue(st, key) as number;
    const curMax = maxKey ? getValue(st, maxKey) as number : null;
    const pre = pst ? (getValue(pst, key) as number) : cur;
    const preMax = (pst && maxKey) ? (getValue(pst, maxKey) as number) : curMax;
    const diff = pre - cur;
    const diffMax = (preMax !== null && curMax !== null) ? preMax - curMax : 0;
    const hasDiff = Math.abs(diff) > 0.0001 || Math.abs(diffMax) > 0.0001;
    if (!hasDiff) {
      const valText = unit === '×' ? cur.toFixed(2) : Math.round(cur);
      const maxText = curMax !== null ? ` / ${Math.round(curMax)}` : '';
      return `<div class="st-stat-card"><div class="lbl">${label}</div><div class="val">${valText}${maxText}${unit}</div></div>`;
    }
    const isGood = invert ? diff < 0 : diff > 0;
    const deltaHtml = Math.abs(diff) > 0.0001
      ? `<span class="delta ${isGood ? 'pos' : 'neg'}">${diff > 0 ? '+' : ''}${unit === '×' ? diff.toFixed(2) : Math.round(diff)}</span>` : '';
    const maxDeltaHtml = Math.abs(diffMax) > 0.0001
      ? `<span class="delta ${diffMax > 0 ? 'pos' : 'neg'}">${diffMax > 0 ? '+' : ''}${Math.round(diffMax)}</span>` : '';
    const curValText = unit === '×' ? cur.toFixed(2) : Math.round(cur);
    const curMaxText = curMax !== null ? ` / ${Math.round(curMax)}` : '';
    return `<div class="st-stat-card"><div class="lbl">${label}</div><div class="val">${curValText}${deltaHtml}${curMaxText}${maxDeltaHtml}${unit}</div></div>`;
  };
  return [
    renderStat("Hull", "maxHp"), renderStat("Armor", "maxStructure"),
    renderStat("Shield", "maxShield"), renderStat("Shield Regen", "shieldRegen", "/s"),
    renderStat("Energy", "maxEnergy"), renderStat("Energy Regen", "energyRegen", "/s"),
    renderStat("PG Usage", "usedPG", "", true, "totalPG"), renderStat("CPU Usage", "usedCPU", "", true, "totalCPU"),
    renderStat("Speed", "maxSpeed", " px/s"), renderStat("Agility", "thrustScale", "×"),
    renderStat("Turn Rate", "turnRate", " rad/s"), renderStat("Mass Mult", "massMult", "×", true),
    renderStat("Weapon Dmg", "finalDmg"), renderStat("Weapon Range", "wProf.range", " px"),
  ].join("");
}

export function updateStatsGrid() {
  const grid = document.getElementById("hangar-stats-grid");
  if (!grid) return;
  const st = getStats();
  const pst = stationState.previewFitting ? computeStats(stationState.previewFitting) : null;
  grid.innerHTML = buildStatHtml(st, pst);
  const pgOv = st.usedPG > st.totalPG, cpuOv = st.usedCPU > st.totalCPU;
  const warn = document.getElementById("hangar-stats-warn");
  if (warn) warn.innerHTML =
    (pgOv ? `<div class="al">⚠ Powergrid overloaded! Stats penalized.</div>` : "") +
    (cpuOv ? `<div class="al">⚠ CPU overloaded! Active modules disabled.</div>` : "") +
    `<span>Hover slots to preview changes.</span>`;
}

export function setPreview(rack: "turret" | "high" | "med" | "low", idx: number, instanceId: string | null) {
  const temp = {
    turret: [...G.P.fitting.turret],
    high: [...G.P.fitting.high],
    med: [...G.P.fitting.med],
    low: [...G.P.fitting.low],
  };
  temp[rack][idx] = instanceId;
  stationState.previewFitting = temp;
  updateStatsGrid();
}

function fmtAffixesShort(affixes: ModuleInstance["affixes"]): string {
  return affixes.map(a => {
    const v = a.value;
    const pct = Math.abs(v) < 1 ? (v * 100).toFixed(0) + "%" : v.toFixed(1);
    return `${v >= 0 ? "+" : ""}${pct} ${a.name}`;
  }).join(", ");
}

function renderSlot(rack: string, i: number, instanceId: string | null): string {
  const instance = instanceId ? getInstance(instanceId) : null;
  const m = instance ? MODULES[instance.baseId] : null;

  // Collect all UIDs currently fitted across all racks
  const fittedUids = new Set<string>();
  for (const r of ["turret", "high", "med", "low"] as const) {
    for (const uid of G.P.fitting[r]) {
      if (uid) fittedUids.add(uid);
    }
  }
  const availInstances = G.P.moduleCargo.filter(inst =>
    MODULES[inst.baseId]?.rack === rack && !fittedUids.has(inst.uid)
  );

  if (instance && m) {
    const hp = G.P.moduleHp?.[rack]?.[i] ?? MODULE_HP_MAX;
    const durPct = Math.round((instance.durability / instance.maxDurability) * 100);
    const dmgTag = instance.durability <= 0 ? ` <span style="color:#ff4444">[OFFLINE]</span>` : durPct < 100 ? ` <span style="color:#ff8844">[DUR ${durPct}%]</span>` : "";
    const bonuses = fmtModBonuses(m);
    const affixStr = fmtAffixesShort(instance.affixes);
    const rarityCfg = RARITY_CONFIG[instance.rarity];

    return `<div class="slot filled minimal" data-rack="${rack}" data-idx="${i}" data-instance="${instance.uid}" style="border-left: 3px solid ${rarityCfg.color}">
      <div class="slot-main">
        <div class="slot-info">
          <div class="slot-title">
            <span class="slot-icon">${iconSvg(m.id, 14)}</span>
            <span class="slot-name" style="color:${rarityCfg.color}">${escHtml(instance.rarity)} ${escHtml(m.name)}${dmgTag}</span>
          </div>
          <div class="slot-stats">${m.powergrid}P · ${m.cpu}C ${bonuses ? `· ${escHtml(bonuses)}` : ""}</div>
          ${affixStr ? `<div class="slot-affixes">${escHtml(affixStr)}</div>` : ""}
        </div>
        <div class="slot-actions">
          <button class="st-btn-xs btn-unfit" data-action="unfit" data-rack="${rack}" data-idx="${i}">◁ Unfit</button>
          ${availInstances.length ? `
            <select class="slot-select-sm" id="swap-${rack}-${i}">${availInstances.map(inst => {
              const base = MODULES[inst.baseId];
              return `<option value="${inst.uid}">${base?.short || base?.name || inst.baseId}</option>`;
            }).join("")}</select>
            <button class="st-btn-xs btn-swap" data-action="swapMod" data-rack="${rack}" data-idx="${i}">↺ Swap</button>
          ` : ""}
        </div>
      </div>
    </div>`;
  }

  return `<div class="slot minimal" data-rack="${rack}" data-idx="${i}">
    <div class="slot-main">
      <div class="slot-info">
        <span class="stag">[EMPTY ${rack.toUpperCase()}]</span>
      </div>
      <div class="slot-actions">
        ${availInstances.length ? `
          <select class="slot-select-sm" id="sel-${rack}-${i}">${availInstances.map(inst => {
            const base = MODULES[inst.baseId];
            return `<option value="${inst.uid}">${base?.short || base?.name || inst.baseId}</option>`;
          }).join("")}</select>
          <button class="st-btn-xs btn-swap" data-action="fit" data-rack="${rack}" data-idx="${i}">Fit</button>
        ` : "<span class='stag'>No modules available</span>"}
      </div>
    </div>
  </div>`;
}

export function renderHangar() {
  const div = document.getElementById("panel-hangar");
  if (!div) return;
  const st = getStats();
  const pst = stationState.previewFitting ? computeStats(stationState.previewFitting) : null;
  const ship = SHIPS[G.P.shipId];

  const hullRep = Math.max(0, st.maxHp - G.P.hp);
  const structRep = Math.max(0, st.maxStructure - G.P.structure);
  const shieldRep = Math.max(0, st.maxShield - G.P.shield);
  let moduleDamageTotal = 0;
  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = G.P.fitting?.[rack];
    if (!slots) continue;
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (uid) {
        const inst = getInstance(uid);
        if (inst) {
          moduleDamageTotal += Math.max(0, inst.maxDurability - inst.durability);
        }
      }
    }
  }
  const repCost = Math.max(0, Math.ceil((hullRep + structRep * 0.5 + shieldRep * 0.3 + moduleDamageTotal * 0.6) * 0.8));
  const needsRepair = hullRep > 0 || structRep > 0 || shieldRep > 0 || moduleDamageTotal > 0;

  const pgOv = st.usedPG > st.totalPG, cpuOv = st.usedCPU > st.totalCPU;
  const RL: Record<string, string> = { turret: "Turret Slots", high: "Utility Slots", med: "Medium Slots", low: "Low Slots" };

  const racks = (["turret", "high", "med", "low"] as const).map(rack => {
    const slots = G.P.fitting[rack].map((uid: string | null, i: number) => renderSlot(rack, i, uid)).join("");
    return `<div class="frack"><h4>${RL[rack]}</h4>${slots}</div>`;
  }).join("");

  const invSections = [
    { label: "Ore", data: G.P.ore, pool: "ore" as const },
    { label: "Refined", data: G.P.refined, pool: "refined" as const },
    { label: "Loot", data: G.P.loot, pool: "loot" as const },
    { label: "Components", data: G.P.components, pool: "component" as const },
  ].map(sec => {
    const entries = Object.entries(sec.data).filter(([, qty]) => qty > 0);
    if (entries.length === 0) return "";
    const rows = entries.map(([key, qty]) => {
      const label = poolItemLabel(sec.pool, key);
      return `<div class="inv-row"><span class="inv-icon">${iconSvg(key, 12)}</span><span class="inv-name">${escHtml(label)}</span><span class="inv-qty">${qty}</span></div>`;
    }).join("");
    return `<div class="inv-section"><div class="inv-section-title">${sec.label}</div>${rows}</div>`;
  }).join("");

  const ammoHtml = `
    <div class="inv-section">
      <div class="inv-section-title">Ammunition</div>
      <div class="inv-row"><span class="inv-icon">${iconSvg("ammo-hybrid", 12)}</span><span class="inv-name">Hybrid</span><span class="inv-qty">${G.P.ammo?.hybrid ?? 0}</span></div>
      <div class="inv-row"><span class="inv-icon">${iconSvg("ammo-missile", 12)}</span><span class="inv-name">Missile</span><span class="inv-qty">${G.P.ammo?.missile ?? 0}</span></div>
    </div>`;

  const invHtml = invSections || `<div class="inv-empty">No resources in cargo.</div>`;

  const active = G.P.contracts.filter(c => c.status === "active" || c.status === "complete");
  const activeRows = active.map(c => {
    const { current, required } = c.objective;
    const pct = required > 0 ? Math.min(current / required, 1) : 0;
    const filled = Math.max(0, Math.min(10, Math.round(pct * 10)));
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    const cls = c.status === "complete" ? "ct-card-mini ct-done" : "ct-card-mini";
    return `<div class="${cls}">
      <div class="ct-mini-top"><span class="ct-mini-icon">${CONTRACT_TYPE_ICONS[c.type]||"○"}</span> <span class="ct-mini-title">${escHtml(c.title)}</span></div>
      <div class="ct-mini-progress">${bar} ${current}/${required}</div>
    </div>`;
  }).join("") || `<div class="ct-mini-empty">No active contracts</div>`;

  const contractBox = `
    <div class="st-hangar-contracts">
      <div class="ct-section-head">Active Contracts</div>
      <div class="ct-mini-list">${activeRows}</div>
    </div>`;

  div.innerHTML = `
  <h3>Ship Status</h3>
  <div class="row"><span class="lbl">Active Ship</span><span class="val" style="font-weight:600">${ship.name}</span><span class="stag">${ship.role}</span></div>
  <div class="row"><span class="lbl">Hull / Structure / Shield</span><span class="val">${Math.round(G.P.hp)}/${st.maxHp} · ${Math.round(G.P.structure)}/${st.maxStructure} · ${Math.round(G.P.shield)}/${st.maxShield}</span></div>
  <div class="row"><span class="lbl">Ammunition</span><span class="val">HYB ${G.P.ammo?.hybrid ?? 0}  ·  MSL ${G.P.ammo?.missile ?? 0}</span></div>
  ${Client.activeStation?.services.includes("repair") && needsRepair ? `<div class="row"><span class="lbl">Repair & Recharge</span><button class="btn" data-action="repair">Repair All (${repCost}¢)</button></div>` : ""}
  <div class="row"><span class="lbl">Home Station</span><span class="val">${G.GALAXY[G.P.homeSysIdx ?? 0]?.name || "HOME BASE ALPHA"}${G.P.homeSysIdx === G.P.sysIdx ? " (current)" : ""}</span>${G.P.homeSysIdx !== G.P.sysIdx ? `<button class="btn" data-action="setHome">Set as Home</button>` : ""}</div>

  <div class="st-fitting-container" style="margin-top:16px;">
    <aside>
      <h3>Ship Statistics</h3>
      <div class="st-stats-grid" id="hangar-stats-grid">${buildStatHtml(st, pst)}</div>
      <div id="hangar-stats-warn" style="margin-top:16px; font-size:10px; color:#3d5060; line-height:1.4;">
        ${pgOv ? `<div class="al">⚠ Powergrid overloaded! Stats penalized.</div>` : ""}
        ${cpuOv ? `<div class="al">⚠ CPU overloaded! Active modules disabled.</div>` : ""}
        <span>Hover slots to preview changes.</span>
      </div>
      ${contractBox}
    </aside>
    <main>
      <h3>Active Fitting</h3>
      ${racks}
      <h3>Inventory</h3>
      <div class="st-inventory-container">${invHtml}${ammoHtml}</div>
    </main>
  </div>`;
}
