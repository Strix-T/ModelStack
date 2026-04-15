export const PRIMARY_USE_CASE_OPTIONS = [
  { value: "general_chat", label: "General chat" },
  { value: "writing", label: "Writing" },
  { value: "coding", label: "Coding" },
  { value: "documents", label: "Research and documents" },
  { value: "vision_understanding", label: "Screenshots, photos, or scanned PDFs (general)" },
  { value: "scanned_documents", label: "Scanned documents (reading text from photos or scans)" },
  { value: "screenshots", label: "Screenshots (apps, websites, menus)" },
  { value: "photos", label: "Photos / visual understanding" },
  { value: "image_generation", label: "Image generation" },
  { value: "speech_to_text", label: "Voice transcription" },
  { value: "text_to_speech", label: "Voice responses (computer reads text aloud)" },
  { value: "agents", label: "AI that uses tools for you (e.g., files, browsing, plugins)" },
  { value: "reranking", label: "Search your notes or files (best matches first)" },
] as const;

export const INPUT_TYPE_OPTIONS = [
  { value: "text", label: "Just text" },
  { value: "pdf_text", label: "Documents or digital PDFs" },
  { value: "screenshots", label: "Screenshots or photos" },
  { value: "code", label: "Code files" },
  { value: "mixed", label: "A mix" },
] as const;

export const PDF_OPTIONS = [
  { value: "pdf_text", label: "Mostly selectable text" },
  { value: "pdf_scanned", label: "Mostly scanned pages or images" },
  { value: "both", label: "Both or not sure" },
] as const;

/** Stored values match `userIntentSchema.localPreference`; labels are for people new to “local AI.” */
export const LOCAL_PREFERENCE_OPTIONS = [
  {
    value: "local_only" as const,
    label: "Keep it simple on my computer",
    hint: "Only suggest models that are usually easy to run on your own machine. We skip heavier or fussier options.",
  },
  {
    value: "prefer_local" as const,
    label: "Favor what runs well here, but stay flexible",
    hint: "We still lean toward straightforward setups, but we may suggest something stronger if your hardware can handle it.",
  },
  {
    value: "no_preference" as const,
    label: "Don’t prioritize that — focus on the best fit",
    hint: "We won’t extra-favor “easy” setups. Better if you’re comfortable adjusting memory, drivers, or install steps.",
  },
] as const;

export type LocalPreferenceValue = (typeof LOCAL_PREFERENCE_OPTIONS)[number]["value"];

export function describeLocalPreference(value: LocalPreferenceValue): string {
  const match = LOCAL_PREFERENCE_OPTIONS.find((opt) => opt.value === value);
  return match ? match.label : value;
}

export const PREFERRED_ENGINE_OPTIONS = [
  { value: "auto", label: "Recommend for me" },
  { value: "ollama", label: "Ollama" },
  { value: "llamacpp", label: "llama.cpp" },
  { value: "lm_studio", label: "LM Studio" },
  { value: "transformers", label: "Transformers / Python" },
  { value: "vllm", label: "vLLM" },
  { value: "mlx", label: "MLX / Apple Silicon" },
] as const;

export const INSTALL_COMFORT_OPTIONS = [
  { value: "simple", label: "Simplest setup possible" },
  { value: "moderate", label: "Fine with a little setup" },
  { value: "advanced", label: "Comfortable with advanced setup" },
] as const;

export const FORMAT_PREFERENCE_OPTIONS = [
  { value: "auto", label: "No preference" },
  { value: "gguf", label: "Prefer GGUF" },
  { value: "safetensors", label: "Prefer Safetensors" },
  { value: "onnx", label: "Prefer ONNX" },
] as const;

export const CONTEXT_PREFERENCE_OPTIONS = [
  { value: "not_sure", label: "Not sure" },
  { value: "standard", label: "Standard context windows" },
  { value: "long_context", label: "Long-context chat or large docs" },
] as const;

export const QUANTIZATION_TOLERANCE_OPTIONS = [
  { value: "prefer_quality", label: "Prefer quality (heavier quant / fp)" },
  { value: "balanced", label: "Balanced" },
  { value: "prefer_efficiency", label: "Prefer efficiency (smaller quant)" },
] as const;
