import { getEngineDefinition } from "./engineRegistry.js";
import { candidateSupportsEngine, formatMatchesEngine } from "./engineCompatibility.js";
import type { CandidateModel, EngineId, SystemProfile, UserIntent } from "../shared/types.js";

export type EngineSelection = {
  primary: EngineId;
  fallback: EngineId;
  reasons: string[];
  warnings: string[];
};

function isAppleSilicon(system: SystemProfile): boolean {
  return system.os === "macos" && /\bApple M\d/.test(system.cpuModel);
}

function installDifficultyRank(d: "simple" | "moderate" | "advanced"): number {
  switch (d) {
    case "simple":
      return 0;
    case "moderate":
      return 1;
    default:
      return 2;
  }
}

function comfortAllowsEngine(system: SystemProfile, engine: EngineId, comfort: UserIntent["installComfort"]): boolean {
  const def = getEngineDefinition(engine);
  return installDifficultyRank(def.installDifficulty) <= installDifficultyRank(comfort === "simple" ? "simple" : comfort === "moderate" ? "moderate" : "advanced");
}

function engineUsableOnSystem(engine: EngineId, system: SystemProfile): boolean {
  if (engine === "mlx" && (!isAppleSilicon(system) || system.os !== "macos")) {
    return false;
  }
  if (engine === "vllm" && (system.os !== "linux" || system.gpuBackend !== "cuda")) {
    return false;
  }
  return true;
}

function engineRuntimeReady(engine: EngineId, system: SystemProfile): boolean {
  switch (engine) {
    case "ollama":
      return system.runtimes.ollamaInstalled;
    case "llamacpp":
      return system.runtimes.llamaCppInstalled;
    case "lm_studio":
      return system.runtimes.lmStudioInstalled === true;
    case "transformers":
    case "vllm":
      return system.runtimes.pythonInstalled || system.runtimes.dockerInstalled === true;
    case "mlx":
      return system.runtimes.mlxPythonInstalled === true || system.runtimes.pythonInstalled;
    default:
      return true;
  }
}

function scoreEngineCandidate(
  engine: EngineId,
  system: SystemProfile,
  intent: UserIntent,
  preferred: UserIntent["preferredEngine"],
): number {
  let score = 0;
  const def = getEngineDefinition(engine);

  if (preferred !== "auto" && preferred === engine) {
    score += 4;
  }

  if (engineRuntimeReady(engine, system)) {
    score += 2.5;
  }

  if (comfortAllowsEngine(system, engine, intent.installComfort)) {
    score += 1;
  }

  if (intent.requiresImageGeneration && def.supportsImageGenerationWell) {
    score += 1.5;
  } else if (intent.requiresVision && def.supportsVisionWell) {
    score += 0.8;
  }

  if (intent.formatPreference === "gguf" && def.supportsFormats.includes("gguf")) {
    score += 0.6;
  }
  if (intent.formatPreference === "safetensors" && def.supportsFormats.includes("safetensors")) {
    score += 0.6;
  }

  if (isAppleSilicon(system)) {
    score += def.goodForAppleSilicon ? 0.7 : -0.5;
  } else if (system.os === "windows") {
    score += def.goodForWindows ? 0.4 : 0;
  } else if (system.os === "linux") {
    score += def.goodForLinux ? 0.4 : 0;
  }

  if (intent.installComfort === "simple" && def.installDifficulty === "simple") {
    score += 1.2;
  }

  if (engine === "vllm" && intent.installComfort !== "advanced") {
    score -= 2;
  }

  return score;
}

function orderedEnginesForAuto(system: SystemProfile, intent: UserIntent): EngineId[] {
  const all: EngineId[] = ["ollama", "lm_studio", "llamacpp", "transformers", "mlx", "vllm", "other"];
  return all
    .filter((e) => engineUsableOnSystem(e, system))
    .sort((a, b) => scoreEngineCandidate(b, system, intent, "auto") - scoreEngineCandidate(a, system, intent, "auto"));
}

/**
 * Picks the best concrete engine for a specific model (skips the generic "other" bucket).
 * Used when the planner would otherwise label the stack as "other" even though weights are GGUF/Safetensors.
 */
export function selectConcreteEnginePairForCandidate(
  candidate: CandidateModel,
  system: SystemProfile,
  intent: UserIntent,
): { primary: EngineId; fallback: EngineId } {
  const ordered = orderedEnginesForAuto(system, intent).filter((e) => engineUsableOnSystem(e, system) && e !== "other");
  const compatible = ordered.filter(
    (e) => candidateSupportsEngine(candidate, e) && formatMatchesEngine(e, candidate.formats, intent.formatPreference),
  );
  const primary = compatible[0] ?? "other";
  if (primary === "other") {
    return { primary: "other", fallback: "transformers" };
  }
  const fallback =
    compatible.find((e) => e !== primary) ??
    (primary === "ollama" ? "llamacpp" : primary === "llamacpp" || primary === "lm_studio" ? "ollama" : "ollama");
  return { primary, fallback };
}

export function selectEngine(system: SystemProfile, intent: UserIntent, textAnchor?: CandidateModel): EngineSelection {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const preferred = intent.preferredEngine;

  if (preferred !== "auto") {
    const mapped = preferred as EngineId;
    const usable = engineUsableOnSystem(mapped, system);
    const modelOk = !textAnchor || candidateSupportsEngine(textAnchor, mapped);
    if (usable && modelOk) {
      reasons.push(`Using ${getEngineDefinition(mapped).label} because you selected it explicitly.`);
      // Fallback is a planner hint for "next engine to try" if the primary pool is empty — not
      // derived from what is already installed; the user may install the stack they chose.
      const fb: EngineId =
        mapped === "ollama"
          ? "llamacpp"
          : mapped === "transformers"
            ? "ollama"
            : mapped === "llamacpp" || mapped === "lm_studio"
              ? "ollama"
              : mapped === "vllm" || mapped === "mlx"
                ? "transformers"
                : "other";
      return { primary: mapped, fallback: fb, reasons, warnings };
    }
    if (!usable) {
      warnings.push(
        `${getEngineDefinition(mapped).label} is not ideal for this OS or GPU backend; falling back to an automatic choice.`,
      );
    }
    if (!modelOk) {
      warnings.push(
        `Your preferred engine does not match the primary model's published runtimes; choosing a compatible engine instead.`,
      );
    }
  }

  const candidates = orderedEnginesForAuto(system, intent).filter((e) => engineUsableOnSystem(e, system));

  const pickWithText = candidates.filter((e) => !textAnchor || candidateSupportsEngine(textAnchor, e));
  const pool = pickWithText.length > 0 ? pickWithText : candidates;

  const primary = pool[0] ?? "other";
  const fallback = pool.find((e) => e !== primary) ?? "other";

  const def = getEngineDefinition(primary);
  reasons.push(`Selected ${def.label} based on your hardware, install comfort, and workload.`);
  if (!engineRuntimeReady(primary, system)) {
    warnings.push(`${def.label} was not detected on PATH; install it before pulling models.`);
  }

  return { primary, fallback, reasons, warnings };
}
