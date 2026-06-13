import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../utils/i18n.js";

export interface PauseMenuViewProps {
  onResume: () => void;
  onSave: () => void;
  onSettings: () => void;
  onExit: () => void;
}

export function PauseMenuView({ onResume, onSave, onSettings, onExit }: PauseMenuViewProps) {
  const [saveLabel, setSaveLabel] = useState(t("pause.save"));
  const [saveDisabled, setSaveDisabled] = useState(false);
  const saveResetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (saveResetTimer.current !== null) {
        window.clearTimeout(saveResetTimer.current);
      }
    };
  }, []);

  const handleSave = (): void => {
    onSave();
    setSaveLabel(t("common.saved"));
    setSaveDisabled(true);

    if (saveResetTimer.current !== null) {
      window.clearTimeout(saveResetTimer.current);
    }

    saveResetTimer.current = window.setTimeout(() => {
      setSaveLabel(t("pause.save"));
      setSaveDisabled(false);
      saveResetTimer.current = null;
    }, 1200);
  };

  return (
    <div class="pause-panel">
      <h2 class="pause-title">{t("pause.title")}</h2>
      <button type="button" id="pause-resume" class="pause-btn pause-btn-primary" onClick={onResume}>
        {t("pause.resume")}
      </button>
      <button type="button" id="pause-save" class="pause-btn" disabled={saveDisabled} onClick={handleSave}>
        {saveLabel}
      </button>
      <button type="button" id="pause-settings" class="pause-btn" onClick={onSettings}>
        {t("pause.settings")}
      </button>
      <button type="button" id="pause-exit" class="pause-btn pause-btn-exit" onClick={onExit}>
        {t("pause.exit")}
      </button>
    </div>
  );
}
