import { Container, Sprite, Texture, Filter, UniformGroup } from "pixi.js";
import type { System } from "../types/world.js";
import { defaultFilterVert } from "pixi.js";
import { NOISE_GLSL } from "./shaders/noise.glsl.js";
import { mkRng } from "../utils/math.js";
import { viewportW, viewportH } from "./viewport.js";

interface NebulaUniforms {
  uTime: number;
  uCamera: Float32Array;
  uDensity: number;
  uColor0: Float32Array;
  uColor1: Float32Array;
  uColor2: Float32Array;
  uOffset: Float32Array;
  uAspect: Float32Array;
  uRidgeFactor: number;
  uWarpStrength: number;
  uLaneDir: Float32Array;
  [key: string]: unknown;
}


let _sprite: Sprite | null = null;
let _filter: Filter | null = null;
let _ug: UniformGroup | null = null;
const _nebulaSessionSeed = Date.now();

// ── GLSL fragment shader ───────────────────────────────────────────────────
const FRAG = `#version 300 es
precision highp float;

in vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

uniform vec2  uCamera;
uniform float uTime;
uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform float uDensity;
uniform vec2  uAspect;
uniform float uRidgeFactor;
uniform float uWarpStrength;
uniform vec2  uOffset;
uniform vec2  uLaneDir;

out vec4 fragColor;

${NOISE_GLSL}

float nebulaLayer(vec2 uv, float camScale, float freq, vec2 aspect, float warp, float ridge) {
  vec2 p = uv * freq + uCamera * camScale + uOffset;
  p *= aspect;
  p = nDomainWarp(p, warp);
  float f = nFbm4(p);
  float r = 1.0 - abs(f * 2.0 - 1.0);
  return smoothstep(0.35, 0.80, mix(f, r, ridge));
}

void main() {
  if (uDensity < 0.001) { fragColor = vec4(0.0); return; }

  vec2 uv    = vTextureCoord;
  float drift = uTime * 0.0000012;

  // Archetype anisotropy fades toward neutral at closer layers
  vec2 farAsp  = mix(vec2(1.0), uAspect, 1.00);
  vec2 midAsp  = mix(vec2(1.0), uAspect, 0.50);
  vec2 nearAsp = mix(vec2(1.0), uAspect, 0.15);

  // Three depth layers: far (slowest parallax) → near (fastest)
  float far  = nebulaLayer(uv + vec2(drift,         drift * 0.5),  0.000006, 2.0, farAsp,  uWarpStrength,        uRidgeFactor);
  float mid  = nebulaLayer(uv + vec2(-drift * 0.7,  drift),        0.000015, 2.8, midAsp,  uWarpStrength * 0.60, uRidgeFactor * 0.65);
  float near = nebulaLayer(uv + vec2(drift  * 1.2, -drift),        0.000030, 3.6, nearAsp, uWarpStrength * 0.25, uRidgeFactor * 0.25);

  // Lane bias for dust-lane archetype
  float lane = 0.0;
  if (dot(uLaneDir, uLaneDir) > 0.001) {
    float laneT = dot(uv - 0.5, uLaneDir);
    lane = exp(-laneT * laneT * 10.0) * 0.35 * uDensity;
  }

  vec3 col = uColor0 * far + uColor1 * mid * 0.65 + uColor2 * near * 0.35;
  float d  = far * 0.50 + mid * 0.32 + near * 0.13 + lane;
  d *= uDensity * (0.96 + 0.04 * sin(uTime * 0.00024));
  d  = clamp(d, 0.0, 1.0);

  fragColor = vec4(col * d, d);
}
`;

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function buildFilter(): Filter {
  _ug = new UniformGroup({
    uCamera:       { value: new Float32Array(2),      type: "vec2<f32>" },
    uTime:         { value: 0,                         type: "f32"       },
    uColor0:       { value: new Float32Array(3),      type: "vec3<f32>" },
    uColor1:       { value: new Float32Array(3),      type: "vec3<f32>" },
    uColor2:       { value: new Float32Array(3),      type: "vec3<f32>" },
    uDensity:      { value: 0,                         type: "f32"       },
    uAspect:       { value: new Float32Array([1, 1]), type: "vec2<f32>" },
    uRidgeFactor:  { value: 0,                         type: "f32"       },
    uWarpStrength: { value: 1,                         type: "f32"       },
    uOffset:       { value: new Float32Array(2),      type: "vec2<f32>" },
    uLaneDir:      { value: new Float32Array(2),      type: "vec2<f32>" },
  });
  return Filter.from({
    gl: { vertex: defaultFilterVert, fragment: FRAG, name: "nebula-gpu" },
    resources: { uNebUniforms: _ug },
    blendMode: "normal",
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

export function initNebulaMesh(parent: Container) {
  if (_sprite?.parent === parent) return;
  if (_sprite) {
    _sprite.destroy();
    _sprite = null;
  }
  _filter = buildFilter();
  _sprite = new Sprite(Texture.EMPTY);
  _sprite.filters = [_filter];
  resizeNebulaMesh();
  parent.addChildAt(_sprite, 0);   // behind everything else in screenContainer
}

export function updateNebulaMesh(now: number, camX: number, camY: number) {
  if (!_ug) return;
  const u = _ug.uniforms as unknown as NebulaUniforms;
  u.uTime = now;
  u.uCamera = new Float32Array([camX, camY]);
}

export function setNebulaSystem(sys: System, enabled = true) {
  if (!_ug) return;
  const u = _ug.uniforms as unknown as NebulaUniforms;

  if (_sprite) _sprite.visible = enabled;
  if (!enabled || !sys) return;

  // Vary the generated background nebula by session launch time
  const rng = mkRng(sys.id + "-neb-gpu-v2-" + _nebulaSessionSeed);

  // Procedural density / coverage / brightness multiplier
  // yielding values between 0.35 and 0.90 for rich coverage variations
  const coverage = 0.35 + rng() * 0.55;
  u.uDensity = coverage;

  // Procedural and fully random hues, saturations, and lightnesses
  const baseHue = rng() * 360;
  const h0 = baseHue;
  const h1 = (baseHue + 20 + rng() * 80) % 360;
  const h2 = (baseHue + 150 + rng() * 100) % 360;

  // Randomize saturations (0.45 to 0.85) and lightnesses (0.35 to 0.65) for maximum visual beauty and depth
  const s0 = 0.45 + rng() * 0.4;
  const s1 = 0.45 + rng() * 0.4;
  const s2 = 0.45 + rng() * 0.4;

  const l0 = 0.35 + rng() * 0.3;
  const l1 = 0.35 + rng() * 0.3;
  const l2 = 0.35 + rng() * 0.3;

  const c0 = hslToRgb(h0 / 360, s0, l0);
  const c1 = hslToRgb(h1 / 360, s1, l1);
  const c2 = hslToRgb(h2 / 360, s2, l2);
  u.uColor0 = new Float32Array(c0);
  u.uColor1 = new Float32Array(c1);
  u.uColor2 = new Float32Array(c2);

  // Randomize offset with larger ranges to avoid repeated patterns
  u.uOffset = new Float32Array([rng() * 1000, rng() * 1000]);

  _applyArchetype(u, sys.archetype ?? "wisps", rng);
}

function _applyArchetype(u: NebulaUniforms, arch: string, rng: () => number) {
  let aspect = [1.0, 1.0];
  let ridge  = 0.0;
  let warp   = 1.0;
  let lane   = [0.0, 0.0];

  switch (arch) {
    case "wisps":
      aspect = [2.5 + rng() * 1.5, 0.38 + rng() * 0.1];
      ridge  = 0.45 + rng() * 0.3;
      warp   = 1.3 + rng() * 0.3;
      break;
    case "filament":
    case "filaments":
      aspect = [4.5 + rng() * 2.0, 0.20 + rng() * 0.1];
      ridge  = 0.65 + rng() * 0.25;
      warp   = 1.8 + rng() * 0.4;
      break;
    case "dust-lane": {
      const slope = (rng() - 0.5) * 1.6;
      const len   = Math.hypot(1, slope);
      lane   = [1 / len, slope / len];
      aspect = [1.8 + rng() * 0.5, 0.6 + rng() * 0.2];
      ridge  = 0.15 + rng() * 0.15;
      warp   = 0.9 + rng() * 0.3;
      break;
    }
    case "pillars":
      aspect = [0.4 + rng() * 0.15, 2.5 + rng() * 0.5];
      ridge  = 0.25 + rng() * 0.2;
      warp   = 1.2 + rng() * 0.3;
      break;
    case "dense":
      aspect = [1.0 + (rng() - 0.5) * 0.3, 1.0 + (rng() - 0.5) * 0.3];
      ridge  = 0.0;
      warp   = 0.7 + rng() * 0.3;
      break;
    default:  // void + unknown
      aspect = [1.1 + rng() * 0.4, 0.9 - rng() * 0.3];
      ridge  = 0.05 + rng() * 0.1;
      warp   = 0.4 + rng() * 0.3;
      break;
  }

  u.uAspect = new Float32Array(aspect);
  u.uRidgeFactor  = ridge;
  u.uWarpStrength = warp;
  u.uLaneDir = new Float32Array(lane);
}

export function resizeNebulaMesh() {
  if (!_sprite) return;
  _sprite.width  = Math.max(1, viewportW());
  _sprite.height = Math.max(1, viewportH());
}

export function destroyNebulaMesh() {
  if (_sprite) { _sprite.destroy(); _sprite = null; }
  _filter  = null;
  _ug      = null;
}
