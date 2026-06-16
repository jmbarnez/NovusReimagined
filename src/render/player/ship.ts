/**
 * Player ship sprite creation, syncing, and lifecycle (local and remote players).
 */
import { Sprite, Texture } from "pixi.js";
import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { entityLayer } from "../../pixi.js";
import { lerp } from "../../utils/math.js";
import { isVisible } from "../../utils/game.js";
import { getNebulaDensity } from "../pixi-background.js";
import { displayShipAngle } from "../display-orientation.js";
import { getShipTexture, getShipLightTextures, getDotTexture } from "./bake.js";
import { getSunWorldPos } from "../../utils/sun-position.js";

const TAU = Math.PI * 2;
const HULL_SCALE = 1.0;
const LIGHT_DIRS = 8;

let _hullSprite: Sprite | null = null;
let _hullLightSprite: Sprite | null = null;
let _shipLightTex: Texture[] = [];
let _currentShipId = "";

interface RemotePlayerSprites {
  hull: Sprite;
  light: Sprite;
  lightTex: Texture[];
  shipId: string;
}

const _remotePlayerSprites = new Map<string, RemotePlayerSprites>();

function destroySprite(sprite: Sprite): void {
  const parent = sprite.parent;
  if (parent && !parent.destroyed) parent.removeChild(sprite);
  if (!sprite.destroyed) sprite.destroy();
}

function isSpriteAttachedToEntityLayer(sprite: Sprite | null): boolean {
  return !!entityLayer
    && !!sprite
    && !sprite.destroyed
    && sprite.parent === entityLayer;
}

function isLocalPlayerSpriteBundleReady(): boolean {
  return isSpriteAttachedToEntityLayer(_hullSprite)
    && isSpriteAttachedToEntityLayer(_hullLightSprite);
}

function isRemotePlayerSpriteBundleReady(bundle: RemotePlayerSprites): boolean {
  return isSpriteAttachedToEntityLayer(bundle.hull)
    && isSpriteAttachedToEntityLayer(bundle.light);
}

export function destroyPlayerSprites() {
  if (_hullSprite) { destroySprite(_hullSprite); _hullSprite = null; }
  if (_hullLightSprite) { destroySprite(_hullLightSprite); _hullLightSprite = null; }
  _shipLightTex = [];
  _currentShipId = "";
}

export function destroyRemotePlayerSprites(): void {
  for (const bundle of _remotePlayerSprites.values()) {
    destroySprite(bundle.hull);
    destroySprite(bundle.light);
  }
  _remotePlayerSprites.clear();
}

function removeOrphanedPlayerSprites(): void {
  if (!entityLayer) return;
  for (let i = entityLayer.children.length - 1; i >= 0; i--) {
    const child = entityLayer.children[i];
    if (child.label === "player-hull" || child.label === "player-light") {
      entityLayer.removeChild(child);
      child.destroy();
    }
  }
}

export function buildPlayerSprites(shipId: string) {
  if (!entityLayer) return;
  removeOrphanedPlayerSprites();
  destroyPlayerSprites();

  _hullSprite = new Sprite(getShipTexture(shipId));
  _hullSprite.anchor.set(0.5);
  _hullSprite.scale.set(HULL_SCALE);
  _hullSprite.visible = false;
  _hullSprite.label = "player-hull";
  entityLayer.addChild(_hullSprite);

  // Directional light overlay — sits directly above the hull, additive blend.
  _shipLightTex = getShipLightTextures(shipId);
  _hullLightSprite = new Sprite(_shipLightTex[0] ?? Texture.EMPTY);
  _hullLightSprite.anchor.set(0.5);
  _hullLightSprite.scale.set(HULL_SCALE);
  _hullLightSprite.blendMode = "add";
  _hullLightSprite.alpha = 0.7;
  _hullLightSprite.visible = false;
  _hullLightSprite.label = "player-light";
  entityLayer.addChild(_hullLightSprite);

  _currentShipId = shipId;
}

function createRemotePlayerSprites(shipId: string): RemotePlayerSprites | null {
  if (!entityLayer) return null;

  const hull = new Sprite(getShipTexture(shipId));
  hull.anchor.set(0.5);
  hull.scale.set(HULL_SCALE);
  hull.visible = false;
  entityLayer.addChild(hull);

  const lightTex = getShipLightTextures(shipId);
  const light = new Sprite(lightTex[0] ?? Texture.EMPTY);
  light.anchor.set(0.5);
  light.scale.set(HULL_SCALE);
  light.blendMode = "add";
  light.alpha = 0.7;
  light.visible = false;
  entityLayer.addChild(light);

  return { hull, light, lightTex, shipId };
}

function getRemotePlayerSprites(netId: string, shipId: string): RemotePlayerSprites | null {
  const existing = _remotePlayerSprites.get(netId);
  if (existing?.shipId === shipId && isRemotePlayerSpriteBundleReady(existing)) return existing;

  if (existing) {
    destroySprite(existing.hull);
    destroySprite(existing.light);
    _remotePlayerSprites.delete(netId);
  }

  const created = createRemotePlayerSprites(shipId);
  if (created) _remotePlayerSprites.set(netId, created);
  return created;
}

