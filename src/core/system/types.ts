import type { ExecaMethod } from "execa";

export type CommandRunner = ExecaMethod;

export type NativeProbeResult = {
  gpuBackend?: "metal" | "cuda" | "rocm" | "directml" | "unknown";
  gpuVendor?: string;
  gpuModel?: string;
  gpuVramGb?: number;
  unifiedMemoryGb?: number;
  warnings: string[];
};
