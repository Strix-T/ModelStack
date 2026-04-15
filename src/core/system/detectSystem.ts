import os from "node:os";
import path from "node:path";

import { execa } from "execa";
import si from "systeminformation";

import { systemProfileSchema } from "../shared/schemas.js";
import type { GpuBackend, SystemProfile } from "../shared/types.js";
import { bytesToGb, getHardwareBand } from "../shared/utils.js";
import { detectLinux } from "./detectLinux.js";
import { detectMac } from "./detectMac.js";
import { detectWindows } from "./detectWindows.js";
import type { NativeProbeResult } from "./types.js";

export type DetectSystemDeps = {
  execaImpl?: typeof execa;
  siImpl?: typeof si;
  platform?: NodeJS.Platform;
};

async function isCommandAvailable(command: string, deps: DetectSystemDeps): Promise<boolean> {
  const runner = deps.execaImpl ?? execa;
  const lookupCommand = (deps.platform ?? process.platform) === "win32" ? "where" : "which";
  const result = await runner(lookupCommand, [command], { reject: false });
  return result.exitCode === 0;
}

async function detectNativeProbe(deps: DetectSystemDeps): Promise<NativeProbeResult> {
  const runner = deps.execaImpl ?? execa;
  const platform = deps.platform ?? process.platform;

  switch (platform) {
    case "darwin":
      return detectMac(runner);
    case "win32":
      return detectWindows(runner);
    default:
      return detectLinux(runner);
  }
}

function mapOs(platform: NodeJS.Platform): "macos" | "windows" | "linux" {
  switch (platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

function estimateConfidence(warnings: string[], gpuBackend?: GpuBackend): "low" | "medium" | "high" {
  if (warnings.length >= 3) {
    return "low";
  }

  if (warnings.length > 0 || !gpuBackend || gpuBackend === "unknown") {
    return "medium";
  }

  return "high";
}

type FsSizeEntry = Awaited<ReturnType<typeof si.fsSize>>[number];

function getFsFreeBytes(entry: FsSizeEntry): number {
  if (typeof entry.available === "number") {
    return entry.available;
  }

  return Math.max((entry.size ?? 0) - (entry.used ?? 0), 0);
}

function selectPrimaryFs(fsSizes: FsSizeEntry[], platform: NodeJS.Platform): FsSizeEntry | undefined {
  if (fsSizes.length === 0) {
    return undefined;
  }

  if (platform === "darwin") {
    return fsSizes.find((entry) => entry.mount === "/") ??
      fsSizes.find((entry) => entry.mount === "/System/Volumes/Data") ??
      [...fsSizes].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];
  }

  if (platform === "win32") {
    const currentDrive = path.parse(process.cwd()).root.replace(/[\\/]+$/, "").toLowerCase();
    return fsSizes.find((entry) => entry.mount?.toLowerCase().replace(/[\\/]+$/, "") === currentDrive) ??
      [...fsSizes].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];
  }

  return fsSizes.find((entry) => entry.mount === "/") ??
    [...fsSizes].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];
}

export async function detectSystem(deps: DetectSystemDeps = {}): Promise<SystemProfile> {
  const siImpl = deps.siImpl ?? si;
  const platform = deps.platform ?? process.platform;
  const warnings: string[] = [];

  const runner = deps.execaImpl ?? execa;

  const [cpu, mem, graphics, fsSizes, nativeProbe, ollamaInstalled, llamaCppInstalled, pythonInstalled, dockerInstalled, mlxPythonInstalled] =
    await Promise.all([
      siImpl.cpu(),
      siImpl.mem(),
      siImpl.graphics(),
      siImpl.fsSize(),
      detectNativeProbe(deps),
      isCommandAvailable("ollama", deps),
      isCommandAvailable("llama-cli", deps),
      isCommandAvailable("python", deps).then((found) => found || isCommandAvailable("python3", deps)),
      isCommandAvailable("docker", deps),
      runner("python3", ["-c", "import mlx"], { reject: false }).then((r) => r.exitCode === 0),
    ]);

  warnings.push(...nativeProbe.warnings);

  const controller = graphics.controllers.find((item) => item.model || item.vendor);
  const primaryFs = selectPrimaryFs(fsSizes, platform);
  const totalRamGb = bytesToGb(mem.total) ?? bytesToGb(os.totalmem()) ?? 0;
  const freeRamGb = bytesToGb(mem.available ?? mem.free);
  const gpuVramGb = bytesToGb(controller?.vram ? controller.vram * 1024 * 1024 : undefined) ?? nativeProbe.gpuVramGb;
  const storageFreeGb = primaryFs ? bytesToGb(getFsFreeBytes(primaryFs)) : undefined;

  if (!controller?.model && !nativeProbe.gpuModel) {
    warnings.push("GPU model could not be determined; recommendations will bias conservative.");
  }

  if (gpuVramGb === undefined && !nativeProbe.unifiedMemoryGb) {
    warnings.push("GPU memory could not be determined; vision and image generation estimates are conservative.");
  }

  const profile = systemProfileSchema.parse({
    os: mapOs(platform),
    cpuModel: cpu.brand || cpu.manufacturer || "Unknown CPU",
    cpuCores: cpu.physicalCores || cpu.cores || os.cpus().length,
    ramGb: totalRamGb,
    freeRamGb,
    gpuVendor: controller?.vendor || nativeProbe.gpuVendor,
    gpuModel: controller?.model || nativeProbe.gpuModel,
    gpuVramGb,
    unifiedMemoryGb: nativeProbe.unifiedMemoryGb,
    storageFreeGb,
    hardwareBand: getHardwareBand(totalRamGb),
    gpuBackend: nativeProbe.gpuBackend,
    detectionWarnings: warnings,
    confidence: estimateConfidence(warnings, nativeProbe.gpuBackend),
    runtimes: {
      ollamaInstalled,
      llamaCppInstalled,
      pythonInstalled,
      dockerInstalled,
      mlxPythonInstalled,
    },
  });

  return profile;
}
