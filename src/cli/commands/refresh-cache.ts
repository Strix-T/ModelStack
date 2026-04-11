import chalk from "chalk";
import ora from "ora";

import { refreshCandidateCache } from "../../core/models/loadCandidates.js";

export async function runRefreshCacheCommand(_options: { force?: boolean }): Promise<void> {
  const spinner = ora("Refreshing candidate cache from Hugging Face").start();
  const { snapshot, filePath } = await refreshCandidateCache();
  spinner.succeed(`Cache written to ${filePath}`);

  process.stdout.write(
    `${chalk.bold("Cache Summary")}\n- Generated: ${snapshot.generatedAt}\n- Seed text candidates: ${snapshot.seedCandidates.text.length}\n- Discovered text candidates: ${snapshot.discoveredCandidates.text.length}\n- Warnings: ${snapshot.warnings.length}\n`,
  );
}
