import { _G, type Player } from "./state.js";

/** Registry key for the single-player / main-thread local human. */
export const LOCAL_PLAYER_ID = "local";

function ensurePlayersMap(): Map<string, Player> {
  if (!_G.players) _G.players = new Map();
  return _G.players;
}

/** Insert or replace a player in _G.players and assign netId when missing. */
export function registerPlayer(p: Player, id?: string): Player {
  const key = id ?? p.netId ?? LOCAL_PLAYER_ID;
  p.netId = key;
  ensurePlayersMap().set(key, p);
  return p;
}

export function getLocalPlayer(): Player | null {
  return _G.players?.get(LOCAL_PLAYER_ID) ?? _G.P ?? null;
}

export function isLocalPlayer(p: Player): boolean {
  const local = getLocalPlayer();
  if (!local) return false;
  if (p === local) return true;
  const key = p.netId ?? p.shipId;
  const localKey = local.netId ?? LOCAL_PLAYER_ID;
  return key === localKey || key === LOCAL_PLAYER_ID;
}

/** Boot / test helper: register player as local and set _G.P alias. */
export function installLocalPlayer(p: Player, id: string = LOCAL_PLAYER_ID): Player {
  const registered = registerPlayer(p, id);
  _G.P = registered;
  return registered;
}

/** Vitest helper — same as installLocalPlayer. */
export function installTestPlayer(p: Player): Player {
  return installLocalPlayer(p);
}
