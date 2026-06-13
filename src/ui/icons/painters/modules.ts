import type { IconPaintCtx, IconPainter } from "./shared.js";
import {
  drawSpecular,
  drawEmissiveGlow,
  COL,
  energyRgb,
  energyHex,
  drawOctPlatform,
  drawSlotChassis,
  drawRailBarrels,
  hullGradient,
  copperGradient,
  tintGradient,
  RACK_COLORS,
} from "./shared.js";

// ═════════════════════════════════════════════════════════════════════════════
//  Module Icon Schema — data-driven Canvas rendering
// ═════════════════════════════════════════════════════════════════════════════

type ColorSpec =
  | string
  | "accent" | "energy" | "energyRgb"
  | "hullDark" | "hullMid" | "hullLite" | "hullEdge"
  | "amber" | "amberHex" | "green" | "cyan" | "cyanHex" | "hazard" | "purple"
  | { grad: "hull" | "copper" | "tint"; y0: number; y1: number };

type PathSeg =
  | { type: "move"; x: number; y: number }
  | { type: "line"; x: number; y: number }
  | { type: "quad"; cpx: number; cpy: number; x: number; y: number }
  | { type: "arc"; x: number; y: number; r: number; start: number; end: number }
  | { type: "close" };

type DrawCmd =
  | { type: "chassis"; kind: "turret" | "slot"; w?: number; h?: number }
  | { type: "rect"; x: number; y: number; w: number; h: number; fill?: ColorSpec; stroke?: ColorSpec; lineWidth?: number }
  | { type: "path"; segments: PathSeg[]; fill?: ColorSpec; stroke?: ColorSpec; lineWidth?: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: ColorSpec; lineWidth?: number }
  | { type: "arc"; x: number; y: number; r: number; start: number; end: number; fill?: ColorSpec; stroke?: ColorSpec; lineWidth?: number }
  | { type: "ellipse"; x: number; y: number; rx: number; ry: number; rotate: number; start: number; end: number; stroke?: ColorSpec; lineWidth?: number }
  | { type: "glow"; x: number; y: number; r: number; rgb: string; alpha?: number }
  | { type: "rail"; x: number; len: number }
  | { type: "specular"; ox?: number; oy?: number; r?: number }
  | { type: "loop"; count: number; dy?: number; commands: DrawCmd[] };

function resolveColor(spec: ColorSpec, ctx: IconPaintCtx): string | CanvasGradient {
  if (typeof spec === "string") {
    switch (spec) {
      case "accent": return ctx.accent;
      case "energy": return energyHex(ctx);
      case "energyRgb": return energyRgb(ctx);
      case "hullDark": return COL.hullDark;
      case "hullMid": return COL.hullMid;
      case "hullLite": return COL.hullLite;
      case "hullEdge": return COL.hullEdge;
      case "amber": return COL.amber;
      case "amberHex": return COL.amberHex;
      case "green": return COL.green;
      case "cyan": return COL.cyan;
      case "cyanHex": return COL.cyanHex;
      case "hazard": return COL.hazard;
      case "purple": return COL.purple;
      default: return spec;
    }
  }
  const { cx, half } = ctx;
  if (spec.grad === "hull") return hullGradient(cx, half, spec.y0, spec.y1);
  if (spec.grad === "copper") return copperGradient(cx, half, spec.y0, spec.y1);
  return tintGradient(ctx.accent, spec.y0, spec.y1, cx, half);
}

function applyDy(cmd: DrawCmd, offset: number): DrawCmd {
  const add = (v: number) => v + offset;
  if (cmd.type === "rect") return { ...cmd, y: add(cmd.y) };
  if (cmd.type === "arc") return { ...cmd, y: add(cmd.y) };
  if (cmd.type === "ellipse") return { ...cmd, y: add(cmd.y) };
  if (cmd.type === "glow") return { ...cmd, y: add(cmd.y) };
  if (cmd.type === "line") return { ...cmd, y1: add(cmd.y1), y2: add(cmd.y2) };
  if (cmd.type === "path")
    return {
      ...cmd,
      segments: cmd.segments.map((s) =>
        s.type === "move" ? { ...s, y: add(s.y) }
        : s.type === "line" ? { ...s, y: add(s.y) }
        : s.type === "quad" ? { ...s, cpy: add(s.cpy), y: add(s.y) }
        : s.type === "arc" ? { ...s, y: add(s.y) }
        : s
      ),
    };
  return cmd;
}

