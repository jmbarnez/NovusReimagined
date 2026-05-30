import type { IconPaintCtx, IconPainter } from "./shared.js";
import {
  drawSpecular,
  drawEmissiveGlow,
  fillPolygon,
  tintGradient,
  hullGradient,
  copperGradient,
  COL,
  RACK_COLORS,
  fillRoundRect,
  energyRgb,
  energyHex,
  drawOctPlatform,
  drawSlotChassis,
  drawRailBarrels,
} from "./shared.js";

function beginTurret(ctx: IconPaintCtx): void {
  if (!ctx.rack) ctx.rack = "turret";
  drawOctPlatform(ctx, ctx.half, ctx.half);
}

function paintDualRail(ctx: IconPaintCtx): void {
  beginTurret(ctx);
  drawRailBarrels(ctx, ctx.half + 1, 17);
  drawSpecular(ctx, 2, -6, 16);
}

function paintGauss(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  beginTurret(ctx);
  cx.fillStyle = hullGradient(cx, half, half - 5, half + 5);
  cx.fillRect(half - 4, half - 5, 22, 10);
  cx.strokeStyle = COL.hullEdge;
  cx.strokeRect(half - 4, half - 5, 22, 10);
  cx.fillStyle = copperGradient(cx, half, half - 6, half + 6);
  cx.fillRect(half - 8, half - 6, 7, 12);
  cx.strokeStyle = energyHex(ctx);
  cx.lineWidth = 1.4;
  cx.beginPath();
  cx.moveTo(half + 2, half);
  cx.lineTo(half + 20, half);
  cx.stroke();
  drawEmissiveGlow(cx, half + 16, half, 6, energyRgb(ctx), 0.55);
}

function paintBeamEmitter(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  beginTurret(ctx);
  cx.fillStyle = copperGradient(cx, half + 8, half - 6, half + 6);
  cx.beginPath();
  cx.moveTo(half - 2, half - 7);
  cx.lineTo(half + 20, half);
  cx.lineTo(half - 2, half + 7);
  cx.closePath();
  cx.fill();
  cx.strokeStyle = COL.hullEdge;
  cx.stroke();
  drawEmissiveGlow(cx, half + 14, half, 9, energyRgb(ctx), 0.6);
  cx.strokeStyle = energyHex(ctx);
  cx.lineWidth = 1.2;
  cx.beginPath();
  cx.moveTo(half + 4, half);
  cx.lineTo(half + 22, half);
  cx.stroke();
}

function paintStrip(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  beginTurret(ctx);
  cx.strokeStyle = energyHex(ctx);
  cx.lineWidth = 1.1;
  for (let i = -2; i <= 2; i++) {
    cx.beginPath();
    cx.moveTo(half - 1, half + i * 3.5);
    cx.lineTo(half + 20, half);
    cx.stroke();
  }
  drawEmissiveGlow(cx, half + 15, half, 7, energyRgb(ctx), 0.45);
}

function paintMissileRack(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  beginTurret(ctx);
  for (let i = 0; i < 3; i++) {
    const y = half - 9 + i * 9;
    cx.fillStyle = hullGradient(cx, half + 10, y, y + 5);
    cx.beginPath();
    cx.moveTo(half + 3, y);
    cx.lineTo(half + 18, y + 2.5);
    cx.lineTo(half + 3, y + 5);
    cx.closePath();
    cx.fill();
    cx.strokeStyle = COL.hullEdge;
    cx.stroke();
  }
  drawEmissiveGlow(cx, half + 14, half, 6, COL.amber, 0.4);
}

function paintMiner(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  beginTurret(ctx);
  drawEmissiveGlow(cx, half + 14, half, 11, COL.green, 0.5);
  cx.strokeStyle = "#55ff99";
  cx.lineWidth = 2;
  cx.beginPath();
  cx.moveTo(half + 2, half);
  cx.lineTo(half + 22, half);
  cx.stroke();
  cx.fillStyle = "#3dcc66";
  cx.beginPath();
  cx.arc(half + 22, half, 3, 0, Math.PI * 2);
  cx.fill();
  cx.strokeStyle = "rgba(255,255,255,0.35)";
  cx.lineWidth = 0.8;
  cx.beginPath();
  cx.moveTo(half + 18, half - 5);
  cx.lineTo(half + 22, half);
  cx.lineTo(half + 18, half + 5);
  cx.stroke();
}

