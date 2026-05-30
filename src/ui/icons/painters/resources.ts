import type { IconPaintCtx, IconPainter } from "./shared.js";
import {
  drawSpecular,
  drawEmissiveGlow,
  fillPolygon,
  tintGradient,
  hullGradient,
  copperGradient,
  COL,
  fillRoundRect,
  strokeRoundRect,
} from "./shared.js";

function paintIron(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  const chunks: [number, number][][] = [
    [[half - 16, half + 8], [half - 18, half - 2], [half - 8, half - 14], [half + 2, half - 10], [half + 4, half + 6]],
    [[half + 4, half + 10], [half + 14, half + 4], [half + 18, half - 4], [half + 10, half - 16], [half + 2, half - 2]],
  ];
  for (const pts of chunks) {
    fillPolygon(cx, pts, tintGradient(accent, half - 14, half + 10, cx, half), COL.hullEdge, 0.9);
  }
  cx.strokeStyle = "rgba(255,255,255,0.12)";
  cx.lineWidth = 0.8;
  cx.beginPath();
  cx.moveTo(half - 4, half - 2);
  cx.lineTo(half + 8, half + 2);
  cx.stroke();
  drawSpecular(ctx, -3, -7, 14);
}

function paintCrystal(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawEmissiveGlow(cx, half, half + 1, 18, "68,204,255", 0.35);
  const pts: [number, number][] = [
    [half, half - 18], [half + 12, half - 2], [half + 9, half + 14],
    [half - 9, half + 14], [half - 12, half - 2],
  ];
  fillPolygon(cx, pts, tintGradient(accent, half - 18, half + 14, cx, half), "rgba(180,240,255,0.75)", 1);
  cx.strokeStyle = "rgba(220,250,255,0.55)";
  cx.lineWidth = 0.9;
  for (const [x, y] of pts) {
    cx.beginPath();
    cx.moveTo(half, half + 2);
    cx.lineTo(x, y);
    cx.stroke();
  }
  drawEmissiveGlow(cx, half, half + 2, 7, "100,230,255", 0.75);
}

function paintExotic(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  drawEmissiveGlow(cx, half, half, 22, "255,68,170", 0.45);
  cx.fillStyle = tintGradient(accent, half - 10, half + 10, cx, half);
  cx.beginPath();
  cx.arc(half, half, 9, 0, Math.PI * 2);
  cx.fill();
  cx.strokeStyle = "rgba(255,160,220,0.8)";
  cx.lineWidth = 1;
  cx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = half + Math.cos(a) * 16;
    const py = half + Math.sin(a) * 16;
    drawEmissiveGlow(cx, px, py, 3.5, "255,80,180", 0.85);
    cx.fillStyle = accent;
    cx.beginPath();
    cx.arc(px, py, 1.8, 0, Math.PI * 2);
    cx.fill();
  }
}

function paintBar(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  const w = 30, h = 11, x = half - w / 2, y = half - 1;
  cx.fillStyle = tintGradient(accent, y, y + h, cx, half);
  fillRoundRect(cx, x, y, w, h, 2);
  cx.strokeStyle = COL.hullEdge;
  cx.lineWidth = 1;
  strokeRoundRect(cx, x + 0.5, y + 0.5, w - 1, h - 1, 2);
  cx.fillStyle = "rgba(255,255,255,0.18)";
  cx.fillRect(x + 2, y + 1, w - 4, 2);
  cx.strokeStyle = "rgba(0,0,0,0.4)";
  cx.beginPath();
  cx.moveTo(x + 1, half);
  cx.lineTo(x + w - 1, half);
  cx.stroke();
  drawSpecular(ctx, 0, -3, 14);
}

function paintLatticeIngot(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  const r = 13;
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
    pts.push([half + Math.cos(a) * r, half + Math.sin(a) * r * 0.82]);
  }
  fillPolygon(cx, pts, tintGradient(accent, half - 12, half + 12, cx, half), "rgba(140,230,255,0.65)", 1);
  cx.strokeStyle = "rgba(80,200,255,0.45)";
  cx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    cx.beginPath();
    cx.moveTo(half, half);
    cx.lineTo(pts[i][0], pts[i][1]);
    cx.stroke();
  }
  drawEmissiveGlow(cx, half, half, 9, "80,220,255", 0.4);
}