function renderCmd(ctx: IconPaintCtx, cmd: DrawCmd): void {
  const { cx, half } = ctx;
  switch (cmd.type) {
    case "chassis":
      if (cmd.kind === "turret") {
        if (!ctx.rack) ctx.rack = "turret";
        drawOctPlatform(ctx, half, half);
      } else {
        drawSlotChassis(ctx, cmd.w ?? 20, cmd.h ?? 20);
      }
      return;
    case "rail": drawRailBarrels(ctx, cmd.x, cmd.len); return;
    case "specular": drawSpecular(ctx, cmd.ox, cmd.oy, cmd.r); return;
    case "glow": drawEmissiveGlow(cx, cmd.x, cmd.y, cmd.r, cmd.rgb, cmd.alpha ?? 0.55); return;
    case "loop": {
      for (let i = 0; i < cmd.count; i++) {
        const off = i * (cmd.dy ?? 0);
        for (const c of cmd.commands) renderCmd(ctx, applyDy(c, off));
      }
      return;
    }
    case "rect": {
      if (cmd.fill) { cx.fillStyle = resolveColor(cmd.fill, ctx); cx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h); }
      if (cmd.stroke) { cx.strokeStyle = resolveColor(cmd.stroke, ctx); cx.lineWidth = cmd.lineWidth ?? 1; cx.strokeRect(cmd.x, cmd.y, cmd.w, cmd.h); }
      return;
    }
    case "line": {
      cx.strokeStyle = resolveColor(cmd.stroke, ctx); cx.lineWidth = cmd.lineWidth ?? 1;
      cx.beginPath(); cx.moveTo(cmd.x1, cmd.y1); cx.lineTo(cmd.x2, cmd.y2); cx.stroke();
      return;
    }
    case "arc": {
      cx.beginPath(); cx.arc(cmd.x, cmd.y, cmd.r, cmd.start, cmd.end);
      if (cmd.fill) { cx.fillStyle = resolveColor(cmd.fill, ctx); cx.fill(); }
      if (cmd.stroke) { cx.strokeStyle = resolveColor(cmd.stroke, ctx); cx.lineWidth = cmd.lineWidth ?? 1; cx.stroke(); }
      return;
    }
    case "ellipse": {
      cx.beginPath(); cx.ellipse(cmd.x, cmd.y, cmd.rx, cmd.ry, cmd.rotate, cmd.start, cmd.end);
      if (cmd.stroke) { cx.strokeStyle = resolveColor(cmd.stroke, ctx); cx.lineWidth = cmd.lineWidth ?? 1; cx.stroke(); }
      return;
    }
    case "path": {
      cx.beginPath();
      for (const s of cmd.segments) {
        switch (s.type) {
          case "move": cx.moveTo(s.x, s.y); break;
          case "line": cx.lineTo(s.x, s.y); break;
          case "quad": cx.quadraticCurveTo(s.cpx, s.cpy, s.x, s.y); break;
          case "arc": cx.arc(s.x, s.y, s.r, s.start, s.end); break;
          case "close": cx.closePath(); break;
        }
      }
      if (cmd.fill) { cx.fillStyle = resolveColor(cmd.fill, ctx); cx.fill(); }
      if (cmd.stroke) { cx.strokeStyle = resolveColor(cmd.stroke, ctx); cx.lineWidth = cmd.lineWidth ?? 1; cx.stroke(); }
      return;
    }
  }
}

type SchemaFn = (h: number) => DrawCmd[];
function build(fn: SchemaFn): IconPainter {
  return (ctx) => { for (const cmd of fn(ctx.half)) renderCmd(ctx, cmd); };
}

// ── Turret weapons ─────────────────────────────────────────────────────────

const dualRail = build((h) => [
  { type: "chassis", kind: "turret" },
  { type: "rail", x: h + 1, len: 17 },
  { type: "specular", ox: 2, oy: -6, r: 16 },
]);

