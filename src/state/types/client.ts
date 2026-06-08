import type { Settings } from "../../data/settings.js";
import type { Gate, GateFxProfile, Station } from "../../types/world.js";

export enum AppMode {
  TITLE = "TITLE",
  SPACE = "SPACE",
  STATION = "STATION",
}

export interface WarpGateHint {
  gateId: string;
  gateLabel: string;
  fxProfile?: GateFxProfile;
  distance: number;
  activationRadius: number;
  gateState: NonNullable<Gate["gateState"]>;
  chargeProgress: number;
  inRange: boolean;
  isCharging: boolean;
}

export interface ClientState {
  mode: AppMode;
  keys: Record<string, boolean>;
  mouse: { x: number; y: number; lmb: boolean; rmb: boolean };
  mouseWorld: { x: number; y: number };
  camx: number; camy: number;
  zoom: number;
  waypoint: { x: number; y: number } | null;
  navCommand: { mode: "orbit" | "keepRange"; targetId: string; rangePx: number; dir: 1 | -1 } | null;
  cursorUnlocked: boolean;
  combatHeat: number;
  showMap: boolean;
  showSystemMap: boolean;
  stationOpen: boolean;
  activeStation: Station | null;
  bridgeOpen: boolean;
  overviewOpen: boolean;
  bridgeWindowZ: number;

  settingsOpen: boolean;
  skillsOpen: boolean;
  settings: Settings;
  showPerf: boolean;
  perfAdvanced: boolean;
  gameStarted: boolean;
  _lastBridgeRender: number;
  mapPanX: number;
  mapPanY: number;
  mapZoom: number;
  multiplayerRole?: "none" | "host" | "client" | null;
  pauseOpen: boolean;
  mapDragging: boolean;
  mapDragLastSx: number;
  mapDragLastSy: number;
  systemMapTransform?: unknown;
  mapScannerAngleDeg: number;
  typingPlayers: Set<string>;
  chatBubbles: Map<string, { text: string; expiresAt: number }>;
  warpGateHint: WarpGateHint | null;
}
