import os from "node:os";
import path from "node:path";

import { APP_NAME, HARDWARE_BANDS } from "./constants.js";
import type { HardwareBand, LoadStrategy, SystemProfile } from "./types.js";

export function bytesToGb(value?: number): number | undefined {
  if (value === undefined || Number.isNaN(value)) {
    return undefined;
  }

  return Math.round((value / 1024 ** 3) * 10) / 10;
}

export function numberToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getHardwareBand(ramGb: number): HardwareBand {
  if (ramGb < 8) {
    return HARDWARE_BANDS[0];
  }

  if (ramGb < 16) {
    return HARDWARE_BANDS[1];
  }

  if (ramGb < 32) {
    return HARDWARE_BANDS[2];
  }

  if (ramGb < 64) {
    return HARDWARE_BANDS[3];
  }

  return HARDWARE_BANDS[4];
}

export function getCacheDir(): string {
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support", APP_NAME);
    case "win32":
      return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), APP_NAME);
    default:
      return path.join(process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share"), APP_NAME);
  }
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function scoreToConfidence(score: number): "low" | "medium" | "high" {
  if (score >= 0.8) {
    return "high";
  }

  if (score >= 0.55) {
    return "medium";
  }

  return "low";
}

export function chooseLoadStrategy(system: SystemProfile, requiresSecondaryModel: boolean): LoadStrategy {
  if (!requiresSecondaryModel && system.hardwareBand !== "tiny") {
    return "always_loaded";
  }

  if (system.hardwareBand === "tiny") {
    return "degraded_local";
  }

  if (system.hardwareBand === "small") {
    return "lightweight_all_local";
  }

  return "on_demand_secondary";
}