const gauss = build((h) => [
  { type: "chassis", kind: "turret" },
  { type: "rect", x: h - 4, y: h - 5, w: 22, h: 10, fill: { grad: "hull", y0: h - 5, y1: h + 5 }, stroke: "hullEdge" },
  { type: "rect", x: h - 8, y: h - 6, w: 7, h: 12, fill: { grad: "copper", y0: h - 6, y1: h + 6 } },
  { type: "line", x1: h + 2, y1: h, x2: h + 20, y2: h, stroke: "energy", lineWidth: 1.4 },
  { type: "glow", x: h + 16, y: h, r: 6, rgb: "energyRgb", alpha: 0.55 },
]);

const beam = build((h) => [
  { type: "chassis", kind: "turret" },
  {
    type: "path",
    segments: [
      { type: "move", x: h - 2, y: h - 7 },
      { type: "line", x: h + 20, y: h },
      { type: "line", x: h - 2, y: h + 7 },
      { type: "close" },
    ],
    fill: { grad: "copper", y0: h - 6, y1: h + 6 },
    stroke: "hullEdge",
  },
  { type: "glow", x: h + 14, y: h, r: 9, rgb: "energyRgb", alpha: 0.6 },
  { type: "line", x1: h + 4, y1: h, x2: h + 22, y2: h, stroke: "energy", lineWidth: 1.2 },
]);

const strip = build((h) => [
  { type: "chassis", kind: "turret" },
  { type: "loop", count: 5, dy: 3.5, commands: [
    { type: "line", x1: h - 1, y1: h, x2: h + 20, y2: h, stroke: "energy", lineWidth: 1.1 },
  ]},
  { type: "glow", x: h + 15, y: h, r: 7, rgb: "energyRgb", alpha: 0.45 },
]);

const missile = build((h) => [
  { type: "chassis", kind: "turret" },
  { type: "path", segments: [
    { type: "move", x: h + 3, y: h - 9 },
    { type: "line", x: h + 18, y: h - 6.5 },
    { type: "line", x: h + 3, y: h - 4 },
    { type: "close" },
  ], fill: { grad: "hull", y0: h - 9, y1: h - 4 }, stroke: "hullEdge" },
  { type: "path", segments: [
    { type: "move", x: h + 3, y: h },
    { type: "line", x: h + 18, y: h + 2.5 },
    { type: "line", x: h + 3, y: h + 5 },
    { type: "close" },
  ], fill: { grad: "hull", y0: h, y1: h + 5 }, stroke: "hullEdge" },
  { type: "path", segments: [
    { type: "move", x: h + 3, y: h + 9 },
    { type: "line", x: h + 18, y: h + 11.5 },
    { type: "line", x: h + 3, y: h + 14 },
    { type: "close" },
  ], fill: { grad: "hull", y0: h + 9, y1: h + 14 }, stroke: "hullEdge" },
  { type: "glow", x: h + 14, y: h, r: 6, rgb: COL.amber, alpha: 0.4 },
]);

const miner = build((h) => [
  { type: "chassis", kind: "turret" },
  { type: "glow", x: h + 14, y: h, r: 11, rgb: COL.green, alpha: 0.5 },
  { type: "line", x1: h + 2, y1: h, x2: h + 22, y2: h, stroke: "#55ff99", lineWidth: 2 },
  { type: "arc", x: h + 22, y: h, r: 3, start: 0, end: Math.PI * 2, fill: "#3dcc66" },
  { type: "path", segments: [
    { type: "move", x: h + 18, y: h - 5 },
    { type: "line", x: h + 22, y: h },
    { type: "line", x: h + 18, y: h + 5 },
  ], stroke: "rgba(255,255,255,0.35)", lineWidth: 0.8 },
]);

const salvager = build((h) => [
  { type: "chassis", kind: "turret" },
  { type: "path", segments: [{ type: "move", x: h + 3, y: h - 5 }, { type: "quad", cpx: h + 12, cpy: h - 1.5, x: h + 20, y: h - 7 }], stroke: "#b898ff", lineWidth: 1.4 },
  { type: "path", segments: [{ type: "move", x: h + 3, y: h }, { type: "quad", cpx: h + 12, cpy: h, x: h + 20, y: h }], stroke: "#b898ff", lineWidth: 1.4 },
  { type: "path", segments: [{ type: "move", x: h + 3, y: h + 5 }, { type: "quad", cpx: h + 12, cpy: h + 1.5, x: h + 20, y: h + 7 }], stroke: "#b898ff", lineWidth: 1.4 },
  { type: "glow", x: h + 14, y: h, r: 8, rgb: "160,120,255", alpha: 0.45 },
]);

