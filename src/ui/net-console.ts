/** Network lines routed into the HUD comms log — essentials only. */

import { appendLogEntry, flushPendingLogEntries } from "./hud/logs.js";

function classifyNetType(msg: string): string {
  if (msg.includes("[ERR]") || msg.includes("failed") || msg.includes("Failed")) return "net-err";
  if (msg.includes("[OK]") || msg.includes("connected")) return "net-ok";
  if (msg.includes("[WARN]")) return "net-warn";
  return "net";
}

/** True when the line should appear in the player-facing comms / terminal console. */
function shouldShowInHud(msg: string): boolean {
  if (msg.includes("[ERR]")) return true;
  if (/timed out|connect failed|Failed to/i.test(msg)) return true;

  if (msg.includes("[OK]")) {
    if (/Connected|listening|connect to|Join complete|relay active/i.test(msg)) return true;
    return false;
  }

  if (msg.includes("[WARN]")) {
    if (/in use|aborted|unavailable|returned false/i.test(msg)) return true;
    return false;
  }

  if (msg === "disconnected") return true;
  if (/^connecting\b/i.test(msg)) return true;
  if (/WebSocket error/i.test(msg)) return true;

  return false;
}

/** Append a net line — HUD only for connection essentials; verbose lines are dev-console only. */
export function netLog(msg: string) {
  if (shouldShowInHud(msg)) {
    console.log("[Net]", msg);
    appendLogEntry(msg, classifyNetType(msg), "[NET]");
  }
}

export function initNetConsole() {
  flushNetLogPending();
}

/** Flush lines buffered before the HUD log mount existed. */
export function flushNetLogPending() {
  flushPendingLogEntries();
}

/** Snapshot stream is debug-only (too noisy for the comms panel). */
export function netLogSnapshot(
  _tick: number,
  _entityCount: number,
  _sysIdx: number,
  _isFull: boolean,
  _remotePlayers = 0,
) {
  /* intentionally quiet */
}