function paintCondensate(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  const x = half - 8, y = half - 14, w = 16, h = 24;
  cx.fillStyle = hullGradient(cx, half, y, y + h);
  fillRoundRect(cx, x, y, w, h, 2);
  cx.strokeStyle = COL.hullEdge;
  strokeRoundRect(cx, x + 0.5, y + 0.5, w - 1, h - 1, 2);
  cx.fillStyle = tintGradient(accent, half + 2, half + 10, cx, half);
  cx.beginPath();
  cx.ellipse(half, half + 5, 6.5, 4.5, 0, 0, Math.PI * 2);
  cx.fill();
  drawEmissiveGlow(cx, half, half + 3, 7, "255,100,200", 0.55);
  cx.fillStyle = "rgba(255,255,255,0.22)";
  cx.fillRect(x + 2, y + 2, 3, h - 10);
}

function paintScrap(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  const pts: [number, number][] = [
    [half - 11, half + 9], [half - 15, half - 3], [half - 5, half - 13],
    [half + 5, half - 11], [half + 15, half - 1], [half + 13, half + 9], [half + 1, half + 13],
  ];
  fillPolygon(cx, pts, tintGradient(accent, half - 13, half + 13, cx, half), COL.hullEdge, 1);
  cx.strokeStyle = COL.copperMid;
  cx.lineWidth = 1.2;
  cx.beginPath();
  cx.moveTo(half - 3, half - 5);
  cx.lineTo(half + 9, half + 3);
  cx.stroke();
}

function paintChip(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  const x = half - 12, y = half - 9, w = 24, h = 15;
  cx.fillStyle = hullGradient(cx, half, y, y + h);
  fillRoundRect(cx, x, y, w, h, 1);
  cx.strokeStyle = accent;
  cx.lineWidth = 1;
  strokeRoundRect(cx, x + 0.5, y + 0.5, w - 1, h - 1, 1);
  cx.strokeStyle = "rgba(255,210,80,0.75)";
  cx.lineWidth = 0.7;
  cx.strokeRect(x + 4, y + 3, w - 8, h - 6);
  for (let i = 0; i < 4; i++) {
    const py = y + 4 + i * 3;
    cx.beginPath();
    cx.moveTo(x, py);
    cx.lineTo(x - 3, py);
    cx.moveTo(x + w, py);
    cx.lineTo(x + w + 3, py);
    cx.stroke();
  }
  drawEmissiveGlow(cx, half, half, 5, COL.green, 0.28);
}

function paintCell(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  const x = half - 7, y = half - 11, w = 14, h = 20;
  cx.fillStyle = tintGradient(accent, y, y + h, cx, half);
  fillRoundRect(cx, x, y + 4, w, h - 4, 3);
  cx.fillStyle = hullGradient(cx, half, y, y + 5);
  fillRoundRect(cx, x + 1, y, w - 2, 5, 1);
  cx.strokeStyle = COL.hullEdge;
  strokeRoundRect(cx, x + 0.5, y + 0.5, w - 1, 4, 1);
  cx.fillStyle = "rgba(0,0,0,0.28)";
  cx.fillRect(x + 3, half - 1, 2.5, 7);
  cx.fillRect(x + 8, half - 1, 2.5, 7);
  drawEmissiveGlow(cx, half, half + 3, 5, "255,255,90", 0.38);
}

function paintIntactPart(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  cx.fillStyle = tintGradient(accent, half - 9, half + 9, cx, half);
  fillRoundRect(cx, half - 11, half - 7, 22, 15, 2);
  cx.strokeStyle = COL.hullEdge;
  strokeRoundRect(cx, half - 10.5, half - 6.5, 21, 14, 2);
  cx.fillStyle = COL.hullDark;
  cx.fillRect(half - 7, half - 3, 14, 7);
  cx.strokeStyle = "rgba(255,200,120,0.55)";
  cx.strokeRect(half - 7, half - 3, 14, 7);
  cx.fillStyle = COL.hudGold;
  cx.fillRect(half - 5, half - 1, 10, 2);
}

function paintCircuit(ctx: IconPaintCtx): void {
  paintChip(ctx);
  const { cx, half, accent } = ctx;
  cx.strokeStyle = accent;
  cx.lineWidth = 0.9;
  cx.beginPath();
  cx.moveTo(half - 5, half + 1);
  cx.lineTo(half - 2, half + 1);
  cx.lineTo(half - 2, half - 2);
  cx.lineTo(half + 2, half - 2);
  cx.lineTo(half + 2, half + 2);
  cx.lineTo(half + 5, half + 2);
  cx.stroke();
  cx.fillStyle = accent;
  cx.beginPath();
  cx.arc(half - 5, half + 1, 1.5, 0, Math.PI * 2);
  cx.arc(half + 5, half + 2, 1.5, 0, Math.PI * 2);
  cx.fill();
}

