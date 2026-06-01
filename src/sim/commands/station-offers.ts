import { PlayerAccess, getState } from "../../state-access.js";
import { generateContractsForStation, type MissionContract } from "../../data/missions.js";
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
  const ring = sys?.ring ?? 0;
  const offers: MissionContract[] = generateContractsForStation(station, p.sysIdx, ring);
  PlayerAccess.setStationOffers(offers, station.id, p);
}
