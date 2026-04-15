import type { UserIntent } from "../../src/core/shared/types.js";

/** Full intent object for tests (matches `userIntentSchema` defaults). */
export function minimalIntent(overrides: Partial<UserIntent> = {}): UserIntent {
  return {
    primaryUseCases: ["general_chat"],
    inputTypes: ["text"],
    priority: "balanced",
    localPreference: "prefer_local",
    allowsSlowSmart: true,
    requiresEmbeddings: true,
    requiresVision: false,
    requiresImageGeneration: false,
    preferredEngine: "auto",
    installComfort: "moderate",
    formatPreference: "auto",
    contextPreference: "not_sure",
    quantizationTolerance: "balanced",
    requiresReranker: false,
    requiresOCR: false,
    requiresToolCalling: false,
    requiresLongContext: false,
    requiresSpeechToText: false,
    requiresSpeechSynthesis: false,
    ...overrides,
  };
}
