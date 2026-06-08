import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { C } from "../../config/index.js";
import { TUTORIAL_LOCAL_REGIONS } from "../../data/tutorial-layout.js";
import { curSys } from "../../utils/game.js";
import { getThemeColors } from "../../data/settings.js";
import { pixiMapState } from "./state.js";
import { rgbaToHex } from "./utils.js";
import { setMapLabel } from "./labels.js";
import type { MapWindowBounds } from "./utils.js";

export function drawSectors(
  toMap: (wx: number, wy: number) => { x: number; y: number },
  bounds: MapWindowBounds,
): void {
  if (!pixiMapState.sectorGfx) return;
  pixiMapState.sectorGfx.clear();

  const sys = curSys();
  const player = getState().player;
  if (!sys || !player) return;

  const theme = getThemeColors(Client.settings?.theme || "default");

  // Tutorial local zone rings
  if (sys.idx === 0 && player.tutorial?.active) {
    for (const reg of TUTORIAL_LOCAL_REGIONS) {
      const p = toMap(reg.x, reg.y);
      const mapTransformScale = (Client.systemMapTransform as { scale?: number } | undefined)?.scale ?? 1;
      const regR = reg.r * mapTransformScale;
      pixiMapState.sectorGfx.circle(p.x, p.y, regR);
      pixiMapState.sectorGfx.stroke({ color: 0x64a0dc, width: 1.2, alpha: 0.28 });

      setMapLabel(`region:${reg.name}`, reg.name.toUpperCase(), "small", p.x, p.y, 0.32, 0x64a0dc);
    }
  }

  // Concentric sector boundaries
  if (sys.idx >= 1) {
    const sectors = C.WORLD.CONCENTRIC.sectors;
    const C1 = sectors.find((s: { idx: number }) => s.idx === 1)!;
    const C2 = sectors.find((s: { idx: number }) => s.idx === 2)!;
    const C3 = sectors.find((s: { idx: number }) => s.idx === 3)!;
    const C4 = sectors.find((s: { idx: number }) => s.idx === 4)!;

    const getCircumcenter = (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number }
    ) => {
      const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
      if (Math.abs(d) < 0.0001) return { x: 0, y: 0 };
      const sq1 = p1.x * p1.x + p1.y * p1.y;
      const sq2 = p2.x * p2.x + p2.y * p2.y;
      const sq3 = p3.x * p3.x + p3.y * p3.y;
      const ux = (sq1 * (p2.y - p3.y) + sq2 * (p3.y - p1.y) + sq3 * (p1.y - p2.y)) / d;
      const uy = (sq1 * (p3.x - p2.x) + sq2 * (p1.x - p3.x) + sq3 * (p2.x - p1.x)) / d;
      return { x: ux, y: uy };
    };

    const V123 = getCircumcenter(C1, C2, C3);
    const V134 = getCircumcenter(C1, C3, C4);
    const V142 = getCircumcenter(C1, C4, C2);

    const sV123 = toMap(V123.x, V123.y);
    const sV134 = toMap(V134.x, V134.y);
    const sV142 = toMap(V142.x, V142.y);
    const sCenter = toMap(0, 0);
    const sRadius = 20000 * ((Client.systemMapTransform as { scale?: number } | undefined)?.scale ?? 1);

    // Outer boundary
    pixiMapState.sectorGfx.circle(sCenter.x, sCenter.y, sRadius);
    pixiMapState.sectorGfx.stroke({ color: 0x64a0dc, width: 2, alpha: 0.65 });

    // Voronoi edges
    pixiMapState.sectorGfx.moveTo(sV142.x, sV142.y);
    pixiMapState.sectorGfx.lineTo(sV123.x, sV123.y);
    pixiMapState.sectorGfx.moveTo(sV123.x, sV123.y);
    pixiMapState.sectorGfx.lineTo(sV134.x, sV134.y);
    pixiMapState.sectorGfx.moveTo(sV134.x, sV134.y);
    pixiMapState.sectorGfx.lineTo(sV142.x, sV142.y);
    pixiMapState.sectorGfx.stroke({ color: 0x64a0dc, width: 1.5, alpha: 0.55 });

    // Sector labels
    for (const secConfig of sectors) {
      const secCenter = toMap(secConfig.x, secConfig.y);
      const discovered = (secConfig as unknown as Record<string, unknown>).discovered as boolean ?? false;
      const label = discovered ? (secConfig as unknown as Record<string, string>).name.toUpperCase() : "?";
      setMapLabel(`sector:${secConfig.idx}`, label, "bold", secCenter.x, secCenter.y - 12, discovered ? 0.65 : 0.28);
    }
  }
}
