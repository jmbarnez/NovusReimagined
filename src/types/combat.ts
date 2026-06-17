/**
 * Combat and targeting structural types.
 */

export interface LockSlot {
  id: string;
  resolving: boolean;
  acc: number;
}

/**
 * Resolved primary target (Enemy or Asteroid). Defined as a structural
 * shape rather than a discriminated union so callers don't need to narrow
 * before reading common fields like `name`/`alive`/`depleted`.
 */
export interface AutoTarget {
  id: string;
  x: number;
  y: number;
  hp: number;
  name?: string;
  alive?: boolean;
  depleted?: boolean;
  sigRadius?: number;
  vx?: number;
  vy?: number;
  radius?: number;
}