function paintGear(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  cx.fillStyle = tintGradient(accent, half - 12, half + 12, cx, half);
  cx.beginPath();
  cx.arc(half, half, 11, 0, Math.PI * 2);
  cx.fill();
  cx.strokeStyle = COL.hullEdge;
  cx.lineWidth = 1;
  cx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tx = half + Math.cos(a) * 13;
    const ty = half + Math.sin(a) * 13;
    cx.fillStyle = tintGradient(accent, ty - 2, ty + 2, cx, tx);
    cx.fillRect(tx - 2, ty - 2, 4, 4);
  }
  cx.fillStyle = COL.hullDark;
  cx.beginPath();
  cx.arc(half, half, 4.5, 0, Math.PI * 2);
  cx.fill();
  cx.strokeStyle = COL.steelRim;
  cx.stroke();
}

function paintHarness(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  cx.fillStyle = hullGradient(cx, half, half - 12, half + 12);
  cx.fillRect(half - 14, half - 11, 3, 22);
  cx.fillRect(half + 11, half - 11, 3, 22);
  cx.strokeStyle = accent;
  cx.lineWidth = 2.2;
  for (let i = 0; i < 3; i++) {
    const y = half - 7 + i * 7;
    cx.beginPath();
    cx.moveTo(half - 11, y);
    cx.quadraticCurveTo(half, y - 3, half + 11, y);
    cx.stroke();
  }
}

function paintSensorCluster(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  cx.fillStyle = hullGradient(cx, half, half - 14, half + 12);
  cx.beginPath();
  cx.moveTo(half - 11, half + 11);
  cx.lineTo(half, half - 15);
  cx.lineTo(half + 11, half + 11);
  cx.closePath();
  cx.fill();
  cx.strokeStyle = accent;
  cx.stroke();
  drawEmissiveGlow(cx, half, half - 9, 7, COL.cyan, 0.5);
  cx.strokeStyle = COL.cyanHex;
  cx.lineWidth = 0.9;
  cx.beginPath();
  cx.arc(half, half + 1, 7, Math.PI, 0);
  cx.stroke();
}

function paintAmmoHybrid(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  cx.fillStyle = copperGradient(cx, half, half - 14, half + 14);
  fillRoundRect(cx, half - 4, half - 15, 8, 26, 3);
  cx.strokeStyle = COL.hullEdge;
  strokeRoundRect(cx, half - 3.5, half - 14.5, 7, 25, 3);
  cx.fillStyle = "rgba(255,255,255,0.2)";
  cx.fillRect(half - 2, half - 11, 4, 9);
  cx.fillStyle = hullGradient(cx, half, half - 15, half - 11);
  cx.beginPath();
  cx.ellipse(half, half - 15, 4, 2.5, 0, 0, Math.PI * 2);
  cx.fill();
}

function paintAmmoMissile(ctx: IconPaintCtx): void {
  const { cx, half, accent } = ctx;
  const pts: [number, number][] = [
    [half - 5, half + 11], [half - 7, half - 3], [half, half - 17], [half + 7, half - 3], [half + 5, half + 11],
  ];
  fillPolygon(cx, pts, tintGradient(accent, half - 17, half + 11, cx, half), COL.hullEdge, 1);
  cx.fillStyle = COL.hullMid;
  for (const sx of [-1, 1]) {
    cx.beginPath();
    cx.moveTo(half + sx * 7, half + 7);
    cx.lineTo(half + sx * 11, half + 13);
    cx.lineTo(half + sx * 3, half + 9);
    cx.fill();
  }
  drawEmissiveGlow(cx, half, half + 9, 5, COL.amber, 0.48);
}

function paintGenericOre(ctx: IconPaintCtx): void { paintIron(ctx); }
function paintGenericRefined(ctx: IconPaintCtx): void { paintBar(ctx); }
function paintGenericLoot(ctx: IconPaintCtx): void { paintScrap(ctx); }
function paintGenericComponent(ctx: IconPaintCtx): void { paintCircuit(ctx); }
function paintGenericAmmo(ctx: IconPaintCtx): void { paintAmmoHybrid(ctx); }

export const RESOURCE_PAINTERS: Record<string, IconPainter> = {
  iron: paintIron,
  crystal: paintCrystal,
  exotic: paintExotic,
  bar: paintBar,
  lattice: paintLatticeIngot,
  condensate: paintCondensate,
  scrap: paintScrap,
  chip: paintChip,
  cell: paintCell,
  "intact-part": paintIntactPart,
  circuit: paintCircuit,
  gear: paintGear,
  harness: paintHarness,
  sensor_cluster: paintSensorCluster,
  "ammo-hybrid": paintAmmoHybrid,
  "ammo-missile": paintAmmoMissile,
  "__ore": paintGenericOre,
  "__refined": paintGenericRefined,
  "__loot": paintGenericLoot,
  "__component": paintGenericComponent,
  "__ammo": paintGenericAmmo,
};
