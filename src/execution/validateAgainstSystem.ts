import type { RecommendedBundle, SystemProfile } from "../core/shared/types.js";

export type BundleValidationResult =
  | { ok: true }
  | { ok: false; userMessage: string };

function ramBudgetGb(system: SystemProfile): number {
  return system.freeRamGb ?? system.ramGb * 0.88;
}

function vramBudgetGb(system: SystemProfile): number {
  if (system.unifiedMemoryGb !== undefined) {
    return system.unifiedMemoryGb * 0.78;
  }
  return system.gpuVramGb ?? 0;
}

/**
 * Re-check the live machine against a frozen recommendation bundle.
 * Conservative: uses free RAM when known so apply fails fast before large downloads.
 */
export function validateBundleAgainstSystem(bundle: RecommendedBundle, system: SystemProfile): BundleValidationResult {
  const budget = ramBudgetGb(system);
  if (bundle.estimatedPeakRamGb > budget) {
    return {
      ok: false,
      userMessage: `This stack expects up to about ${bundle.estimatedPeakRamGb.toFixed(1)} GB of usable memory, but only about ${budget.toFixed(1)} GB looks available right now. A lighter bundle may fit better.`,
    };
  }

  const peakVram = bundle.estimatedPeakVramGb;
  if (peakVram !== undefined && peakVram > 0) {
    const vBudget = vramBudgetGb(system);
    if (vBudget > 0 && peakVram > vBudget * 0.92) {
      return {
        ok: false,
        userMessage:
          "This stack expects more GPU memory than your system likely has free. A CPU-friendlier or smaller model bundle may work better.",
      };
    }
  }

  const freeDisk = system.storageFreeGb;
  if (freeDisk !== undefined) {
    if (freeDisk < 5) {
      return {
        ok: false,
        userMessage:
          "Very little free disk space was detected. Free at least a few gigabytes before downloading models, then try again.",
      };
    }
    const largeText = bundle.textModel?.parameterClass === "large";
    if (largeText && freeDisk < 20) {
      return {
        ok: false,
        userMessage:
          "Large models need plenty of disk space. Free roughly 20+ GB (more is safer) before applying this stack, or pick a smaller bundle.",
      };
    }
    if (freeDisk < 15 && bundle.estimatedPeakRamGb >= 12) {
      return {
        ok: false,
        userMessage:
          "Disk space looks tight for this stack. Free more space or choose a lighter recommendation, then try again.",
      };
    }
  }

  return { ok: true };
}
