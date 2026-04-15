export const CACHE_VERSION = 2;
export const APP_NAME = "modelstack";
export const DEFAULT_DISCOVERY_LIMIT = 3;
export const DEFAULT_HF_TIMEOUT_MS = 10_000;
export const RECOMMENDATION_LABELS = [
  "best_overall",
  "fastest",
  "best_quality",
  "most_local_friendly",
] as const;

export const HARDWARE_BANDS = ["tiny", "small", "medium", "large", "xlarge"] as const;

export const SUPPORTED_OSES = ["macos", "windows", "linux"] as const;
export const SUPPORTED_RUNTIMES = ["ollama", "llamacpp", "transformers", "other"] as const;
/** Deployment engines shown to users; distinct from candidate `runtime` compatibility hints. */
export const SUPPORTED_ENGINES = [
  "ollama",
  "llamacpp",
  "lm_studio",
  "transformers",
  "vllm",
  "mlx",
  "other",
] as const;

export const USER_PREFERRED_ENGINES = [
  "auto",
  "ollama",
  "llamacpp",
  "lm_studio",
  "transformers",
  "vllm",
  "mlx",
] as const;

export const SUPPORTED_GPU_BACKENDS = ["metal", "cuda", "rocm", "directml", "unknown"] as const;

export const MODEL_KIND_LABELS = {
  text: "Text Model",
  embedding: "Embedding Model",
  vision: "Vision Model",
  image: "Image Model",
  reranker: "Reranker Model",
  speech_to_text: "Speech-to-Text Model",
  text_to_speech: "Text-to-Speech Model",
} as const;
