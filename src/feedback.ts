/**
 * Facade for UI feedback/presentation layer callbacks.
 * Decouples the simulation layer (combat, player stats, data) from directly
 * importing or referencing DOM/UI overlay code, enabling headless execution.
 */

import type { ModuleInstance } from "./types/moduleInstance.js";

type LogEventHandler = (msg: string, type: string) => void;
type FlashSlotFireHandler = (slotIdx: number) => void;
type ShowXpEarnedHandler = (skillId: string, amount: number) => void;
type ShowPickupToastHandler = (kind: string, payload: string, qty: number, instance?: ModuleInstance) => void;

let _logEvent: LogEventHandler | null = null;
let _flashSlotFire: FlashSlotFireHandler | null = null;
let _showXpEarned: ShowXpEarnedHandler | null = null;
let _showPickupToast: ShowPickupToastHandler | null = null;

export function registerFeedbackHandlers(handlers: {
  logEvent?: LogEventHandler;
  flashSlotFire?: FlashSlotFireHandler;
  showXpEarned?: ShowXpEarnedHandler;
  showPickupToast?: ShowPickupToastHandler;
}) {
  if (handlers.logEvent) _logEvent = handlers.logEvent;
  if (handlers.flashSlotFire) _flashSlotFire = handlers.flashSlotFire;
  if (handlers.showXpEarned) _showXpEarned = handlers.showXpEarned;
  if (handlers.showPickupToast) _showPickupToast = handlers.showPickupToast;
}

export function logEvent(msg: string, type = "system") {
  if (_logEvent) _logEvent(msg, type);
}

export function flashSlotFire(slotIdx: number) {
  if (_flashSlotFire) _flashSlotFire(slotIdx);
}

export function showXpEarned(skillId: string, amount: number) {
  if (_showXpEarned) _showXpEarned(skillId, amount);
}

export function showPickupToast(kind: string, payload: string, qty: number, instance?: ModuleInstance) {
  if (_showPickupToast) _showPickupToast(kind, payload, qty, instance);
}