function paintSalvager(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  beginTurret(ctx);
  cx.strokeStyle = "#b898ff";
  cx.lineWidth = 1.4;
  for (let i = -1; i <= 1; i++) {
    cx.beginPath();
    cx.moveTo(half + 3, half + i * 5);
    cx.quadraticCurveTo(half + 12, half + i * 1.5, half + 20, half + i * 7);
    cx.stroke();
  }
  drawEmissiveGlow(cx, half + 14, half, 8, "160,120,255", 0.45);
}

function paintTractor(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  beginTurret(ctx);
  cx.strokeStyle = energyHex(ctx);
  cx.lineWidth = 1.3;
  cx.setLineDash([4, 3]);
  cx.beginPath();
  cx.moveTo(half + 5, half - 11);
  cx.lineTo(half + 18, half);
  cx.lineTo(half + 5, half + 11);
  cx.stroke();
  cx.setLineDash([]);
  drawEmissiveGlow(cx, half + 16, half, 7, energyRgb(ctx), 0.42);
}

function paintScanner(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  beginTurret(ctx);
  cx.strokeStyle = energyHex(ctx);
  cx.lineWidth = 1;
  for (let r = 5; r <= 15; r += 5) {
    cx.beginPath();
    cx.arc(half + 2, half, r, -0.55, 0.55);
    cx.stroke();
  }
  drawEmissiveGlow(cx, half + 10, half, 9, energyRgb(ctx), 0.38);
}

function paintHiCruise(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  drawSlotChassis(ctx, 12, 26);
  cx.fillStyle = hullGradient(cx, half, half - 14, half + 10);
  cx.fillRect(half - 3, half - 14, 6, 20);
  cx.strokeStyle = COL.hullEdge;
  cx.strokeRect(half - 3, half - 14, 6, 20);
  cx.beginPath();
  cx.moveTo(half - 5, half - 14);
  cx.lineTo(half, half - 20);
  cx.lineTo(half + 5, half - 14);
  cx.fill();
  cx.strokeStyle = "#ff6644";
  cx.lineWidth = 1.2;
  cx.beginPath();
  cx.moveTo(half - 7, half + 6);
  cx.lineTo(half - 11, half + 14);
  cx.moveTo(half + 7, half + 6);
  cx.lineTo(half + 11, half + 14);
  cx.stroke();
  drawEmissiveGlow(cx, half, half - 10, 6, COL.amber, 0.45);
}

function paintHiNos(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 20, 22);
  cx.strokeStyle = accent;
  cx.lineWidth = 2;
  cx.beginPath();
  cx.arc(half, half + 1, 12, 0, Math.PI * 1.35);
  cx.stroke();
  cx.fillStyle = COL.hazard;
  cx.beginPath();
  cx.arc(half, half + 1, 4, 0, Math.PI * 2);
  cx.fill();
  drawEmissiveGlow(cx, half, half + 1, 11, COL.amber, 0.5);
}

function paintHiSalv(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  drawSlotChassis(ctx, 20, 22);
  cx.strokeStyle = "#b898ff";
  cx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) {
    cx.beginPath();
    cx.moveTo(half - 8, half + 4 + i * 4);
    cx.quadraticCurveTo(half, half - 2 + i * 2, half + 8, half + 4 + i * 4);
    cx.stroke();
  }
  drawEmissiveGlow(cx, half, half, 9, "160,120,255", 0.4);
}

function paintHiComms(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 18, 24);
  cx.strokeStyle = accent;
  cx.lineWidth = 1.2;
  cx.beginPath();
  cx.moveTo(half, half + 10);
  cx.lineTo(half, half - 8);
  cx.stroke();
  cx.beginPath();
  cx.moveTo(half - 9, half - 8);
  cx.quadraticCurveTo(half, half - 18, half + 9, half - 8);
  cx.stroke();
  for (let i = 1; i <= 2; i++) {
    cx.beginPath();
    cx.arc(half, half - 8, 5 * i, Math.PI * 1.08, Math.PI * 1.92);
    cx.stroke();
  }
}

