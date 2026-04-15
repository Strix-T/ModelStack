import type { RecommendedBundle } from "../core/shared/types.js";

/** Heuristic for prompting before large Ollama pulls (desktop + CLI). */
export function isLargeDownloadRisk(bundle: RecommendedBundle): boolean {
  if (bundle.textModel?.parameterClass === "large") {
    return true;
  }
  if (bundle.estimatedPeakRamGb >= 10) {
    return true;
  }
  return false;
}
