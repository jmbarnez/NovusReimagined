import "../styles/hud-xp.css";
import { getState } from "../../state-access.js";
import { levelForSkillXp, xpForSkillLevel, MAX_SKILL_LEVEL } from "../../data/skills.js";
import { hudState, XP_VISIBLE_MS, XP_FADE_MS, SKILL_NAMES, SKILL_ICONS } from "./state.js";

/* ── Skill XP Popup ── */
export function showXpEarned(skillId: string, amount: number) {
  if (!hudState.xpPopup || amount <= 0) return;
  if (!hudState.xpAccum.has(skillId)) {
    hudState.xpBefore.set(skillId, (getState().player.skillXp[skillId] || 0) - amount);
  }
  hudState.xpAccum.set(skillId, (hudState.xpAccum.get(skillId) || 0) + amount);
  renderXpPopup();
  hudState.xpPopup.classList.remove("fading");
  hudState.xpPopup.classList.add("visible");
  if (hudState.xpHideTimer !== null) { clearTimeout(hudState.xpHideTimer); hudState.xpHideTimer = null; }
  if (hudState.xpClearTimer !== null) { clearTimeout(hudState.xpClearTimer); hudState.xpClearTimer = null; }
  hudState.xpHideTimer = window.setTimeout(() => {
    hudState.xpPopup?.classList.add("fading");
  }, XP_VISIBLE_MS);
  hudState.xpClearTimer = window.setTimeout(() => {
    hudState.xpPopup?.classList.remove("visible", "fading");
    hudState.xpAccum.clear();
    hudState.xpBefore.clear();
  }, XP_VISIBLE_MS + XP_FADE_MS);
}

export function skillProgress(xp: number): number {
  const lvl = levelForSkillXp(xp);
  if (lvl >= MAX_SKILL_LEVEL) return 1;
  const lo = xpForSkillLevel(lvl);
  const hi = xpForSkillLevel(lvl + 1);
  return hi > lo ? (xp - lo) / (hi - lo) : 0;
}

export function renderXpPopup() {
  if (!hudState.xpPopup) return;
  hudState.xpPopup.innerHTML = "";
  for (const [id, amt] of hudState.xpAccum) {
    const icon = SKILL_ICONS[id] || "⭐";
    const name = SKILL_NAMES[id] || id;
    const totalXp = getState().player.skillXp[id] || 0;
    const beforeXp = hudState.xpBefore.get(id) ?? totalXp;
    const pctNow = skillProgress(totalXp) * 100;
    const pctFrom = skillProgress(Math.max(0, beforeXp)) * 100;

    const row = document.createElement("div");
    row.className = "xp-row";
    row.innerHTML = `<span class="xp-icon">${icon}</span><span class="xp-name">${name}</span><span class="xp-amt">+${amt}</span>`;

    const track = document.createElement("div");
    track.className = "xp-bar-track";
    const fill = document.createElement("div");
    fill.className = "xp-bar-fill";
    fill.style.width = `${pctFrom}%`;
    fill.style.transition = "none";
    track.appendChild(fill);
    row.appendChild(track);
    hudState.xpPopup.appendChild(row);

    requestAnimationFrame(() => {
      fill.style.transition = "width 1.2s ease-out";
      fill.style.width = `${pctNow}%`;
    });
  }
}
