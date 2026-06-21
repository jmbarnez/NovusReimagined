/**
 * Scanning command handlers: map scanner power/cone/strength and scan pulses.
 */
import type { Player } from "../../../state.js";
import { PlayerAccess } from "../../../state-access.js";
import { startScanPulse } from "../../../scanning/index.js";
import type { GameCommand } from "../types.js";
import { isScannerConeDeg } from "../validators.js";

export type ScanningCommand = Extract<
  GameCommand,
  { type: "setMapScannerPower" | "setMapScannerCone" | "setMapScannerStrength" | "startScanPulse" }
>;

export function handleScanningCommand(command: ScanningCommand, p: Player): void {
  switch (command.type) {
    case "setMapScannerPower":
      PlayerAccess.setMapScannerActive(command.payload.active === true, p);
      break;
    case "setMapScannerCone":
      if (!isScannerConeDeg(command.payload.coneDeg)) break;
      PlayerAccess.setScannerConeDeg(command.payload.coneDeg, p);
      break;
    case "setMapScannerStrength":
      if (!Number.isFinite(command.payload.strength)) break;
      PlayerAccess.setMapScannerStrength(command.payload.strength, p);
      break;
    case "startScanPulse":
      if (!Number.isFinite(command.payload.angleDeg)) break;
      startScanPulse(p, { angleDeg: command.payload.angleDeg, allowWithoutMapOpen: true });
      break;
  }
}