const tractor = build((h) => [
  { type: "chassis", kind: "turret" },
  { type: "path", segments: [
    { type: "move", x: h + 5, y: h - 11 },
    { type: "line", x: h + 18, y: h },
    { type: "line", x: h + 5, y: h + 11 },
  ], stroke: "energy", lineWidth: 1.3 },
  { type: "glow", x: h + 16, y: h, r: 7, rgb: "energyRgb", alpha: 0.42 },
]);

const scanner = build((h) => [
  { type: "chassis", kind: "turret" },
  { type: "arc", x: h + 2, y: h, r: 5, start: -0.55, end: 0.55, stroke: "energy", lineWidth: 1 },
  { type: "arc", x: h + 2, y: h, r: 10, start: -0.55, end: 0.55, stroke: "energy", lineWidth: 1 },
  { type: "arc", x: h + 2, y: h, r: 15, start: -0.55, end: 0.55, stroke: "energy", lineWidth: 1 },
  { type: "glow", x: h + 10, y: h, r: 9, rgb: "energyRgb", alpha: 0.38 },
]);

// ── High slot modules ────────────────────────────────────────────────────────

const cruise = build((h) => [
  { type: "chassis", kind: "slot", w: 12, h: 26 },
  { type: "rect", x: h - 3, y: h - 14, w: 6, h: 20, fill: { grad: "hull", y0: h - 14, y1: h + 10 }, stroke: "hullEdge" },
  { type: "path", segments: [
    { type: "move", x: h - 5, y: h - 14 },
    { type: "line", x: h, y: h - 20 },
    { type: "line", x: h + 5, y: h - 14 },
  ], fill: { grad: "hull", y0: h - 20, y1: h - 14 } },
  { type: "line", x1: h - 7, y1: h + 6, x2: h - 11, y2: h + 14, stroke: "#ff6644", lineWidth: 1.2 },
  { type: "line", x1: h + 7, y1: h + 6, x2: h + 11, y2: h + 14, stroke: "#ff6644", lineWidth: 1.2 },
  { type: "glow", x: h, y: h - 10, r: 6, rgb: COL.amber, alpha: 0.45 },
]);

const nos = build((h) => [
  { type: "chassis", kind: "slot", w: 20, h: 22 },
  { type: "arc", x: h, y: h + 1, r: 12, start: 0, end: Math.PI * 1.35, stroke: "accent", lineWidth: 2 },
  { type: "arc", x: h, y: h + 1, r: 4, start: 0, end: Math.PI * 2, fill: "hazard" },
  { type: "glow", x: h, y: h + 1, r: 11, rgb: COL.amber, alpha: 0.5 },
]);

const hiSalv = build((h) => [
  { type: "chassis", kind: "slot", w: 20, h: 22 },
  { type: "path", segments: [{ type: "move", x: h - 8, y: h }, { type: "quad", cpx: h, cpy: h - 2, x: h + 8, y: h }], stroke: "#b898ff", lineWidth: 1.5 },
  { type: "path", segments: [{ type: "move", x: h - 8, y: h + 4 }, { type: "quad", cpx: h, cpy: h, x: h + 8, y: h + 4 }], stroke: "#b898ff", lineWidth: 1.5 },
  { type: "path", segments: [{ type: "move", x: h - 8, y: h + 8 }, { type: "quad", cpx: h, cpy: h + 4, x: h + 8, y: h + 8 }], stroke: "#b898ff", lineWidth: 1.5 },
  { type: "glow", x: h, y: h, r: 9, rgb: "160,120,255", alpha: 0.4 },
]);

