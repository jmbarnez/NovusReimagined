import { Buffer, BufferUsage, Container, Geometry, Mesh, Shader, State, UniformGroup } from "pixi.js";

const MAX_MINING_LASERS = 16;
const QUADS_PER_LASER = 18;
const VERTS_PER_QUAD = 4;
const INDICES_PER_QUAD = 6;
const MAX_QUADS = MAX_MINING_LASERS * QUADS_PER_LASER;
const MAX_VERTS = MAX_QUADS * VERTS_PER_QUAD;
const MAX_INDICES = MAX_QUADS * INDICES_PER_QUAD;
const TAU = Math.PI * 2;

const MINING_LASER_VERT = `#version 300 es
precision highp float;

in vec2 aPosition;
in vec2 aUV;
in vec3 aColor;
in float aAlpha;
in float aKind;

out vec2 vUV;
out vec3 vColor;
out float vAlpha;
out float vKind;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vColor = aColor;
  vAlpha = aAlpha;
  vKind = aKind;
}
`;

const MINING_LASER_FRAG = `#version 300 es
precision mediump float;

in vec2 vUV;
in vec3 vColor;
in float vAlpha;
in float vKind;

out vec4 fragColor;

uniform float uTime;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  float alpha = vAlpha;
  vec3 color = vColor;

  if (vKind < 0.5) {
    float across = abs(vUV.y);
    float core = exp(-across * across * 3.8);
    float bands = 0.92 + 0.08 * sin(vUV.x * 58.0 - uTime * 0.028);
    float taper = smoothstep(0.0, 0.06, vUV.x) * (1.0 - smoothstep(0.94, 1.0, vUV.x));
    alpha *= core * bands * taper;
    color = mix(color * 0.72, vec3(1.0, 0.96, 0.70), pow(core, 2.2) * 0.55);
  } else if (vKind < 1.5) {
    float d = length(vUV);
    float hot = exp(-d * d * 4.2);
    float pulse = 0.86 + 0.14 * sin(uTime * 0.038 + hash(vUV.x + vUV.y) * 2.0);
    alpha *= hot * pulse;
    color = mix(color, vec3(1.0, 0.96, 0.82), hot * 0.55);
  } else {
    float across = abs(vUV.y);
    float along = clamp(vUV.x, 0.0, 1.0);
    float line = exp(-across * across * 5.6);
    float taper = 1.0 - smoothstep(0.45, 1.0, along);
    alpha *= line * taper;
    color = mix(color, vec3(1.0, 0.96, 0.78), line * 0.38);
  }

  if (alpha < 0.004) discard;
  fragColor = vec4(color * alpha, alpha);
}
`;

let _mesh: Mesh<Geometry, Shader> | null = null;
let _posBuffer: Buffer | null = null;
let _uvBuffer: Buffer | null = null;
let _colorBuffer: Buffer | null = null;
let _alphaBuffer: Buffer | null = null;
let _kindBuffer: Buffer | null = null;
let _ug: UniformGroup | null = null;
let _quadCount = 0;

function addQuad(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  halfWidth: number,
  color: [number, number, number],
  alpha: number,
  kind: number,
): void {
  if (!_posBuffer || !_uvBuffer || !_colorBuffer || !_alphaBuffer || !_kindBuffer) return;
  if (_quadCount >= MAX_QUADS) return;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const points = [
    [x1 + nx * halfWidth, y1 + ny * halfWidth, 0, -1],
    [x1 - nx * halfWidth, y1 - ny * halfWidth, 0, 1],
    [x2 - nx * halfWidth, y2 - ny * halfWidth, 1, 1],
    [x2 + nx * halfWidth, y2 + ny * halfWidth, 1, -1],
  ] as const;

  const vertBase = _quadCount * VERTS_PER_QUAD;
  const posData = _posBuffer.data as Float32Array;
  const uvData = _uvBuffer.data as Float32Array;
  const colorData = _colorBuffer.data as Float32Array;
  const alphaData = _alphaBuffer.data as Float32Array;
  const kindData = _kindBuffer.data as Float32Array;

  for (let i = 0; i < VERTS_PER_QUAD; i++) {
    const v = vertBase + i;
    const p = points[i];
    posData[v * 2 + 0] = p[0];
    posData[v * 2 + 1] = p[1];
    uvData[v * 2 + 0] = p[2];
    uvData[v * 2 + 1] = p[3];
    colorData[v * 3 + 0] = color[0];
    colorData[v * 3 + 1] = color[1];
    colorData[v * 3 + 2] = color[2];
    alphaData[v] = alpha;
    kindData[v] = kind;
  }

  _quadCount++;
}

