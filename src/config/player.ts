export const PLAYER = {
  SKILL_POTENCY: {
    // Per-weapon-type damage scaling (applied at fire time based on weapon delivery).
    weaponMultPerLevel: 0.025,
    // Lock scan benefits from any combat training (uses max of the three weapon skills).
    lockScanPerLevel: 0.018,
    miningMultPerLevel: 0.04,
    engineeringEhpPerLevel: 0.025,
    levelHpPerLevel: 0.09,
    engineeringShieldRegenPerLevel: 0.04,
    salvagePerLevel: 0.03,
  },
  STRUCTURE_RATIO: 0.8,
  SPEED: {
    engineRatioFloor: 0.78,
    engineRatioCeiling: 0.22,
    engineRatioCap: 2.5,
  },
  MASS: {
    agilityFloor: 0.4,
  },
  THRUST: {
    dragMin: 0.965,
    dragMax: 0.9995,
  },
  DURABILITY: {
    inactiveFloor: 0.3,
    activeScale: 0.7,
  },
  MINE_RANGE: {
    referenceKm: 8,
    referencePx: 100,
    miningSkillMultiplier: 0.3,
  },
  TURRET: {
    rangeKmReference: 58,
    rangeScaleMultiplier: 1.24,
    rangeMinPx: 90,
    projectileSpeedBase: 0.65,
    projectileSpeedPerTracking: 0.5,
    projectileSpeedMin: 180,
    defaultTrackingSpeed: 0.55,
  },
  CAPACITOR: {
    baseCapacitorFallback: 100,
    capPerLevelFallback: 8,
    capFromEngineeringFallback: 4,
    baseCapRechargeFallback: 6,
    capRechargeFromEngineeringFallback: 0.5,
  },
  MINING_LASER: {
    energyCostPerSec: 10,
    cooldown: 0.45,
    particleCount: 2,
    particleSpread: 1.4,
    particleSpeedMin: 30,
    particleSpeedMax: 60,
    particleLifeMin: 0.35,
    particleLifeMax: 0.25,
    particleDragMin: 0.90,
    particleDragMax: 0.06,
    particleDecayMin: 2.0,
    particleDecayMax: 1.0,
    humInterval: 0.5,
  },
};
