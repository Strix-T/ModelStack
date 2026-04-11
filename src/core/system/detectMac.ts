import type { ExecaMethod } from "execa";

import { bytesToGb } from "../shared/utils.js";
import { parseMacDisplaysProfilerJson } from "./parseMacGpu.js";
import type { NativeProbeResult } from "./types.js";

async function runCommand(runner: ExecaMethod, command: string, args: string[]): Promise<string | undefined> {
  const result = await runner(command, args, { reject: false });
  if (result.exitCode !== 0) {
    return undefined;
  }

  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  return stdout || undefined;
}

export async function detectMac(runner: ExecaMethod): Promise<NativeProbeResult> {
  const warnings: string[] = [];
  const sysctlMem = await runCommand(runner, "sysctl", ["-n", "hw.memsize"]);
  const gpuJson = await runCommand(runner, "system_profiler", ["SPDisplaysDataType", "-json"]);

  let gpuModel: string | undefined;
  let gpuVendor: string | undefined;

  if (gpuJson) {
    const parsed = parseMacDisplaysProfilerJson(gpuJson);
    gpuModel = parsed.gpuModel;
    gpuVendor = parsed.gpuVendor;
  }

  if (!gpuModel) {
    warnings.push("macOS GPU probe could not determine a reliable GPU model from system_profiler.");
  }

  return {
    gpuBackend: "metal",
    unifiedMemoryGb: sysctlMem ? bytesToGb(Number(sysctlMem)) : undefined,
    gpuModel,
    gpuVendor,
    warnings,
  };
}
