import "./styles/hud-mission-tooltip.css";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { escHtml } from "../utils/format.js";
import type { MissionContract } from "../data/missions.js";
import { isTutorialContract, TUTORIAL_GRADUATION_REWARD } from "../data/missions.js";
import { TUTORIAL_STEP_REWARDS } from "../data/tutorial-mission.js";
import { getCurrentTutorialStep } from "../data/tutorial.js";
import { SKILL_DEF } from "../data/skills.js";
import { CONTRACT_TYPE_ICONS } from "./station/shared.js";
import { TUTORIAL_MISSION_ICONS } from "./station/contracts.js";
import { getElement, createElement, append, setHtml, setStyle, setPosition, getStyleProperty, onMouseOver, onMouseMove, onMouseLeave } from "./dom-helpers.js";

const TOOLTIP_ID = "hud-mission-tooltip";
let listenersPanel: HTMLElement | null = null;

function findContractById(id: string): MissionContract | null {
  const match = getState().player?.contracts?.find(c => c.id === id);
  return match ?? null;
}

function ensureMissionTooltip(): HTMLElement {
  let el = getElement(TOOLTIP_ID);
  if (!el) {
    el = createElement("div");
    el.id = TOOLTIP_ID;
    el.setAttribute("role", "tooltip");
    append(document.body, el);
  }
  return el;
}

function statusLabel(c: MissionContract): string {
  if (c.status === "complete") {
    return isTutorialContract(c) && c.id === "mc_tutorial_graduation" ? "Ready to graduate" : "Complete — turn in at station";
  }
  return "Active";
}

function buildMissionTooltipHtml(c: MissionContract): string {
  const icon = isTutorialContract(c)
    ? (TUTORIAL_MISSION_ICONS[c.id] ?? "★")
    : (CONTRACT_TYPE_ICONS[c.type] ?? "○");
  const { current, required } = c.objective;
  const pct = required > 0 ? Math.round((current / required) * 100) : 0;
  const isTutorial = isTutorialContract(c);

  let body = `
    <div class="hmt-header">
      <span class="hmt-icon">${icon}</span>
      <span class="hmt-title">${escHtml(c.title)}</span>
    </div>
    <div class="hmt-type">${escHtml(c.type.toUpperCase())} · ${escHtml(statusLabel(c))}</div>
    <div class="hmt-desc">${escHtml(c.description)}</div>
    <div class="hmt-stat"><span class="hmt-k">Progress</span><span class="hmt-v">${current} / ${required} (${pct}%)</span></div>`;

  if (isTutorial) {
    body += `<div class="hmt-stat"><span class="hmt-k">Graduation bonus</span><span class="hmt-v hmt-gold">${TUTORIAL_GRADUATION_REWARD.toLocaleString()} CR</span></div>`;
    const step = getCurrentTutorialStep(getState().player);
    const stepReward = step ? TUTORIAL_STEP_REWARDS[step.id] : undefined;
    if (stepReward) {
      const skillName = SKILL_DEF[stepReward.skillId]?.name ?? stepReward.skillId;
      body += `<div class="hmt-section">Current step payout</div>`;
      body += `<div class="hmt-stat"><span class="hmt-k">Credits</span><span class="hmt-v hmt-gold">+${stepReward.credits} CR</span></div>`;
      body += `<div class="hmt-stat"><span class="hmt-k">${escHtml(skillName)}</span><span class="hmt-v">+${stepReward.skillXp} XP</span></div>`;
    }
  } else {
    body += `<div class="hmt-stat"><span class="hmt-k">Reward</span><span class="hmt-v hmt-gold">${c.reward.toLocaleString()} CR</span></div>`;
    if (c.status === "complete") {
      body += `<div class="hmt-note">Dock at the issuing station to claim.</div>`;
    }
  }

  return body;
}

export function showMissionTooltip(contractId: string, clientX: number, clientY: number): void {
  const c = findContractById(contractId);
  if (!c) return;
  const tip = ensureMissionTooltip();
  setHtml(tip, buildMissionTooltipHtml(c));
  setStyle(tip, { display: "block" });
  positionMissionTooltip(tip, clientX, clientY);
}

export function hideMissionTooltip(): void {
  const tip = getElement(TOOLTIP_ID);
  if (tip) setStyle(tip, { display: "none" });
}

function positionMissionTooltip(tip: HTMLElement, clientX: number, clientY: number): void {
  const pad = 12;
  const rect = tip.getBoundingClientRect();
  const scale = Client.settings?.uiScale ?? 1.0;
  let left = clientX + pad;
  let top = clientY + pad;
  if (left + rect.width > window.innerWidth - 8) {
    left = clientX - rect.width - pad;
  }
  if (top + rect.height > window.innerHeight - 8) {
    top = clientY - rect.height - pad;
  }
  setPosition(tip, `${Math.max(8, left) / scale}px`, `${Math.max(8, top) / scale}px`);
}

export function attachMissionTooltipListeners(panel: HTMLElement): void {
  if (listenersPanel === panel) return;
  listenersPanel = panel;

  onMouseOver(panel, (e) => {
    const ev = e as MouseEvent;
    const card = (ev.target as HTMLElement).closest(".hm-contract") as HTMLElement | null;
    if (!card?.dataset.contractId) return;
    showMissionTooltip(card.dataset.contractId, ev.clientX, ev.clientY);
  });

  onMouseMove(panel, (e) => {
    const ev = e as MouseEvent;
    const tip = getElement(TOOLTIP_ID);
    if (!tip || getStyleProperty(tip, "display") === "none") return;
    const card = (ev.target as HTMLElement).closest(".hm-contract");
    if (!card) {
      hideMissionTooltip();
      return;
    }
    positionMissionTooltip(tip, ev.clientX, ev.clientY);
  });

  onMouseLeave(panel, (e) => {
    const related = (e as MouseEvent).relatedTarget as Node | null;
    if (related && panel.contains(related)) return;
    hideMissionTooltip();
  });
}
