import "../styles/station-market.css";
import { G } from "../../state.js";
import { MODULES } from "../../data/modules.js";
import { ORE, LOOT } from "../../data/resources.js";
import { ORE_MARKET_BUY, COMPONENT_MARKET_BUY } from "../../data/marketCatalog.js";
import { escHtml } from "../../utils/format.js";
import { stationState, fmtModBonuses, iconSvg } from "./shared.js";

export function renderMarket() {
  const div = document.getElementById("panel-market");
  if (!div) return;
  const q = stationState.mktSearch.trim().toLowerCase();

  const RACK_TABS = [
    { id: "all",    label: "All"     },
    { id: "turret", label: "Turrets" },
    { id: "high",   label: "High"    },
    { id: "med",    label: "Med"     },
    { id: "low",    label: "Low"     },
  ];

  let mods = Object.values(MODULES);
  if (stationState.mktRack !== "all") mods = mods.filter(m => m.rack === stationState.mktRack);
  if (q) mods = mods.filter(m => m.name.toLowerCase().includes(q) || m.rack.includes(q));
  if (stationState.mktSort === "price_asc")  mods.sort((a, b) => a.price - b.price);
  else if (stationState.mktSort === "price_desc") mods.sort((a, b) => b.price - a.price);
  else if (stationState.mktSort === "owned") mods.sort((a, b) => (G.P.moduleCargo.filter(i => i.baseId === b.id).length) - (G.P.moduleCargo.filter(i => i.baseId === a.id).length));

  const modRows = mods.map(m => {
    const n = G.P.moduleCargo.filter(i => i.baseId === m.id).length;
    const sp = Math.floor(m.price * 0.6);

    const bon = fmtModBonuses(m);
    return `<div class="mkt-row">
      <div class="mkt-icon">${iconSvg(m.id)}</div>
      <div><span class="mkt-name">${escHtml(m.name)}</span><span class="mkt-tag">${m.rack}</span>${bon ? `<div class="mkt-bonus">${escHtml(bon)}</div>` : ""}</div>
      <span class="mkt-have">${n > 0 ? `×${n}` : "—"}</span>
      <div class="mkt-cell"><button class="btn btn-buy mkt-btn" data-action="buyMod" data-mod-id="${m.id}">${m.price}¢</button></div>
      <div class="mkt-cell">${n > 0 ? `<button class="btn btn-sell mkt-btn" data-action="sellMod" data-mod-id="${m.id}">${sp}¢</button>` : `<span class="mkt-dash">—</span>`}</div>
    </div>`;
  }).join("") || `<div class="mkt-empty">No modules match.</div>`;

  const ammoRows = `
    <div class="mkt-row">
      <div class="mkt-icon">${iconSvg("ammo-hybrid")}</div>
      <div><span class="mkt-name">Hybrid Charges</span><span class="mkt-tag">ammo</span><div class="mkt-bonus">blasters · beams · 0.08¢ per shot</div></div>
      <span class="mkt-have">${G.P.ammo?.hybrid ?? 0}</span>
      <div class="mkt-cell"><button class="btn btn-buy mkt-btn" data-action="buyHybrid">+500 — 40¢</button></div>
      <div class="mkt-cell"><span class="mkt-dash">—</span></div>
    </div>
    <div class="mkt-row">
      <div class="mkt-icon">${iconSvg("ammo-missile")}</div>
      <div><span class="mkt-name">Missile Stack</span><span class="mkt-tag">ammo</span><div class="mkt-bonus">guided ordnance · 3.96¢ per shot</div></div>
      <span class="mkt-have">${G.P.ammo?.missile ?? 0}</span>
      <div class="mkt-cell"><button class="btn btn-buy mkt-btn" data-action="buyMissile">+24 — 95¢</button></div>
      <div class="mkt-cell"><span class="mkt-dash">—</span></div>
    </div>`;

  const LOOT_BUY: Record<string, number> = { scrap: 5, chip: 45, cell: 22, "intact-part": 30 };
  type Res = { id: string; label: string; qty: number; rate: number; action: string; attr: string };
  let res: Res[] = [
    ...(["iron","crystal","exotic"] as const).map(k => ({ id:k, label:ORE[k].label, qty:G.P.ore[k]||0, rate:ORE_MARKET_BUY[k]||0, action:"sellOre", attr:`data-ore="${k}"` })),
    ...(["scrap","chip","cell","intact-part"] as const).map(k => ({ id:k, label:LOOT[k].label, qty:G.P.loot[k]||0, rate:LOOT_BUY[k]||0, action:"sellLoot", attr:`data-loot="${k}"` })),
    ...(["circuit","gear","harness","sensor_cluster"] as const).map(k => ({ id:k, label:k.replace("_"," "), qty:G.P.components[k]||0, rate:COMPONENT_MARKET_BUY[k]||100, action:"sellComp", attr:`data-comp="${k}"` })),
  ];
  if (q) res = res.filter(r => r.label.toLowerCase().includes(q) || r.id.includes(q));
  if (stationState.mktSort === "price_asc")  res.sort((a, b) => a.rate - b.rate);
  else if (stationState.mktSort === "price_desc") res.sort((a, b) => b.rate - a.rate);
  else if (stationState.mktSort === "owned") res.sort((a, b) => b.qty - a.qty);
  else res.sort((a, b) => a.label.localeCompare(b.label));

  const resRows = res.map(r => `<div class="mkt-row">
    <div class="mkt-icon">${iconSvg(r.id)}</div>
    <div><span class="mkt-name">${escHtml(r.label)}</span></div>
    <span class="mkt-have">${r.qty > 0 ? r.qty : "—"}</span>
    <span class="mkt-rate">${r.rate}¢/u</span>
    <div class="mkt-cell">${r.qty > 0 ? `<button class="btn btn-sell mkt-btn" data-action="${r.action}" ${r.attr}>sell ${r.qty*r.rate}¢</button>` : `<span class="mkt-dash">—</span>`}</div>
  </div>`).join("") || `<div class="mkt-empty">No resources match.</div>`;

  const topTabs = ["modules","ammo","resources"].map(t =>
    `<button class="mkt-tab-btn${stationState.mktTab===t?" active":""}" data-action="mktTab" data-tab="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</button>`
  ).join("");
  const rackSubTabs = stationState.mktTab === "modules"
    ? `<div class="mkt-rack-tabs">${RACK_TABS.map(t =>
        `<button class="mkt-rack-btn${stationState.mktRack===t.id?" active":""}" data-action="mktRack" data-rack="${t.id}">${t.label}</button>`
      ).join("")}</div>`
    : "";
  const sortOpts = [["name","Name"],["price_asc","Price ↑"],["price_desc","Price ↓"],["owned","Owned"]].map(
    ([v,l]) => `<option value="${v}"${stationState.mktSort===v?" selected":""}>${l}</option>`
  ).join("");
  const controls = `<div class="mkt-controls">
    <div class="mkt-tab-group">${topTabs}</div>
    ${rackSubTabs}
    <input class="mkt-search-input" id="mkt-search-input" type="text" placeholder="search…" value="${escHtml(stationState.mktSearch)}">
    <select class="mkt-sort-sel" id="mkt-sort-select">${sortOpts}</select>
  </div>`;

  const content = stationState.mktTab === "modules" ? modRows : stationState.mktTab === "ammo" ? ammoRows : resRows;
  div.innerHTML = controls + `<div class="mkt-list">${content}</div>`;
}
