import { Client } from "../state.js";
import { DEFAULT_KEYBINDS, type Keybinds } from "./settings.js";
import { fmtKey } from "../utils/format.js";

/** Resolve a player keybind to a short display label. */
export function tutorialKey(action: keyof Keybinds): string {
  const binds = Client.settings?.keybinds ?? DEFAULT_KEYBINDS;
  return fmtKey(binds[action] ?? DEFAULT_KEYBINDS[action]);
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
  switch (key) {
    case "move-course":
      return "Right-click ahead to set course — your ship thrusts toward the waypoint";
    case "brake-gate":
      return `${brake} brakes — use it to line up with the gate opening`;
    case "gate-boost":
      return "Fly through the gate pillars for a slingshot boost";
    case "gate-lane":
      return "Thread the opening dead-center — chevrons mark the lane";
    case "gate-boost-short":
      return "Fly through the gate opening for a boost";
    case "gate-steady":
      return "Hold course — boost gates reward clean passes";
    case "brake-overshoot":
      return `${brake} to brake if you overshoot the Academy`;
    case "gate-momentum":
      return "Thread the gate — momentum carries you to gunnery";
    case "gate-center":
      return "Fly through center for the slingshot";
    case "gate-pillars":
      return "Gate boost — stay between the pillars";
    case "gate-clean":
      return "Clean pass through the gate opening";
    case "gate-last":
      return "Last boost gate before the stargate";
    case "gate-dock":
      return `Fly through — then dock at the gate (${dock})`;
  }
}
