import { candidateModelSchema } from "../shared/schemas.js";
import type { CandidateModel } from "../shared/types.js";
import { inferDiscoveryConfidenceFromHfItem, inferTasksFromHfItem } from "./inferTasks.js";
import { parseRepoFiles } from "./parseRepoFiles.js";
import type { HfModelListItem } from "./types.js";

function inferParameterClass(modelId: string): "small" | "medium" | "large" {
  const id = modelId.toLowerCase();
  if (/\b(0\.5|1|2|3|4)b\b/.test(id)) {
    return "small";
  }
  if (/\b(6|7|8|9|10)b\b/.test(id)) {
    return "medium";
  }
  return "large";
}

function inferRuntime(item: HfModelListItem): CandidateModel["runtime"] {
  const { formats } = parseRepoFiles(item.siblings);
  const runtimes = new Set<CandidateModel["runtime"][number]>();

  if (formats.includes("gguf")) {
    runtimes.add("llamacpp");
    runtimes.add("ollama");
  }

  if (formats.includes("safetensors") || item.library_name?.includes("transformers")) {
    runtimes.add("transformers");
  }

  if (item.tags?.some((tag) => tag.includes("ollama"))) {
    runtimes.add("ollama");
  }

  if (runtimes.size === 0) {
    runtimes.add("other");
  }

  return [...runtimes];
}

function estimateMemoryProfile(kind: CandidateModel["kind"], parameterClass: CandidateModel["parameterClass"], largestFileGb?: number) {
  const baseRam =
    kind === "embedding"
      ? 4
      : kind === "reranker"
        ? 5
        : kind === "speech_to_text"
          ? 7
          : kind === "text_to_speech"
            ? 8
            : parameterClass === "small"
              ? 8
              : parameterClass === "medium"
                ? 14
                : 22;
  const largest = largestFileGb ?? baseRam;
  const minFloor =
    kind === "embedding" ? 2 : kind === "reranker" ? 3 : kind === "speech_to_text" ? 4 : kind === "text_to_speech" ? 4 : 6;
  return {
    minRamGb: Math.max(minFloor, Math.min(baseRam, largest)),
    recommendedRamGb: Math.max(baseRam + 2, Math.ceil(largest + 2)),
    minVramGb:
      kind === "image" || kind === "vision" ? Math.max(6, Math.ceil((largestFileGb ?? baseRam) / 2)) : undefined,
    recommendedVramGb:
      kind === "image" || kind === "vision" ? Math.max(8, Math.ceil((largestFileGb ?? baseRam) * 0.75)) : undefined,
  };
}

export function parseHfModelToCandidate(item: HfModelListItem, kind: CandidateModel["kind"]): CandidateModel {
  const { formats, largestFileGb } = parseRepoFiles(item.siblings);
  const parameterClass = inferParameterClass(item.id);
  const memoryProfile = estimateMemoryProfile(kind, parameterClass, largestFileGb);
  const qualityTier =
    kind === "embedding" || kind === "reranker"
      ? 4
      : kind === "image"
        ? 4
        : kind === "speech_to_text" || kind === "text_to_speech"
          ? 3
          : parameterClass === "small"
            ? 3
            : parameterClass === "medium"
              ? 4
              : 5;
  const speedTier =
    kind === "embedding" || kind === "reranker"
      ? 4
      : kind === "speech_to_text" || kind === "text_to_speech"
        ? 3
        : parameterClass === "small"
          ? 4
          : parameterClass === "medium"
            ? 3
            : 2;
  const tasks = inferTasksFromHfItem(kind, item);
  const discoveryConfidence = inferDiscoveryConfidenceFromHfItem(kind, item);

  return candidateModelSchema.parse({
    id: item.id,
    kind,
    family: item.id.split("/")[0],
    runtime: inferRuntime(item),
    tasks,
    hfDownloads: typeof item.downloads === "number" ? Math.floor(item.downloads) : undefined,
    hfLikes: typeof item.likes === "number" ? Math.floor(item.likes) : undefined,
    localFriendly: formats.includes("gguf") || formats.includes("safetensors"),
    estimatedRamGb: memoryProfile.recommendedRamGb,
    estimatedVramGb: memoryProfile.recommendedVramGb,
    speedTier,
    qualityTier,
    source: "discovered",
    license: item.license,
    gated: Boolean(item.private) || Boolean(item.gated),
    formats,
    parameterClass,
    memoryProfile,
    discoveryConfidence,
    notes: ["Auto-discovered from bounded Hugging Face search."],
  });
}
