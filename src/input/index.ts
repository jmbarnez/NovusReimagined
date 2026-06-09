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

let _audioStarted = false;
let _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let _keyupHandler: ((e: KeyboardEvent) => void) | null = null;
let _blurHandler: (() => void) | null = null;
let _mousedownHandler: ((e: MouseEvent) => void) | null = null;
let _mouseupHandler: ((e: MouseEvent) => void) | null = null;
let _mousemoveHandler: ((e: MouseEvent) => void) | null = null;
let _wheelHandler: ((e: WheelEvent) => void) | null = null;
let _contextmenuHandler: ((e: MouseEvent) => void) | null = null;

export function initInput() {
  if (isInputInitialized()) return;
  markInputInitialized();

  const canvasEl = getCanvasElement();
  const uiBlockSelector = getUiPointerBlockSelector();

  _keydownHandler = (e) => handleKeyDown(e);
  _keyupHandler = (e) => handleKeyUp(e);
  _blurHandler = () => handleWindowBlur();
  _mousedownHandler = (e) => {
    if (!_audioStarted) {
      _audioStarted = true;
      resumeAudio();
      playBackgroundMusic();
    }
    handleMouseDown(e);
  };
  _mouseupHandler = (e) => handleMouseUp(e);
  _mousemoveHandler = (e) => handleMouseMove(e);
  _wheelHandler = (e) => handleWheel(e);
  _contextmenuHandler = (e) => handleContextMenu(e);

  window.addEventListener("keydown", _keydownHandler);
  window.addEventListener("keyup", _keyupHandler);
  window.addEventListener("blur", _blurHandler);
  window.addEventListener("mousedown", _mousedownHandler);
  window.addEventListener("mouseup", _mouseupHandler);
  window.addEventListener("mousemove", _mousemoveHandler);
  window.addEventListener("wheel", _wheelHandler, { passive: true });
  window.addEventListener("contextmenu", _contextmenuHandler);
}

export function deinitInput() {
  if (!isInputInitialized()) return;

  if (_keydownHandler) window.removeEventListener("keydown", _keydownHandler);
  if (_keyupHandler) window.removeEventListener("keyup", _keyupHandler);
  if (_blurHandler) window.removeEventListener("blur", _blurHandler);
  if (_mousedownHandler) window.removeEventListener("mousedown", _mousedownHandler);
  if (_mouseupHandler) window.removeEventListener("mouseup", _mouseupHandler);
  if (_mousemoveHandler) window.removeEventListener("mousemove", _mousemoveHandler);
  if (_wheelHandler) window.removeEventListener("wheel", _wheelHandler);
  if (_contextmenuHandler) window.removeEventListener("contextmenu", _contextmenuHandler);

  _keydownHandler = null;
  _keyupHandler = null;
  _blurHandler = null;
  _mousedownHandler = null;
  _mouseupHandler = null;
  _mousemoveHandler = null;
  _wheelHandler = null;
  _contextmenuHandler = null;
  _audioStarted = false;

  clearAllInputState();
}
