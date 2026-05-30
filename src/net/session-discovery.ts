import { getMultiplayerPort } from "../game-loop.js";

export interface DiscoveredSession {
  id: string;
  address: string;
  label: string;
  lastSeen: number;
}

const SCAN_TIMEOUT_MS = 450;
const SCAN_BATCH = 24;

let scanGeneration = 0;
let activeScan: AbortController | null = null;

/** Best-effort local IPv4 via WebRTC (for LAN subnet scan). */
export async function guessLocalIPv4(): Promise<string | null> {
  if (typeof RTCPeerConnection === "undefined") return null;

  return new Promise((resolve) => {
    const found = new Set<string>();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      pc.close();
      const preferPrivate = [...found].find((ip) =>
        ip.startsWith("192.168.") || ip.startsWith("10.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip),
      );
      resolve(preferPrivate ?? [...found][0] ?? null);
    };

    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel("novus-discover");
    pc.onicecandidate = (ev) => {
      const cand = ev.candidate?.candidate ?? "";
      const m = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(cand);
      if (m?.[1] && !m[1].endsWith(".0") && !m[1].endsWith(".255")) {
        found.add(m[1]);
      }
    };
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finish());
    window.setTimeout(finish, 1200);
  });
}

function subnetCandidates(localIp: string | null): string[] {
  const out = new Set<string>(["127.0.0.1", "localhost"]);
  if (localIp) {
    const parts = localIp.split(".").map(Number);
    if (parts.length === 4 && parts.every((n) => n >= 0 && n <= 255)) {
      const base = `${parts[0]}.${parts[1]}.${parts[2]}`;
      for (let i = 1; i <= 254; i++) {
        out.add(`${base}.${i}`);
      }
    }
  }
  return [...out];
}

function probeWebSocketHost(host: string, port: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    let ws: WebSocket | null = null;
    const done = (ok: boolean) => {
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    const timer = window.setTimeout(() => done(false), SCAN_TIMEOUT_MS);
    const onAbort = () => {
      window.clearTimeout(timer);
      done(false);
    };
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      ws = new WebSocket(`ws://${host}:${port}`);
      ws.onopen = () => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        done(true);
      };
      ws.onerror = () => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        done(false);
      };
    } catch {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      done(false);
    }
  });
}

export function stopSessionDiscovery(): void {
  activeScan?.abort();
  activeScan = null;
  scanGeneration += 1;
}

/**
 * Scan the local subnet for Novus WS hosts. Yields batches as they are found.
 */
export async function discoverLanSessions(
  onBatch: (sessions: DiscoveredSession[]) => void,
  port = getMultiplayerPort(),
): Promise<DiscoveredSession[]> {
  stopSessionDiscovery();
  const gen = ++scanGeneration;
  const ac = new AbortController();
  activeScan = ac;

  const localIp = await guessLocalIPv4();
  if (gen !== scanGeneration) return [];

  const hosts = subnetCandidates(localIp);
  const found = new Map<string, DiscoveredSession>();
  const now = Date.now();

  for (let i = 0; i < hosts.length; i += SCAN_BATCH) {
    if (ac.signal.aborted || gen !== scanGeneration) break;
    const batch = hosts.slice(i, i + SCAN_BATCH);
    const results = await Promise.all(
      batch.map(async (host) => {
        const ok = await probeWebSocketHost(host, port, ac.signal);
        return ok ? host : null;
      }),
    );
    for (const host of results) {
      if (!host) continue;
      const address = `${host}:${port}`;
      const id = address;
      if (!found.has(id)) {
        const label = host === "127.0.0.1" || host === "localhost"
          ? `Local Relay · ${address}`
          : `Neural Relay · ${address}`;
        found.set(id, { id, address, label, lastSeen: now });
      }
    }
    if (found.size > 0) {
      onBatch([...found.values()]);
    }
  }

  if (gen === scanGeneration) {
    activeScan = null;
  }
  return [...found.values()];
}
