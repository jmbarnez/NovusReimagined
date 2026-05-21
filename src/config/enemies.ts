export const ENEMIES = {
  PROJECTILE_SPEED: 550,
  AI: {
    GRID_QUERY_RADIUS: 80,
    SEPARATION_DISTANCE: 70,
    SEPARATION_FORCE_SCALE: 600,
    SEPARATION_MAG_CAP: 1.0,
    AVOIDANCE: {
      LOOKAHEAD_TIME: 0.4,      // seconds of velocity look-ahead for the probe
      QUERY_PADDING: 90,        // added to enemy radius for the asteroid query
      AVOID_PADDING: 60,        // desired clearance beyond asteroid radius
      FORCE_SCALE: 900,         // steering strength
      MAG_CAP: 1.5,             // normalized force cap
    },
    DETECTION: {
      baseAggroRange: 250,
      lockOnMultiplier: 2.5,
      lockingMultiplier: 1.5,
    },
    LOCK_ON: {
      minTime: 0.8,
      baseTime: 6.0,
      perBonusTickReduction: 1.5,
    },
    ENGAGEMENT: {
      ratDrone: {
        orbitDistance: 180,
        orbitHysteresis: 40,
        approachTurnRate: 0.04,
        orbitTurnRate: 0.05,
        thrustMultiplier: 4,
      },
      rat: {
        stopDistance: 220,
        turnRate: 0.08,
        thrustMultiplier: 4,
        idleThrustMultiplier: 0.2,
      },
      other: {
        stopDistance: 350,
        turnRate: 0.08,
        thrustMultiplier: 4,
        idleThrustMultiplier: 0.2,
      },
    },
    SAFE_ZONE: {
      PUSH_FORCE_MULTIPLIER: 400,
    },
    HIT_CHECK_RADIUS: 8,
    TURRET_RELOAD_JITTER: 0.2,
    BEAM_IMPACT_LIFE: 0.15,
    BEAM_HIT_RADIUS_CAP: 45,
  },
  SEPARATION_PASS_COUNT: 1,
  TRAIL: {
    backDistanceOffset: 10,
    backDistanceMultiplier: 0.4,
    color: "#ff8a3a",
    width: 6,
    life: 0.45,
  },
  ATTACK_PULSE_INTERVAL: 1.1,
  IDLE_ANGLE_JITTER_CHANCE: 0.01,
  IDLE_ANGLE_JITTER_AMOUNT: 2,
  IDLE_THRUST_SPEED_THRESHOLD: 20,
  PLAYER_HIT_WINDOW_MS: 6000,
};
