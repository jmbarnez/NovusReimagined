import { Client } from "../../state.js";

// ─── Client Navigation accessors ─────────────────────────────────────────────

/** Set active navigation command and clear waypoint. */
export function setNavCommand(cmd: typeof Client.navCommand) {
  Client.navCommand = cmd;
  if (cmd) {
    Client.waypoint = null;
  }
}

/** Clear active navigation command. */
export function clearNav() {
  Client.navCommand = null;
}
