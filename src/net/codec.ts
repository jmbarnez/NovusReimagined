/**
 * Network message codec abstraction.
 *
 * Uses msgpackr binary encoding for the WebSocket wire protocol, with an
 * opt-out flag to fall back to JSON during transition or debugging.
 *
 * Rules:
 * - WebSocket messages → encode/decode through this module only.
 * - Worker postMessage → keep structured clone (do NOT use this module).
 * - Tauri relay → keep JSON (Rust bridge expects strings).
 */

import { pack, unpack } from "msgpackr";

export interface NetEnvelope {
  type: string;
  payload: Record<string, unknown>;
}

let _useBinary = true;

export function setUseBinaryCodec(value: boolean): void {
  _useBinary = value;
}

export function useBinaryCodec(): boolean {
  return _useBinary;
}

export function encodeNetMessage(envelope: NetEnvelope): Uint8Array | string {
  if (!_useBinary) {
    return JSON.stringify(envelope);
  }
  return pack(envelope) as Uint8Array;
}

export function decodeNetMessage(data: unknown): NetEnvelope | null {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as NetEnvelope;
    } catch {
      return null;
    }
  }
  if (data instanceof ArrayBuffer) {
    try {
      return unpack(new Uint8Array(data)) as NetEnvelope;
    } catch {
      return null;
    }
  }
  if (data instanceof Uint8Array) {
    try {
      return unpack(data) as NetEnvelope;
    } catch {
      return null;
    }
  }
  return null;
}
