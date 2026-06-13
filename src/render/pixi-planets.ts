import { Container, Sprite, Texture, ImageSource, Graphics, Filter, UniformGroup } from "pixi.js";
import { defaultFilterVert } from "pixi.js";
import type { Planet, System } from "../types/world.js";
import { TAU } from "../constants.js";
import { getSunWorldPos } from "../utils/sun-position.js";
import { mkRng } from "../utils/math.js";

interface PlanetLightUniforms {
  uLightDir: Float32Array;
  uAtmosphere: Float32Array;
  uDiscRadius: number;
  uSpecular: number;
  uRelief: number;
  [key: string]: Float32Array | number;
}

type PlanetEntry = {
  sprite: Sprite;
  planet: Planet;
  uniforms: UniformGroup;
};

type MoonEntry = {
  gfx: Graphics;
  px: number; py: number; radius: number;
  moonIdx: number; totalMoons: number;
};

let _planetEntries: PlanetEntry[] = [];
let _moonEntries: MoonEntry[] = [];

const PLANET_LIGHT_FRAG = `#version 300 es
precision mediump float;

in vec2 vTextureCoord;
uniform sampler2D uSampler;

uniform vec2 uLightDir;
uniform vec3 uAtmosphere;
uniform float uDiscRadius;
uniform float uSpecular;
uniform float uRelief;

out vec4 fragColor;

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec4 base = texture(uSampler, vTextureCoord);
  if (base.a < 0.001) {
    fragColor = vec4(0.0);
    return;
  }

  vec2 local = vTextureCoord - vec2(0.5);
  float sphereDist = length(local) / max(uDiscRadius, 0.001);

  if (sphereDist > 1.0) {
    fragColor = base;
    return;
  }

  vec2 nxy = local / uDiscRadius;
  float nz = sqrt(max(0.0, 1.0 - dot(nxy, nxy)));
  vec3 normal = normalize(vec3(nxy, nz));
  vec3 light = normalize(vec3(normalize(uLightDir) * 0.93, 0.36));
  vec3 view = vec3(0.0, 0.0, 1.0);

  float ndl = dot(normal, light);
  float day = smoothstep(-0.18, 0.96, ndl);
  float terminator = smoothstep(-0.16, 0.18, ndl);
  float limb = pow(clamp(1.0 - nz, 0.0, 1.0), 1.7);

  float reliefSample = luminance(base.rgb);
  float relief = mix(1.0 - uRelief, 1.0 + uRelief, reliefSample);
  float shade = (0.16 + day * 0.92) * relief;
  vec3 color = base.rgb * shade;

  vec3 halfVec = normalize(light + view);
  float spec = pow(max(dot(normal, halfVec), 0.0), 42.0) * uSpecular * day;
  color += vec3(1.0, 0.92, 0.78) * spec;

  float blueRim = limb * smoothstep(-0.30, 0.35, ndl);
  float nightRim = limb * (1.0 - terminator) * 0.42;
  color += uAtmosphere * (blueRim * 0.34 + nightRim * 0.18);
  color *= 1.0 - limb * 0.30;

  fragColor = vec4(color, base.a);
}
`;

function hslStr(h: number, s: number, l: number, a = 1): string {
  return `hsla(${((h % 360) + 360) % 360},${Math.max(0, Math.min(100, s))}%,${Math.max(0, Math.min(100, l))}%,${a})`;
}

