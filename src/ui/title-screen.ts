/**
 * Legacy compatibility wrapper.
 *
 * Boot-screen title logic now lives in `ui/boot-screen/boot-screen-title.ts`.
 * Keep this file as a thin re-export so existing imports remain stable.
 */
export { bindTitleScreenEvents, restoreTitleScreen } from "./boot-screen/boot-screen-title.js";
