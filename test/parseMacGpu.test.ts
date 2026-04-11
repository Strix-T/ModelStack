import { describe, expect, it } from "vitest";

import { parseMacDisplaysProfilerJson } from "../src/core/system/parseMacGpu.js";

describe("parseMacDisplaysProfilerJson", () => {
  it("reads Apple Silicon GPU from SPDisplaysDataType array", () => {
    const json = JSON.stringify({
      SPDisplaysDataType: [
        {
          _name: "spdisplays_display",
          sppci_model: "Apple M4",
          spdisplays_vendor: "spdisplay_vendor_Apple",
        },
      ],
    });
    expect(parseMacDisplaysProfilerJson(json)).toEqual({
      gpuModel: "Apple M4",
      gpuVendor: "Apple",
    });
  });

  it("finds GPU in nested spdisplays_ndrvs-style structure", () => {
    const json = JSON.stringify({
      SPDisplaysDataType: [
        {
          _name: "Color LCD",
          spdisplays_ndrvs: [
            {
              _name: "Apple M3 Pro",
              sppci_model: "Apple M3 Pro",
              spdisplays_vendor: "Apple",
            },
          ],
        },
      ],
    });
    expect(parseMacDisplaysProfilerJson(json).gpuModel).toBe("Apple M3 Pro");
  });

  it("prefers sppci_model over generic display _name", () => {
    const json = JSON.stringify({
      SPDisplaysDataType: [
        {
          _name: "Color LCD",
          sppci_model: "Apple M2",
        },
      ],
    });
    expect(parseMacDisplaysProfilerJson(json).gpuModel).toBe("Apple M2");
  });

  it("returns empty object for invalid JSON", () => {
    expect(parseMacDisplaysProfilerJson("not json")).toEqual({});
  });

  it("returns empty object when SPDisplaysDataType is missing", () => {
    expect(parseMacDisplaysProfilerJson("{}")).toEqual({});
  });
});
