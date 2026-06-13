import { buildDockHeaderHTML } from "../hud/window-chrome.js";
import { t } from "../../utils/i18n.js";

export interface PilotTerminalViewProps {
  title: string;
  subtitle?: string;
  embedded?: boolean;
  dashboardHtml?: string;
  showConsole: boolean;
  showAbort: boolean;
  abortLabel: string;
  onAbort?: () => void;
}

export function PilotTerminalView({
  title,
  subtitle,
  dashboardHtml,
  showConsole,
  showAbort,
  abortLabel,
  onAbort,
}: PilotTerminalViewProps) {
  return (
    <>
      <div class="pilot-terminal-corners" aria-hidden="true">
        <div class="pt-corner tl"></div>
        <div class="pt-corner tr"></div>
        <div class="pt-corner bl"></div>
        <div class="pt-corner br"></div>
      </div>
      <header class="pilot-terminal-header">
        <span class="pilot-terminal-title">{title}</span>
        {subtitle ? <span class="pilot-terminal-subtitle">{subtitle}</span> : null}
      </header>
      <div class="pilot-terminal-body">
        <section class="pilot-terminal-dashboard" aria-label="Dashboard">
          <span class="pilot-terminal-dashboard-label">{t("pilotTerminal.pilotInterface")}</span>
          <div class="pilot-terminal-status-line" data-pilot-status></div>
          <div
            class="pilot-terminal-dashboard-main"
            data-pilot-dashboard
            dangerouslySetInnerHTML={{ __html: dashboardHtml ?? "" }}
          ></div>
          {showAbort ? (
            <div class="pilot-terminal-actions">
              <button type="button" class="btn-pilot-danger" data-pilot-abort onClick={onAbort}>
                {abortLabel}
              </button>
            </div>
          ) : null}
        </section>
        {showConsole ? (
          <section class="pilot-terminal-console-wrap" aria-label={t("pilotTerminal.systemConsole")}>
            <div
              class="hud-dock-header"
              dangerouslySetInnerHTML={{ __html: buildDockHeaderHTML(t("pilotTerminal.systemConsole")) }}
            ></div>
            <div class="pilot-terminal-console-entries" data-pilot-console></div>
          </section>
        ) : null}
      </div>
    </>
  );
}
