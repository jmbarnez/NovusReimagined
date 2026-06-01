/**
 * Legacy compatibility wrapper.
 *
 * Boot-screen phase logic now lives in `ui/boot-screen/boot-screen-phases.ts`.
 * Keep this file as a thin re-export so existing imports remain stable.
 */
export {
  dismissLoadingScreen,
  localizeBootScreen,
  logBootTiming,
  markBootPhase,
  registerLoadingConsole,
  transitionToTitleScreen,
} from "./boot-screen/boot-screen-phases.js";
