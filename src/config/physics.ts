// Ship-handling and spawn-grid tuning.
//
// Collision, mass, module, drag, and station-turret tunables are the flat
// exports in src/constants.ts (COLLISION_*, *_MASS, MODULE_*, *_DRAG,
// STATION_TURRET_*) — that is their single source of truth. Do not re-add
// duplicate blocks for them here.
export const PHYSICS = {
  SHIP: {
    lateralThrustScale: 0.55,
    minSpeedForThrust: 12,
    turnRateMultiplier: 2.5,
    brakeVelocityRetention: 0.99,
    brakeAngularRetention: 0.95,
    thrustTrailRearDist: 22,
    thrustTrailNormalColor: "#9ad6ff",
    thrustTrailNormalWidth: 10,
    thrustTrailABColor: "#ffaa55",
    thrustTrailABWidth: 14,
    thrustTrailLife: 0.9,
    boostBaseThrustMult: 1.25,
    boostBaseSpeedMult: 1.12,
    boostModuleThrustBonus: 0.18,
    boostModuleSpeedBonus: 0.08,
    boostModuleCapCostMult: 0.9,
    boostCapDrainPerSec: 14,
    boostMinEnergyToStart: 2,
  },
  SPAWN_GRID: {
    cellSize: 128,
  },
};
