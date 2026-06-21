/**
 * GPU boost gate mesh renderer.
 *
 * Renders tutorial boost gates as a single GPU Mesh with a custom shader.
 * Each gate is one quad (4 verts, 2 triangles). The fragment shader draws
 * the plasma curtain, glowing pillars, traveling sweep, drifting sparks,
 * proximity charge-up, and activation flash — all on the GPU.
 *
 * Follows the same architecture as `pixi-trail-mesh.ts`.
 */
import { Mesh, Geometry, Shader, Buffer, BufferUsage, State, UniformGroup } from "pixi.js";
import { effectLayer } from "../pixi.js";
import { BOOST_GATE_VERT, BOOST_GATE_FRAG } from "./shaders/boost-gate.glsl.js";

const MAX_GATES = 16;
const VERTS_PER_GATE = 4;
const MAX_VERTS = MAX_GATES * VERTS_PER_GATE;
const MAX_INDICES = MAX_GATES * 6;

/** World-space padding beyond the pillar center for the halo. */
const PILLAR_PAD = 38;
/** Half-thickness of the curtain along the boost direction. */
const CURTAIN_HALF = 20;
/** Cooldown window (seconds) over which the activation flash fades.
 *  Kept short for a minimal, brief warp shimmer on pass-through. */
const FLASH_WINDOW = 0.5;
/** Proximity range (world units) within which the gate charges up. */
const CHARGE_RANGE = 700;

let _mesh: Mesh<Geometry, Shader> | null = null;
let _geometry: Geometry | null = null;
let _posBuffer: Buffer | null = null;
let _uvBuffer: Buffer | null = null;
let _alphaBuffer: Buffer | null = null;
let _chargeBuffer: Buffer | null = null;
let _flashBuffer: Buffer | null = null;
let _seedBuffer: Buffer | null = null;
let _ug: UniformGroup | null = null;

export function isBoostGateMeshReady(): boolean {
  return _mesh !== null;
}

export function buildBoostGateMesh(): void {
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
  _flashBuffer = new Buffer({
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
  geometry.addAttribute("aAlpha", { buffer: _alphaBuffer, format: "float32" });
  geometry.addAttribute("aCharge", { buffer: _chargeBuffer, format: "float32" });
  geometry.addAttribute("aFlash", { buffer: _flashBuffer, format: "float32" });
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
      vertex: BOOST_GATE_VERT,
      fragment: BOOST_GATE_FRAG,
      name: "boost-gate-shader",
    },
    resources: {
      uBoostGateUniforms: _ug,
    },
  });

  const state = new State();
  state.blendMode = "add";

  _mesh = new Mesh({ geometry, shader, state });
  _mesh.eventMode = "none";
  _mesh.label = "boost-gate-mesh";
  effectLayer.addChild(_mesh);
}

export interface BoostGateRenderData {
  id: string;
  x: number;
  y: number;
  angle: number;
  halfWidth: number;
  visible: boolean;
  /** 0..1 proximity charge (lights up as player approaches). */
  charge: number;
  /** 0..1 activation flash (bright burst right after pass-through). */
  flash: number;
  /** Per-gate stable seed for shader variation. */
  seed: number;
}

/**
 * Upload per-gate vertex data to the GPU and update the time uniform.
 *
 * Gates beyond `gates.length` are zeroed (hidden). The mesh visibility is
 * toggled based on whether any gates are active.
 */
export function syncBoostGateMesh(now: number, gates: BoostGateRenderData[]): void {
  if (!_mesh || !_posBuffer) return;

  const posData = _posBuffer.data as Float32Array;
  const uvData = _uvBuffer!.data as Float32Array;
  const alphaData = _alphaBuffer!.data as Float32Array;
  const chargeData = _chargeBuffer!.data as Float32Array;
  const flashData = _flashBuffer!.data as Float32Array;
  const seedData = _seedBuffer!.data as Float32Array;

  const activeCount = Math.min(gates.length, MAX_GATES);
  _mesh.visible = activeCount > 0;

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

    const ca = Math.cos(g.angle);
    const sa = Math.sin(g.angle);
    // Perpendicular to boost direction (gate width axis)
    const px = -sa;
    const py = ca;

    const halfExt = g.halfWidth + PILLAR_PAD;
    const uMax = 1.0 + PILLAR_PAD / g.halfWidth;

    // Quad corners: (perp offset, boost offset)
    // 0: (-halfExt, -CURTAIN_HALF)  UV: (-uMax, 0)
    // 1: (+halfExt, -CURTAIN_HALF)  UV: (+uMax, 0)
    // 2: (+halfExt, +CURTAIN_HALF)  UV: (+uMax, 1)
    // 3: (-halfExt, +CURTAIN_HALF)  UV: (-uMax, 1)
    const corners = [
      { pp: -halfExt, bp: -CURTAIN_HALF, u: -uMax, v: 0 },
      { pp: halfExt, bp: -CURTAIN_HALF, u: uMax, v: 0 },
      { pp: halfExt, bp: CURTAIN_HALF, u: uMax, v: 1 },
      { pp: -halfExt, bp: CURTAIN_HALF, u: -uMax, v: 1 },
    ];

    for (let j = 0; j < 4; j++) {
      const c = corners[j];
      const pBase = (vIdx + j) * 2;
      posData[pBase + 0] = g.x + px * c.pp + ca * c.bp;
      posData[pBase + 1] = g.y + py * c.pp + sa * c.bp;

      const uvBase = (vIdx + j) * 2;
      uvData[uvBase + 0] = c.u;
      uvData[uvBase + 1] = c.v;

      alphaData[vIdx + j] = 1.0;
      chargeData[vIdx + j] = g.charge;
      flashData[vIdx + j] = g.flash;
      seedData[vIdx + j] = g.seed;
    }
    vIdx += 4;
  }

  _posBuffer.update();
  _uvBuffer!.update();
  _alphaBuffer!.update();
  _chargeBuffer!.update();
  _flashBuffer!.update();
  _seedBuffer!.update();

  if (_ug) {
    (_ug.uniforms as unknown as { uTime: number }).uTime = now;
  }
}

export function destroyBoostGateMesh(): void {
  if (_mesh) {
    _mesh.destroy();
    _mesh = null;
  }
  _geometry = null;
  _posBuffer = null;
  _uvBuffer = null;
  _alphaBuffer = null;
  _chargeBuffer = null;
  _flashBuffer = null;
  _seedBuffer = null;
  _ug = null;
}

/** Compute a 0..1 proximity charge from the player to the gate.
 *  Bidirectional: the gate lights up as the player approaches from either side. */
export function computeGateCharge(
  gateX: number,
  gateY: number,
  gateAngle: number,
  gateHalfWidth: number,
  playerX: number,
  playerY: number,
): number {
  const dx = gateX - playerX;
  const dy = gateY - playerY;
  const dist = Math.hypot(dx, dy);
  if (dist > CHARGE_RANGE) return 0;

  const nx = Math.cos(gateAngle);
  const ny = Math.sin(gateAngle);

  // Perpendicular offset from the boost axis
  const perp = Math.abs(-dx * ny + dy * nx);
  const alignment = Math.max(0, 1 - perp / (gateHalfWidth * 1.5));
  const proximity = 1 - dist / CHARGE_RANGE;
  return Math.max(0, proximity * alignment);
}

/** Compute a 0..1 activation flash from the remaining gate cooldown. */
export function computeGateFlash(cooldown: number): number {
  if (cooldown <= 0) return 0;
  return Math.min(1, cooldown / FLASH_WINDOW);
}
