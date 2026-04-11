/**
 * Parse `system_profiler SPDisplaysDataType -json` output for GPU/display controller info.
 * Structure varies by macOS version; this walks the tree defensively.
 */

const DISPLAY_ONLY_NAMES = /^(color lcd|display|built-?in display|lcd)$/i;

function isUsableGpuName(name: string): boolean {
  const t = name.trim();
  if (t.length < 2) {
    return false;
  }
  if (DISPLAY_ONLY_NAMES.test(t)) {
    return false;
  }
  return true;
}

function normalizeVendor(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const v = raw.trim();
  if (v.startsWith("spdisplay_vendor_")) {
    return v.replace(/^spdisplay_vendor_/i, "").replaceAll("_", " ");
  }
  return v || undefined;
}

export type ParsedMacGpu = {
  gpuModel?: string;
  gpuVendor?: string;
};

function readGpuFromObject(obj: Record<string, unknown>): ParsedMacGpu | undefined {
  const modelRaw =
    (typeof obj.sppci_model === "string" && obj.sppci_model) ||
    (typeof obj.sppci_model_and_chipset === "string" && obj.sppci_model_and_chipset) ||
    (typeof obj.sppci_device_type === "string" && obj.sppci_device_type) ||
    undefined;

  const vendorRaw =
    (typeof obj.spdisplays_vendor === "string" && obj.spdisplays_vendor) ||
    (typeof obj.sppdisplays_vendor === "string" && obj.sppdisplays_vendor) ||
    undefined;

  const nameRaw = typeof obj._name === "string" ? obj._name : undefined;

  const model = modelRaw?.trim() || (nameRaw && isUsableGpuName(nameRaw) ? nameRaw.trim() : undefined);
  if (!model) {
    return undefined;
  }

  return {
    gpuModel: model,
    gpuVendor: normalizeVendor(vendorRaw),
  };
}

function walkForGpu(node: unknown): ParsedMacGpu | undefined {
  if (node === null || node === undefined) {
    return undefined;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = walkForGpu(item);
      if (found?.gpuModel) {
        return found;
      }
    }
    return undefined;
  }
  if (typeof node !== "object") {
    return undefined;
  }

  const obj = node as Record<string, unknown>;
  const direct = readGpuFromObject(obj);
  if (direct?.gpuModel) {
    return direct;
  }

  for (const value of Object.values(obj)) {
    const found = walkForGpu(value);
    if (found?.gpuModel) {
      return found;
    }
  }
  return undefined;
}

/**
 * Exported for unit tests with fixture strings.
 */
export function parseMacDisplaysProfilerJson(json: string): ParsedMacGpu {
  try {
    const parsed = JSON.parse(json) as unknown;
    const root = parsed as { SPDisplaysDataType?: unknown };
    if (root.SPDisplaysDataType === undefined) {
      return {};
    }
    return walkForGpu(root.SPDisplaysDataType) ?? {};
  } catch {
    return {};
  }
}
