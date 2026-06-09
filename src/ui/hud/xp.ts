import "../styles/hud-xp.css";
import { getState } from "../../state-access.js";
import { levelForSkillXp, xpForSkillLevel, MAX_SKILL_LEVEL } from "../../data/skills.js";
import { hudState, XP_VISIBLE_MS, XP_FADE_MS, SKILL_NAMES, SKILL_ICONS } from "./state.js";
import { createElement, append, setHtml, setStyle, setPosition } from "../dom-helpers.js";

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
  setHtml(hudState.xpPopup, "");
  for (const [id, amt] of hudState.xpAccum) {
    const icon = SKILL_ICONS[id] || "⭐";
    const name = SKILL_NAMES[id] || id;
    const totalXp = getState().player.skillXp[id] || 0;
    const beforeXp = hudState.xpBefore.get(id) ?? totalXp;
    const pctNow = skillProgress(totalXp) * 100;
    const pctFrom = skillProgress(Math.max(0, beforeXp)) * 100;

    const row = createElement("div", "xp-row");
    setHtml(row, `<span class="xp-icon">${icon}</span><span class="xp-name">${name}</span><span class="xp-amt">+${amt}</span>`);

    const track = createElement("div", "xp-bar-track");
    const fill = createElement("div", "xp-bar-fill");
    setPosition(fill, `${pctFrom}%`, "");
    setStyle(fill, { transition: "none" });
    append(track, fill);
    append(row, track);
    append(hudState.xpPopup, row);

    requestAnimationFrame(() => {
      setStyle(fill, { transition: "width 1.2s ease-out" });
      setPosition(fill, `${pctNow}%`, "");
    });
  }
}