const comms = build((h) => [
  { type: "chassis", kind: "slot", w: 18, h: 24 },
  { type: "line", x1: h, y1: h + 10, x2: h, y2: h - 8, stroke: "accent", lineWidth: 1.2 },
  { type: "path", segments: [{ type: "move", x: h - 9, y: h - 8 }, { type: "quad", cpx: h, cpy: h - 18, x: h + 9, y: h - 8 }], stroke: "accent", lineWidth: 1.2 },
  { type: "arc", x: h, y: h - 8, r: 5, start: Math.PI * 1.08, end: Math.PI * 1.92, stroke: "accent", lineWidth: 1.2 },
  { type: "arc", x: h, y: h - 8, r: 10, start: Math.PI * 1.08, end: Math.PI * 1.92, stroke: "accent", lineWidth: 1.2 },
]);

const link = build((h) => [
  { type: "chassis", kind: "slot", w: 18, h: 24 },
  { type: "line", x1: h, y1: h + 12, x2: h, y2: h - 6, stroke: "accent", lineWidth: 1.4 },
  { type: "line", x1: h, y1: h - 6, x2: h - 7, y2: h - 14, stroke: "accent", lineWidth: 1.4 },
  { type: "line", x1: h, y1: h - 6, x2: h + 7, y2: h - 14, stroke: "accent", lineWidth: 1.4 },
  { type: "arc", x: h, y: h + 6, r: 9, start: Math.PI, end: 0, stroke: "accent", lineWidth: 1.4 },
]);

const cipher = build((h) => [
  { type: "chassis", kind: "slot", w: 26, h: 20 },
  { type: "rect", x: h - 11, y: h - 7, w: 22, h: 14, fill: "hullDark", stroke: "accent" },
  { type: "rect", x: h - 9,  y: h - 5, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h - 5,  y: h - 5, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h - 1,  y: h - 5, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h + 3,  y: h - 5, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h + 7,  y: h - 5, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h - 7,  y: h - 1, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h - 3,  y: h - 1, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h + 1,  y: h - 1, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h + 5,  y: h - 1, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h + 9,  y: h - 1, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h - 9,  y: h + 3, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h - 5,  y: h + 3, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h - 1,  y: h + 3, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h + 3,  y: h + 3, w: 2.5, h: 2.5, fill: "energy" },
  { type: "rect", x: h + 7,  y: h + 3, w: 2.5, h: 2.5, fill: "energy" },
]);

const scannerArray = build((h) => [
  { type: "chassis", kind: "slot", w: 22, h: 22 },
  { type: "rect", x: h - 14, y: h - 2, w: 5, h: 4, fill: "hullLite" },
  { type: "rect", x: h - 14, y: h + 5, w: 5, h: 4, fill: "hullLite" },
  { type: "arc", x: h + 2, y: h + 1, r: 4, start: -0.6, end: 0.6, stroke: "energy", lineWidth: 1 },
  { type: "arc", x: h + 2, y: h + 1, r: 8, start: -0.6, end: 0.6, stroke: "energy", lineWidth: 1 },
  { type: "arc", x: h + 2, y: h + 1, r: 12, start: -0.6, end: 0.6, stroke: "energy", lineWidth: 1 },
]);

// ── Med slot modules ─────────────────────────────────────────────────────────

const ab = build((h) => [
  { type: "chassis", kind: "slot", w: 20, h: 18 },
  { type: "rect", x: h - 8, y: h - 5, w: 12, h: 10, fill: { grad: "hull", y0: h - 5, y1: h + 5 } },
  { type: "path", segments: [
    { type: "move", x: h + 6, y: h - 3 },
    { type: "line", x: h + 16, y: h },
    { type: "line", x: h + 6, y: h + 3 },
    { type: "close" },
  ], fill: "amberHex" },
  { type: "glow", x: h + 12, y: h, r: 5, rgb: COL.amber, alpha: 0.5 },
]);

const mwd = build((h) => [
  { type: "chassis", kind: "slot", w: 22, h: 18 },
  { type: "path", segments: [
    { type: "move", x: h - 6, y: h - 4 },
    { type: "line", x: h + 12, y: h },
    { type: "line", x: h - 6, y: h + 4 },
    { type: "close" },
  ], fill: { grad: "tint", y0: h - 8, y1: h + 8 } },
  { type: "path", segments: [
    { type: "move", x: h - 12, y: h - 5 },
    { type: "line", x: h - 2, y: h },
    { type: "line", x: h - 12, y: h + 5 },
    { type: "close" },
  ], fill: "accent" },
  { type: "glow", x: h + 8, y: h, r: 8, rgb: COL.cyan, alpha: 0.45 },
]);

