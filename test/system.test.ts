import { describe, expect, it } from "vitest";

import { detectSystem } from "../src/core/system/detectSystem.js";

describe("detectSystem", () => {
  it("normalizes macOS hardware data", async () => {
    const system = await detectSystem({
      platform: "darwin",
      siImpl: {
        cpu: async () => ({ brand: "Apple M4", manufacturer: "Apple", physicalCores: 10, cores: 10 }),
        mem: async () => ({ total: 32 * 1024 ** 3, available: 20 * 1024 ** 3, free: 20 * 1024 ** 3 }),
        graphics: async () => ({ controllers: [{ model: "Apple GPU", vendor: "Apple", vram: 0 }] }),
        fsSize: async () => [{ size: 1000, used: 100 }],
      } as never,
      execaImpl: (async (command: string) => {
        if (command === "which") {
          return { exitCode: 0, stdout: "/usr/bin/mock" };
        }
        if (command === "system_profiler") {
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              SPDisplaysDataType: [{ sppci_model: "Apple M4", spdisplays_vendor: "spdisplay_vendor_Apple" }],
            }),
          };
        }
        return { exitCode: 0, stdout: "34359738368" };
      }) as never,
    });

    expect(system.os).toBe("macos");
    expect(system.hardwareBand).toBe("large");
    expect(system.gpuBackend).toBe("metal");
  });

  it("normalizes Windows hardware data", async () => {
    const system = await detectSystem({
      platform: "win32",
      siImpl: {
        cpu: async () => ({ brand: "Ryzen", manufacturer: "AMD", physicalCores: 8, cores: 16 }),
        mem: async () => ({ total: 16 * 1024 ** 3, available: 10 * 1024 ** 3, free: 10 * 1024 ** 3 }),
        graphics: async () => ({ controllers: [{ model: "RTX 4060", vendor: "nvidia", vram: 8192 }] }),
        fsSize: async () => [{ size: 500, used: 125 }],
      } as never,
      execaImpl: (async (command: string) => {
        if (command === "where") {
          return { exitCode: 0, stdout: "C:\\mock.exe" };
        }
        return { exitCode: 0, stdout: "{\"Name\":\"RTX 4060\",\"AdapterRAM\":8589934592}" };
      }) as never,
    });

    expect(system.os).toBe("windows");
    expect(system.gpuBackend).toBe("directml");
    expect(system.gpuVramGb).toBeGreaterThan(7);
  });

  it("falls back conservatively on Linux when GPU details are missing", async () => {
    const system = await detectSystem({
      platform: "linux",
      siImpl: {
        cpu: async () => ({ brand: "Intel Core", manufacturer: "Intel", physicalCores: 4, cores: 8 }),
        mem: async () => ({ total: 8 * 1024 ** 3, available: 6 * 1024 ** 3, free: 6 * 1024 ** 3 }),
        graphics: async () => ({ controllers: [] }),
        fsSize: async () => [{ size: 600, used: 200 }],
      } as never,
      execaImpl: (async (command: string) => {
        if (command === "which") {
          return { exitCode: 0, stdout: "/usr/bin/mock" };
        }
        return { exitCode: 1, stdout: "" };
      }) as never,
    });

    expect(system.os).toBe("linux");
    expect(system.confidence).toBe("low");
    expect(system.detectionWarnings.join(" ")).toContain("conservative");
  });

  it("uses the primary mounted volume instead of summing every filesystem", async () => {
    const system = await detectSystem({
      platform: "darwin",
      siImpl: {
        cpu: async () => ({ brand: "Apple M4", manufacturer: "Apple", physicalCores: 10, cores: 10 }),
        mem: async () => ({ total: 24 * 1024 ** 3, available: 14 * 1024 ** 3, free: 14 * 1024 ** 3 }),
        graphics: async () => ({ controllers: [{ model: "Apple GPU", vendor: "Apple", vram: 0 }] }),
        fsSize: async () => [
          { mount: "/", size: 500 * 1024 ** 3, used: 300 * 1024 ** 3, available: 200 * 1024 ** 3 },
          { mount: "/System/Volumes/Data", size: 500 * 1024 ** 3, used: 300 * 1024 ** 3, available: 200 * 1024 ** 3 },
          { mount: "/Library/Developer/CoreSimulator/Volumes/iOS_1", size: 20 * 1024 ** 3, used: 19 * 1024 ** 3, available: 1 * 1024 ** 3 },
        ],
      } as never,
      execaImpl: (async (command: string) => {
        if (command === "which") {
          return { exitCode: 0, stdout: "/usr/bin/mock" };
        }
        if (command === "system_profiler") {
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              SPDisplaysDataType: [{ sppci_model: "Apple M4", spdisplays_vendor: "Apple" }],
            }),
          };
        }
        return { exitCode: 0, stdout: "25769803776" };
      }) as never,
    });

    expect(system.storageFreeGb).toBe(200);
  });

  it("fills macOS GPU from system_profiler when systeminformation omits a controller model", async () => {
    const profilerJson = JSON.stringify({
      SPDisplaysDataType: [{ sppci_model: "Apple M3 Max", spdisplays_vendor: "spdisplay_vendor_Apple" }],
    });
    const system = await detectSystem({
      platform: "darwin",
      siImpl: {
        cpu: async () => ({ brand: "Apple M3 Max", manufacturer: "Apple", physicalCores: 12, cores: 12 }),
        mem: async () => ({ total: 64 * 1024 ** 3, available: 40 * 1024 ** 3, free: 40 * 1024 ** 3 }),
        graphics: async () => ({ controllers: [{ model: "", vendor: "Apple", vram: 0 }] }),
        fsSize: async () => [{ size: 1000, used: 100 }],
      } as never,
      execaImpl: (async (command: string) => {
        if (command === "which") {
          return { exitCode: 0, stdout: "/usr/bin/mock" };
        }
        if (command === "system_profiler") {
          return { exitCode: 0, stdout: profilerJson };
        }
        return { exitCode: 0, stdout: "68719476736" };
      }) as never,
    });

    expect(system.gpuModel).toBe("Apple M3 Max");
    expect(system.detectionWarnings.some((w) => w.includes("system_profiler"))).toBe(false);
  });
});
