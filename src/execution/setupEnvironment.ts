import fs from "node:fs/promises";
import path from "node:path";

import type { RecommendationResult, RecommendedBundle } from "../core/shared/types.js";

export type ProjectConfigV1 = {
  version: 1;
  generatedAt: string;
  bundleLabel: RecommendedBundle["label"];
  recommendedEngine: RecommendedBundle["recommendedEngine"];
  fallbackEngine: RecommendedBundle["fallbackEngine"];
  loadStrategy: RecommendedBundle["loadStrategy"];
  models: {
    text?: string;
    embedding?: string;
    vision?: string;
    image?: string;
    reranker?: string;
    speechToText?: string;
    textToSpeech?: string;
  };
  intentSnapshot: {
    primaryUseCases: RecommendationResult["intent"]["primaryUseCases"];
    requiresEmbeddings: boolean;
    requiresVision: boolean;
    requiresImageGeneration: boolean;
    priority: RecommendationResult["intent"]["priority"];
  };
  selectedTextVariantId?: string;
};

function buildConfig(result: RecommendationResult, bundle: RecommendedBundle): ProjectConfigV1 {
  return {
    version: 1,
    generatedAt: result.generatedAt,
    bundleLabel: bundle.label,
    recommendedEngine: bundle.recommendedEngine,
    fallbackEngine: bundle.fallbackEngine,
    loadStrategy: bundle.loadStrategy,
    models: {
      text: bundle.textModel?.id,
      embedding: bundle.embeddingModel?.id,
      vision: bundle.visionModel?.id,
      image: bundle.imageModel?.id,
      reranker: bundle.rerankerModel?.id,
      speechToText: bundle.speechToTextModel?.id,
      textToSpeech: bundle.textToSpeechModel?.id,
    },
    intentSnapshot: {
      primaryUseCases: result.intent.primaryUseCases,
      requiresEmbeddings: result.intent.requiresEmbeddings,
      requiresVision: result.intent.requiresVision,
      requiresImageGeneration: result.intent.requiresImageGeneration,
      priority: result.intent.priority,
    },
    selectedTextVariantId: bundle.selectedTextVariant?.variantId,
  };
}

export async function setupProjectEnvironment(
  projectDir: string,
  result: RecommendationResult,
  bundle: RecommendedBundle,
): Promise<{ configPath: string }> {
  const dirs = ["models", "data", "documents", "images"];
  await fs.mkdir(projectDir, { recursive: true });
  for (const d of dirs) {
    await fs.mkdir(path.join(projectDir, d), { recursive: true });
  }

  const config = buildConfig(result, bundle);
  const configPath = path.join(projectDir, "config.json");
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { configPath };
}
