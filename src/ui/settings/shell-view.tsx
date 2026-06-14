import { WIN_CLOSE_ICON, WIN_EXPAND_ICON } from "../hud/window-chrome.js";
import { t } from "../../utils/i18n.js";

export interface SettingsPanelViewProps {
  title: string;
  subtitle?: string;
  className?: string;
  showChromeButtons?: boolean;
}

function WindowHeadButtonsView() {
  return (
    <>
      <span style={{ flex: 1 }} />
      <button
        type="button"
        className="win-btn win-expand"
        aria-label="Expand window"
        tabIndex={-1}
        dangerouslySetInnerHTML={{ __html: WIN_EXPAND_ICON }}
      />
      <button
        type="button"
        className="win-btn win-close"
        aria-label="Close window"
        tabIndex={-1}
        dangerouslySetInnerHTML={{ __html: WIN_CLOSE_ICON }}
      />
    </>
  );
}

function TipIcon(props: { impact: "NONE" | "LOW" | "MEDIUM" | "HIGH"; desc: string }) {
  return (
    <span className="settings-tip-icon" data-tip-impact={props.impact} data-tip-desc={props.desc}>
      ⓘ
    </span>
  );
}

export function SettingsContentView() {
  return (
    <>
      <div className="settings-tabs" id="settings-tabs">
        <button type="button" className="settings-tab active" data-tab="audio">{t("settings.tab.audio")}</button>
        <button type="button" className="settings-tab" data-tab="video">{t("settings.tab.video")}</button>
        <button type="button" className="settings-tab" data-tab="interface">{t("settings.tab.interface")}</button>
        <button type="button" className="settings-tab" data-tab="controls">{t("settings.tab.controls")}</button>
      </div>
      <div className="win-body">
        <div id="settings-body">
          <div className="settings-tab-panel active" data-tab-panel="audio">
            <h3 className="accent-audio">{t("settings.tab.audio")}</h3>
            <div className="settings-row">
              <label>{t("settings.sfxVolume")}</label>
              <input type="range" id="sfx-volume" min="0" max="1" step="0.05" value="1" />
              <TipIcon impact="NONE" desc={t("settings.tip.sfxVolume")} />
            </div>
            <div className="settings-row">
              <label>{t("settings.music")}</label>
              <input type="range" id="music-volume" min="0" max="1" step="0.05" value="1" />
              <TipIcon impact="NONE" desc={t("settings.tip.music")} />
            </div>
          </div>

          <div className="settings-tab-panel" data-tab-panel="video">
            <h3 className="accent-video">{t("settings.tab.video")}</h3>
            <div className="settings-row">
              <label>Preset</label>
              <div id="preset-buttons" className="settings-btn-row" />
            </div>
            <div className="settings-row">
              <label>{t("settings.renderScale")}</label>
              <input type="range" id="render-scale" min="0.5" max="2.5" step="0.1" value="2.2" />
              <span id="render-scale-val" className="settings-val">2.2x</span>
              <TipIcon impact="HIGH" desc={t("settings.tip.renderScale")} />
            </div>
            <div className="settings-row">
              <label>{t("settings.bloom")}</label>
              <input type="range" id="bloom-intensity" min="0.0" max="2.0" step="0.1" value="1.0" />
              <span id="bloom-intensity-val" className="settings-val">1.0x</span>
              <TipIcon impact="LOW" desc={t("settings.tip.bloom")} />
            </div>
            <div className="settings-row">
              <label>{t("settings.background")}</label>
              <div id="detail-buttons" style={{ display: "flex", gap: "6px" }} />
              <TipIcon impact="MEDIUM" desc={t("settings.tip.background")} />
            </div>
            <div className="settings-row">
              <label>FPS</label>
              <select id="fps-limit" className="settings-select">
                <option value="0">Unlimited</option>
                <option value="60">60 FPS</option>
                <option value="90">90 FPS</option>
                <option value="120">120 FPS</option>
                <option value="144">144 FPS</option>
                <option value="165">165 FPS</option>
                <option value="240">240 FPS</option>
              </select>
              <TipIcon impact="NONE" desc="Limits render frames only. Simulation remains fixed-tick." />
            </div>
            <div className="settings-row settings-toggle-row">
              <label>{t("settings.vignette")}</label>
              <input type="checkbox" id="vignette-toggle" className="toggle-switch" checked />
              <TipIcon impact="LOW" desc={t("settings.tip.vignette")} />
            </div>
            <div className="settings-row settings-toggle-row">
              <label>{t("settings.directionalLighting")}</label>
              <input type="checkbox" id="dir-light-toggle" className="toggle-switch" checked />
              <TipIcon impact="LOW" desc={t("settings.tip.directionalLighting")} />
            </div>
            <div className="settings-row settings-toggle-row">
              <label>{t("settings.atmosphericRim")}</label>
              <input type="checkbox" id="atm-rim-toggle" className="toggle-switch" checked />
              <TipIcon impact="LOW" desc={t("settings.tip.atmosphericRim")} />
            </div>
            <div className="settings-row settings-toggle-row">
              <label>{t("settings.colorGrading")}</label>
              <input type="checkbox" id="color-grade-toggle" className="toggle-switch" checked />
              <TipIcon impact="LOW" desc={t("settings.tip.colorGrading")} />
            </div>
            <div className="settings-row settings-toggle-row">
              <label>{t("settings.mipmapping")}</label>
              <input type="checkbox" id="mipmapping-toggle" className="toggle-switch" checked />
              <TipIcon impact="NONE" desc={t("settings.tip.mipmapping")} />
            </div>
            <div className="settings-row settings-toggle-row">
              <label>{t("settings.lensFlare")}</label>
              <input type="checkbox" id="lens-flare-toggle" className="toggle-switch" checked />
              <TipIcon impact="LOW" desc={t("settings.tip.lensFlare")} />
            </div>
            <div className="settings-row settings-toggle-row">
              <label>{t("settings.antialiasing")}</label>
              <input type="checkbox" id="antialias-toggle" className="toggle-switch" />
              <TipIcon impact="LOW" desc={t("settings.tip.antialiasing")} />
            </div>
          </div>

          <div className="settings-tab-panel" data-tab-panel="interface">
            <h3 className="accent-theme">{t("settings.theme")}</h3>
            <div id="theme-buttons" className="settings-swatch-grid" />
            <h3 className="accent-theme">{t("settings.font")}</h3>
            <div id="font-buttons" className="settings-btn-row" />
            <h3 className="accent-theme">{t("settings.reticle")}</h3>
            <div id="reticle-buttons" className="settings-btn-row" />
            <h3 className="accent-theme">{t("settings.uiScale")}</h3>
            <div className="settings-row">
              <label>{t("settings.scaleFactor")}</label>
              <input type="range" id="ui-scale" min="0.7" max="1.5" step="0.05" value="1.0" />
              <span id="ui-scale-val" className="settings-val">1.00x</span>
              <TipIcon impact="NONE" desc={t("settings.tip.uiScale")} />
            </div>
            <h3 className="accent-theme">{t("settings.fontScale")}</h3>
            <div className="settings-row">
              <label>{t("settings.scaleFactor")}</label>
              <input type="range" id="font-scale" min="0.7" max="1.6" step="0.05" value="1.0" />
              <span id="font-scale-val" className="settings-val">1.00x</span>
              <TipIcon impact="NONE" desc={t("settings.tip.fontScale")} />
            </div>
            <h3 className="accent-theme">{t("settings.language")}</h3>
            <div className="settings-row">
              <label>{t("settings.language")}</label>
              <select id="settings-language" className="settings-select">
                <option value="en">{t("settings.option.en")}</option>
                <option value="es">{t("settings.option.es")}</option>
              </select>
            </div>
          </div>

          <div className="settings-tab-panel" data-tab-panel="controls">
            <h3 className="accent-controls">{t("settings.tab.controls")}</h3>
            <div className="settings-row movement-mode-row">
              <label>{t("settings.movementMode")}</label>
              <div id="movement-mode-buttons" className="movement-mode-grid" />
              <TipIcon impact="NONE" desc={t("settings.tip.movementMode")} />
            </div>
            <div id="keybind-list" />
          </div>
        </div>
      </div>
      <div className="win-foot" id="settings-footer">
        <button type="button" id="settings-exit" className="settings-icon-btn">← {t("common.exit")}</button>
        <button type="button" id="settings-reset" className="settings-icon-btn">⟳ {t("settings.reset")}</button>
        <button type="button" id="settings-save" className="settings-icon-btn save">✓ {t("common.save")}</button>
      </div>
    </>
  );
}

export function SettingsPanelView({
  title,
  subtitle,
  className = "window",
  showChromeButtons = true,
}: SettingsPanelViewProps) {
  return (
    <div id="settings-panel" className={className}>
      <div className="win-head">
        {subtitle ? (
          <>
            <span className="win-title">{title}</span>
            <span className="win-sub">{subtitle}</span>
          </>
        ) : (
          <div className="win-title">{title}</div>
        )}
        {showChromeButtons ? <WindowHeadButtonsView /> : null}
      </div>
      <SettingsContentView />
    </div>
  );
}
