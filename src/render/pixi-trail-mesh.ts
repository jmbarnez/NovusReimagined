/**
 * GPU trail mesh renderer.
 *
 * Replaces the sprite-pool trail renderer with a single Mesh using a custom
 * Shader. Each trail becomes a quad (4 verts, 2 triangles). The fragment
 * shader adds heat turbulence, Mach-diamond bands for boost trails, and a
 * white-hot → tail-fade colour gradient.
 */
import { Mesh, Geometry, Shader, Buffer, BufferUsage, State, UniformGroup } from "pixi.js";
import { thrustLayer } from "../pixi.js";
import { getState } from "../state-access.js";
import { TRAIL_VERT, TRAIL_FRAG } from "./shaders/trail.glsl.js";

const MAX_TRAILS = 384;
const VERTS_PER_TRAIL = 4;
const MAX_VERTS = MAX_TRAILS * VERTS_PER_TRAIL;
const MAX_INDICES = MAX_TRAILS * 6;

let _mesh: Mesh<Geometry, Shader> | null = null;
let _geometry: Geometry | null = null;
let _posBuffer: Buffer | null = null;
let _uvBuffer: Buffer | null = null;
let _colorBuffer: Buffer | null = null;
let _alphaBuffer: Buffer | null = null;
let _lifeBuffer: Buffer | null = null;
let _boostBuffer: Buffer | null = null;
let _dotBuffer: Buffer | null = null;
let _ug: UniformGroup | null = null;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16) || 0xffffff;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function buildTrailMesh(): void {
  if (!thrustLayer || _mesh) return;

  _posBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS * 2),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _uvBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS * 2),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _colorBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS * 3),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _alphaBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _lifeBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _boostBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _dotBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });

  const geometry = new Geometry();
  geometry.addAttribute("aPosition", { buffer: _posBuffer, format: "float32x2" });
  geometry.addAttribute("aUV", { buffer: _uvBuffer, format: "float32x2" });
  geometry.addAttribute("aColor", { buffer: _colorBuffer, format: "float32x3" });
  geometry.addAttribute("aAlpha", { buffer: _alphaBuffer, format: "float32" });
  geometry.addAttribute("aLife", { buffer: _lifeBuffer, format: "float32" });
  geometry.addAttribute("aBoost", { buffer: _boostBuffer, format: "float32" });
  geometry.addAttribute("aDot", { buffer: _dotBuffer, format: "float32" });

  const indexData = new Uint16Array(MAX_INDICES);
  for (let i = 0; i < MAX_TRAILS; i++) {
    const v0 = i * 4;
    const idx = i * 6;
    indexData[idx + 0] = v0 + 0;
    indexData[idx + 1] = v0 + 1;
    indexData[idx + 2] = v0 + 2;
    indexData[idx + 3] = v0 + 0;
    indexData[idx + 4] = v0 + 2;
    indexData[idx + 5] = v0 + 3;
  }
  geometry.addIndex(indexData);
  _geometry = geometry;

  _ug = new UniformGroup({
    uTime: { value: 0, type: "f32" },
  });

  const shader = Shader.from({
    gl: {
      vertex: TRAIL_VERT,
      fragment: TRAIL_FRAG,
      name: "trail-shader",
    },
    resources: {
      uTrailUniforms: _ug,
    },
  });

  const state = new State();
  state.blendMode = "add";

  _mesh = new Mesh({ geometry, shader, state });
  _mesh.eventMode = "none";
  thrustLayer.addChild(_mesh);
}