const shield = build((h) => [
  { type: "chassis", kind: "slot", w: 18, h: 22 },
  { type: "path", segments: [
    { type: "move", x: h, y: h - 14 },
    { type: "line", x: h + 13, y: h - 6 },
    { type: "line", x: h + 13, y: h + 5 },
    { type: "quad", cpx: h, cpy: h + 17, x: h - 13, y: h + 5 },
    { type: "line", x: h - 13, y: h - 6 },
    { type: "close" },
  ], stroke: "accent", lineWidth: 2, fill: "rgba(56,160,240,0.18)" },
  { type: "glow", x: h, y: h + 2, r: 12, rgb: "56,180,255", alpha: 0.3 },
]);

const capacitor = build((h) => [
  { type: "chassis", kind: "slot", w: 20, h: 20 },
  { type: "arc", x: h, y: h + 1, r: 11, start: 0.35, end: Math.PI * 1.65, stroke: "accent", lineWidth: 2.5 },
  { type: "arc", x: h, y: h + 1, r: 4, start: 0, end: Math.PI * 2, fill: "accent" },
  { type: "glow", x: h, y: h + 1, r: 9, rgb: COL.cyan, alpha: 0.4 },
]);

const signalMed = build((h) => [
  { type: "chassis", kind: "slot", w: 22, h: 18 },
  { type: "path", segments: [
    { type: "move", x: h - 10, y: h + 5 },
    { type: "line", x: h - 3, y: h - 7 },
    { type: "line", x: h + 3, y: h + 3 },
    { type: "line", x: h + 10, y: h - 8 },
  ], stroke: "accent", lineWidth: 1.3 },
  { type: "glow", x: h, y: h, r: 8, rgb: COL.cyan, alpha: 0.35 },
]);

const medTractor = build((h) => [
  { type: "chassis", kind: "slot", w: 20, h: 20 },
  { type: "path", segments: [
    { type: "move", x: h - 6, y: h - 8 },
    { type: "line", x: h + 8, y: h },
    { type: "line", x: h - 6, y: h + 8 },
  ], stroke: "energy", lineWidth: 1.3 },
]);

const gyro = build((h) => [
  { type: "chassis", kind: "slot", w: 22, h: 18 },
  { type: "ellipse", x: h, y: h + 1, rx: 13, ry: 5, rotate: 0, start: 0, end: Math.PI * 2, stroke: "accent", lineWidth: 1.2 },
  { type: "ellipse", x: h, y: h + 1, rx: 13, ry: 5, rotate: Math.PI / 3, start: 0, end: Math.PI * 2, stroke: "accent", lineWidth: 1.2 },
  { type: "arc", x: h, y: h + 1, r: 2.5, start: 0, end: Math.PI * 2, fill: "accent" },
]);

const dcu = build((h) => [
  { type: "chassis", kind: "slot", w: 24, h: 18 },
  { type: "rect", x: h - 10, y: h - 6, w: 20, h: 3.5, fill: { grad: "tint", y0: h - 6, y1: h - 2.5 }, stroke: "hullEdge" },
  { type: "rect", x: h - 10, y: h - 1, w: 20, h: 3.5, fill: { grad: "tint", y0: h - 1, y1: h + 2.5 }, stroke: "hullEdge" },
  { type: "rect", x: h - 10, y: h + 4, w: 20, h: 3.5, fill: { grad: "tint", y0: h + 4, y1: h + 7.5 }, stroke: "hullEdge" },
]);

const battery = build((h) => [
  { type: "chassis", kind: "slot", w: 18, h: 22 },
  { type: "rect", x: h - 8, y: h - 6, w: 16, h: 12, fill: { grad: "tint", y0: h - 8, y1: h + 8 } },
  { type: "rect", x: h - 3, y: h - 10, w: 6, h: 4, fill: { grad: "tint", y0: h - 10, y1: h - 6 } },
  { type: "path", segments: [
    { type: "move", x: h - 3, y: h },
    { type: "line", x: h + 2, y: h - 3 },
    { type: "line", x: h + 2, y: h + 3 },
  ], stroke: "#44ff88", lineWidth: 1.2 },
]);

