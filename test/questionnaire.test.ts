import { describe, expect, it } from "vitest";

import { normalizeAnswers } from "../src/core/questionnaire/normalizeAnswers.js";
import { runQuestionnaire } from "../src/core/questionnaire/flows.js";

describe("questionnaire normalization", () => {
  it("assumes embeddings for general chat so chat and file retrieval can be part of the stack", () => {
    const intent = normalizeAnswers({
      primaryUseCases: ["general_chat"],
      inputTypes: ["text"],
      priority: "balanced",
      localPreference: "prefer_local",
      allowsSlowSmart: true,
    });

    expect(intent.requiresEmbeddings).toBe(true);
    expect(intent.requiresVision).toBe(false);
  });

  it("marks digital documents as embedding workloads without vision", () => {
    const intent = normalizeAnswers({
      primaryUseCases: ["documents"],
      inputTypes: ["pdf_text"],
      priority: "balanced",
      localPreference: "prefer_local",
      allowsSlowSmart: true,
    });

    expect(intent.requiresEmbeddings).toBe(true);
    expect(intent.requiresVision).toBe(false);
  });

  it("does not require vision for text-to-image only workflows", () => {
    const intent = normalizeAnswers({
      primaryUseCases: ["image_generation"],
      inputTypes: ["text"],
      priority: "balanced",
      localPreference: "prefer_local",
      allowsSlowSmart: true,
    });

    expect(intent.requiresImageGeneration).toBe(true);
    expect(intent.requiresVision).toBe(false);
  });

  it("marks vision_understanding as requiring vision", () => {
    const intent = normalizeAnswers({
      primaryUseCases: ["vision_understanding"],
      inputTypes: ["text"],
      priority: "balanced",
      localPreference: "prefer_local",
      allowsSlowSmart: true,
    });

    expect(intent.requiresVision).toBe(true);
  });

  it("marks scanned documents as vision workloads", () => {
    const intent = normalizeAnswers({
      primaryUseCases: ["documents", "vision_understanding"],
      inputTypes: ["pdf_scanned"],
      priority: "quality",
      localPreference: "local_only",
      allowsSlowSmart: false,
    });

    expect(intent.requiresEmbeddings).toBe(true);
    expect(intent.requiresVision).toBe(true);
  });

  it("supports deterministic non-interactive questionnaire runs via env", async () => {
    process.env.MODELSTACK_INTENT_JSON = JSON.stringify({
      primaryUseCases: ["general_chat"],
      inputTypes: ["text"],
      priority: "speed",
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
    });

    const intent = await runQuestionnaire();
    delete process.env.MODELSTACK_INTENT_JSON;

    expect(intent.priority).toBe("speed");
    expect(intent.primaryUseCases).toEqual(["general_chat"]);
  });
});
