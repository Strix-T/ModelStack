import { getEngineDefinition } from "../engines/engineRegistry.js";
import type { CandidateModel, CandidateVariant, EngineId } from "../shared/types.js";

export type InstallParts = {
  textModel?: CandidateModel;
  embeddingModel?: CandidateModel;
  visionModel?: CandidateModel;
  imageModel?: CandidateModel;
  rerankerModel?: CandidateModel;
};

export function buildInstallSteps(engine: EngineId, parts: InstallParts, textVariant?: CandidateVariant): string[] {
  const def = getEngineDefinition(engine);
  const steps: string[] = [];

  switch (engine) {
    case "ollama":
      steps.push("Install Ollama from https://ollama.com if it is not already installed.");
      if (textVariant?.deployHint?.startsWith("ollama pull")) {
        steps.push(`Pull the primary model: \`${textVariant.deployHint}\`.`);
      } else if (parts.textModel) {
        steps.push(`Run \`ollama pull <tag>\` for ${parts.textModel.id} using an official or community tag that matches your quantization needs.`);
      }
      break;
    case "llamacpp":
      steps.push("Install llama.cpp and download a matching GGUF for your text model.");
      if (parts.textModel) {
        steps.push(`Point llama.cpp at a GGUF build of ${parts.textModel.id}; verify context size flags match your goals.`);
      }
      break;
    case "lm_studio":
      steps.push("Install LM Studio, download a GGUF in the Models UI, then load it in the Chat or Server tab.");
      if (parts.textModel) {
        steps.push(`Search for ${parts.textModel.id} or an equivalent GGUF conversion compatible with your hardware.`);
      }
      break;
    case "transformers":
      steps.push("Create a Python 3.10+ virtual environment and install `torch` plus `transformers` (and `accelerate` if helpful).");
      if (parts.textModel) {
        steps.push(`Load ${parts.textModel.id} with Transformers; prefer safetensors weights when available.`);
      }
      break;
    case "vllm":
      steps.push("vLLM is advanced: use Linux + NVIDIA CUDA, Docker, and the upstream vLLM quickstart.");
      if (parts.textModel) {
        steps.push(`Serve ${parts.textModel.id} with a vLLM-compatible HF repo and watch GPU memory headroom.`);
      }
      break;
    case "mlx":
      steps.push("On Apple Silicon, install MLX (`pip install mlx mlx-lm`) and follow MLX model examples.");
      if (parts.textModel) {
        steps.push(`Convert or obtain an MLX-compatible weight set for ${parts.textModel.id} when available.`);
      }
      break;
    default:
      steps.push("Verify the runtime each model expects (GGUF vs safetensors) and follow the upstream project README.");
  }

  steps.push(`${def.label}: ${def.strengths[0] ?? "See documentation for setup."}`);

  if (parts.embeddingModel) {
    steps.push(
      `Keep embeddings fixed on ${parts.embeddingModel.id}; rebuilding indexes is required if you change embedding models.`,
    );
  }
  if (parts.visionModel) {
    steps.push(`Load ${parts.visionModel.id} on demand for screenshots and scanned PDFs to save RAM.`);
  }
  if (parts.imageModel) {
    steps.push(`Image generation with ${parts.imageModel.id} will spike VRAM or unified memory; close other GPU apps first.`);
  }
  if (parts.rerankerModel) {
    steps.push(`Wire ${parts.rerankerModel.id} after retrieval; it is optional but improves ranking quality.`);
  }

  return steps;
}
