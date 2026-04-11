import type { CandidateModel, UserIntent } from "../shared/types.js";

export function getQualityScore(candidate: CandidateModel, intent: UserIntent): number {
  let taskBonus = 0;
  if (intent.primaryUseCases.includes("coding") && candidate.tasks.includes("coding")) {
    taskBonus += 0.2;
  }
  if (intent.primaryUseCases.includes("documents") && candidate.tasks.includes("documents")) {
    taskBonus += 0.15;
  }
  if (intent.requiresVision && candidate.kind === "vision") {
    taskBonus += 0.2;
  }
  if (intent.requiresImageGeneration && candidate.kind === "image") {
    taskBonus += 0.2;
  }

  return Math.min(1, candidate.qualityTier / 5 + taskBonus);
}
