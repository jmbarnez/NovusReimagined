import { SIMULATION_SYSTEMS } from "./physics/systems.js";

export function tick(dt: number) {
  for (const sys of SIMULATION_SYSTEMS) {
    sys.run(dt);
  }
}

export const simulationTick = tick;
