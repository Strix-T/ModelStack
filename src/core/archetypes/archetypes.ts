import type { RecommendedBundle, UserIntent } from "../shared/types.js";

const ARCHETYPES = [
  "Simple Local Chat",
  "Coding Copilot",
  "Document / RAG Stack",
  "Vision + OCR Assistant",
  "Creator Image Stack",
  "Hybrid Generalist Stack",
  "Agent / Tool Stack",
  "Voice + Transcription Stack",
] as const;

export type StackArchetypeId = (typeof ARCHETYPES)[number];

export function inferStackArchetype(intent: UserIntent, bundle: RecommendedBundle): StackArchetypeId {
  if (intent.requiresImageGeneration && bundle.imageModel) {
    return "Creator Image Stack";
  }
  if (intent.requiresSpeechToText || intent.requiresSpeechSynthesis) {
    return "Voice + Transcription Stack";
  }
  if (intent.requiresToolCalling || intent.primaryUseCases.includes("agents")) {
    return "Agent / Tool Stack";
  }
  if (intent.requiresVision || intent.requiresOCR) {
    return "Vision + OCR Assistant";
  }
  if (intent.requiresEmbeddings && (intent.primaryUseCases.includes("documents") || intent.requiresReranker)) {
    return "Document / RAG Stack";
  }
  if (intent.primaryUseCases.includes("coding")) {
    return "Coding Copilot";
  }
  if (
    intent.primaryUseCases.length >= 3 ||
    (bundle.visionModel && bundle.embeddingModel && bundle.textModel)
  ) {
    return "Hybrid Generalist Stack";
  }
  return "Simple Local Chat";
}
