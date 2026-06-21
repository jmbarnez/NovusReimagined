/**
 * Player mission contract and station offer accessors.
 */
import { _G, type Player } from "../../../../state.js";
import type { MissionContract } from "../../../../data/missions.js";

export const playerContractsAccess = {
  setContracts(contracts: Player["contracts"], p: Player = _G.P) {
    p.contracts = contracts;
  },

  setStationOffers(offers: Player["stationOffers"], stationId: string | null, p: Player = _G.P) {
    p.stationOffers = offers;
    p.stationOfferStationId = stationId;
  },

  addContract(contract: MissionContract, p: Player = _G.P) {
    p.contracts.push(contract);
  },

  removeContract(index: number, p: Player = _G.P) {
    p.contracts.splice(index, 1);
  },
};
