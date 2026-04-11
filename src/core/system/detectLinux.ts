import type { ExecaMethod } from "execa";

import { bytesToGb } from "../shared/utils.js";
import type { NativeProbeResult } from "./types.js";

async function maybeCommand(runner: ExecaMethod, command: string, args: string[]): Promise<string | undefined> {
  const result = await runner(command, args, { reject: false });
  if (result.exitCode !== 0) {
    return undefined;
  }

  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  return stdout || undefined;
}

export async function detectLinux(runner: ExecaMethod): Promise<NativeProbeResult> {
  const warnings: string[] = [];

  const nvidiaName = await maybeCommand(runner, "nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"]);
  const nvidiaVram = await maybeCommand(runner, "nvidia-smi", ["--query-gpu=memory.total", "--format=csv,noheader,nounits"]);

  if (nvidiaName) {
    return {
      gpuBackend: "cuda",
      gpuVendor: "nvidia",
      gpuModel: nvidiaName.split("\n")[0],
      gpuVramGb: nvidiaVram ? bytesToGb(Number(nvidiaVram.split("\n")[0]) * 1024 * 1024) : undefined,
      warnings,
    };
  }

  warnings.push("CUDA probe did not find an NVIDIA GPU; using generic Linux hardware data.");
  return {
    gpuBackend: "unknown",
    warnings,
  };
}