function paintHiLink(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 18, 24);
  cx.strokeStyle = accent;
  cx.lineWidth = 1.4;
  cx.beginPath();
  cx.moveTo(half, half + 12);
  cx.lineTo(half, half - 6);
  cx.moveTo(half, half - 6);
  cx.lineTo(half - 7, half - 14);
  cx.moveTo(half, half - 6);
  cx.lineTo(half + 7, half - 14);
  cx.stroke();
  cx.setLineDash([3, 2]);
  cx.beginPath();
  cx.arc(half, half + 6, 9, Math.PI, 0);
  cx.stroke();
  cx.setLineDash([]);
}

function paintCipherAnalyzer(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 26, 20);
  cx.fillStyle = COL.hullDark;
  cx.fillRect(half - 11, half - 7, 22, 14);
  cx.strokeStyle = accent;
  cx.strokeRect(half - 11, half - 7, 22, 14);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      if ((row + col) % 2 === 0) {
        cx.fillStyle = energyHex(ctx);
        cx.fillRect(half - 9 + col * 4, half - 5 + row * 4, 2.5, 2.5);
      }
    }
  }
}

function paintScannerArray(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  drawSlotChassis(ctx, 22, 22);
  cx.fillStyle = COL.hullLite;
  cx.fillRect(half - 14, half - 2, 5, 4);
  cx.fillRect(half - 14, half + 5, 5, 4);
  cx.strokeStyle = energyHex(ctx);
  cx.lineWidth = 1;
  for (let r = 4; r <= 12; r += 4) {
    cx.beginPath();
    cx.arc(half + 2, half + 1, r, -0.6, 0.6);
    cx.stroke();
  }
}

function paintAb(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 20, 18);
  cx.fillStyle = hullGradient(cx, half, half - 5, half + 5);
  cx.fillRect(half - 8, half - 5, 12, 10);
  cx.fillStyle = COL.amberHex;
  cx.beginPath();
  cx.moveTo(half + 6, half - 3);
  cx.lineTo(half + 16, half);
  cx.lineTo(half + 6, half + 3);
  cx.closePath();
  cx.fill();
  drawEmissiveGlow(cx, half + 12, half, 5, COL.amber, 0.5);
}

function paintMwd(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 22, 18);
  cx.fillStyle = tintGradient(accent, half - 8, half + 8, cx, half);
  cx.beginPath();
  cx.moveTo(half - 6, half - 4);
  cx.lineTo(half + 12, half);
  cx.lineTo(half - 6, half + 4);
  cx.closePath();
  cx.fill();
  cx.beginPath();
  cx.moveTo(half - 12, half - 5);
  cx.lineTo(half - 2, half);
  cx.lineTo(half - 12, half + 5);
  cx.fill();
  drawEmissiveGlow(cx, half + 8, half, 8, COL.cyan, 0.45);
}

function paintShield(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 18, 22);
  cx.strokeStyle = accent;
  cx.lineWidth = 2;
  cx.beginPath();
  cx.moveTo(half, half - 14);
  cx.lineTo(half + 13, half - 6);
  cx.lineTo(half + 13, half + 5);
  cx.quadraticCurveTo(half, half + 17, half - 13, half + 5);
  cx.lineTo(half - 13, half - 6);
  cx.closePath();
  cx.stroke();
  cx.fillStyle = "rgba(56,160,240,0.18)";
  cx.fill();
  drawEmissiveGlow(cx, half, half + 2, 12, "56,180,255", 0.3);
}

function paintCapacitor(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 20, 20);
  cx.strokeStyle = accent;
  cx.lineWidth = 2.5;
  cx.beginPath();
  cx.arc(half, half + 1, 11, 0.35, Math.PI * 1.65);
  cx.stroke();
  cx.fillStyle = accent;
  cx.beginPath();
  cx.arc(half, half + 1, 4, 0, Math.PI * 2);
  cx.fill();
  drawEmissiveGlow(cx, half, half + 1, 9, COL.cyan, 0.4);
}

function paintSignalMed(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 22, 18);
  cx.strokeStyle = accent;
  cx.lineWidth = 1.3;
  cx.beginPath();
  cx.moveTo(half - 10, half + 5);
  cx.lineTo(half - 3, half - 7);
  cx.lineTo(half + 3, half + 3);
  cx.lineTo(half + 10, half - 8);
  cx.stroke();
  drawEmissiveGlow(cx, half, half, 8, COL.cyan, 0.35);
}

