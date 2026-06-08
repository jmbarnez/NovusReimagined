import { isInputInitialized, markInputInitialized, getCanvasElement, getUiPointerBlockSelector, isBlockedByUi, setCursorLock, clearAllInputState } from "./core.js";
import { handleKeyDown, handleKeyUp } from "./bindings.js";
import { handleMouseDown, handleMouseUp, handleMouseMove, handleWheel, handleContextMenu, handleWindowBlur } from "./mouse.js";
import { resumeAudio } from "../audio/procedural.js";
import { playBackgroundMusic } from "../audio/music.js";

export {
  isInputInitialized,
  markInputInitialized,
  getCanvasElement,
  getUiPointerBlockSelector,
  isBlockedByUi,
  setCursorLock,
  clearAllInputState,
  handleKeyDown,
  handleKeyUp,
  handleMouseDown,
  handleMouseUp,
  handleMouseMove,
  handleWheel,
  handleContextMenu,
  handleWindowBlur,
};

export function initInput() {
  if (isInputInitialized()) return;
  markInputInitialized();

  const canvasEl = getCanvasElement();
  const uiBlockSelector = getUiPointerBlockSelector();

  window.addEventListener("keydown", (e) => {
    handleKeyDown(e);
  });

  window.addEventListener("keyup", (e) => {
    handleKeyUp(e);
  });

  window.addEventListener("blur", () => {
    handleWindowBlur();
  });

  let _audioStarted = false;
  window.addEventListener("mousedown", (e) => {
    if (!_audioStarted) {
      _audioStarted = true;
      resumeAudio();
      playBackgroundMusic();
    }
    handleMouseDown(e);
  });

  window.addEventListener("mouseup", (e) => {
    handleMouseUp(e);
  });

  window.addEventListener("mousemove", (e) => {
    handleMouseMove(e);
  });

  window.addEventListener("wheel", (e) => {
    handleWheel(e);
  }, { passive: true });

  window.addEventListener("contextmenu", (e) => {
    handleContextMenu(e);
  });
}
