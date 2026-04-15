import type { CandidateModel, EngineId, Runtime } from "../shared/types.js";

/**
 * Maps a user-facing engine to candidate `runtime` tags (HF seeds stay coarse-grained).
 */
const ENGINE_REQUIRED_RUNTIMES: Record<EngineId, Runtime[]> = {
  ollama: ["ollama"],
  llamacpp: ["llamacpp"],
  lm_studio: ["llamacpp"],
  transformers: ["transformers"],
  vllm: ["transformers"],
  mlx: ["transformers", "other"],
  other: ["ollama", "llamacpp", "transformers", "other"],
};

export function candidateSupportsEngine(candidate: CandidateModel, engine: EngineId): boolean {
  const needed = ENGINE_REQUIRED_RUNTIMES[engine];
  return needed.some((rt) => candidate.runtime.includes(rt));
}

export function formatMatchesEngine(engine: EngineId, formats: CandidateModel["formats"], preference: "auto" | "gguf" | "safetensors" | "onnx"): boolean {
  if (engine === "other") {
    return true;
  }
  if (preference === "auto") {
    return true;
  }
  const defFormats = ENGINE_REQUIRED_RUNTIMES[engine];
  void defFormats;
  if (preference === "gguf") {
    return formats.includes("gguf");
  }
  if (preference === "safetensors") {
    return formats.includes("safetensors");
  }
  if (preference === "onnx") {
    return formats.includes("onnx");
  }
  return true;
}
