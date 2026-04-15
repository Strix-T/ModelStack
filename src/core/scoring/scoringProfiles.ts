import type { UserIntent } from "../shared/types.js";

export type BundleScoringWeights = {
  speed: number;
  quality: number;
  local: number;
  simplicity: number;
};

/** Returns normalized-ish weights (sum ~1 for first three; simplicity applied as multiplier layer). */
export function getBundleScoringWeights(intent: UserIntent): BundleScoringWeights {
  let speed = 0.4;
  let quality = 0.45;
  let local = 0.15;
  let simplicity = 0.12;

  if (intent.priority === "speed") {
    speed = 0.52;
    quality = 0.33;
    local = 0.15;
  } else if (intent.priority === "quality") {
    speed = 0.28;
    quality = 0.57;
    local = 0.15;
  }

  if (intent.primaryUseCases.includes("coding") || intent.primaryUseCases.includes("agents")) {
    quality += 0.03;
    speed -= 0.03;
  }

  if (intent.primaryUseCases.includes("documents") || intent.primaryUseCases.includes("reranking")) {
    quality += 0.02;
    speed -= 0.02;
  }

  if (intent.installComfort === "simple") {
    simplicity = 0.22;
    speed -= 0.04;
    quality -= 0.04;
    local += 0.08;
  } else if (intent.installComfort === "advanced") {
    simplicity = 0.05;
    quality += 0.02;
    speed += 0.02;
    local -= 0.04;
  }

  const sum = speed + quality + local;
  return {
    speed: speed / sum,
    quality: quality / sum,
    local: local / sum,
    simplicity: simplicity,
  };
}
