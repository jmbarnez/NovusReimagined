# Ambient Ship Projectile Rendering — Diagnostic Plan

## Current Findings

- **Creation**: `fireTurretsAt` in `src/physics/npc-ai.ts:175` correctly calls `addEnemyBullet` for ambient combat ships (escort/scout).
- **Physics**: `updateEnemyBullets` in `src/physics/npcs/combat.ts:51` updates positions and handles collisions.
- **Render**: `syncBullets` in `src/render/combat/bullets.ts:84` iterates `state.enemyBullets` and draws them with PixiJS.
- **Pipeline**: `syncPixiCombat` → `syncBullets` is called every frame in `src/game-loop/render-pass.ts:180`.

## Suspected Area

Single-player uses a **local server worker**. The client both:
1. Runs local physics (`updateNpcs` → `fireTurretsAt` → `addEnemyBullet`)
2. Receives server snapshots that call `applyProjectileSnapshots`, which **clears** `enemyBullets` and rebuilds from the server snapshot.

This creates a race: locally-created bullets can be wiped by snapshot application before rendering. The server *should* include its own bullets in snapshots, but if client/server ambient ship states diverge (different `Math.random()` seeds for spawn timing/IDs), the server's snapshot may not contain matching bullets.

## Next Steps

1. **Verify with console logging** — Add temporary `console.log` to:
   - `src/physics/npc-ai.ts:175` when `addEnemyBullet` is called (log count + ownerId)
   - `src/render/combat/bullets.ts:84` loop entry (log `state.enemyBullets.length`)
   - `src/net/snapshot-apply/projectiles.ts:7` (log count before/after applying snapshot)

2. **Run in browser** — Observe whether bullets are created but then cleared by snapshots, or never created at all.

3. **Fix root cause** once the exact failure point is identified.
