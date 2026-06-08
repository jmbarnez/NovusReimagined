/** Mutable shared state for the tutorial overlay system. */
export const tutorialState = {
  layerEl: null as HTMLElement | null,
  root: null as HTMLElement | null,
  cardEl: null as HTMLElement | null,
  titleEl: null as HTMLElement | null,
  objectiveEl: null as HTMLElement | null,
  tourLabelEl: null as HTMLElement | null,
  tourBodyEl: null as HTMLElement | null,
  statusEl: null as HTMLElement | null,
  counterEl: null as HTMLElement | null,
  tourNextBtn: null as HTMLButtonElement | null,
  nextBtn: null as HTMLButtonElement | null,
  navProgressEl: null as HTMLElement | null,
  navProgressFillEl: null as HTMLElement | null,
  navProgressLabelEl: null as HTMLElement | null,
  confirmEl: null as HTMLElement | null,
  completeEl: null as HTMLElement | null,
  visible: false,
  showCompleteBannerActive: false,
  lastReady: false,
  _activeHudHighlightEl: null as Element | null,
  _hudDimmerEl: null as HTMLElement | null,
  _hudDimmerVisible: false,
  _hudDimmerHideTimer: null as number | null,
  _lastDimmerCutoutKey: "",
  _lastTutorialOverlayUpdateMs: 0,
  _lastCardPositionUpdateMs: 0,
  _overlayInactiveCleaned: false,
  _overlayHiddenCleaned: false,
};

export const TUTORIAL_OVERLAY_MIN_UPDATE_MS = 1000 / 30;
export const TUTORIAL_CARD_POSITION_MIN_UPDATE_MS = 1000 / 20;
