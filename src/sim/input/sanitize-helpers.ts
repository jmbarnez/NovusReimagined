/**
 * Shared sanitization helpers and validation sets for input-frame action
 * parsing.
 *
 * These helpers narrow untrusted `Record<string, unknown>` action payloads
 * into typed {@link GameCommand} variants. They are pure and side-effect
 * free so the per-domain sanitizers under `./sanitizers/` can compose them.
 */
import type { GameCommand } from "../commands.js";

/** Re-exported so callers can reference the canonical command union. */
export type { GameCommand };

/** Max absolute coordinate value accepted in input frames (mouse world pos). */
export const MAX_INPUT_COORD = 1_000_000;

export const RACK_IDS = new Set(["turret", "high", "med", "low"]);
export const AMMO_TYPES = new Set(["hybrid", "missile"]);
export const RESOURCE_CATEGORIES = new Set(["ore", "loot", "components"]);
export const HEAT_MODES = new Set(["cool", "stable", "hot"]);

export function finiteOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function clampFinite(value: unknown, min: number, max: number): number {
  return Math.max(min, Math.min(max, finiteOrZero(value)));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function stringPayload(action: Record<string, unknown>, key: string): string | null {
  const payload = action.payload;
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function numberPayload(action: Record<string, unknown>, key: string): number | null {
  const payload = action.payload;
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function optionalPayloadRecord(action: Record<string, unknown>): Record<string, unknown> {
  return isRecord(action.payload) ? action.payload : {};
}
