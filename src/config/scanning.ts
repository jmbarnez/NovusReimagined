/** Map survey scanner: passive cap drain and emission signature while active on system map. */
export const SCANNING = {
  MAP_DRAIN: {
    /** Capacitor units drained per second at minimum strength multiplier. */
    basePerSec: 2.5,
  },
  /** Strength dial 0–1 scales drain and signature via these multipliers. */
  MAP_STRENGTH: {
    drainMin: 0.5,
    drainMax: 2.75,
    signatureMin: 1.0,
    signatureMax: 2.4,
  },
  /** Discrete steps on the map strength dial (0 … steps-1). */
  MAP_STRENGTH_STEPS: 5,
} as const;
