import { Client } from "../state.js";
import { queueFrameAction } from "../sim/input.js";
import { app } from "../pixi.js";

let inputInitialized = false;

export function isInputInitialized(): boolean {
  return inputInitialized;
}

export function markInputInitialized(): void {
  inputInitialized = true;
}

export function getCanvasElement(): HTMLCanvasElement | null {
  return (app?.canvas as HTMLCanvasElement | undefined) ?? null;
}

export function getUiPointerBlockSelector(): string {
  return [
    "#station-overlay",
    "#bridge-overlay",
    "#settings-overlay",
    "#wreck-overlay",
    "#pause-overlay",
    "#title-screen",
    ".eve-window",
    "#hud-bottom",
    "#hud-minimap",
    "[id^='hud-win-']",
  ].join(", ");
}

export function isBlockedByUi(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && !!target.closest(selector);
}

export function setCursorLock(locked: boolean, canvasEl: HTMLCanvasElement | null): void {
  Client.cursorUnlocked = !locked;
  if (canvasEl) canvasEl.style.cursor = locked ? "none" : "default";
}

export function clearAllInputState(): void {
  Client.keys[" "] = false;
  Client.keys["w"] = false;
  Client.keys["a"] = false;
  Client.keys["s"] = false;
  Client.keys["d"] = false;
  Client.keys["shift"] = false;
  Client.keys["boost"] = false;
  Client.mouse.lmb = false;
  Client.mouse.rmb = false;
}
