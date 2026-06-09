import { getState } from "../../state-access.js";
import { buildTutorialCtx } from "../data/helpers.js";
import { snapshot } from "./snapshot.js";

export function nowSec(): number {
  return Date.now() / 1000;
}

export function buildCtx() {
  const p = getState().player;
  return buildTutorialCtx(nowSec(), p.tutorial.stepEnteredAt ?? nowSec(), snapshot, p);
}
