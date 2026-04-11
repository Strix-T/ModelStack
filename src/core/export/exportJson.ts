import type { RecommendationResult } from "../shared/types.js";

export function exportJson(result: RecommendationResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
