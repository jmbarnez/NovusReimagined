import type { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { MapWindowBounds } from "./utils.js";

export interface PixiMapState {
  bgGfx: Graphics | null;
  gridGfx: Graphics | null;
  starGfx: Graphics | null;
  sectorGfx: Graphics | null;
  objectGfx: Graphics | null;
  waypointGfx: Graphics | null;
  playerGfx: Graphics | null;
  vignetteGfx: Graphics | null;
  labelContainer: Container | null;
  mapMask: Graphics | null;
  positioningContainer: Container | null;
  overlayGfx: Graphics | null;
  mapContainer: Container | null;
  cachedMapBounds: MapWindowBounds | null;
  mapBoundsDirty: boolean;
  _lastLabelFontKey: string;
  _nameStyle: TextStyle | null;
  _smallStyle: TextStyle | null;
  _boldStyle: TextStyle | null;
  _labelStyleVariantCache: Map<string, TextStyle>;
  _mapLabelPool: Map<string, Text>;
  _activeMapLabelKeys: Set<string>;
}

export const pixiMapState: PixiMapState = {
  bgGfx: null,
  gridGfx: null,
  starGfx: null,
  sectorGfx: null,
  objectGfx: null,
  waypointGfx: null,
  playerGfx: null,
  vignetteGfx: null,
  labelContainer: null,
  mapMask: null,
  positioningContainer: null,
  overlayGfx: null,
  mapContainer: null,
  cachedMapBounds: null,
  mapBoundsDirty: true,
  _lastLabelFontKey: "",
  _nameStyle: null,
  _smallStyle: null,
  _boldStyle: null,
  _labelStyleVariantCache: new Map(),
  _mapLabelPool: new Map(),
  _activeMapLabelKeys: new Set(),
};
