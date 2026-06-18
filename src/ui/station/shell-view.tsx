import { t } from "../../utils/i18n.js";

const STATION_TABS = [
  { id: "hangar", labelKey: "station.hangar" },
  { id: "market", labelKey: "station.market" },
  { id: "industry", labelKey: "station.industry" },
  { id: "fabrication", labelKey: "station.fabrication" },
  { id: "missions", labelKey: "station.missions" },
] as const;

export function StationShellView() {
  return (
    <>
      <div className="st-win-head">
        <span className="st-win-meta" id="st-meta" />
        <span className="st-win-wallet"><span id="st-cr" /></span>
        <button type="button" id="st-undock" data-action="undock">
          {t("station.undock")} <kbd className="st-kbd" id="st-undock-key" />
        </button>
      </div>
      <nav id="st-tabs">
        {STATION_TABS.map((tab) => (
          <button type="button" className="st-tab" data-tab={tab.id} key={tab.id}>
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>
      <main id="st-body">
        <div className="panel" id="panel-hangar" />
        <div className="panel" id="panel-market" />
        <div className="panel panel--tool" id="panel-industry" />
        <div className="panel panel--tool" id="panel-fabrication" />
        <div className="panel" id="panel-missions" />
      </main>
      <div id="st-dimmer" />
    </>
  );
}
