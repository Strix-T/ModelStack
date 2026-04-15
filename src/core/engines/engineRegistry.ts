import type { EngineId } from "../shared/types.js";

export type EngineDefinition = {
  id: EngineId;
  label: string;
  supportsFormats: Array<"gguf" | "safetensors" | "onnx" | "other">;
  installDifficulty: "simple" | "moderate" | "advanced";
  strengths: string[];
  weaknesses: string[];
  supportsVisionWell: boolean;
  supportsImageGenerationWell: boolean;
  goodForAppleSilicon: boolean;
  goodForWindows: boolean;
  goodForLinux: boolean;
};

export const ENGINE_DEFINITIONS: Record<EngineId, EngineDefinition> = {
  ollama: {
    id: "ollama",
    label: "Ollama",
    supportsFormats: ["gguf", "other"],
    installDifficulty: "simple",
    strengths: ["Fastest path to a working local chat model", "Simple updates and model pulls"],
    weaknesses: ["Less control than raw llama.cpp", "Model catalog depends on Ollama naming"],
    supportsVisionWell: true,
    supportsImageGenerationWell: false,
    goodForAppleSilicon: true,
    goodForWindows: true,
    goodForLinux: true,
  },
  llamacpp: {
    id: "llamacpp",
    label: "llama.cpp",
    supportsFormats: ["gguf"],
    installDifficulty: "moderate",
    strengths: ["Maximum control over GGUF builds", "Great for tight RAM tuning"],
    weaknesses: ["More CLI friction than GUI tools"],
    supportsVisionWell: true,
    supportsImageGenerationWell: false,
    goodForAppleSilicon: true,
    goodForWindows: true,
    goodForLinux: true,
  },
  lm_studio: {
    id: "lm_studio",
    label: "LM Studio",
    supportsFormats: ["gguf"],
    installDifficulty: "simple",
    strengths: ["GUI-first GGUF workflow", "Beginner-friendly"],
    weaknesses: ["Heavier app footprint", "Detection via CLI is unreliable"],
    supportsVisionWell: true,
    supportsImageGenerationWell: false,
    goodForAppleSilicon: true,
    goodForWindows: true,
    goodForLinux: true,
  },
  transformers: {
    id: "transformers",
    label: "Transformers (Python)",
    supportsFormats: ["safetensors", "onnx", "other"],
    installDifficulty: "moderate",
    strengths: ["Best multimodal and image pipelines", "Access to latest research models"],
    weaknesses: ["Python environment overhead", "VRAM/RAM spikes during load"],
    supportsVisionWell: true,
    supportsImageGenerationWell: true,
    goodForAppleSilicon: true,
    goodForWindows: true,
    goodForLinux: true,
  },
  vllm: {
    id: "vllm",
    label: "vLLM",
    supportsFormats: ["safetensors"],
    installDifficulty: "advanced",
    strengths: ["Strong throughput on capable NVIDIA Linux servers"],
    weaknesses: ["Not a typical laptop workflow", "Expect Docker or a careful CUDA setup"],
    supportsVisionWell: false,
    supportsImageGenerationWell: false,
    goodForAppleSilicon: false,
    goodForWindows: false,
    goodForLinux: true,
  },
  mlx: {
    id: "mlx",
    label: "MLX (Apple Silicon)",
    supportsFormats: ["safetensors", "other"],
    installDifficulty: "moderate",
    strengths: ["Efficient on Apple Silicon", "Good fit for Mac-native stacks"],
    weaknesses: ["macOS + Apple Silicon only", "Smaller model catalog than Ollama"],
    supportsVisionWell: true,
    supportsImageGenerationWell: true,
    goodForAppleSilicon: true,
    goodForWindows: false,
    goodForLinux: false,
  },
  other: {
    id: "other",
    label: "Other / mixed",
    supportsFormats: ["gguf", "safetensors", "onnx", "other"],
    installDifficulty: "advanced",
    strengths: ["Fallback when no single engine fits"],
    weaknesses: ["You will need to verify runtime details manually"],
    supportsVisionWell: true,
    supportsImageGenerationWell: true,
    goodForAppleSilicon: true,
    goodForWindows: true,
    goodForLinux: true,
  },
};

export function getEngineDefinition(engine: EngineId): EngineDefinition {
  return ENGINE_DEFINITIONS[engine];
}
