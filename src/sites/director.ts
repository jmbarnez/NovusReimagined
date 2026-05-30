/**
 * Hidden-site lifecycle director (Tier 2+).
 *
 * Tier 1: resolving a signature does not respawn the same site; clearing marks
 * `state: "cleared"` permanently until save reset or this director schedules a
 * new instance (new id, new coordinates).
 */
export function tickSiteDirector(_dt: number) {
  // TODO: respawn when activeCount < budget after respawnCooldown (Novus Prime template).
}
