import { Graphics } from "pixi.js";
import { effectLayer } from "../pixi.js";
import { getState } from "../state-access.js";
import { curSys } from "../utils/game.js";
import { SHIPS } from "../data/ships.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { getPlayerColRadius, getEnemyColRadius } from "../utils/collision-helpers.js";
import { getAsteroidColRadius } from "../utils/asteroid-helpers.js";
import { Client, AppMode } from "../state.js";

let _gfx: Graphics | null = null;
let _enabled = false;

function getGfx(): Graphics | null {
  if (!effectLayer) return null;
  if (!_gfx) {
    _gfx = new Graphics();
    _gfx.label = "collision-debug";
    effectLayer.addChild(_gfx);
  }
  return _gfx;
}

function transformPath(
  cx: number, cy: number, angle: number,
  path: number[][], out: number[][],
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  out.length = path.length;
  for (let i = 0; i < path.length; i++) {
    const [vx, vy] = path[i];
    if (!out[i]) out[i] = [0, 0];
    out[i][0] = cx + vx * cos - vy * sin;
    out[i][1] = cy + vx * sin + vy * cos;
  }
}

const _worldPath: number[][] = [];

function drawPolygon(g: Graphics, path: number[][], color: number, closed = true): void {
  if (path.length < 2) return;
  g.stroke({ width: 1, color });
  g.moveTo(path[0][0], path[0][1]);
  for (let i = 1; i < path.length; i++) g.lineTo(path[i][0], path[i][1]);
  if (closed) g.lineTo(path[0][0], path[0][1]);
}

function drawCircle(g: Graphics, x: number, y: number, r: number, color: number): void {
  g.stroke({ width: 1, color });
  g.circle(x, y, r);
}

function drawCollisionShapes(): void {
  const g = getGfx();
  if (!g) return;
  g.clear();

  if (Client.mode === AppMode.TITLE || Client.mode === AppMode.STATION) return;
  if (!_enabled) return;

  const state = getState();
  const sys = curSys();
  if (!sys) return;

  const p = state.player;
  if (!p) return;

  // Player hull
  const shipPath = SHIPS[p.shipId]?.render.path;
  if (shipPath) {
    transformPath(p.x, p.y, p.angle, shipPath, _worldPath);
    drawPolygon(g, _worldPath, 0x00ff00);
    drawCircle(g, p.x, p.y, getPlayerColRadius(p.shipId), 0x00ff00);
  }

  // Enemies
  for (const e of sys._liveEnemies ?? []) {
    const enemyPath = ENEMY_DEFS[e.type]?.render.path;
    if (enemyPath) {
      transformPath(e.x, e.y, e.angle, enemyPath, _worldPath);
      drawPolygon(g, _worldPath, 0xff0000);
      drawCircle(g, e.x, e.y, getEnemyColRadius(e.type), 0xff0000);
    }
  }

  // Asteroids
  for (const a of sys.asteroids) {
    if (a.depleted || a.hp <= 0) continue;
    const shape = a.shape;
    if (shape && shape.length) {
      _worldPath.length = shape.length;
      for (let i = 0; i < shape.length; i++) {
        if (!_worldPath[i]) _worldPath[i] = [0, 0];
        _worldPath[i][0] = a.x + shape[i][0];
        _worldPath[i][1] = a.y + shape[i][1];
      }
      drawPolygon(g, _worldPath, 0xffaa00);
      drawCircle(g, a.x, a.y, getAsteroidColRadius(a), 0xffaa00);
    }
  }

  // Wreck pieces
  for (const w of state.wreckPieces ?? []) {
    if (w.hp <= 0) continue;
    drawCircle(g, w.x, w.y, w.radius, 0xff00ff);
  }
}

export function isCollisionDebugEnabled(): boolean {
  return _enabled;
}

export function setCollisionDebug(enabled: boolean): void {
  _enabled = enabled;
}

export function toggleCollisionDebug(): void {
  _enabled = !_enabled;
}

export function syncCollisionDebug(): void {
  drawCollisionShapes();
}

export function destroyCollisionDebug(): void {
  if (_gfx) {
    _gfx.destroy();
    _gfx = null;
  }
}
