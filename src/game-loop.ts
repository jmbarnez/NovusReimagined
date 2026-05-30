export {
  connectToRemote,
  ensureGameplayConnected,
  enterSpaceMode,
  gameClient,
  GAME_SERVER_PORT,
  getMultiplayerPort,
  initGameLoop,
  stopGameLoop,
  VITE_DEV_PORT,
  VITE_PREVIEW_PORT,
} from "./game-loop/runtime.js";

export {
  stopMultiplayer,
  updateHostHeartbeat,
} from "./game-loop/multiplayer-host.js";