function paintMedTractor(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  drawSlotChassis(ctx, 20, 20);
  cx.strokeStyle = energyHex(ctx);
  cx.lineWidth = 1.3;
  cx.setLineDash([3, 2]);
  cx.beginPath();
  cx.moveTo(half - 6, half - 8);
  cx.lineTo(half + 8, half);
  cx.lineTo(half - 6, half + 8);
  cx.stroke();
  cx.setLineDash([]);
}

function paintGyro(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 22, 18);
  cx.strokeStyle = accent;
  cx.lineWidth = 1.2;
  cx.beginPath();
  cx.ellipse(half, half + 1, 13, 5, 0, 0, Math.PI * 2);
  cx.stroke();
  cx.beginPath();
  cx.ellipse(half, half + 1, 13, 5, Math.PI / 3, 0, Math.PI * 2);
  cx.stroke();
  cx.fillStyle = accent;
  cx.beginPath();
  cx.arc(half, half + 1, 2.5, 0, Math.PI * 2);
  cx.fill();
}

function paintDcu(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 24, 18);
  for (let i = 0; i < 3; i++) {
    cx.fillStyle = tintGradient(accent, half - 6 + i * 6, half + 4, cx, half);
    cx.fillRect(half - 10, half - 6 + i * 5, 20, 3.5);
    cx.strokeStyle = COL.hullEdge;
    cx.strokeRect(half - 10, half - 6 + i * 5, 20, 3.5);
  }
}

function paintBattery(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 18, 22);
  cx.fillStyle = tintGradient(accent, half - 8, half + 8, cx, half);
  cx.fillRect(half - 8, half - 6, 16, 12);
  cx.fillRect(half - 3, half - 10, 6, 4);
  cx.strokeStyle = "#44ff88";
  cx.lineWidth = 1.2;
  cx.beginPath();
  cx.moveTo(half - 3, half);
  cx.lineTo(half + 2, half - 3);
  cx.lineTo(half + 2, half + 3);
  cx.stroke();
}

function paintNano(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 22, 18);
  cx.fillStyle = accent;
  cx.beginPath();
  cx.arc(half, half, 2.5, 0, Math.PI * 2);
  cx.fill();
  const nodes: [number, number][] = [[half - 9, half - 5], [half + 9, half - 5], [half - 9, half + 5], [half + 9, half + 5]];
  cx.strokeStyle = accent;
  cx.lineWidth = 0.9;
  for (const [x, y] of nodes) {
    cx.beginPath();
    cx.arc(x, y, 2, 0, Math.PI * 2);
    cx.fill();
    cx.moveTo(half, half);
    cx.lineTo(x, y);
    cx.stroke();
  }
}

function paintDataRecovery(ctx: IconPaintCtx): void {
  paintNano(ctx);
  const { cx, half } = ctx;
  cx.strokeStyle = COL.cyanHex;
  cx.lineWidth = 1;
  cx.strokeRect(half - 7, half - 5, 14, 10);
}

function paintHull(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  drawSlotChassis(ctx, 26, 14);
  cx.strokeStyle = COL.hullEdge;
  cx.lineWidth = 1;
  cx.beginPath();
  cx.moveTo(half - 10, half - 1);
  cx.lineTo(half + 10, half - 1);
  cx.moveTo(half - 10, half + 2);
  cx.lineTo(half + 10, half + 2);
  cx.stroke();
}

function paintDeadspace(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawSlotChassis(ctx, 22, 22);
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
    pts.push([half + Math.cos(a) * 11, half + Math.sin(a) * 11]);
  }
  fillPolygon(cx, pts, tintGradient(accent, half - 11, half + 11, cx, half), accent, 0.8);
}

function paintRackFallback(rack: keyof typeof RACK_COLORS): IconPainter {
  return (ctx: IconPaintCtx) => {
    ctx.rack = rack;
    drawSlotChassis(ctx, 20, 20);
    const { cx, half } = ctx;
    cx.fillStyle = RACK_COLORS[rack];
    cx.font = "bold 11px sans-serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    const ch = rack === "turret" ? "T" : rack === "high" ? "H" : rack === "med" ? "M" : "L";
    cx.fillText(ch, half, half + 1);
  };
}

