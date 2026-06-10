import type { Player } from "../state.js";

export function syncCharacterFromServer(character: Player): void {
  console.log("[GameClient] Received character sync from server, updating localStorage");

  let isLocalHostActive = false;
  if (typeof localStorage !== "undefined") {
    const hostActiveRaw = localStorage.getItem("ss2-host-active");
    if (hostActiveRaw) {
      const hostTime = parseInt(hostActiveRaw, 10);
      if (!Number.isNaN(hostTime) && Date.now() - hostTime < 10000) {
        isLocalHostActive = true;
      }
    }
  }

  if (isLocalHostActive) {
    console.log("[GameClient] Active local host detected. Skipping saving character to prevent overwriting host save.");
    return;
  }

  try {
    localStorage.setItem("ss2-sim-v1", JSON.stringify(character));
  } catch (e) {
    console.warn("[GameClient] Failed to save character sync to localStorage", e);
  }
}
