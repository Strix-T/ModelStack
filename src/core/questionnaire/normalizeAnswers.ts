import { userIntentSchema } from "../shared/schemas.js";
import type { UserIntent } from "../shared/types.js";

export type QuestionnaireAnswers = {
  primaryUseCases: UserIntent["primaryUseCases"];
  inputTypes: Array<"text" | "pdf_text" | "pdf_scanned" | "screenshots" | "photos" | "code">;
  priority: UserIntent["priority"];
  localPreference: UserIntent["localPreference"];
  allowsSlowSmart: boolean;
};

export function normalizeAnswers(answers: QuestionnaireAnswers): UserIntent {
  const inputTypes = [...answers.inputTypes];
  const assumesChatAndFileRetrieval =
    answers.primaryUseCases.some((useCase) =>
      ["general_chat", "writing", "coding", "documents"].includes(useCase),
    ) ||
    inputTypes.some((inputType) => ["text", "pdf_text", "pdf_scanned", "code"].includes(inputType));

  const requiresEmbeddings =
    assumesChatAndFileRetrieval ||
    answers.primaryUseCases.includes("documents") ||
    inputTypes.includes("pdf_text") ||
    inputTypes.includes("pdf_scanned");

  const requiresVision =
    answers.primaryUseCases.includes("vision_understanding") ||
    inputTypes.includes("pdf_scanned") ||
    inputTypes.includes("screenshots") ||
    inputTypes.includes("photos");

  const requiresImageGeneration = answers.primaryUseCases.includes("image_generation");

  return userIntentSchema.parse({
    ...answers,
    inputTypes,
    requiresEmbeddings,
    requiresVision,
    requiresImageGeneration,
  });
}
