/** Mutable shared state for the tutorial overlay system.
 *  Keep this object minimal — only DOM element references and the
 *  public `visible` flag.  All internal caches live as module-level
 *  private variables in the files that use them.
 */
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
};

export const TUTORIAL_OVERLAY_MIN_UPDATE_MS = 1000 / 30;
export const TUTORIAL_CARD_POSITION_MIN_UPDATE_MS = 1000 / 20;
