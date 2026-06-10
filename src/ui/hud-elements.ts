/**
 * Centralized HUD element accessors to reduce duplication across UI modules.
 */

import { getElement } from "./dom-helpers.js";

export function getHudOverlay(): HTMLElement | null {
  return getElement("hud-overlay");
}

export function getHudModules(): HTMLElement | null {
  return getElement("hud-modules");
}

export function getHudStatusBars(): HTMLElement | null {
  return getElement("hud-status-bars");
}

export function getHudSlots(): HTMLElement | null {
  return getElement("hud-slots");
}

export function getHudLockRail(): HTMLElement | null {
  return getElement("hud-lock-rail");
}

export function getHudMissions(): HTMLElement | null {
  return getElement("hud-missions");
}

export function getHudDockPrompt(): HTMLElement | null {
  return getElement("hud-dock-prompt");
}

export function getHudXpPopup(): HTMLElement | null {
  return getElement("hud-xp-popup");
}

export function getHudOnboard(): HTMLElement | null {
  return getElement("hud-onboard");
}

export function getHudTourDimmer(): HTMLElement | null {
  return getElement("hud-tour-dimmer");
}
