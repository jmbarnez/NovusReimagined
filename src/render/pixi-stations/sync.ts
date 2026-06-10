import { AppMode } from "../../state.js";
import type { RenderSubsystem } from "../lifecycle.js";
import { Client } from "../../state.js";
import type { System } from "../../types/world.js";
import { stationLayer } from "../../pixi.js";
import { bundles, createBundle, destroyBundle, clearStationTextureCaches } from "./cache.js";
import { LIGHT_DIRS, TAU, type Station } from "./shared.js";

export function syncPixiStations(now: number, sys: System): void {
  if (!stationLayer) return;
  const stations: Station[] = sys?.stations ?? [];
  const sunDir = sys?.sunDir ?? 0;
  const lightOn = Client.settings?.directionalLighting !== false;

  const activeIds = new Set<string>();
  for (const st of stations) {
    activeIds.add(st.id);
    if (!bundles.has(st.id)) bundles.set(st.id, createBundle(st));
    const b = bundles.get(st.id)!;
    b.body.x = st.x;
    b.body.y = st.y;
    b.body.rotation = st.spin;

    // Animate the secondary glowing energy shield ring
    if (b.shield) {
      b.shield.x = st.x;
      b.shield.y = st.y;
      // Counter-rotates slowly relative to station's own spin to feel dynamically alive
      b.shield.rotation = -st.spin * 0.38;
      // Breathe glowing alpha over time
      b.shield.alpha = 0.42 + 0.16 * Math.sin(now * 0.0018);
      b.shield.visible = true;
    }

    if (lightOn && b.lightTex.length) {
      let di = Math.round(((sunDir - st.spin) / TAU) * LIGHT_DIRS) % LIGHT_DIRS;
      if (di < 0) di += LIGHT_DIRS;
      b.light.texture = b.lightTex[di];
      b.light.x = st.x;
      b.light.y = st.y;
      b.light.visible = true;
    } else {
      b.light.visible = false;
    }
  }

  for (const id of Array.from(bundles.keys())) {
    if (!activeIds.has(id)) destroyBundle(id);
  }
}

export const stationsRenderer: RenderSubsystem = {
  name: "stations",
  sync: (ctx) => {
    syncPixiStations(ctx.now, ctx.sys);
  },
  destroy: clearStationTextureCaches,
  modes: [AppMode.SPACE],
  order: 70,
};
