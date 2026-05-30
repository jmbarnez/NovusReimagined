/** True when running inside a Tauri desktop shell. */
export function isTauriApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Close the app window (Tauri only). No-op in the browser. */
export async function quitApplication(): Promise<void> {
  if (!isTauriApp()) return;

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.close();
  } catch (e) {
    console.warn("[app-exit] window.close failed, trying destroy:", e);
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().destroy();
    } catch (e2) {
      console.error("[app-exit] could not close application:", e2);
    }
  }
}
