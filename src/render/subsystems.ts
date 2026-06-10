/**
 * Central Render Subsystem Registry
 *
 * Imports every render subsystem descriptor and registers them with the
 * Render Phase Coordinator. This is the single source of truth for the
 * entire renderer pipeline.
 */

import { registerSubsystem } from "./lifecycle.js";

// Shared (title + space)
import { backgroundRenderer } from "./pixi-background.js";
import { celestialRenderer } from "./celestial/index.js";
import { vignetteRenderer } from "./pixi-vignette.js";

// Space gameplay
import { particlesRenderer } from "./pixi-particles.js";
import { planetsRenderer } from "./pixi-planets.js";
import { stationsRenderer } from "./pixi-stations/sync.js";
import { entitiesRenderer } from "./enemy/index.js";
import { playerRenderer, trailsRenderer } from "./player/index.js";
import { thrustRenderer } from "./pixi-thrust.js";
import { combatRenderer } from "./combat/index.js";
import { effectsRenderer } from "./fx/index.js";
import { asteroidsRenderer } from "./pixi-asteroids.js";
import { hitEffectsRenderer } from "./pixi-hit-effects.js";
import { stationOverlaysRenderer } from "./pixi-station-overlays.js";
import { stationTurretsRenderer } from "./pixi-station-turrets.js";
import { lensFlareRenderer } from "./pixi-lens-flare.js";
import { waypointRenderer } from "./pixi-waypoint.js";
import { damageFlashRenderer } from "./pixi-damage-flash.js";
import { effectsOverlayRenderer } from "./pixi-effects-overlay.js";
import { chatBubblesRenderer } from "./pixi-chat-bubbles.js";
import { crosshairRenderer } from "./pixi-crosshair.js";
import { systemMapRenderer } from "./pixi-maps/index.js";
import { minimapRenderer } from "./pixi-minimap.js";
import { warpScreenRenderer } from "./pixi-warp-screen.js";
import { hudRenderer } from "./pixi-hud/index.js";
import { targetArrowsRenderer, tutorialGuideArrowRenderer } from "./pixi-target-arrows.js";
import { tutorialMarkersRenderer } from "./pixi-tutorial-markers.js";
import { tutorialTrackRenderer } from "./pixi-tutorial-track.js";
import { tutorialGatesRenderer } from "./pixi-tutorial-gates.js";
import { regionBordersRenderer } from "./pixi-region-borders.js";

// Station
import { stationInteriorRenderer } from "./pixi-station-interior.js";

const subsystems = [
  backgroundRenderer,
  celestialRenderer,
  vignetteRenderer,
  particlesRenderer,
  planetsRenderer,
  stationsRenderer,
  entitiesRenderer,
  playerRenderer,
  trailsRenderer,
  thrustRenderer,
  combatRenderer,
  effectsRenderer,
  asteroidsRenderer,
  hitEffectsRenderer,
  stationOverlaysRenderer,
  stationTurretsRenderer,
  lensFlareRenderer,
  waypointRenderer,
  damageFlashRenderer,
  effectsOverlayRenderer,
  chatBubblesRenderer,
  crosshairRenderer,
  systemMapRenderer,
  minimapRenderer,
  warpScreenRenderer,
  hudRenderer,
  targetArrowsRenderer,
  tutorialGuideArrowRenderer,
  tutorialMarkersRenderer,
  tutorialTrackRenderer,
  tutorialGatesRenderer,
  regionBordersRenderer,
  stationInteriorRenderer,
];

for (const sub of subsystems) {
  registerSubsystem(sub);
}
