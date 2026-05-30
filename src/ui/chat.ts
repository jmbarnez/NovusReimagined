import { gameClient } from "../game-loop.js";
import { getState } from "../state-access.js";
import { getPilotDisplayName } from "../player/player-data.js";
import { appendLogEntry } from "./hud/logs.js";
import { showCommsLogPanel } from "./hud-overlay.js";
import { t } from "../utils/i18n.js";

let chatUnsubscribe: (() => void) | null = null;
let inputKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

function appendChatMessage(sender: string, text: string, isSystem = false) {
  const isSelf = !isSystem && sender === getPilotDisplayName(getState().player);
  let type = "chat";
  if (isSystem) type = "chat-system";
  else if (isSelf) type = "chat-self";
  const label = isSystem ? t("chat.system") : sender;
  appendLogEntry(text, type, `${label}:`);
  showCommsLogPanel();
}

/** Open comms log chat input (bound to settings keybind, default T). */
export function openChatTransmit() {
  const inputRow = document.getElementById("hud-log-chat-input-row");
  const inputEl = document.getElementById("hud-log-chat-input") as HTMLInputElement | null;
  if (!inputRow || !inputEl) return;

  showCommsLogPanel();
  inputRow.style.display = "flex";
  inputEl.value = "";
  inputEl.focus();
}

export function initChat() {
  destroyChat();

  const inputRow = document.getElementById("hud-log-chat-input-row");
  const inputEl = document.getElementById("hud-log-chat-input") as HTMLInputElement | null;
  if (!inputRow || !inputEl) return;

  appendChatMessage("SYSTEM", t("chat.welcome"), true);

  chatUnsubscribe = gameClient.onChatMessage((senderName, message) => {
    appendChatMessage(senderName, message);
  });

  inputKeydownHandler = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const text = inputEl.value.trim();
      if (text) gameClient.sendChatMessage(text);
      inputEl.value = "";
      inputEl.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      inputEl.value = "";
      inputEl.blur();
    }
  };

  inputEl.addEventListener("keydown", inputKeydownHandler);
}

export function destroyChat() {
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }
  const inputEl = document.getElementById("hud-log-chat-input") as HTMLInputElement | null;
  if (inputEl && inputKeydownHandler) {
    inputEl.removeEventListener("keydown", inputKeydownHandler);
  }
  inputKeydownHandler = null;

  const inputRow = document.getElementById("hud-log-chat-input-row");
  if (inputRow) inputRow.style.display = "none";

  document.getElementById("hud-chat-overlay")?.remove();
}
