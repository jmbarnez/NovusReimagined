import { _G, type Player } from "../../../state.js";
import { LOCAL_PLAYER_ID, registerPlayer, getLocalPlayer } from "../../../player-registry.js";

export const playerMultiplayerAccess = {
  setNetId(netId: string, p: Player = _G.P) {
    p.netId = netId;
  },

  setPilotName(name: string, p: Player = _G.P) {
    p.pilotName = name;
  },

  addServerPlayer(p: Player) {
    registerPlayer(p, p.netId ?? p.shipId);
    if (!_G.P) _G.P = p;
  },

  installServerPrimaryPlayer(p: Player) {
    _G.players.clear();
    registerPlayer(p, p.netId ?? LOCAL_PLAYER_ID);
    _G.P = p;
  },

  removeServerPlayer(netId: string) {
    if (!_G.players) return;
    const local = getLocalPlayer();
    if (local && (netId === LOCAL_PLAYER_ID || netId === local.netId)) return;
    _G.players.delete(netId);
  },

  clearServerPlayers() {
    if (!_G.players) return;
    const local = getLocalPlayer();
    _G.players.clear();
    if (local) {
      registerPlayer(local, LOCAL_PLAYER_ID);
      _G.P = local;
    }
  },
};
