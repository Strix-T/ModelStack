import type { CandidateModel, SystemProfile, UserIntent } from "../shared/types.js";

function taskMatches(candidate: CandidateModel, intent: UserIntent): boolean {
  if (candidate.kind === "embedding") {
    return intent.requiresEmbeddings;
  }
  if (candidate.kind === "vision") {
    return intent.requiresVision;
  }
  if (candidate.kind === "image") {
    return intent.requiresImageGeneration;
  }

  if (intent.primaryUseCases.includes("coding")) {
    return candidate.tasks.includes("coding") || candidate.tasks.includes("text_generation");
  }

  return candidate.tasks.includes("text_generation") || candidate.tasks.includes("general_chat");
}

function availableRamBudget(system: SystemProfile): number {
  return system.ramGb;
}

function availableVramBudget(system: SystemProfile): number {
  return system.gpuVramGb ?? system.unifiedMemoryGb ?? 0;
}

/**
 * Soft penalty factor when recommended RAM is tight against free memory (does not affect hard eligibility).
 */
export function practicalRamHeadroomFactor(candidate: CandidateModel, system: SystemProfile): number {
  const free = Math.max(system.freeRamGb ?? system.ramGb, 1);
  const rec = candidate.memoryProfile.recommendedRamGb;
  if (rec > free) {
    return 0.78;
  }
  if (rec > free * 0.95) {
    return 0.9;
  }
  return 1;
}

export function isCandidateEligible(candidate: CandidateModel, system: SystemProfile, intent: UserIntent): boolean {
  if (candidate.gated) {
    return false;
  }

  if (!taskMatches(candidate, intent) && candidate.kind !== "text") {
    return false;
  }

  if (intent.localPreference === "local_only" && !candidate.localFriendly) {
    return false;
  }

  if (candidate.memoryProfile.minRamGb > availableRamBudget(system)) {
    return false;
  }

  if (candidate.memoryProfile.minVramGb && candidate.memoryProfile.minVramGb > availableVramBudget(system)) {
    return false;
  }

  return true;
}