export const MODULE_PAINTERS: Record<string, IconPainter> = {
  "dual-rail": paintDualRail,
  gauss: paintGauss,
  beam: paintBeamEmitter,
  strip: paintStrip,
  missile: paintMissileRack,
  miner: paintMiner,
  salvager: paintSalvager,
  tractor: paintTractor,
  scanner: paintScanner,
  "scanner-array": paintScannerArray,
  cruise: paintHiCruise,
  nos: paintHiNos,
  "hi-salv": paintHiSalv,
  comms: paintHiComms,
  link: paintHiLink,
  cipher: paintCipherAnalyzer,
  ab: paintAb,
  mwd: paintMwd,
  shield: paintShield,
  capacitor: paintCapacitor,
  signal: paintSignalMed,
  "med-tract": paintMedTractor,
  gyro: paintGyro,
  dcu: paintDcu,
  battery: paintBattery,
  nano: paintNano,
  "data-recovery": paintDataRecovery,
  hull: paintHull,
  deadspace: paintDeadspace,
  sentry: paintDualRail,
  mite: paintBeamEmitter,
  "__rack-turret": paintRackFallback("turret"),
  "__rack-high": paintRackFallback("high"),
  "__rack-med": paintRackFallback("med"),
  "__rack-low": paintRackFallback("low"),
};

export type ModuleFamily =
  | "dual-rail" | "gauss" | "beam" | "strip" | "missile"
  | "miner" | "salvager" | "tractor" | "scanner" | "scanner-array"
  | "cruise" | "nos" | "hi-salv" | "comms" | "link" | "cipher"
  | "ab" | "mwd" | "shield" | "capacitor" | "signal" | "med-tract"
  | "gyro" | "dcu" | "battery" | "nano" | "data-recovery" | "hull" | "deadspace"
  | "sentry" | "mite"
  | "__rack-turret" | "__rack-high" | "__rack-med" | "__rack-low";

export function resolveModuleFamily(id: string): ModuleFamily {
  const lower = id.toLowerCase();
  if (lower.includes("sentry")) return "sentry";
  if (lower.includes("mite")) return "mite";
  if (lower.includes("cannon") || lower.includes("neutron")) return "dual-rail";
  if (lower.includes("gauss")) return "gauss";
  if (lower.includes("ion") || lower.includes("pulse")) return "beam";
  if (lower.includes("strip")) return "strip";
  if (lower.includes("missile")) return "missile";
  if (lower.includes("miner")) return "miner";
  if (lower.includes("salv") && (lower.startsWith("hi-") || lower.includes("hi-salv"))) return "hi-salv";
  if (lower.includes("salv")) return "salvager";
  if (lower === "me-tract") return "med-tract";
  if (lower.includes("tractor")) return "tractor";
  if (lower.includes("scanner-array")) return "scanner-array";
  if (lower.includes("scanner") || lower.includes("scan")) return "scanner";
  if (lower.includes("cipher")) return "cipher";
  if (lower.includes("cruise")) return "cruise";
  if (lower.includes("nos")) return "nos";
  if (lower.includes("comms")) return "comms";
  if (lower.includes("link")) return "link";
  if (lower.includes("ab1") || lower.includes("-ab")) return "ab";
  if (lower.includes("mwd")) return "mwd";
  if (lower.includes("shield")) return "shield";
  if (lower.includes("-cap") || lower.endsWith("cap")) return "capacitor";
  if (lower.includes("signal") || lower.includes("spectrum") || lower.includes("noise-injector")) return "signal";
  if (lower.includes("data-recovery")) return "data-recovery";
  if (lower.includes("gyro")) return "gyro";
  if (lower.includes("dcu")) return "dcu";
  if (lower.includes("battery")) return "battery";
  if (lower.includes("nano")) return "nano";
  if (lower.includes("deadspace")) return "deadspace";
  if (lower.includes("hull")) return "hull";
  if (lower.startsWith("tu-") || lower.includes("turret")) return "__rack-turret";
  if (lower.startsWith("hi-")) return "__rack-high";
  if (lower.startsWith("me-")) return "__rack-med";
  if (lower.startsWith("lo-")) return "__rack-low";
  return "__rack-turret";
}
