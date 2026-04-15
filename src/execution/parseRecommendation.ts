import { recommendationResultSchema } from "../core/shared/schemas.js";
import type { RecommendationResult } from "../core/shared/types.js";

export type ParseRecommendationResult =
  | { ok: true; data: RecommendationResult }
  | { ok: false; error: string; details?: string };

export function parseRecommendationResultJson(raw: string): ParseRecommendationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That file is not valid JSON. Save output from `modelstack recommend --json` and try again." };
  }

  const parsedResult = recommendationResultSchema.safeParse(parsed);
  if (!parsedResult.success) {
    const details =
      process.env.MODELSTACK_DEBUG === "1" ? JSON.stringify(parsedResult.error.format(), null, 2) : undefined;
    return {
      ok: false,
      error: "This JSON is not a ModelStack recommendation export. Re-run `modelstack recommend --json` and use that file.",
      details,
    };
  }

  return { ok: true, data: parsedResult.data };
}