function hslInt(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

function hslRgbFloat(h: number, s: number, l: number): Float32Array {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return new Float32Array([f(0), f(8), f(4)]);
}

function createPlanetLightFilter(p: Planet): UniformGroup {
  const uniforms = new UniformGroup({
    uLightDir:    { value: new Float32Array([1, 0]), type: "vec2<f32>" },
    uAtmosphere:  { value: hslRgbFloat(p.hue + 18, Math.min(100, p.sat + 30), Math.min(92, p.lit + 38)), type: "vec3<f32>" },
    uDiscRadius:  { value: p.radius / Math.max(128, Math.ceil(p.radius * 5)), type: "f32" },
    uSpecular:    { value: p.sat < 45 ? 0.18 : 0.08, type: "f32" },
    uRelief:      { value: 0.10, type: "f32" },
  });
  return uniforms;
}

function makePlanetFilter(uniforms: UniformGroup): Filter {
  return Filter.from({
    gl: { vertex: defaultFilterVert, fragment: PLANET_LIGHT_FRAG, name: "planet-runtime-light" },
    resources: { uPlanetLight: uniforms },
    blendMode: "normal",
  });
}

function bakePlanet(p: Planet, sys: System): Texture {
  const texSize = Math.max(128, Math.ceil(p.radius * 5));
  const half = texSize / 2;
  const c = document.createElement("canvas");
  c.width = c.height = texSize;
  const cx = c.getContext("2d")!;
  const rng = mkRng(`${sys.id}:planet:${Math.round(p.x)}:${Math.round(p.y)}:${p.radius}`);
  const r = p.radius;

  cx.save();
  cx.translate(half, half);

  // Procedural atmosphere and albedo are baked; direction-sensitive lighting is shader-driven.
  const glow = cx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.45);
  glow.addColorStop(0, hslStr(p.hue, Math.min(100, p.sat + 18), p.lit + 18, 0.12));
  glow.addColorStop(1, "transparent");
  cx.fillStyle = glow;
  cx.beginPath(); cx.arc(0, 0, r * 1.45, 0, TAU); cx.fill();

  const base = cx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  base.addColorStop(0, hslStr(p.hue, p.sat, p.lit + 7));
  base.addColorStop(0.72, hslStr(p.hue + 5, p.sat, p.lit));
  base.addColorStop(1, hslStr(p.hue - 8, Math.max(0, p.sat - 8), p.lit - 4));
  cx.fillStyle = base;
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();

  cx.save();
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.clip();

  const bandTilt = (rng() - 0.5) * 0.36;
  cx.rotate(bandTilt);
  const bandCount = 5 + Math.floor(rng() * 4);
  for (let b = 0; b < bandCount; b++) {
    const y = -r * 0.82 + (b / Math.max(1, bandCount - 1)) * r * 1.64 + (rng() - 0.5) * r * 0.12;
    const h = r * (0.08 + rng() * 0.12);
    const alpha = 0.055 + rng() * 0.06;
    cx.fillStyle = hslStr(p.hue + 24 + rng() * 32, Math.min(100, p.sat + 18), Math.min(92, p.lit + 20), alpha);
    cx.beginPath();
    cx.ellipse(0, y, r * (1.04 + rng() * 0.12), h, 0, 0, TAU);
    cx.fill();
  }

  cx.globalCompositeOperation = "multiply";
  for (let b = 0; b < 4; b++) {
    const y = -r * 0.72 + rng() * r * 1.44;
    cx.fillStyle = hslStr(p.hue - 18, Math.max(0, p.sat - 18), Math.max(8, p.lit - 20), 0.045);
    cx.beginPath();
    cx.ellipse(0, y, r * (0.75 + rng() * 0.35), r * (0.035 + rng() * 0.04), 0, 0, TAU);
    cx.fill();
  }
  cx.globalCompositeOperation = "source-over";

  for (let i = 0; i < 8; i++) {
    const a = rng() * TAU;
    const d = Math.sqrt(rng()) * r * 0.78;
    const spotR = r * (0.025 + rng() * 0.055);
    cx.fillStyle = hslStr(p.hue + (rng() - 0.5) * 45, Math.min(100, p.sat + 10), p.lit + (rng() - 0.5) * 16, 0.07);
    cx.beginPath();
    cx.ellipse(Math.cos(a) * d, Math.sin(a) * d, spotR * 1.8, spotR, rng() * TAU, 0, TAU);
    cx.fill();
  }
  cx.restore();

  if (p.hasRing) {
    cx.save(); cx.scale(1, p.ringTilt ?? 0.4);
    cx.strokeStyle = hslStr(p.hue, p.sat, 62, 0.42);
    cx.lineWidth = r * 0.18;
    cx.beginPath(); cx.arc(0, 0, r * 1.62, 0, TAU); cx.stroke();
    cx.strokeStyle = hslStr(p.hue + 20, Math.min(100, p.sat + 12), 76, 0.24);
    cx.lineWidth = r * 0.08;
    cx.beginPath(); cx.arc(0, 0, r * 1.9, 0, TAU); cx.stroke();
    cx.strokeStyle = hslStr(p.hue - 20, Math.max(0, p.sat - 20), 36, 0.18);
    cx.lineWidth = r * 0.05;
    cx.beginPath(); cx.arc(0, 0, r * 1.38, 0, TAU); cx.stroke();
    cx.restore();
  }

  cx.restore(); // translate(half, half)

  return new Texture({ source: new ImageSource({ resource: c, resolution: 1, scaleMode: "linear" }) });
}

export function initPlanetSprites(parent: Container, sys: System) {
  destroyPlanetSprites();
  if (!sys?.planets) return;

  for (const p of sys.planets) {
    const sprite = new Sprite(bakePlanet(p, sys));
    const uniforms = createPlanetLightFilter(p);
    sprite.anchor.set(0.5);
    sprite.x = p.x;
    sprite.y = p.y;
    sprite.filters = [makePlanetFilter(uniforms)];
    parent.addChild(sprite);
    _planetEntries.push({ sprite, planet: p, uniforms });

    for (let m = 0; m < (p.moons || 0); m++) {
      const moonR = Math.max(1.5, p.radius * 0.13);
      const gfx = new Graphics();
      gfx.circle(0, 0, moonR);
      gfx.fill({ color: hslInt((p.hue + 80) % 360, 20, 48) });
      // Seed an initial position at the planet centre. Without this the moon sits
      // at world (0,0) until the first syncPixiPlanets — which never runs in title
      // mode, leaving a stray dot in the screen's top-left corner.
      gfx.x = p.x;
      gfx.y = p.y;
      parent.addChild(gfx);
      _moonEntries.push({ gfx, px: p.x, py: p.y, radius: p.radius, moonIdx: m, totalMoons: p.moons });
    }
  }
}

export function syncPixiPlanets(now: number, sys?: System) {
  if (sys) {
    const sun = getSunWorldPos(sys);
    for (const e of _planetEntries) {
      const lx = sun.x - e.planet.x;
      const ly = sun.y - e.planet.y;
      const len = Math.hypot(lx, ly) || 1;
      const uniforms = e.uniforms.uniforms as unknown as PlanetLightUniforms;
      uniforms.uLightDir[0] = lx / len;
      uniforms.uLightDir[1] = ly / len;
    }
  }

  for (const e of _moonEntries) {
    const ma = (e.moonIdx / e.totalMoons) * TAU + now * 0.0003 * (e.moonIdx + 1);
    const mr = e.radius * 1.85 + e.moonIdx * 28;
    e.gfx.x = e.px + Math.cos(ma) * mr;
    e.gfx.y = e.py + Math.sin(ma) * mr * 0.55;
  }
}

export function destroyPlanetSprites() {
  for (const e of _planetEntries) e.sprite.destroy({ texture: true });
  for (const e of _moonEntries)  e.gfx.destroy();
  _planetEntries = [];
  _moonEntries = [];
}
