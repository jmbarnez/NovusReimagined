import type { Container, Graphics, Text, TextStyle } from "pixi.js";

export interface PixiHudState {
  hudContainer: Container | null;
  horizonLine: Graphics | null;
  speedArcBg: Graphics | null;
  speedArcFill: Graphics | null;
  shieldArcBg: Graphics | null;
  shieldArcFill: Graphics | null;
  driftVectors: Graphics | null;
  warningBanner: Text | null;
  speedLabel: Text | null;
  shieldLabel: Text | null;
  speedStyle: TextStyle | null;
  shieldStyle: TextStyle | null;
  warningStyle: TextStyle | null;
  lastSpeed: number;
  lastShieldFrac: number;
  lastIsCritical: boolean;
  lastZoom: number;
  lastAngle: number;
  lastBoostFx: boolean;
  boostPulseUntil: number;
  lastPlayerAngle: number;
  lastSpdPct: number;
  lastBoostPulse: number;
  lastDriftAngle: number;
  lastDriftSpeed: number;
  lastDriftVisible: boolean;
  lastThemeKey: string;
}

export const hudState: PixiHudState = {
  hudContainer: null,
  horizonLine: null,
  speedArcBg: null,
  speedArcFill: null,
  shieldArcBg: null,
  shieldArcFill: null,
  driftVectors: null,
  warningBanner: null,
  speedLabel: null,
  shieldLabel: null,
  speedStyle: null,
  shieldStyle: null,
  warningStyle: null,
  lastSpeed: -1,
  lastShieldFrac: -1,
  lastIsCritical: false,
  lastZoom: 1,
  lastAngle: 0,
  lastBoostFx: false,
  boostPulseUntil: 0,
  lastPlayerAngle: 0,
  lastSpdPct: -1,
  lastBoostPulse: -1,
  lastDriftAngle: 0,
  lastDriftSpeed: -1,
  lastDriftVisible: false,
  lastThemeKey: "",
};
