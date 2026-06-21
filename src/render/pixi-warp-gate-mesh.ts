/**
 * GPU warp gate mesh renderer.
 *
 * Renders warp gates as a single GPU Mesh with a custom shader. Each gate
 * is one quad (4 verts, 2 triangles) covering the gate's bounding circle.
 * The fragment shader draws the solid hull ring, swirling vortex portal,
 * counter-rotating dashed rings, charging energy arcs, orbiting sparks,
 * pulsing core, and outer rim halo — all on the GPU.
 *
 * Follows the same architecture as `pixi-trail-mesh.ts` and
 * `pixi-boost-gate-mesh.ts`.
 */
import { Mesh, Geometry, Shader, Buffer, BufferUsage, State, UniformGroup } from "pixi.js";
import { effectLayer } from "../pixi.js";
import { WARP_GATE_VERT, WARP_GATE_FRAG } from "./shaders/warp-gate.glsl.js";

const MAX_GATES = 32;
const VERTS_PER_GATE = 4;
const MAX_VERTS = MAX_GATES * VERTS_PER_GATE;
const MAX_INDICES = MAX_GATES * 6;

/** UV padding beyond r=1 for the rim halo. */
const RIM_PAD_FRAC = 0.15;

let _mesh: Mesh<Geometry, Shader> | null = null;
let _geometry: Geometry | null = null;
let _posBuffer: Buffer | null = null;
let _uvBuffer: Buffer | null = null;
let _colorHullBuffer: Buffer | null = null;
let _colorPortalBuffer: Buffer | null = null;
let _colorCoreBuffer: Buffer | null = null;
let _alphaBuffer: Buffer | null = null;
let _chargeBuffer: Buffer | null = null;
let _stateBuffer: Buffer | null = null;
let _spinBuffer: Buffer | null = null;
let _seedBuffer: Buffer | null = null;
let _ug: UniformGroup | null = null;

export function isWarpGateMeshReady(): boolean {
  return _mesh !== null;
}

export function buildWarpGateMesh(): void {
  if (!effectLayer || _mesh) return;

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
  _colorHullBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS * 3),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _colorPortalBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS * 3),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _colorCoreBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS * 3),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _alphaBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _chargeBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _stateBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _spinBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });
  _seedBuffer = new Buffer({
    data: new Float32Array(MAX_VERTS),
    usage: BufferUsage.VERTEX,
    shrinkToFit: false,
  });

  const geometry = new Geometry();
  geometry.addAttribute("aPosition", { buffer: _posBuffer, format: "float32x2" });
  geometry.addAttribute("aUV", { buffer: _uvBuffer, format: "float32x2" });
  geometry.addAttribute("aColorHull", { buffer: _colorHullBuffer, format: "float32x3" });
  geometry.addAttribute("aColorPortal", { buffer: _colorPortalBuffer, format: "float32x3" });
  geometry.addAttribute("aColorCore", { buffer: _colorCoreBuffer, format: "float32x3" });
  geometry.addAttribute("aAlpha", { buffer: _alphaBuffer, format: "float32" });
  geometry.addAttribute("aCharge", { buffer: _chargeBuffer, format: "float32" });
  geometry.addAttribute("aState", { buffer: _stateBuffer, format: "float32" });
  geometry.addAttribute("aSpin", { buffer: _spinBuffer, format: "float32" });
  geometry.addAttribute("aSeed", { buffer: _seedBuffer, format: "float32" });

  const indexData = new Uint16Array(MAX_INDICES);
  for (let i = 0; i < MAX_GATES; i++) {
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
      vertex: WARP_GATE_VERT,
      fragment: WARP_GATE_FRAG,
      name: "warp-gate-shader",
    },
    resources: {
      uWarpGateUniforms: _ug,
    },
  });

  const state = new State();
  state.blendMode = "add";

  _mesh = new Mesh({ geometry, shader, state });
  _mesh.eventMode = "none";
  _mesh.label = "warp-gate-mesh";
  effectLayer.addChild(_mesh);
}

export interface WarpGateColorSet {
  hull: [number, number, number];
  portal: [number, number, number];
  core: [number, number, number];
}

export interface WarpGateRenderData {
  id: string;
  x: number;
  y: number;
  radius: number;
  visible: boolean;
  /** 0..1 charge progress (energy buildup). */
  charge: number;
  /** 0=dormant, 1=primed, 2=charging, 3=active/cooldown. */
  state: number;
  /** Current spin angle (radians). */
  spin: number;
  /** Per-gate stable seed 0..1. */
  seed: number;
  /** Color palette. */
  colors: WarpGateColorSet;
  /** Overall alpha multiplier. */
  alpha: number;
}

/**
 * Upload per-gate vertex data to the GPU and update the time uniform.
 *
 * Gates beyond `gates.length` are zeroed (hidden). The mesh visibility is
 * toggled based on whether any gates are active.
 */
