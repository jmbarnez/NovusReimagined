/**
 * Station, gate, and planet structural types.
 */

import type { Enemy } from "./enemy.js";

export interface StationTurret {
  angle: number;
  orbitRadius: number;
  orbitSpeed: number;
  shootCd: number;
  // Set during physics tick (orbit position + targeting state)
  x?: number;
  y?: number;
  target?: Enemy | null;
  faceAngle?: number;
}

export interface StationIdentity {
  id: string;
  name: string;
  isHome: boolean;
  services: string[];
}

export interface StationPhysics {
  x: number;
  y: number;
  radius: number;
  spin: number;
  orbitSpeed?: number;
}

export interface StationSecurity {
  safeRadius: number;
  turrets: StationTurret[];
}

export interface StationServices {
  structureType?: "standard" | "home" | "industrial";
  isProcessingHub?: boolean;
  collectRadius?: number;
  dropZoneOffset?: { dx?: number; dy?: number; x?: number; y?: number };
  dropZoneRadius?: number;
}

export interface Station extends
  StationIdentity,
  StationPhysics,
  StationSecurity,
  StationServices
{}

export type GateFxProfile = "sector" | "tutorial-return" | "temporary";

export interface Gate {
  id?: string;
  x: number;
  y: number;
  px: number;
  py: number;
  target: {
    kind: "local";
    x: number;
    y: number;
    label: string;
  };
  targetSysIdx?: number;
  radius: number;
  spin: number;
  angle?: number;
  orbitSpeed?: number;
  gateState?: "dormant" | "charging" | "active" | "warping" | "cooldown";
  chargeProgress?: number;
  cooldownTimer?: number;
  dispenseTimer?: number | null;
  isTemporary?: boolean;
  activationRadius?: number;
  fxProfile?: GateFxProfile;
}

export interface Planet {
  name?: string;
  x: number;
  y: number;
  radius: number;
  hue: number;
  sat: number;
  lit: number;
  hasRing: boolean;
  ringTilt: number;
  moons: number;
  orbitSpeed?: number;
}
