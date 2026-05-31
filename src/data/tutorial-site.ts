import type { SiteTypeDef } from "./site-types.js";
import {
  TUTORIAL_TRAINING_SITE_X,
  TUTORIAL_TRAINING_SITE_Y,
} from "./tutorial-layout.js";
import { t } from "../utils/i18n.js";

export {
  TUTORIAL_TRAINING_SITE_X,
  TUTORIAL_TRAINING_SITE_Y,
} from "./tutorial-layout.js";

/** Fixed training signature in cadet system (sys-0). */
export const TUTORIAL_TRAINING_SITE_ID = "site-sys-0-training";

export const TUTORIAL_TRAINING_SITE_TYPE: SiteTypeDef = {
  id: "tutorial-training-core",
  family: "resource",
  name: t("site.trainingDatacore"),
  scanDifficulty: 0.55,
  signatureStrength: 0.92,
  signatureSize: 0.85,
  threatLevel: 1,
  hasEncryptedContent: true,
  decryptDifficulty: 0.85,
  requiredSurveyLevel: 0,
  rewards: [
    { kind: "cargo", weight: 50, minQty: 1, maxQty: 2 },
    { kind: "encrypted_core", weight: 50, minQty: 1, maxQty: 1 },
  ],
};
