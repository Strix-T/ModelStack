import type { CandidateModel, UserIntent } from "../shared/types.js";

export function getPreferenceMultiplier(candidate: CandidateModel, intent: UserIntent): number {
  let multiplier = 1;

  if (intent.priority === "speed") {
    multiplier += (candidate.speedTier - candidate.qualityTier) * 0.08;
  } else if (intent.priority === "quality") {
    multiplier += (candidate.qualityTier - candidate.speedTier) * 0.08;
  }

  if (intent.localPreference === "prefer_local" && candidate.localFriendly) {
    multiplier += 0.1;
  }

  if (intent.localPreference === "local_only" && candidate.localFriendly) {
    multiplier += 0.15;
  }

  if (!intent.allowsSlowSmart && candidate.speedTier < candidate.qualityTier) {
    multiplier -= 0.1;
  }

  if (intent.requiresLongContext && (candidate.contextWindow ?? 0) >= 32000) {
    multiplier += 0.08;
  }

  return Math.max(0.4, multiplier);
}
