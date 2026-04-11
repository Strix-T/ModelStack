import type { SystemProfile } from "../shared/types.js";
import { renderKeyValueTable } from "./renderTables.js";

export function renderSystem(system: SystemProfile): string {
  return renderKeyValueTable([
    ["OS", system.os],
    ["CPU", `${system.cpuModel} (${system.cpuCores} cores)`],
    ["RAM", `${system.ramGb} GB total${system.freeRamGb ? `, ${system.freeRamGb} GB free` : ""}`],
    ["GPU", system.gpuModel ? `${system.gpuModel}${system.gpuVramGb ? ` (${system.gpuVramGb} GB)` : ""}` : "Unknown"],
    ["Unified Memory", system.unifiedMemoryGb ? `${system.unifiedMemoryGb} GB` : "n/a"],
    ["Storage Free", system.storageFreeGb ? `${system.storageFreeGb} GB` : "Unknown"],
    ["Hardware Band", system.hardwareBand],
    ["Installed Runtimes", [
      system.runtimes.ollamaInstalled ? "Ollama" : null,
      system.runtimes.llamaCppInstalled ? "llama.cpp" : null,
      system.runtimes.pythonInstalled ? "Python" : null,
    ].filter(Boolean).join(", ") || "None detected"],
  ]);
}
