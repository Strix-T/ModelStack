import { userIntentSchema } from "../shared/schemas.js";
import type { UserIntent } from "../shared/types.js";

export type QuestionnaireAnswers = {
  primaryUseCases: UserIntent["primaryUseCases"];
  inputTypes: Array<"text" | "pdf_text" | "pdf_scanned" | "screenshots" | "photos" | "code">;
  priority: UserIntent["priority"];
  localPreference: UserIntent["localPreference"];
  allowsSlowSmart: boolean;
  preferredEngine?: UserIntent["preferredEngine"];
  installComfort?: UserIntent["installComfort"];
  formatPreference?: UserIntent["formatPreference"];
  contextPreference?: UserIntent["contextPreference"];
  quantizationTolerance?: UserIntent["quantizationTolerance"];
};

export function normalizeAnswers(answers: QuestionnaireAnswers): UserIntent {
  const inputTypes = [...answers.inputTypes];
  const assumesChatAndFileRetrieval =
    answers.primaryUseCases.some((useCase) =>
      ["general_chat", "writing", "coding", "documents", "agents", "reranking"].includes(useCase),
    ) || inputTypes.some((inputType) => ["text", "pdf_text", "pdf_scanned", "code"].includes(inputType));

  const requiresEmbeddings =
    assumesChatAndFileRetrieval ||
    answers.primaryUseCases.includes("documents") ||
    answers.primaryUseCases.includes("reranking") ||
    inputTypes.includes("pdf_text") ||
    inputTypes.includes("pdf_scanned");

  const requiresVision =
    answers.primaryUseCases.includes("vision_understanding") ||
    answers.primaryUseCases.includes("scanned_documents") ||
    answers.primaryUseCases.includes("screenshots") ||
    answers.primaryUseCases.includes("photos") ||
    inputTypes.includes("pdf_scanned") ||
    inputTypes.includes("screenshots") ||
    inputTypes.includes("photos");

  const requiresImageGeneration = answers.primaryUseCases.includes("image_generation");

  const requiresReranker =
    answers.primaryUseCases.includes("reranking") || answers.primaryUseCases.includes("agents");

  const requiresOCR = answers.primaryUseCases.includes("scanned_documents") || inputTypes.includes("pdf_scanned");

  const requiresToolCalling = answers.primaryUseCases.includes("agents");

  const requiresSpeechToText = answers.primaryUseCases.includes("speech_to_text");

  const requiresSpeechSynthesis = answers.primaryUseCases.includes("text_to_speech");

  const contextPreference = answers.contextPreference ?? "not_sure";
  const requiresLongContext = contextPreference === "long_context";

  return userIntentSchema.parse({
    primaryUseCases: answers.primaryUseCases,
    inputTypes,
    priority: answers.priority,
    localPreference: answers.localPreference,
    allowsSlowSmart: answers.allowsSlowSmart,
    requiresEmbeddings,
    requiresVision,
    requiresImageGeneration,
    requiresReranker,
    requiresOCR,
    requiresToolCalling,
    requiresLongContext,
    requiresSpeechToText,
    requiresSpeechSynthesis,
    preferredEngine: answers.preferredEngine ?? "auto",
    installComfort: answers.installComfort ?? "moderate",
    formatPreference: answers.formatPreference ?? "auto",
    contextPreference,
    quantizationTolerance: answers.quantizationTolerance ?? "balanced",
  });
}