const nano = build((h) => [
  { type: "chassis", kind: "slot", w: 22, h: 18 },
  { type: "arc", x: h, y: h, r: 2.5, start: 0, end: Math.PI * 2, fill: "accent" },
  { type: "arc", x: h - 9, y: h - 5, r: 2, start: 0, end: Math.PI * 2, fill: "accent" },
  { type: "arc", x: h + 9, y: h - 5, r: 2, start: 0, end: Math.PI * 2, fill: "accent" },
  { type: "arc", x: h - 9, y: h + 5, r: 2, start: 0, end: Math.PI * 2, fill: "accent" },
  { type: "arc", x: h + 9, y: h + 5, r: 2, start: 0, end: Math.PI * 2, fill: "accent" },
  { type: "line", x1: h, y1: h, x2: h - 9, y2: h - 5, stroke: "accent", lineWidth: 0.9 },
  { type: "line", x1: h, y1: h, x2: h + 9, y2: h - 5, stroke: "accent", lineWidth: 0.9 },
  { type: "line", x1: h, y1: h, x2: h - 9, y2: h + 5, stroke: "accent", lineWidth: 0.9 },
  { type: "line", x1: h, y1: h, x2: h + 9, y2: h + 5, stroke: "accent", lineWidth: 0.9 },
]);

const dataRecovery = build((h) => [
  { type: "chassis", kind: "slot", w: 22, h: 18 },
  { type: "arc", x: h, y: h, r: 2.5, start: 0, end: Math.PI * 2, fill: "accent" },
  { type: "arc", x: h - 9, y: h - 5, r: 2, start: 0, end: Math.PI * 2, fill: "accent" },
  { type: "arc", x: h + 9, y: h - 5, r: 2, start: 0, end: Math.PI * 2, fill: "accent" },
  { type: "arc", x: h - 9, y: h + 5, r: 2, start: 0, end: Math.PI * 2, fill: "accent" },
  { type: "arc", x: h + 9, y: h + 5, r: 2, start: 0, end: Math.PI * 2, fill: "accent" },
  { type: "line", x1: h, y1: h, x2: h - 9, y2: h - 5, stroke: "accent", lineWidth: 0.9 },
  { type: "line", x1: h, y1: h, x2: h + 9, y2: h - 5, stroke: "accent", lineWidth: 0.9 },
  { type: "line", x1: h, y1: h, x2: h - 9, y2: h + 5, stroke: "accent", lineWidth: 0.9 },
  { type: "line", x1: h, y1: h, x2: h + 9, y2: h + 5, stroke: "accent", lineWidth: 0.9 },
  { type: "rect", x: h - 7, y: h - 5, w: 14, h: 10, stroke: "cyanHex", lineWidth: 1 },
]);

const hull = build((h) => [
  { type: "chassis", kind: "slot", w: 26, h: 14 },
  { type: "line", x1: h - 10, y1: h - 1, x2: h + 10, y2: h - 1, stroke: "hullEdge", lineWidth: 1 },
  { type: "line", x1: h - 10, y1: h + 2, x2: h + 10, y2: h + 2, stroke: "hullEdge", lineWidth: 1 },
]);

const deadspace = build((h) => [
  { type: "chassis", kind: "slot", w: 22, h: 22 },
  { type: "path", segments: [
    { type: "move", x: h + 11, y: h + 1 },
    { type: "line", x: h + 5.5, y: h + 10.5 },
    { type: "line", x: h - 5.5, y: h + 10.5 },
    { type: "line", x: h - 11, y: h + 1 },
    { type: "line", x: h - 5.5, y: h - 8.5 },
    { type: "line", x: h + 5.5, y: h - 8.5 },
    { type: "close" },
  ], fill: { grad: "tint", y0: h - 11, y1: h + 11 }, stroke: "accent", lineWidth: 0.8 },
]);

// ── Rack fallbacks ───────────────────────────────────────────────────────────

