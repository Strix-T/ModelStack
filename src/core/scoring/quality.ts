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
  if (intent.requiresReranker && candidate.kind === "reranker") {
    taskBonus += 0.22;
  }
  if (intent.requiresSpeechToText && candidate.kind === "speech_to_text") {
    taskBonus += 0.18;
  }
  if (intent.requiresSpeechSynthesis && candidate.kind === "text_to_speech") {
    taskBonus += 0.18;
  }
  if (intent.primaryUseCases.includes("agents") && (candidate.toolUseSupport === "strong" || candidate.tasks.some((t) => t.includes("tool")))) {
    taskBonus += 0.12;
  }

  return Math.min(1, candidate.qualityTier / 5 + taskBonus);
}
