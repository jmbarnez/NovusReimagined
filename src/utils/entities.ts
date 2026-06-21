/**
 * Centralized entity lifecycle helpers.
 *
 * All simulation entities (bullets, beams, particles, etc.) must be created
 * and destroyed through these helpers — never by direct array push/splice.
 *
 * Every entity receives a unique numeric ID for network sync and debugging.
 *
 * High-churn types (bullets, particles, beams, etc.) use object pooling via
 * src/utils/pool.ts to eliminate per-spawn GC pressure.
 *
 * This module is a barrel re-export; the implementation lives in focused
 * per-entity-type submodules under `./entities/` alongside lifecycle
 * orchestration in `./entities/lifecycle.ts`.
 */
export { generateId } from "./entities/id.js";

export type { BulletOwner, Bullet, EnemyBullet } from "./entities/bullets.js";
export {
  addBullet,
  addEnemyBullet,
  removeBullet,
  removeEnemyBullet,
  _getBulletPoolSize,
  _getEnemyBulletPoolSize,
} from "./entities/bullets.js";

export type { Beam } from "./entities/beams.js";
export { addBeam, updateBeams } from "./entities/beams.js";

export type { Particle, ParticleConfig } from "./entities/particles.js";
export { addParticle, updateParticles, _getParticlePoolSize } from "./entities/particles.js";

export type { FloatText, FloatTextConfig } from "./entities/float-texts.js";
export { addFloatText, updateFloatTexts } from "./entities/float-texts.js";

export type { Shockwave, ShockwaveConfig } from "./entities/shockwaves.js";
export { addShockwave, updateShockwaves } from "./entities/shockwaves.js";

export type { Trail, TrailConfig } from "./entities/trails.js";
export { addTrailSegment, updateTrails } from "./entities/trails.js";

export type { ImpactDecal, ImpactDecalConfig } from "./entities/impact-decals.js";
export { addImpactDecal, removeImpactDecal } from "./entities/impact-decals.js";

export type { WreckPieceConfig, SalvagePickupConfig } from "./entities/wreck-salvage.js";
export {
  addWreckPiece,
  removeWreckPiece,
  addSalvagePickup,
  removeSalvagePickup,
} from "./entities/wreck-salvage.js";

export { clearSimulationEntities, tickAndCull, isTargetDestroyed } from "./entities/lifecycle.js";