function addDisc(
  x: number,
  y: number,
  radius: number,
  color: [number, number, number],
  alpha: number,
): void {
  if (!_posBuffer || !_uvBuffer || !_colorBuffer || !_alphaBuffer || !_kindBuffer) return;
  if (_quadCount >= MAX_QUADS) return;

  const points = [
    [x - radius, y - radius, -1, -1],
    [x + radius, y - radius, 1, -1],
    [x + radius, y + radius, 1, 1],
    [x - radius, y + radius, -1, 1],
  ] as const;

  const vertBase = _quadCount * VERTS_PER_QUAD;
  const posData = _posBuffer.data as Float32Array;
  const uvData = _uvBuffer.data as Float32Array;
  const colorData = _colorBuffer.data as Float32Array;
  const alphaData = _alphaBuffer.data as Float32Array;
  const kindData = _kindBuffer.data as Float32Array;

  for (let i = 0; i < VERTS_PER_QUAD; i++) {
    const v = vertBase + i;
    const p = points[i];
    posData[v * 2 + 0] = p[0];
    posData[v * 2 + 1] = p[1];
    uvData[v * 2 + 0] = p[2];
    uvData[v * 2 + 1] = p[3];
    colorData[v * 3 + 0] = color[0];
    colorData[v * 3 + 1] = color[1];
    colorData[v * 3 + 2] = color[2];
    alphaData[v] = alpha;
    kindData[v] = 1;
  }

  _quadCount++;
}

function clearUnusedVerts(): void {
  if (!_alphaBuffer) return;
  const alphaData = _alphaBuffer.data as Float32Array;
  for (let i = _quadCount * VERTS_PER_QUAD; i < MAX_VERTS; i++) {
    alphaData[i] = 0;
  }
}

export function initMiningLaserGpu(parent: Container): void {
  if (_mesh?.parent === parent) return;
  destroyMiningLaserGpu();

  _posBuffer = new Buffer({ data: new Float32Array(MAX_VERTS * 2), usage: BufferUsage.VERTEX, shrinkToFit: false });
  _uvBuffer = new Buffer({ data: new Float32Array(MAX_VERTS * 2), usage: BufferUsage.VERTEX, shrinkToFit: false });
  _colorBuffer = new Buffer({ data: new Float32Array(MAX_VERTS * 3), usage: BufferUsage.VERTEX, shrinkToFit: false });
  _alphaBuffer = new Buffer({ data: new Float32Array(MAX_VERTS), usage: BufferUsage.VERTEX, shrinkToFit: false });
  _kindBuffer = new Buffer({ data: new Float32Array(MAX_VERTS), usage: BufferUsage.VERTEX, shrinkToFit: false });

  const geometry = new Geometry();
  geometry.addAttribute("aPosition", { buffer: _posBuffer, format: "float32x2" });
  geometry.addAttribute("aUV", { buffer: _uvBuffer, format: "float32x2" });
  geometry.addAttribute("aColor", { buffer: _colorBuffer, format: "float32x3" });
  geometry.addAttribute("aAlpha", { buffer: _alphaBuffer, format: "float32" });
  geometry.addAttribute("aKind", { buffer: _kindBuffer, format: "float32" });

  const indices = new Uint16Array(MAX_INDICES);
  for (let i = 0; i < MAX_QUADS; i++) {
    const v = i * VERTS_PER_QUAD;
    const idx = i * INDICES_PER_QUAD;
    indices[idx + 0] = v + 0;
    indices[idx + 1] = v + 1;
    indices[idx + 2] = v + 2;
    indices[idx + 3] = v + 0;
    indices[idx + 4] = v + 2;
    indices[idx + 5] = v + 3;
  }
  geometry.addIndex(indices);

  _ug = new UniformGroup({ uTime: { value: 0, type: "f32" } });
  const shader = Shader.from({
    gl: { vertex: MINING_LASER_VERT, fragment: MINING_LASER_FRAG, name: "mining-laser-gpu" },
    resources: { uMiningLaserUniforms: _ug },
  });
  const state = new State();
  state.blendMode = "add";

  _mesh = new Mesh({ geometry, shader, state });
  _mesh.eventMode = "none";
  parent.addChild(_mesh);
}

