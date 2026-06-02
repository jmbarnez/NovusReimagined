export const COMBAT = {
  // Back-compat surface used by combat/stats modules.
  RANGE_MODEL: {
    edgeFalloffs: 2,
    minFalloffPx: 24,
    defaultSig: 35,
    sigRef: 35,
    missThreshold: 0.12,
    jitterMin: 0.15,
  },
  TRACKING: {
    trackingFloor: 0.08,
    k: 1.0,
  },
  MISSILE: {
    launchSpeed: 220,
    cruiseSpeed: 820,
    accel: 680,
    turnRate: 3.2,
    maxLife: 2.2,
    lifetimeMultiplier: 1.0,
  },
  RESISTS: {
    min: -0.75,
    max: 0.85,
  },
  TURRET_ORIGIN: {
    forwardPx: 14,
    localDownPx: 0,
  },
  PLAYER_AIM: {
    skillBase: 0.80,
    skillPerWeaponLevel: 0.08,
    sigMultiplier: 0.35,
    distanceScatterBase: 30,
    distanceRatioCap: 1.4,
    trackingFloor: 0.10,
    trackingThresholdMultiplier: 0.012,
    transversalCap: 1.8,
    transversalScatterBase: 15,
    deviationCapRad: 0.35,
  },
  ENEMY_AIM: {
    baseScatter: 22,
    accuracyFloor: 0.4,
    distanceReference: 600,
    distanceRatioCap: 1.5,
    distanceScatterBase: 28,
    deviationCapRad: 0.38,
  },
  RECOIL: {
    projectileMultiplier: 0.009,
    beamMultiplier: 0.35,
  },
  MUZZLE_FLASH: {
    missileIntensity: 10,
    heavyProjectileIntensity: 8,
    defaultIntensity: 6,
    heavyProjectileDmgThreshold: 25,
  },
  XP: {
    perKill: 50,
    perMine: 10,
    weaponSkillPerKill: 25,
  },
  EXPLOSION_SCALE: {
    raider: 1.3,
    pirate: 1.0,
    default: 0.75,
  },
  SFX_EXPLOSION_SCALE: {
    raider: 1.2,
    pirate: 0.8,
    default: 0.5,
  },
  TURRET: {
    traverseConeRad: 0.8,
  },
  TURRET_RANGE_OVERSHOOT: 1.1,
  CAP_FIRE_SURCHARGE: 0.38,
  PLAYER_PARTICIPATION_WINDOW_MS: 8000,
};
