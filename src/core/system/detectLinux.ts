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

  const rocmProduct = await maybeCommand(runner, "rocm-smi", ["--showproductname"]);
  if (rocmProduct) {
    const line = rocmProduct.split("\n").find((l) => l.trim().length > 0) ?? "AMD GPU";
    return {
      gpuBackend: "rocm",
      gpuVendor: "amd",
      gpuModel: line.trim(),
      warnings,
    };
  }

  const lspci = await maybeCommand(runner, "lspci", []);
  const ls = lspci?.toLowerCase() ?? "";

  if (ls.includes("advanced micro devices") && (ls.includes("vga") || ls.includes("display"))) {
    warnings.push("AMD GPU detected without a working ROCm probe; treat acceleration as uncertain unless you install ROCm.");
    return {
      gpuBackend: "unknown",
      gpuVendor: "amd",
      gpuModel: "AMD GPU (ROCm not confirmed)",
      warnings,
    };
  }

  if (ls.includes("intel corporation") && (ls.includes("iris") || ls.includes("uhd") || ls.includes("graphics"))) {
    warnings.push("Intel integrated graphics detected; local GPU acceleration varies by driver and framework.");
    return {
      gpuBackend: "unknown",
      gpuVendor: "intel",
      gpuModel: "Intel iGPU",
      warnings,
    };
  }

  warnings.push("No NVIDIA GPU or ROCm stack detected; assuming CPU-first Linux unless you add discrete GPU tooling.");
  return {
    gpuBackend: "unknown",
    warnings,
  };
}
