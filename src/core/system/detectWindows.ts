import type { ExecaMethod } from "execa";

import { bytesToGb } from "../shared/utils.js";
import type { NativeProbeResult } from "./types.js";

export async function detectWindows(runner: ExecaMethod): Promise<NativeProbeResult> {
  const warnings: string[] = [];
  const result = await runner(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress",
    ],
    { reject: false },
  );

  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  if (result.exitCode !== 0 || !stdout) {
    warnings.push("Windows GPU probe returned no adapter details.");
    return {
      gpuBackend: "unknown",
      warnings,
    };
  }

  try {
    const parsed = JSON.parse(stdout) as { Name?: string; AdapterRAM?: number } | Array<{ Name?: string; AdapterRAM?: number }>;
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    return {
      gpuBackend: "directml",
      gpuModel: first?.Name,
      gpuVramGb: bytesToGb(first?.AdapterRAM),
      warnings,
    };
  } catch {
    warnings.push("Windows GPU probe returned malformed JSON.");
    return {
      gpuBackend: "unknown",
      warnings,
    };
  }
}