function syncRemotePlayers(alpha: number, now: number): void {
  const state = getState();
  const local = state.player;
  if (!local) {
    destroyRemotePlayerSprites();
    return;
  }

  const activeRemoteIds = new Set<string>();
  for (const [key, remote] of state.players) {
    const netId = remote.netId ?? key;
    if (!netId || remote === local || netId === local.netId || key === "local") continue;

    activeRemoteIds.add(netId);
    const bundle = getRemotePlayerSprites(netId, remote.shipId || "scout");
    if (!bundle) continue;

    if (remote.sysIdx !== local.sysIdx || !isVisible(remote.x, remote.y, 80)) {
      bundle.hull.visible = false;
      bundle.light.visible = false;
      continue;
    }

    const useRenderInterpolation = Client.multiplayerRole === "none";
    const ix = useRenderInterpolation ? lerp(remote.px, remote.x, alpha) : remote.x;
    const iy = useRenderInterpolation ? lerp(remote.py, remote.y, alpha) : remote.y;
    const ia = useRenderInterpolation ? lerp(remote.prevAngle, remote.angle, alpha) : remote.angle;
    const lodScale = Math.max(Client.zoom, 0.55);

    bundle.hull.visible = true;
    bundle.hull.scale.set(HULL_SCALE * lodScale / Client.zoom);
    bundle.hull.x = ix;
    bundle.hull.y = iy;
    bundle.hull.rotation = ia;

    bundle.light.scale.set(HULL_SCALE * lodScale / Client.zoom);
    if (Client.settings?.directionalLighting !== false && bundle.lightTex.length) {
      const sys = state.GALAXY?.[remote.sysIdx ?? 0];
      const sunPos = getSunWorldPos(sys);
      const sunDir = Math.atan2(sunPos.y - iy, sunPos.x - ix);
      let lightIdx = Math.round(((sunDir - ia) / TAU) * LIGHT_DIRS) % LIGHT_DIRS;
      if (lightIdx < 0) lightIdx += LIGHT_DIRS;
      bundle.light.texture = bundle.lightTex[lightIdx];
      bundle.light.x = ix;
      bundle.light.y = iy;
      bundle.light.rotation = ia;
      bundle.light.alpha = 0.45 + getNebulaDensity(ix, iy) * 1.8;
      bundle.light.visible = true;
    } else {
      bundle.light.visible = false;
    }

  }

  for (const [netId, bundle] of _remotePlayerSprites) {
    if (activeRemoteIds.has(netId)) continue;
    destroySprite(bundle.hull);
    destroySprite(bundle.light);
    _remotePlayerSprites.delete(netId);
  }
}

export function syncPixiPlayer(alpha: number, now: number): void {
  const player = getState().player;
  if (!player) return;

  if (!isLocalPlayerSpriteBundleReady()) {
    buildPlayerSprites(player.shipId);
    if (!_hullSprite || !_hullLightSprite) return;
  }

  if (player.shipId !== _currentShipId) {
    buildPlayerSprites(player.shipId);
    return;
  }

  const hullSprite = _hullSprite;
  const hullLightSprite = _hullLightSprite;
  if (!hullSprite || !hullLightSprite) return;

  const ix = lerp(player.px, player.x, alpha);
  const iy = lerp(player.py, player.y, alpha);
  const ia = lerp(player.prevAngle, player.angle, alpha);

  // Invincibility blink
  if (player.invincible > 0 && Math.floor(now / 75) % 2 === 0) {
    hullSprite.visible = false;
    hullLightSprite.visible = false;
    syncRemotePlayers(alpha, now);
    return;
  }
  hullSprite.visible = true;

  // LOD: prevent the ship from shrinking below a minimum on-screen size
  const lodScale = Math.max(Client.zoom, 0.55);
  hullSprite.scale.set(HULL_SCALE * lodScale / Client.zoom);

  // Banking tilt
  const angle = displayShipAngle(ia, player.vx, player.vy);

  hullSprite.x = ix;
  hullSprite.y = iy;
  hullSprite.rotation = angle;

  // Directional light overlay — texture picked by local sun direction.
  hullLightSprite.scale.set(HULL_SCALE * lodScale / Client.zoom);
  if (Client.settings?.directionalLighting !== false && _shipLightTex.length) {
    const sys = getState().GALAXY?.[player.sysIdx ?? 0];
    const sunPos = getSunWorldPos(sys);
    const sunDir = Math.atan2(sunPos.y - iy, sunPos.x - ix);
    let di = Math.round(((sunDir - angle) / TAU) * LIGHT_DIRS) % LIGHT_DIRS;
    if (di < 0) di += LIGHT_DIRS;
    hullLightSprite.texture = _shipLightTex[di];
    hullLightSprite.x = ix;
    hullLightSprite.y = iy;
    hullLightSprite.rotation = angle;
    hullLightSprite.visible = true;

    // Dynamic nebula lighting
    const density = getNebulaDensity(ix, iy);
    hullLightSprite.alpha = 0.45 + density * 1.8;
  } else {
    hullLightSprite.visible = false;
  }

  syncRemotePlayers(alpha, now);
}

export function rebuildPlayerSprites(): void {
  destroyPlayerSprites();
  destroyRemotePlayerSprites();
  buildPlayerSprites(getState().player?.shipId ?? "scout");
}