function paintRackFallback(rack: keyof typeof RACK_COLORS): IconPainter {
  return (ctx) => {
    const { cx, half } = ctx;
    drawSlotChassis(ctx, 26, 22);
    cx.fillStyle = "#c8d0e0";
    cx.font = "bold 13px sans-serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    const label = rack === "turret" ? "T" : rack === "high" ? "H" : rack === "med" ? "M" : rack === "low" ? "L" : "?";
    cx.fillText(label, half, half + 1);
  };
}

// ═════════════════════════════════════════════════════════════════════════════
//  Public API
// ═════════════════════════════════════════════════════════════════════════════

export const MODULE_PAINTERS: Record<string, IconPainter> = {
  "dual-rail": dualRail,
  gauss,
  beam,
  strip,
  missile,
  miner,
  salvager,
  tractor,
  scanner,
  cruise,
  nos,
  "hi-salv": hiSalv,
  comms,
  link,
  cipher,
  "scanner-array": scannerArray,
  ab,
  mwd,
  shield,
  capacitor,
  "signal": signalMed,
  "med-tract": medTractor,
  gyro,
  dcu,
  battery,
  nano,
  "data-recovery": dataRecovery,
  hull,
  deadspace,
  sentry: paintRackFallback("turret"),
  mite: paintRackFallback("turret"),
  "__rack-turret": paintRackFallback("turret"),
  "__rack-high": paintRackFallback("high"),
  "__rack-medium": paintRackFallback("med"),
  "__rack-low": paintRackFallback("low"),
};

export type ModuleFamily =
  | "dual-rail"
  | "gauss"
  | "beam"
  | "strip"
  | "missile"
  | "miner"
  | "salvager"
  | "tractor"
  | "scanner"
  | "cruise"
  | "nos"
  | "hi-salv"
  | "comms"
  | "link"
  | "cipher"
  | "scanner-array"
  | "ab"
  | "mwd"
  | "shield"
  | "capacitor"
  | "signal"
  | "med-tract"
  | "gyro"
  | "dcu"
  | "battery"
  | "nano"
  | "data-recovery"
  | "hull"
  | "deadspace"
  | "sentry"
  | "mite";

export function resolveModuleFamily(id: string): ModuleFamily {
  if (id.includes("sentry")) return "sentry";
  if (id.includes("mite")) return "mite";
  if (id.includes("cannon") || id.includes("neutron")) return "dual-rail";
  if (id.includes("gauss")) return "gauss";
  if (id.includes("ion") || id.includes("pulse")) return "beam";
  if (id.includes("strip")) return "strip";
  if (id.includes("missile")) return "missile";
  if (id.includes("miner")) return "miner";
  if (id.includes("salvager")) return "salvager";
  if (id.includes("tractor") && id.startsWith("tu-")) return "tractor";
  if (id.includes("scanner") && id.startsWith("tu-")) return "scanner";
  if (id.includes("cruise")) return "cruise";
  if (id.includes("nos")) return "nos";
  if (id.includes("salv") && id.startsWith("hi-")) return "hi-salv";
  if (id.includes("comms")) return "comms";
  if (id.includes("link")) return "link";
  if (id.includes("cipher")) return "cipher";
  if (id.includes("scanner-array")) return "scanner-array";
  if (id.includes("ab") && id.startsWith("me-")) return "ab";
  if (id.includes("mwd")) return "mwd";
  if (id.includes("shield")) return "shield";
  if (id.includes("cap")) return "capacitor";
  if (id.includes("signal") || id.includes("spectrum") || id.includes("noise")) return "signal";
  if (id.includes("tract") && id.startsWith("me-")) return "med-tract";
  if (id.includes("gyro")) return "gyro";
  if (id.includes("dcu")) return "dcu";
  if (id.includes("battery")) return "battery";
  if (id.includes("nano")) return "nano";
  if (id.includes("data-recovery")) return "data-recovery";
  if (id.includes("hull")) return "hull";
  if (id.includes("deadspace")) return "deadspace";
  const rack = id.startsWith("tu-") ? "turret" : id.startsWith("hi-") ? "high" : id.startsWith("me-") ? "medium" : id.startsWith("lo-") ? "low" : "turret";
  return `__rack-${rack}` as ModuleFamily;
}