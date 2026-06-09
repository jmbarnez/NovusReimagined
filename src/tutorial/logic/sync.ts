import { getState } from "../../state-access.js";
import { queueFrameAction } from "../../sim/input.js";

export function syncTutorialStateToServer() {
  queueFrameAction({
    type: "syncTutorialStep",
    payload: { ...getState().player.tutorial },
  });
}