export function beginMiningLaserGpuFrame(now: number): void {
  _quadCount = 0;
  if (_ug) {
    (_ug.uniforms as unknown as { uTime: number }).uTime = now;
  }
}

export function drawMiningLaserGpu(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  phase: number,
  hitNx: number,
  hitNy: number,
  hitR: number,
): void {
  if (!_mesh) return;

  const hittingAsteroid = hitR > 0;
  let endX = x2;
  let endY = y2;
  if (hittingAsteroid) {
    const osc = Math.sin(phase || 0) * 2.2;
    endX += -hitNy * osc;
    endY += hitNx * osc;
  }

  const pulse = 0.84 + 0.16 * Math.sin(phase * 2.7);
  addQuad(x1, y1, endX, endY, 6.4, [1.0, 0.55, 0.08], 0.22 * pulse, 0);
  addQuad(x1, y1, endX, endY, 2.8, [1.0, 0.78, 0.18], 0.56 * pulse, 0);
  addQuad(x1, y1, endX, endY, 0.95, [1.0, 0.96, 0.58], 0.96 * pulse, 0);

  if (!hittingAsteroid) {
    addDisc(endX, endY, 7, [1.0, 0.76, 0.18], 0.20 * pulse);
    return;
  }

  const flicker = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin((phase || 0) * 3.4));
  addDisc(endX, endY, 15, [1.0, 0.30, 0.03], 0.18 * flicker);
  addDisc(endX, endY, 9, [1.0, 0.62, 0.10], 0.38 * flicker);
  addDisc(endX, endY, 3.7, [1.0, 0.96, 0.72], 0.82 * flicker);

  const sparkA = Math.atan2(hitNy, hitNx);
  for (let s = 0; s < 10; s++) {
    const seed = s * 12.9898;
    const gate = 0.5 + 0.5 * Math.sin((phase || 0) * (2.6 + s * 0.37) + seed);
    if (gate < 0.42) continue;
    const spread = (0.32 + gate * 0.92) * (s % 2 === 0 ? 1 : -1);
    const jitter = Math.sin((phase || 0) * (1.7 + s * 0.18) + seed) * 0.22;
    const angle = sparkA + spread + jitter;
    const len = 5 + gate * (10 + (s % 4) * 2.2);
    const sx = endX + Math.cos(angle) * 1.5;
    const sy = endY + Math.sin(angle) * 1.5;
    addQuad(
      sx,
      sy,
      sx + Math.cos(angle) * len,
      sy + Math.sin(angle) * len,
      0.55 + gate * 0.35,
      s % 3 === 0 ? [1.0, 0.78, 0.24] : [1.0, 0.92, 0.55],
      gate * 0.72,
      2,
    );
  }

  const normalA = Math.atan2(hitNy, hitNx);
  for (let s = 0; s < 4; s++) {
    const a = normalA + (s / 4) * TAU + Math.sin(phase * 0.8 + s) * 0.16;
    const r0 = 3.5 + s * 0.75;
    const r1 = r0 + 4 + Math.sin(phase * 1.3 + s) * 1.2;
    addQuad(
      endX + Math.cos(a) * r0,
      endY + Math.sin(a) * r0,
      endX + Math.cos(a) * r1,
      endY + Math.sin(a) * r1,
      0.38,
      [1.0, 0.58, 0.12],
      0.32 * flicker,
      2,
    );
  }
}

export function endMiningLaserGpuFrame(): void {
  if (!_mesh || !_posBuffer || !_uvBuffer || !_colorBuffer || !_alphaBuffer || !_kindBuffer) return;
  clearUnusedVerts();
  _mesh.visible = _quadCount > 0;
  _posBuffer.update();
  _uvBuffer.update();
  _colorBuffer.update();
  _alphaBuffer.update();
  _kindBuffer.update();
}

export function destroyMiningLaserGpu(): void {
  if (_mesh) {
    _mesh.destroy();
    _mesh = null;
  }
  _posBuffer = null;
  _uvBuffer = null;
  _colorBuffer = null;
  _alphaBuffer = null;
  _kindBuffer = null;
  _ug = null;
  _quadCount = 0;
}