export function syncTrailMesh(now: number): void {
  if (!_mesh || !_posBuffer) return;

  const trails = getState().trails ?? [];
  const posData = _posBuffer.data as Float32Array;
  const uvData = _uvBuffer!.data as Float32Array;
  const colorData = _colorBuffer!.data as Float32Array;
  const alphaData = _alphaBuffer!.data as Float32Array;
  const lifeData = _lifeBuffer!.data as Float32Array;
  const boostData = _boostBuffer!.data as Float32Array;
  const dotData = _dotBuffer!.data as Float32Array;

  let vIdx = 0;
  for (let i = 0; i < MAX_TRAILS; i++) {
    const t = trails[i];
    if (!t || t.life <= 0) {
      // Hide unused trail
      for (let j = 0; j < 4; j++) {
        alphaData[vIdx + j] = 0;
      }
      vIdx += 4;
      continue;
    }

    const lifeRatio = t.life / Math.max(0.001, t.maxLife);
    const [r, g, b] = hexToRgb(t.color);
    const isBoost = t.boost ? 1 : 0;

    if (t.length !== undefined && t.angle !== undefined) {
      // Oriented exhaust sheet
      const ca = Math.cos(t.angle);
      const sa = Math.sin(t.angle);
      const halfW = t.width * 0.5;
      const len = t.length;

      const corners = [
        { dx: -halfW * sa, dy: halfW * ca },
        { dx: halfW * sa, dy: -halfW * ca },
        { dx: halfW * sa - ca * len, dy: -halfW * ca - sa * len },
        { dx: -halfW * sa - ca * len, dy: halfW * ca - sa * len },
      ];

      for (let j = 0; j < 4; j++) {
        const pBase = (vIdx + j) * 2;
        posData[pBase + 0] = t.x + corners[j].dx;
        posData[pBase + 1] = t.y + corners[j].dy;

        const uvBase = (vIdx + j) * 2;
        uvData[uvBase + 0] = j === 0 || j === 3 ? -1.0 : 1.0;
        uvData[uvBase + 1] = j < 2 ? 0.0 : 1.0;

        const cBase = (vIdx + j) * 3;
        colorData[cBase + 0] = r;
        colorData[cBase + 1] = g;
        colorData[cBase + 2] = b;

        alphaData[vIdx + j] = 0.34;
        lifeData[vIdx + j] = lifeRatio;
        boostData[vIdx + j] = isBoost;
        dotData[vIdx + j] = 0.0;
      }
    } else {
      // Dot trail (blink afterimage, enemy trail dot)
      const radius = t.width * 0.55;
      const corners = [
        { dx: -radius, dy: -radius },
        { dx: radius, dy: -radius },
        { dx: radius, dy: radius },
        { dx: -radius, dy: radius },
      ];

      for (let j = 0; j < 4; j++) {
        const pBase = (vIdx + j) * 2;
        posData[pBase + 0] = t.x + corners[j].dx;
        posData[pBase + 1] = t.y + corners[j].dy;

        const uvBase = (vIdx + j) * 2;
        uvData[uvBase + 0] = j === 0 || j === 3 ? -1.0 : 1.0;
        uvData[uvBase + 1] = j < 2 ? -1.0 : 1.0;

        const cBase = (vIdx + j) * 3;
        colorData[cBase + 0] = r;
        colorData[cBase + 1] = g;
        colorData[cBase + 2] = b;

        alphaData[vIdx + j] = 0.85;
        lifeData[vIdx + j] = lifeRatio;
        boostData[vIdx + j] = isBoost;
        dotData[vIdx + j] = 1.0;
      }
    }
    vIdx += 4;
  }

  // Zero alpha for any remaining unused vertices
  for (let i = vIdx; i < MAX_VERTS; i++) {
    alphaData[i] = 0;
  }

  _posBuffer.update();
  _uvBuffer!.update();
  _colorBuffer!.update();
  _alphaBuffer!.update();
  _lifeBuffer!.update();
  _boostBuffer!.update();
  _dotBuffer!.update();

  // Update time uniform
  if (_ug) {
    (_ug.uniforms as unknown as { uTime: number }).uTime = now;
  }
}

export function destroyTrailMesh(): void {
  if (_mesh) {
    _mesh.destroy();
    _mesh = null;
  }
  _geometry = null;
  _posBuffer = null;
  _uvBuffer = null;
  _colorBuffer = null;
  _alphaBuffer = null;
  _lifeBuffer = null;
  _boostBuffer = null;
  _dotBuffer = null;
  _ug = null;
}
