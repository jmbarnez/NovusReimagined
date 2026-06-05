import { Client } from "../state.js";
import { DEFAULT_KEYBINDS, type Keybinds } from "./settings.js";
import { fmtKey } from "../utils/format.js";
import { t } from "../utils/i18n.js";

const RACK_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

/** Resolve a bar slot index to its hotkey display label. */
export function tutorialBarKey(slotIndex: number): string {
  return RACK_KEYS[slotIndex] ?? String(slotIndex + 1);
}

/** Resolve a bar slot index to a styled hotkey label. */
export function tutorialBarKeyStyled(slotIndex: number): string {
  return `<span class="tutorial-keybind">${tutorialBarKey(slotIndex)}</span>`;
}

/** Resolve a player keybind to a short display label. */
export function tutorialKey(action: keyof Keybinds): string {
  const binds = Client.settings?.keybinds ?? DEFAULT_KEYBINDS;
  return fmtKey(binds[action] ?? DEFAULT_KEYBINDS[action]);
}

/** Resolve a player keybind to a styled display label. */
export function tutorialKeyStyled(action: keyof Keybinds): string {
  return `<span class="tutorial-keybind">${tutorialKey(action)}</span>`;
}

export type TutorialGateHintKey =
  | "move-course"
  | "brake-gate"
  | "gate-boost"
  | "gate-lane"
  | "gate-boost-short"
  | "gate-steady"
  | "brake-overshoot"
  | "gate-momentum"
  | "gate-center"
  | "gate-pillars"
  | "gate-clean"
  | "gate-last"
  | "gate-dock";

export function resolveTutorialGateHint(key: TutorialGateHintKey): string {
  const brake = tutorialKey("brake");
  const dock = tutorialKey("dock");
  const forward = tutorialKey("forwardThrust");
  switch (key) {
    case "move-course": {
      const isDirect = Client.settings?.movementControlMode === "direct";
      return isDirect
        ? t("tutorial.gateHint.moveCourseDirect", { forwardKey: forward })
        : t("tutorial.gateHint.moveCourse");
    }
    case "brake-gate":
      return t("tutorial.gateHint.brakeGate", { brakeKey: brake });
    case "gate-boost":
      return t("tutorial.gateHint.gateBoost");
    case "gate-lane":
      return t("tutorial.gateHint.gateLane");
    case "gate-boost-short":
      return t("tutorial.gateHint.gateBoostShort");
    case "gate-steady":
      return t("tutorial.gateHint.gateSteady");
    case "brake-overshoot":
      return t("tutorial.gateHint.brakeOvershoot", { brakeKey: brake });
    case "gate-momentum":
      return t("tutorial.gateHint.gateMomentum");
    case "gate-center":
      return t("tutorial.gateHint.gateCenter");
    case "gate-pillars":
      return t("tutorial.gateHint.gatePillars");
    case "gate-clean":
      return t("tutorial.gateHint.gateClean");
    case "gate-last":
      return t("tutorial.gateHint.gateLast");
    case "gate-dock":
      return t("tutorial.gateHint.gateDock", { dockKey: dock });
  }
}
