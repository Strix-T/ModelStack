import { detectSystem } from "../../core/system/detectSystem.js";

export async function runScanCommand(options: { json?: boolean }): Promise<void> {
  const system = await detectSystem();
  if (options.json) {
    process.stdout.write(`${JSON.stringify(system, null, 2)}\n`);
    return;
  }

  const { renderHeader } = await import("../../core/output/renderHeader.js");
  const { renderSystem } = await import("../../core/output/renderSystem.js");
  const { renderWarnings } = await import("../../core/output/renderWarnings.js");

  process.stdout.write(
    `${renderHeader("System Scan", "Normalized local hardware profile")}\n\n${renderSystem(system)}\n\n${renderWarnings(system.detectionWarnings)}\n`,
  );
}
