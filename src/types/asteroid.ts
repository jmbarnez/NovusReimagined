/**
 * Asteroid entity structural types.
 */

export interface AsteroidCrystal {
  x: number;
  y: number;
  size: number;
  rot: number;
}

export interface AsteroidIdentity {
  id: string;
  name?: string;
}

export interface AsteroidPhysics {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  radius: number;
  spawnX?: number;
  spawnY?: number;
  orbitSpeed?: number;
}

export interface AsteroidDurability {
  hp: number;
  maxHp: number;
  depleted: boolean;
  respawnTimer: number;
}

export interface AsteroidComposition {
  composition: Record<string, number>;
  richness: number;
}

export interface AsteroidVisual {
  shape: number[][];
  /** Max distance of any shape vertex from centre (1.0 = perfect circle). */
  shapeMax: number;
  spinAngle: number;
  spinVel: number;
  prevSpin: number;
  tintHue: number;
  tintSat: number;
}

export interface AsteroidCrystals {
  hasCrystals?: boolean;
  crystalHue?: number;
  crystals?: AsteroidCrystal[];
}

export interface Asteroid extends
  AsteroidIdentity,
  AsteroidPhysics,
  AsteroidDurability,
  AsteroidComposition,
  AsteroidVisual,
  AsteroidCrystals
{}
