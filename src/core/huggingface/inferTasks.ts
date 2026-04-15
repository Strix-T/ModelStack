import type { CandidateModel } from "../shared/types.js";
import type { HfModelListItem } from "./types.js";

function tagSet(item: HfModelListItem): Set<string> {
  return new Set((item.tags ?? []).map((t) => t.toLowerCase()));
}

export function inferTasksFromHfItem(kind: CandidateModel["kind"], item: HfModelListItem): string[] {
  const tags = tagSet(item);
  const id = item.id.toLowerCase();
  const pipeline = (item.pipeline_tag ?? "").toLowerCase();

  if (kind === "embedding") {
    const tasks = new Set<string>(["embeddings", "documents"]);
    if (tags.has("sentence-similarity") || pipeline.includes("sentence")) {
      tasks.add("general_chat");
    }
    return [...tasks];
  }

  if (kind === "vision") {
    const tasks = new Set<string>(["vision", "screenshots", "photos"]);
    if (tags.has("document-understanding") || id.includes("doc") || id.includes("ocr")) {
      tasks.add("documents");
    }
    return [...tasks];
  }

  if (kind === "image") {
    return ["text_to_image"];
  }

  if (kind === "reranker") {
    return ["reranking", "documents"];
  }

  if (kind === "speech_to_text") {
    return ["speech_to_text"];
  }

  if (kind === "text_to_speech") {
    return ["text_to_speech"];
  }

  const tasks = new Set<string>(["text_generation", "general_chat"]);

  if (id.includes("coder") || tags.has("code") || tags.has("coding")) {
    tasks.add("coding");
  }
  if (id.includes("instruct") || tags.has("instruction-tuned") || tags.has("chat")) {
    tasks.add("writing");
  }
  if (tags.has("rag") || tags.has("document-question-answering") || tags.has("retrieval")) {
    tasks.add("documents");
  }
  if (pipeline.includes("text-generation") && (tags.has("conversational") || id.includes("chat"))) {
    tasks.add("writing");
  }
  if (id.includes("rerank") || pipeline.includes("rerank")) {
    tasks.add("reranking");
  }
  if (pipeline.includes("automatic-speech-recognition") || id.includes("whisper")) {
    tasks.add("speech_to_text");
  }
  if (pipeline.includes("text-to-speech") || id.includes("tts")) {
    tasks.add("text_to_speech");
  }
  if (tags.has("tool") || id.includes("tool") || id.includes("function")) {
    tasks.add("tool_use");
  }

  return [...tasks];
}

export function inferDiscoveryConfidenceFromHfItem(kind: CandidateModel["kind"], item: HfModelListItem): CandidateModel["discoveryConfidence"] {
  const tags = item.tags ?? [];
  const hasPipeline = Boolean(item.pipeline_tag);
  const hasTags = tags.length > 0;
  const id = item.id.toLowerCase();

  if (kind === "text") {
    const strongSignal =
      hasPipeline ||
      hasTags ||
      id.includes("instruct") ||
      id.includes("coder") ||
      id.includes("chat");
    if (strongSignal && hasTags) {
      return "high";
    }
    if (strongSignal) {
      return "medium";
    }
  }

  if (hasPipeline && hasTags) {
    return "high";
  }
  if (hasPipeline || hasTags) {
    return "medium";
  }
  return "low";
}
