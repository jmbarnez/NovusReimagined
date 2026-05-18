import { G } from "../state.js";
import { SKILL_IDS, SKILL_DEF, SKILL_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, xpForSkillLevel, levelForSkillXp, MAX_SKILL_LEVEL, type SkillId } from "../data/skills.js";
import { escHtml } from "../utils/format.js";
import "./styles/skills.css";

let _hoveredSkillId: string | null = null;

function renderSkillDetail(id: string | null) {
  if (!id) return "<div style='color:#3a5060;font-size:10px;padding:8px 0;'>Hover a skill to see details.</div>";
  const def = SKILL_DEF[id as SkillId];
  const p = G.P;
  const xp = p.skillXp?.[id] || 0;
  const lvl = levelForSkillXp(xp);
  const nextXp = lvl < MAX_SKILL_LEVEL ? xpForSkillLevel(lvl + 1) : xpForSkillLevel(MAX_SKILL_LEVEL);
  const prevXp = xpForSkillLevel(lvl);
  const currXpInLvl = xp - prevXp;
  const xpNeeded = nextXp - prevXp;
  const frac = lvl >= MAX_SKILL_LEVEL ? 1 : xpNeeded > 0 ? currXpInLvl / xpNeeded : 0;
  const pct = Math.min(100, Math.round(frac * 100));
  const isMaxed = lvl >= MAX_SKILL_LEVEL;
  let detail = `<div class="skd-icon">${def.icon}</div><div class="skd-info">`;
  detail += `<div class="skd-name" style="color:${def.color}">${escHtml(def.name)}</div>`;
  detail += `<div class="skd-desc">${escHtml(def.desc)}</div>`;
  detail += `<div class="skd-xp-row"><span>XP:</span><span class="skd-xp-val">${xp.toLocaleString()} / ${isMaxed ? "MAX" : nextXp.toLocaleString()}</span></div>`;
  detail += `<div class="skd-lvl-row"><span>Level:</span><span class="skd-lvl-val">${lvl} / ${MAX_SKILL_LEVEL}</span></div>`;
  detail += `<div class="skd-bar-track"><div class="skd-bar-fill" style="width:${pct}%;background:${def.color}"></div></div>`;
  detail += `<div class="skd-pct">${isMaxed ? "Maximum level reached!" : `${pct}% to level ${lvl + 1}`}</div>`;
  detail += `</div>`;
  return detail;
}

export function renderSkillsContent() {
  const p = G.P;
  const totalLvl = SKILL_IDS.reduce((sum, id) => sum + levelForSkillXp(p.skillXp?.[id] || 0), 0);
  const maxTotal = SKILL_IDS.length * MAX_SKILL_LEVEL;

  const catSections: Record<string, string> = {};
  for (const cat of SKILL_CATEGORIES) catSections[cat] = "";

  for (const id of SKILL_IDS) {
    const def = SKILL_DEF[id];
    const xp = p.skillXp?.[id] || 0;
    const lvl = levelForSkillXp(xp);
    const prevXp = xpForSkillLevel(lvl);
    const nextXp = lvl < MAX_SKILL_LEVEL ? xpForSkillLevel(lvl + 1) : xpForSkillLevel(MAX_SKILL_LEVEL);
    const xpNeeded = nextXp - prevXp;
    const currXpInLvl = xp - prevXp;
    const frac = lvl >= MAX_SKILL_LEVEL ? 1 : xpNeeded > 0 ? currXpInLvl / xpNeeded : 0;
    const pct = Math.min(100, Math.round(frac * 100));
    const isMaxed = lvl >= MAX_SKILL_LEVEL;

    catSections[def.category] += `<div class="sk-tile ${isMaxed ? "maxed" : ""}" data-skill="${id}" style="--sk-color:${def.color}">
      <div class="sk-icon">${def.icon}</div>
      <div class="sk-name">${escHtml(def.name)}</div>
      <div class="sk-lvl ${isMaxed ? "maxed" : ""}">${lvl}</div>
      <div class="sk-bar-track"><div class="sk-bar-fill" style="width:${pct}%"></div></div>
      <div class="sk-pct">${isMaxed ? "MAX" : pct + "%"}</div>
    </div>`;
  }

  let gridHtml = "";
  for (const cat of SKILL_CATEGORIES) {
    gridHtml += `<div class="sk-category"><div class="sk-cat-head" style="border-color:${CATEGORY_COLORS[cat]}">${CATEGORY_LABELS[cat]}</div><div class="sk-cat-grid">${catSections[cat]}</div></div>`;
  }

  const detailHtml = renderSkillDetail(_hoveredSkillId);

  return `<div class="sk-header"><span class="sk-total">Total Level: ${totalLvl} / ${maxTotal}</span></div><div class="sk-scroll">${gridHtml}</div><div class="sk-detail">${detailHtml}</div>`;
}

function setHoveredSkill(rootEl: HTMLElement, id: string | null) {
  if (id === _hoveredSkillId) return;
  _hoveredSkillId = id;
  const detail = rootEl.querySelector(".sk-detail") as HTMLElement | null;
  if (detail) detail.innerHTML = renderSkillDetail(id);
}

export function initSkillsInteractions(rootEl: HTMLElement) {
  rootEl.addEventListener("mouseover", (e) => {
    const tile = (e.target as HTMLElement).closest(".sk-tile") as HTMLElement | null;
    if (tile) {
      setHoveredSkill(rootEl, tile.dataset.skill ?? null);
    }
  });
  rootEl.addEventListener("mouseout", (e) => {
    const tile = (e.target as HTMLElement).closest(".sk-tile") as HTMLElement | null;
    if (!tile) return;
    const next = (e.relatedTarget as HTMLElement | null)?.closest(".sk-tile");
    if (next !== tile) setHoveredSkill(rootEl, null);
  });
}
