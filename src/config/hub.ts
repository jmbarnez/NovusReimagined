export const HUB = {
  /** Credits charged per 100 mass units when processing raw deposit. */
  PROCESS_FEE_PER_MASS: 0.05,
  /** Minimum processing fee per item. */
  PROCESS_MIN_FEE: 8,
  /** Credits charged per smelt batch queued. */
  SMELT_FEE_PER_BATCH: 12,
  /** Base processing duration (seconds) for debris. */
  DEBRIS_PROCESS_BASE: 50,
  DEBRIS_PROCESS_PER_MASS: 40,
  /** Base processing duration (seconds) for asteroids. */
  ASTEROID_PROCESS_BASE: 110,
  ASTEROID_PROCESS_PER_MASS: 30,
} as const;
