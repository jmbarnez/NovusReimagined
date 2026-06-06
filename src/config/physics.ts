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
    boostBaseThrustMult: 1.35,
    boostBaseSpeedMult: 1.18,
    boostThermalThrustBonus: 0.15,
    boostThermalSpeedBonus: 0.08,
    boostCapDrainPerSec: 14,
    boostCapReductionMax: 0.35,
    boostMinEnergyToStart: 2,
    boostAssistHeatMin: 0.25,
    boostAssistHeatMax: 0.75,
    heatThrustGainPerSec: 0.018,
    heatActiveModuleGainPerSec: 0.016,
    heatBoostGainPerSec: 0.075,
    heatBoostSpendPerSec: 0.22,
    heatCoolingPerSec: 0.006,
  },
  SPAWN_GRID: {
    cellSize: 128,
  },
};
