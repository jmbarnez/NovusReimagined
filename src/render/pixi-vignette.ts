import { Sprite, Texture, Filter, UniformGroup } from "pixi.js";
import { defaultFilterVert } from "pixi.js";
import { Client, AppMode } from "../state.js";
import { getState } from "../state-access.js";

import { app } from "../pixi.js";

// Fragment: screen-space directional border flashes reactive to damage direction.
// Draws a subtle neutral vignette, overlaying thin colored screen-edge flashes 
// corresponding to active shield, hull, or structure damage direction.
const FRAG = `#version 300 es
precision mediump float;

in vec2 vTextureCoord;
uniform sampler2D uSampler;

uniform float uShieldGlow;
uniform float uShieldAngle;
uniform float uHullGlow;
uniform float uHullAngle;
uniform float uStructureGlow;
uniform float uStructureAngle;

out vec4 fragColor;

float getBorderIntensity(vec2 c, float hitAngle, float hitGlow, float borderWidth) {
  if (hitGlow < 0.001) return 0.0;
  
  float distToEdge = min(1.0 - abs(c.x), 1.0 - abs(c.y));
  if (distToEdge > borderWidth) return 0.0;
  
  float borderFactor = smoothstep(borderWidth, 0.0, distToEdge);
  
  float pixelAngle = atan(c.y, c.x);
  float angleDiff = abs(pixelAngle - hitAngle);
  if (angleDiff > 3.14159265) {
    angleDiff = 6.2831853 - angleDiff;
  }
  
  float angleFactor = smoothstep(1.2, 0.0, angleDiff);
  
  return borderFactor * angleFactor * hitGlow;
}

void main() {
  vec2 c = vTextureCoord * 2.0 - 1.0;
  
  // 1. Subtle neutral dark vignette to frame the game
  float d = length(c);
  float baseVig = smoothstep(0.600, 0.950, d);
  float neutralAlpha = baseVig * 0.15;
  
  // 2. Compute border flashes
  // Border width is 0.04 (4% of screen coords [-1, 1], so 2% of screen width/height)
  float borderWidth = 0.04; 
  float shieldIntensity = getBorderIntensity(c, uShieldAngle, uShieldGlow, borderWidth);
  float hullIntensity   = getBorderIntensity(c, uHullAngle, uHullGlow, borderWidth);
  float structIntensity = getBorderIntensity(c, uStructureAngle, uStructureGlow, borderWidth);
  
  vec3 shieldColor = vec3(0.27, 0.80, 1.0) * shieldIntensity;
  vec3 hullColor   = vec3(0.93, 0.60, 0.27) * hullIntensity;
  vec3 structColor = vec3(0.93, 0.11, 0.11) * structIntensity;
  
  vec3 flashColor = shieldColor + hullColor + structColor;
  float flashAlpha = max(shieldIntensity, max(hullIntensity, structIntensity)) * 0.85;
  
  // 3. Composite flash on top of neutral dark vignette (premultiplied blending)
  vec3 finalRgb = flashColor; // Neutral color is (0,0,0) so neutralColor * (1.0 - flashAlpha) is 0
  float finalAlpha = flashAlpha + neutralAlpha * (1.0 - flashAlpha);
  
  fragColor = vec4(finalRgb, finalAlpha);
}
`;

let _sprite: Sprite | null = null;
let _ug: UniformGroup | null = null;
let _cachedW = 0, _cachedH = 0;

export function initVignette() {
  if (!app) return;
  if (_sprite?.parent && _ug) return;
  if (_sprite) {
    _sprite.destroy();
    _sprite = null;
  }

  _ug = new UniformGroup({
    uShieldGlow:     { value: 0, type: "f32" },
    uShieldAngle:    { value: 0, type: "f32" },
    uHullGlow:       { value: 0, type: "f32" },
    uHullAngle:      { value: 0, type: "f32" },
    uStructureGlow:  { value: 0, type: "f32" },
    uStructureAngle: { value: 0, type: "f32" },
  });

  const filter = Filter.from({
    gl: { vertex: defaultFilterVert, fragment: FRAG, name: "vignette-gpu" },
    resources: { uVigUniforms: _ug },
    blendMode: "normal",
  });

  _sprite = new Sprite(Texture.EMPTY);
  _sprite.filters = [filter];
  _sprite.eventMode = "none";
  app.stage.addChild(_sprite);  // last child → renders on top of everything PixiJS draws
}

export function updateVignette() {
  if (!_ug || !_sprite || !app) return;

  // Resize when viewport changes
  const W = app.screen.width, H = app.screen.height;
  if (W !== _cachedW || H !== _cachedH) {
    _sprite.width  = W;
    _sprite.height = H;
    _cachedW = W; _cachedH = H;
  }

  const inSpace = Client.mode === AppMode.SPACE;
  const enabled = Client.settings?.vignetteEnabled !== false;
  _sprite.visible = inSpace && enabled;
  if (!_sprite.visible) return;

  interface VignetteUniforms {
    uShieldGlow: number;
    uShieldAngle: number;
    uHullGlow: number;
    uHullAngle: number;
    uStructureGlow: number;
    uStructureAngle: number;
    [key: string]: number;
  }

  const u = _ug.uniforms as unknown as VignetteUniforms;
  const player = getState().player;
  if (player) {
    u.uShieldGlow     = player.shieldHitGlow || 0;
    u.uShieldAngle    = player.shieldHitAngle || 0;
    u.uHullGlow       = player.hullHitGlow || 0;
    u.uHullAngle      = player.hullHitAngle || 0;
    u.uStructureGlow  = player.structureHitGlow || 0;
    u.uStructureAngle = player.structureHitAngle || 0;
  } else {
    u.uShieldGlow     = 0;
    u.uShieldAngle    = 0;
    u.uHullGlow       = 0;
    u.uHullAngle      = 0;
    u.uStructureGlow  = 0;
    u.uStructureAngle = 0;
  }
}

export function destroyVignette() {
  if (_sprite) { _sprite.destroy(); _sprite = null; }
  _ug = null;
}