export function syncWarpGateMesh(now: number, gates: WarpGateRenderData[]): void {
  const mesh = _mesh;
  const posBuffer = _posBuffer;
  const uvBuffer = _uvBuffer;
  const colorHullBuffer = _colorHullBuffer;
  const colorPortalBuffer = _colorPortalBuffer;
  const colorCoreBuffer = _colorCoreBuffer;
  const alphaBuffer = _alphaBuffer;
  const chargeBuffer = _chargeBuffer;
  const stateBuffer = _stateBuffer;
  const spinBuffer = _spinBuffer;
  const seedBuffer = _seedBuffer;
  if (
    !mesh ||
    !posBuffer ||
    !uvBuffer ||
    !colorHullBuffer ||
    !colorPortalBuffer ||
    !colorCoreBuffer ||
    !alphaBuffer ||
    !chargeBuffer ||
    !stateBuffer ||
    !spinBuffer ||
    !seedBuffer
  ) return;

  const posData = posBuffer.data as Float32Array;
  const uvData = uvBuffer.data as Float32Array;
  const colorHullData = colorHullBuffer.data as Float32Array;
  const colorPortalData = colorPortalBuffer.data as Float32Array;
  const colorCoreData = colorCoreBuffer.data as Float32Array;
  const alphaData = alphaBuffer.data as Float32Array;
  const chargeData = chargeBuffer.data as Float32Array;
  const stateData = stateBuffer.data as Float32Array;
  const spinData = spinBuffer.data as Float32Array;
  const seedData = seedBuffer.data as Float32Array;

  const activeCount = Math.min(gates.length, MAX_GATES);
  mesh.visible = activeCount > 0;

  // UV extends slightly beyond 1.0 for the rim halo
  const uvExt = 1.0 + RIM_PAD_FRAC;

  let vIdx = 0;
  for (let i = 0; i < MAX_GATES; i++) {
    const g = gates[i];

    if (i >= activeCount || !g || !g.visible) {
      for (let j = 0; j < 4; j++) {
        alphaData[vIdx + j] = 0;
      }
      vIdx += 4;
      continue;
    }

    const ext = g.radius * uvExt;
    // Quad corners (world-space, centered on gate)
    const corners = [
      { dx: -ext, dy: -ext, u: -uvExt, v: -uvExt },
      { dx: ext, dy: -ext, u: uvExt, v: -uvExt },
      { dx: ext, dy: ext, u: uvExt, v: uvExt },
      { dx: -ext, dy: ext, u: -uvExt, v: uvExt },
    ];

    for (let j = 0; j < 4; j++) {
      const c = corners[j];
      const pBase = (vIdx + j) * 2;
      posData[pBase + 0] = g.x + c.dx;
      posData[pBase + 1] = g.y + c.dy;

      const uvBase = (vIdx + j) * 2;
      uvData[uvBase + 0] = c.u;
      uvData[uvBase + 1] = c.v;

      const chBase = (vIdx + j) * 3;
      colorHullData[chBase + 0] = g.colors.hull[0];
      colorHullData[chBase + 1] = g.colors.hull[1];
      colorHullData[chBase + 2] = g.colors.hull[2];

      const cpBase = (vIdx + j) * 3;
      colorPortalData[cpBase + 0] = g.colors.portal[0];
      colorPortalData[cpBase + 1] = g.colors.portal[1];
      colorPortalData[cpBase + 2] = g.colors.portal[2];

      const ccBase = (vIdx + j) * 3;
      colorCoreData[ccBase + 0] = g.colors.core[0];
      colorCoreData[ccBase + 1] = g.colors.core[1];
      colorCoreData[ccBase + 2] = g.colors.core[2];

      alphaData[vIdx + j] = g.alpha;
      chargeData[vIdx + j] = g.charge;
      stateData[vIdx + j] = g.state;
      spinData[vIdx + j] = g.spin;
      seedData[vIdx + j] = g.seed;
    }
    vIdx += 4;
  }

  posBuffer.update();
  uvBuffer.update();
  colorHullBuffer.update();
  colorPortalBuffer.update();
  colorCoreBuffer.update();
  alphaBuffer.update();
  chargeBuffer.update();
  stateBuffer.update();
  spinBuffer.update();
  seedBuffer.update();

  if (_ug) {
    (_ug.uniforms as unknown as { uTime: number }).uTime = now;
  }
}

export function destroyWarpGateMesh(): void {
  if (_mesh) {
    _mesh.destroy();
    _mesh = null;
  }
  _geometry = null;
  _posBuffer = null;
  _uvBuffer = null;
  _colorHullBuffer = null;
  _colorPortalBuffer = null;
  _colorCoreBuffer = null;
  _alphaBuffer = null;
  _chargeBuffer = null;
  _stateBuffer = null;
  _spinBuffer = null;
  _seedBuffer = null;
  _ug = null;
}

/** Convert a 0xRRGGBB hex color to a normalized 0..1 RGB tuple. */
export function hexToRgbTuple(hex: number): [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}
