import { type Player } from "../../state.js";
import { PlayerAccess, getState } from "../../state-access.js";
import { emit } from "../../events.js";
import type { MissionContract } from "../../data/missions.js";
import { getDockableStation } from "../../docking/index.js";
import type { ActionResponse } from "./economy.js";

export function acceptContractAction(
  contractId: string,
  stationContracts: MissionContract[],
  p: Player = getState().player,
): ActionResponse {
  const contract = stationContracts.find(c => c.id === contractId);
  if (!contract) return { success: false, reason: "Contract not found" };
  if (p.contracts.length >= 3) {
    return { success: false, reason: "Contract limit reached" };
  }

  const accepted = { ...contract, status: "active" as const };
  PlayerAccess.addContract(accepted, p);
  if (p === getState().player) {
    emit("mission:accepted", { contract: accepted });
  }

  return { success: true, label: accepted.title };
}

export function acceptContractProposalAction(
  contract: MissionContract,
  stationId: string | null,
  p: Player = getState().player
): ActionResponse {
  if (p.contracts.length >= 3) {
    return { success: false, reason: "Contract limit reached" };
  }
  const accepted = { ...contract, status: "active" as const };
  if (stationId) accepted.stationId = stationId;
  PlayerAccess.addContract(accepted, p);

  if (p === getState().player) {
    emit("mission:accepted", { contract: accepted });
  }

  return { success: true, label: accepted.title };
}

export function turnInContractAction(contractId: string, p: Player = getState().player): ActionResponse {
  const idx = p.contracts.findIndex(c => c.id === contractId && c.status === "complete");
  if (idx === -1) return { success: false, reason: "Complete contract not found" };
  const contract = p.contracts[idx];

  if (p.stationOfferStationId !== contract.stationId || !getDockableStation(p, contract.stationId)) {
    return { success: false, reason: "Must turn in at correct station" };
  }

  PlayerAccess.modifyCredits(contract.reward, p);
  PlayerAccess.removeContract(idx, p);

  return { success: true, creditsEarned: contract.reward, label: contract.title };
}

export function abandonContractAction(contractId: string, p: Player = getState().player): ActionResponse {
  const idx = p.contracts.findIndex(c => c.id === contractId);
  if (idx === -1) return { success: false, reason: "Contract not found" };

  PlayerAccess.removeContract(idx, p);
  return { success: true };
}
