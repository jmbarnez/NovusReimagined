import { PlayerAccess, getState } from "../../state-access.js";
import { generateContractsForStation, type MissionContract } from "../../data/missions.js";
import { getAvailableTutorialMissionOffers } from "../../tutorial/data/mission.js";
import type { Player } from "../../state.js";

export function refreshStationOffers(p: Player, stationId: string | null): void {
  if (!stationId) {
    PlayerAccess.setStationOffers([], null, p);
    return;
  }
  const sys = getState().GALAXY[p.sysIdx];
  const station = sys?.stations.find((st) => st.id === stationId) ?? null;
  if (!station) {
    PlayerAccess.setStationOffers([], null, p);
    return;
  }

  if (p.tutorial?.active && !p.tutorial.completed && !p.tutorial.skipped) {
    const offers: MissionContract[] = getAvailableTutorialMissionOffers(p);
    PlayerAccess.setStationOffers(offers, station.id, p);
    return;
  }

  const ring = sys?.ring ?? 0;
  const offers: MissionContract[] = generateContractsForStation(station, p.sysIdx, ring);
  PlayerAccess.setStationOffers(offers, station.id, p);
}
