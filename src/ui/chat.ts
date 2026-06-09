import { gameClient } from "../game-loop.js";
import { getState } from "../state-access.js";
import { getPilotDisplayName } from "../player/player-data.js";
import { appendLogEntry } from "./hud/logs.js";
import { showCommsLogPanel } from "./hud-overlay.js";
import { t } from "../utils/i18n.js";
import { Client } from "../state.js";
import { getElement, setStyle, onKeydown, onClick, onFocus, onBlur, remove } from "./dom-helpers.js";

let chatUnsubscribe: (() => void) | null = null;
let inputKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
let sendClickHandler: ((e: MouseEvent) => void) | null = null;
let focusHandler: (() => void) | null = null;
let blurHandler: (() => void) | null = null;

function addChatBubble(netId: string, text: string): void {
  Client.chatBubbles.set(netId, { text, expiresAt: performance.now() + 5000 });
}

function sendChatInput(inputEl: HTMLInputElement): void {
  const text = inputEl.value.trim();
  if (text) {
    gameClient.sendChatMessage(text);
    const selfId = getState().player?.netId ?? "local";
    addChatBubble(selfId, text);
  }
  inputEl.value = "";
  gameClient.sendTyping(false);
}

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
  const inputRow = getElement("hud-log-chat-input-row");
  const inputEl = getElement("hud-log-chat-input") as HTMLInputElement | null;
  if (!inputRow || !inputEl) return;

  showCommsLogPanel();
  setStyle(inputRow, { display: "flex" });
  inputEl.focus();
}

export function initChat() {
  destroyChat();

  const inputRow = getElement("hud-log-chat-input-row");
  const inputEl = getElement("hud-log-chat-input") as HTMLInputElement | null;
  const sendBtn = getElement("hud-log-chat-send") as HTMLButtonElement | null;
  if (!inputRow || !inputEl) return;

  appendChatMessage("SYSTEM", t("chat.welcome"), true);
  setStyle(inputRow, { display: "flex" });

  chatUnsubscribe = gameClient.onChatMessage((senderName, message, senderId) => {
    appendChatMessage(senderName, message);
    if (senderId) addChatBubble(senderId, message);
  });

  inputKeydownHandler = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      sendChatInput(inputEl);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      inputEl.value = "";
      gameClient.sendTyping(false);
      inputEl.blur();
    }
  };

  onKeydown(inputEl, inputKeydownHandler as EventListener);

  focusHandler = () => gameClient.sendTyping(true);
  blurHandler = () => gameClient.sendTyping(false);
  onFocus(inputEl, focusHandler as EventListener);
  onBlur(inputEl, blurHandler as EventListener);

  sendClickHandler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sendChatInput(inputEl);
    inputEl.focus();
  };
  if (sendBtn) onClick(sendBtn, sendClickHandler as EventListener);
}

export function destroyChat() {
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }
  const inputEl = getElement("hud-log-chat-input") as HTMLInputElement | null;
  if (inputEl && inputKeydownHandler) {
    inputEl.removeEventListener("keydown", inputKeydownHandler);
  }
  if (inputEl && focusHandler) {
    inputEl.removeEventListener("focus", focusHandler);
  }
  if (inputEl && blurHandler) {
    inputEl.removeEventListener("blur", blurHandler);
  }
  const sendBtn = getElement("hud-log-chat-send");
  if (sendBtn && sendClickHandler) {
    sendBtn.removeEventListener("click", sendClickHandler);
  }
  inputKeydownHandler = null;
  sendClickHandler = null;
  focusHandler = null;
  blurHandler = null;

  const inputRow = getElement("hud-log-chat-input-row");
  if (inputRow) setStyle(inputRow, { display: "none" });

  const chatOverlay = getElement("hud-chat-overlay");
  if (chatOverlay) remove(chatOverlay);
}
